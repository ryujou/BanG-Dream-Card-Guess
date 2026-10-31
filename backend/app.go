package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/disintegration/imaging"
	qrcode "github.com/skip2/go-qrcode"
	_ "golang.org/x/image/webp"
)

type AppOptions struct {
	RootDir, DataDir, ResourceDir, PublicDir   string
	PublicOrigin, DevOrigin, BootstrapPassword string
}
type App struct {
	store                               *Store
	sessions                            *Sessions
	scores                              *Scores
	limiter                             *Limiter
	cards, sekaiCards, blueArchiveCards *Cards
	roomsMu                             sync.Mutex
	rooms, solos                        map[string]*Game
	wsMu                                sync.Mutex
	wsCount                             int
	wsByIP                              map[string]int
	origin                              string
	allowedOrigins                      map[string]bool
	root, dataDir, publicDir            string
	started                             time.Time
	mux                                 *http.ServeMux
	done                                chan struct{}
	closeOnce                           sync.Once
	stopOnce                            sync.Once
	errorMu                             sync.Mutex
	errors                              []Obj
}

func valueOr(value, fallback string) string {
	if value != "" {
		return value
	}
	return fallback
}
func resolveDir(root, value string) string {
	if filepath.IsAbs(value) {
		return value
	}
	return filepath.Join(root, value)
}
func (a *App) cardsForTheme(theme string) *Cards {
	switch theme {
	case "sekai":
		return a.sekaiCards
	case "bluearchive":
		return a.blueArchiveCards
	default:
		return a.cards
	}
}
func NewApp(options AppOptions) (*App, error) {
	root := options.RootDir
	if root == "" {
		var err error
		root, err = os.Getwd()
		if err != nil {
			return nil, err
		}
	}
	origin := valueOr(options.PublicOrigin, valueOr(os.Getenv("PUBLIC_ORIGIN"), "http://127.0.0.1:5173"))
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("PUBLIC_ORIGIN 必须为 HTTP/HTTPS 网站地址")
	}
	origin = u.Scheme + "://" + u.Host
	dataDir := resolveDir(root, valueOr(options.DataDir, valueOr(os.Getenv("DATA_DIR"), "data")))
	publicDir := resolveDir(root, valueOr(options.PublicDir, "public"))
	resourceDir := resolveDir(root, valueOr(options.ResourceDir, "resource"))
	store, err := NewStore(filepath.Join(dataDir, "app.sqlite"), valueOr(options.BootstrapPassword, os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")))
	if err != nil {
		return nil, err
	}
	cards, err := NewCards(resourceDir, filepath.Join(publicDir, "cards"), "bangdream")
	if err != nil {
		store.Close()
		return nil, err
	}
	sekai, err := NewCards(filepath.Join(resourceDir, "sekai"), filepath.Join(publicDir, "cards", "sekai"), "sekai")
	if err != nil {
		store.Close()
		return nil, err
	}
	blueArchive, err := NewCards(filepath.Join(resourceDir, "bluearchive"), filepath.Join(publicDir, "cards", "bluearchive"), "bluearchive")
	if err != nil {
		store.Close()
		return nil, err
	}
	if err = os.MkdirAll(filepath.Join(dataDir, "uploads"), 0700); err != nil {
		store.Close()
		return nil, err
	}
	a := &App{store: store, cards: cards, sekaiCards: sekai, blueArchiveCards: blueArchive, limiter: NewLimiter(), rooms: map[string]*Game{}, solos: map[string]*Game{}, origin: origin, allowedOrigins: map[string]bool{origin: true}, root: root, dataDir: dataDir, publicDir: publicDir, started: time.Now(), mux: http.NewServeMux(), done: make(chan struct{})}
	if dev := valueOr(options.DevOrigin, os.Getenv("DEV_ORIGIN")); dev != "" {
		a.allowedOrigins[dev] = true
	}
	a.sessions = NewSessions(store, u.Scheme == "https", func(id string) {
		a.roomsMu.Lock()
		defer a.roomsMu.Unlock()
		for _, g := range a.rooms {
			g.RevokeSession(id)
		}
		for key, g := range a.solos {
			if g.OwnerID == id {
				g.Dispose("单人会话已结束")
				delete(a.solos, key)
			}
		}
	})
	a.scores = NewScores(store)
	a.routes()
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case now := <-ticker.C:
				a.sweep(now)
			case <-a.done:
				return
			}
		}
	}()
	return a, nil
}
func (a *App) StopRealtime() {
	a.stopOnce.Do(func() {
		close(a.done)
		a.scores.Close()
		a.roomsMu.Lock()
		for _, g := range a.rooms {
			g.Dispose("服务正在重启")
		}
		for _, g := range a.solos {
			g.Dispose("服务正在重启")
		}
		a.roomsMu.Unlock()
	})
}
func (a *App) Close() {
	a.closeOnce.Do(func() {
		a.StopRealtime()
		if err := a.store.Close(); err != nil {
			log.Printf("close database: %v", err)
		}
	})
}
func (a *App) requestError(err error) {
	var failure *HTTPError
	if errors.As(err, &failure) && failure.Status < 500 {
		return
	}
	a.errorMu.Lock()
	defer a.errorMu.Unlock()
	a.errors = append([]Obj{{"at": time.Now().UnixMilli(), "message": "服务请求失败"}}, a.errors...)
	if len(a.errors) > 20 {
		a.errors = a.errors[:20]
	}
}
func (a *App) recentErrors() []Obj {
	a.errorMu.Lock()
	defer a.errorMu.Unlock()
	return append([]Obj{}, a.errors...)
}
func (a *App) sweep(now time.Time) {
	a.sessions.Sweep()
	a.limiter.Sweep()
	a.roomsMu.Lock()
	defer a.roomsMu.Unlock()
	for code, g := range a.rooms {
		if g.HostCount() == 0 && now.Sub(g.LastHostSeenAt()) >= 2*time.Hour {
			g.Dispose("主持离线超过两小时，房间已关闭")
			delete(a.rooms, code)
		}
	}
	for id, g := range a.solos {
		if g.ClientCount() == 0 && now.Sub(g.LastActiveAt()) >= 2*time.Hour {
			g.Dispose("单人对局已超时")
			delete(a.solos, id)
		}
	}
}
func (a *App) session(r *http.Request) *Session {
	cookie, err := r.Cookie("xtbang_session")
	if err != nil {
		return nil
	}
	return a.sessions.Get(cookie.Value)
}
func (a *App) requireUser(r *http.Request, admin bool) (*User, error) {
	return a.sessions.Require(r, admin)
}
func (a *App) limit(key string, max int, window time.Duration) error {
	if !a.limiter.Allow(key, max, window) {
		return httpError(429, "请求过于频繁，请稍后再试")
	}
	return nil
}
func (a *App) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-a.done:
			writeError(w, httpError(503, "服务正在重启"))
			return
		default:
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		if r.Method == "POST" || r.Method == "PUT" || r.Method == "PATCH" || r.Method == "DELETE" {
			if !a.allowedOrigins[r.Header.Get("Origin")] {
				writeError(w, httpError(403, "请求来源无效"))
				return
			}
			s := a.session(r)
			if s == nil || r.Header.Get("X-CSRF-Token") != s.CSRFToken {
				writeError(w, httpError(403, "页面会话已更新，请刷新后重试"))
				return
			}
		}
		a.mux.ServeHTTP(w, r)
	})
}
func (a *App) jsonRoute(pattern string, status int, handler func(http.ResponseWriter, *http.Request) (any, error)) {
	a.mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
		result, err := handler(w, r)
		if err != nil {
			a.requestError(err)
			writeError(w, err)
			return
		}
		writeJSON(w, status, result)
	})
}
func (a *App) manage(r *http.Request, code string) (*Game, error) {
	user, err := a.requireUser(r, false)
	if err != nil {
		return nil, err
	}
	a.roomsMu.Lock()
	g := a.rooms[strings.ToUpper(code)]
	a.roomsMu.Unlock()
	if g == nil {
		return nil, httpError(404, "房间不存在或已关闭")
	}
	if user.Role != "super_admin" && g.OwnerID != user.ID {
		return nil, httpError(403, "无权管理该房间")
	}
	return g, nil
}
func (a *App) closeOwner(id string) {
	a.roomsMu.Lock()
	defer a.roomsMu.Unlock()
	for code, g := range a.rooms {
		if g.OwnerID == id {
			g.Dispose("主持账号不可用")
			delete(a.rooms, code)
		}
	}
}
func (a *App) settings() (Obj, error) {
	v, err := a.store.GetValue("game", DefaultSettings())
	return asObject(v), err
}
func (a *App) routes() {
	a.jsonRoute("GET /api/health", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		a.roomsMu.Lock()
		n := len(a.rooms)
		a.roomsMu.Unlock()
		return Obj{"ok": true, "uptimeMs": time.Since(a.started).Milliseconds(), "activeRooms": n, "cardCount": a.cards.Count(), "sekaiCardCount": a.sekaiCards.Count(), "blueArchiveCardCount": a.blueArchiveCards.Count()}, nil
	})
	a.jsonRoute("GET /api/auth/me", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		s, err := a.sessions.Ensure(w, r)
		if err != nil {
			return nil, err
		}
		u, err := a.sessions.User(s)
		return Obj{"user": u, "csrfToken": s.CSRFToken}, err
	})
	a.jsonRoute("POST /api/auth/login", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		ip := ClientIP(r)
		if err := a.limit("login-ip:"+ip, 50, 10*time.Minute); err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 16<<10)
		if err != nil {
			return nil, err
		}
		username, usernameOK := b["username"].(string)
		password, passwordOK := b["password"].(string)
		name := NormalizeUsername(username)
		if !usernameOK || !passwordOK || !validUsername(name) || passwordLength(password) > 128 {
			return nil, httpError(400, "用户名或密码格式无效")
		}
		pairKey, accountKey := "login-pair:"+ip+":"+name, "login-account:"+name
		for _, item := range []struct {
			key string
			max int
		}{{pairKey, 10}, {accountKey, 30}} {
			if err = a.limit(item.key, item.max, 10*time.Minute); err != nil {
				return nil, err
			}
		}
		u, err := a.store.Authenticate(name, password)
		if err != nil {
			return nil, err
		}
		if u == nil {
			return nil, httpError(403, "用户名或密码错误")
		}
		if old := a.session(r); old != nil {
			a.sessions.Revoke(old.ID)
		}
		r.Header.Del("Cookie")
		s, err := a.sessions.Ensure(w, r)
		if err != nil {
			return nil, err
		}
		s, err = a.sessions.Mutate(s.ID, func(s *Session) error {
			latest, err := a.store.User(u.ID)
			if err != nil {
				return err
			}
			if latest == nil || !latest.Enabled || latest.UpdatedAt != u.UpdatedAt {
				return httpError(403, "账号信息已变化，请重新登录")
			}
			s.UserID = u.ID
			return nil
		})
		if err != nil {
			return nil, err
		}
		a.limiter.Refund(pairKey)
		a.limiter.Refund(accountKey)
		return Obj{"user": u, "csrfToken": s.CSRFToken}, nil
	})
	a.jsonRoute("POST /api/auth/logout", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		if s := a.session(r); s != nil {
			a.sessions.Revoke(s.ID)
		}
		http.SetCookie(w, &http.Cookie{Name: "xtbang_session", Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: strings.HasPrefix(a.origin, "https:"), SameSite: http.SameSiteLaxMode})
		return Obj{"ok": true}, nil
	})
	a.jsonRoute("POST /api/auth/change-password", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		u, err := a.requireUser(r, false)
		if err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		current, err := a.store.Authenticate(u.Username, asString(b["currentPassword"]))
		if err != nil {
			return nil, err
		}
		if current == nil {
			return nil, httpError(403, "当前密码错误")
		}
		if err = a.store.ResetPassword(u.ID, asString(b["newPassword"])); err != nil {
			return nil, err
		}
		a.sessions.RevokeUser(u.ID)
		http.SetCookie(w, &http.Cookie{Name: "xtbang_session", Path: "/", MaxAge: -1, HttpOnly: true, Secure: strings.HasPrefix(a.origin, "https:"), SameSite: http.SameSiteLaxMode})
		return Obj{"ok": true, "reauthRequired": true}, nil
	})
	a.jsonRoute("GET /api/admin/users", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		if _, err := a.requireUser(r, true); err != nil {
			return nil, err
		}
		u, err := a.store.Users()
		return Obj{"users": u}, err
	})
	a.jsonRoute("POST /api/admin/users", 201, func(w http.ResponseWriter, r *http.Request) (any, error) {
		if _, err := a.requireUser(r, true); err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		u, err := a.store.CreateUser(b)
		return Obj{"user": u}, err
	})
	a.jsonRoute("PATCH /api/admin/users/{id}", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		actor, err := a.requireUser(r, true)
		if err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		before, err := a.store.User(r.PathValue("id"))
		if err != nil {
			return nil, err
		}
		u, err := a.store.UpdateUser(r.PathValue("id"), b, actor.ID)
		if err != nil {
			return nil, err
		}
		if !u.Enabled || before.Role != u.Role {
			a.sessions.RevokeUser(u.ID)
			if !u.Enabled {
				a.closeOwner(u.ID)
			}
		}
		return Obj{"user": u}, nil
	})
	a.jsonRoute("DELETE /api/admin/users/{id}", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		actor, err := a.requireUser(r, true)
		if err != nil {
			return nil, err
		}
		id := r.PathValue("id")
		if err = a.store.DeleteUser(id, actor.ID); err != nil {
			return nil, err
		}
		a.sessions.RevokeUser(id)
		a.closeOwner(id)
		return Obj{"ok": true}, nil
	})
	a.jsonRoute("POST /api/admin/users/{id}/reset-password", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		if _, err := a.requireUser(r, true); err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		id := r.PathValue("id")
		if err = a.store.ResetPassword(id, asString(b["password"])); err != nil {
			return nil, err
		}
		a.sessions.RevokeUser(id)
		return Obj{"ok": true}, nil
	})
	a.jsonRoute("GET /api/rooms", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		u, err := a.requireUser(r, false)
		if err != nil {
			return nil, err
		}
		a.roomsMu.Lock()
		defer a.roomsMu.Unlock()
		rooms := []Obj{}
		for _, g := range a.rooms {
			if u.Role == "super_admin" || g.OwnerID == u.ID {
				rooms = append(rooms, g.Summary())
			}
		}
		sort.Slice(rooms, func(i, j int) bool {
			if number(rooms[i]["createdAt"]) == number(rooms[j]["createdAt"]) {
				return asString(rooms[i]["code"]) < asString(rooms[j]["code"])
			}
			return number(rooms[i]["createdAt"]) < number(rooms[j]["createdAt"])
		})
		return Obj{"rooms": rooms, "limits": Obj{"perUser": 5, "total": 30}}, nil
	})
	a.jsonRoute("POST /api/rooms", 201, func(w http.ResponseWriter, r *http.Request) (any, error) {
		u, err := a.requireUser(r, false)
		if err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		settings, err := a.settings()
		if err != nil {
			return nil, err
		}
		cards := a.cardsForTheme(asString(b["theme"]))
		theme := cards.Theme
		a.roomsMu.Lock()
		defer a.roomsMu.Unlock()
		if len(a.rooms) >= 30 {
			return nil, httpError(409, "全站活跃房间已达到30个上限")
		}
		count := 0
		for _, g := range a.rooms {
			if g.OwnerID == u.ID {
				count++
			}
		}
		if count >= 5 {
			return nil, httpError(409, "每个账号最多创建5个活跃房间")
		}
		alphabet := "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
		code := ""
		for {
			b := make([]byte, 6)
			if _, err = rand.Read(b); err != nil {
				return nil, err
			}
			for i := range b {
				b[i] = alphabet[int(b[i])%len(alphabet)]
			}
			code = string(b)
			if a.rooms[code] == nil {
				break
			}
		}
		name := strings.TrimSpace(asString(b["name"]))
		if name == "" {
			name = u.DisplayName + "的舞台"
		}
		name = truncate(name, 40)
		g := NewGame(cards, code, name, u.ID, "booth", NormalizeSettings(ThemeSettings(settings, theme), asObject(b["settings"]), theme))
		a.rooms[code] = g
		return Obj{"room": g.Summary()}, nil
	})
	a.jsonRoute("GET /api/rooms/{code}", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		g, err := a.manage(r, r.PathValue("code"))
		if err != nil {
			return nil, err
		}
		summary := g.Summary()
		theme := asString(summary["theme"])
		cards := a.cardsForTheme(theme)
		return Obj{"room": summary, "settings": g.SettingsCopy(), "meta": GameMeta(cards.FaceBoxImages(), theme), "teams": g.Teams()}, nil
	})
	a.jsonRoute("PATCH /api/rooms/{code}", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		g, err := a.manage(r, r.PathValue("code"))
		if err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		g.Rename(truncate(strings.TrimSpace(asString(b["name"])), 40))
		return Obj{"room": g.Summary()}, nil
	})
	a.jsonRoute("DELETE /api/rooms/{code}", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		g, err := a.manage(r, r.PathValue("code"))
		if err != nil {
			return nil, err
		}
		a.roomsMu.Lock()
		delete(a.rooms, g.Code)
		a.roomsMu.Unlock()
		g.Dispose("主持已关闭房间")
		return Obj{"ok": true}, nil
	})
	a.jsonRoute("PATCH /api/rooms/{code}/settings", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		g, err := a.manage(r, r.PathValue("code"))
		if err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		if err = g.UpdateSettings(b); err != nil {
			return nil, err
		}
		return Obj{"settings": g.SettingsCopy()}, nil
	})
	a.jsonRoute("POST /api/solo", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		s := a.session(r)
		if s == nil {
			return nil, httpError(403, "会话已失效，请刷新后重试")
		}
		cards := a.cardsForTheme(asString(b["theme"]))
		theme := cards.Theme
		settings, err := a.settings()
		if err != nil {
			return nil, err
		}
		var id string
		_, err = a.sessions.Mutate(s.ID, func(s *Session) error {
			a.roomsMu.Lock()
			defer a.roomsMu.Unlock()
			id = s.SoloID
			if theme == "sekai" {
				id = s.SekaiSoloID
			} else if theme == "bluearchive" {
				id = s.BlueArchiveSoloID
			}
			if a.solos[id] != nil {
				return nil
			}
			if err := a.limit("solo:"+ClientIP(r), 20, time.Minute); err != nil {
				return err
			}
			if len(a.solos) >= 100 {
				return httpError(503, "单人舞台已满，请稍后再试")
			}
			id = randomID()
			name := "我的单人舞台"
			if theme == "sekai" {
				name = "世界计划单人舞台"
			} else if theme == "bluearchive" {
				name = "蔚蓝档案单人舞台"
			}
			a.solos[id] = NewGame(cards, id, name, s.ID, "solo", ThemeSettings(settings, theme))
			if theme == "sekai" {
				s.SekaiSoloID = id
			} else if theme == "bluearchive" {
				s.BlueArchiveSoloID = id
			} else {
				s.SoloID = id
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
		return Obj{"id": id}, nil
	})
	a.jsonRoute("GET /api/settings", 200, func(w http.ResponseWriter, r *http.Request) (any, error) { return a.settings() })
	a.jsonRoute("GET /api/settings/meta", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		cards := a.cardsForTheme(r.URL.Query().Get("theme"))
		return GameMeta(cards.FaceBoxImages(), cards.Theme), nil
	})
	a.jsonRoute("PUT /api/settings", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		if _, err := a.requireUser(r, true); err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		base, err := a.settings()
		if err != nil {
			return nil, err
		}
		s := NormalizeSettings(base, b, "bangdream")
		return s, a.store.SetValue("game", s)
	})
	a.jsonRoute("GET /api/stopwatch-settings", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		s, err := a.settings()
		if err != nil {
			return nil, err
		}
		return Obj{"targetSeconds": s["stopwatchTargetSeconds"], "toleranceSeconds": s["stopwatchToleranceSeconds"]}, nil
	})
	a.jsonRoute("GET /api/community", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		w.Header().Set("Cache-Control", "no-store")
		return a.store.GetValue("community", Obj{"aboutUs": "一起听见，属于我们的声音。欢迎来到湘潭 BanG Dream! 同好会。", "socialLinks": []any{}, "members": []any{}, "events": []any{}, "photos": []any{}, "bilibili": []any{}})
	})
	a.jsonRoute("PUT /api/community", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		if _, err := a.requireUser(r, true); err != nil {
			return nil, err
		}
		b, err := readBody(w, r, 1<<20)
		if err != nil {
			return nil, err
		}
		for _, field := range []string{"socialLinks", "members", "events", "photos"} {
			if _, ok := b[field].([]any); !ok {
				return nil, httpError(400, field+"格式无效")
			}
		}
		if _, ok := b["aboutUs"].(string); !ok {
			return nil, httpError(400, "介绍格式无效")
		}
		return b, a.store.SetValue("community", b)
	})
	a.jsonRoute("POST /api/uploads", 200, a.upload)
	a.jsonRoute("GET /api/network", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		return Obj{"publicOrigin": a.origin, "currentOrigin": a.origin, "urls": Obj{"home": a.origin, "player": a.origin + "/join", "login": a.origin + "/login", "solo": a.origin + "/solo"}}, nil
	})
	a.jsonRoute("GET /api/diagnostics", 200, func(w http.ResponseWriter, r *http.Request) (any, error) {
		if _, err := a.requireUser(r, true); err != nil {
			return nil, err
		}
		users, err := a.store.Users()
		if err != nil {
			return nil, err
		}
		rows, err := a.store.ScoreRows("note")
		if err != nil {
			return nil, err
		}
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		a.roomsMu.Lock()
		defer a.roomsMu.Unlock()
		clients := 0
		for _, g := range a.rooms {
			clients += g.ClientCount()
		}
		for _, g := range a.solos {
			clients += g.ClientCount()
		}
		return Obj{"uptime": int(time.Since(a.started).Seconds()), "rooms": len(a.rooms), "soloGames": len(a.solos), "clients": clients, "users": len(users), "scores": len(rows), "cardCount": a.cards.Count(), "publicOrigin": a.origin, "memory": Obj{"systemAllocated": m.Sys, "heapUsed": m.HeapAlloc}, "errors": a.recentErrors(), "runtime": "go"}, nil
	})
	a.jsonRoute("GET /api/stats", 200, a.stats)
	a.mux.HandleFunc("GET /api/qr", a.qr)
	a.mux.HandleFunc("GET /bestdori/", a.bestdori)
	a.mux.HandleFunc("GET /ws", a.handleWebSocket)
	a.mux.Handle("GET /uploads/", privateFiles(filepath.Join(a.dataDir, "uploads"), "/uploads/"))
	a.mux.Handle("GET /cards/", privateFiles(filepath.Join(a.publicDir, "cards"), "/cards/"))
	RegisterScores(a.mux, a)
	a.mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, httpError(404, "接口或文件不存在"))
	})
}
func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}
func privateFiles(root, prefix string) http.Handler {
	fs := http.StripPrefix(prefix, http.FileServer(http.Dir(root)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(r.URL.Path, prefix)
		for _, part := range strings.Split(rel, "/") {
			if strings.HasPrefix(part, ".") || strings.Contains(part, "\\") {
				writeError(w, httpError(404, "文件不存在"))
				return
			}
		}
		file := filepath.Join(root, filepath.FromSlash(rel))
		info, err := os.Stat(file)
		if err != nil || info.IsDir() {
			writeError(w, httpError(404, "文件不存在"))
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=86400")
		fs.ServeHTTP(w, r)
	})
}
func (a *App) upload(w http.ResponseWriter, r *http.Request) (any, error) {
	if _, err := a.requireUser(r, true); err != nil {
		return nil, err
	}
	b, err := readBody(w, r, 7<<20)
	if err != nil {
		return nil, err
	}
	raw := asString(b["image"])
	header, payload, ok := strings.Cut(raw, ",")
	if !ok {
		return nil, httpError(400, "请选择 PNG、JPEG 或 WebP 图片")
	}
	if header != "data:image/png;base64" && header != "data:image/jpeg;base64" && header != "data:image/jpg;base64" && header != "data:image/webp;base64" {
		return nil, httpError(400, "请选择 PNG、JPEG 或 WebP 图片")
	}
	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, httpError(400, "图片无法解析")
	}
	if len(data) > 5<<20 {
		return nil, httpError(400, "图片不能超过5MB")
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "png" && format != "jpeg" && format != "webp") || int64(config.Width)*int64(config.Height) > 16777216 {
		return nil, httpError(400, "图片无法解析，请使用尺寸不超过1600万像素的 PNG、JPEG 或 WebP 图片")
	}
	img, err := imaging.Decode(bytes.NewReader(data), imaging.AutoOrientation(true))
	if err != nil {
		return nil, httpError(400, "图片无法解析")
	}
	var encoded bytes.Buffer
	if err = png.Encode(&encoded, img); err != nil {
		return nil, err
	}
	name := randomID() + ".png"
	if err = os.WriteFile(filepath.Join(a.dataDir, "uploads", name), encoded.Bytes(), 0600); err != nil {
		return nil, err
	}
	return Obj{"url": "/uploads/" + name}, nil
}
func (a *App) qr(w http.ResponseWriter, r *http.Request) {
	text := r.URL.Query().Get("text")
	if text == "" {
		text = a.origin
	}
	if len([]rune(text)) > 2048 {
		writeError(w, httpError(400, "二维码内容过长"))
		return
	}
	code, err := qrcode.New(text, qrcode.Medium)
	if err != nil {
		writeError(w, httpError(400, "二维码内容无法编码"))
		return
	}
	matrix := code.Bitmap()
	size := len(matrix)
	var s strings.Builder
	fmt.Fprintf(&s, `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 %d %d" shape-rendering="crispEdges"><rect width="100%%" height="100%%" fill="white"/><path fill="black" d="`, size, size)
	for y, row := range matrix {
		for x, dark := range row {
			if dark {
				fmt.Fprintf(&s, "M%d %dh1v1h-1z", x, y)
			}
		}
	}
	s.WriteString(`"/></svg>`)
	w.Header().Set("Content-Type", "image/svg+xml")
	io.WriteString(w, s.String())
}
func (a *App) bestdori(w http.ResponseWriter, r *http.Request) {
	suffix := strings.TrimPrefix(r.URL.RequestURI(), "/bestdori")
	target, err := url.Parse("https://bestdori.com" + suffix)
	if err != nil || target.Hostname() != "bestdori.com" {
		writeError(w, httpError(400, "资源地址无效"))
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", target.String(), nil)
	if err != nil {
		writeError(w, err)
		return
	}
	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if req.URL.Hostname() != "bestdori.com" {
			return http.ErrUseLastResponse
		}
		if len(via) >= 5 {
			return fmt.Errorf("too many redirects")
		}
		return nil
	}}
	res, err := client.Do(req)
	if err != nil {
		writeError(w, httpError(502, "资源服务暂时不可用"))
		return
	}
	defer res.Body.Close()
	w.Header().Set("Content-Type", res.Header.Get("Content-Type"))
	w.WriteHeader(res.StatusCode)
	if _, err = io.Copy(w, res.Body); err != nil {
		log.Printf("write resource response: %v", err)
	}
}
func (a *App) stats(w http.ResponseWriter, r *http.Request) (any, error) {
	base, id, token, shareID := os.Getenv("UMAMI_BASE_URL"), os.Getenv("UMAMI_WEBSITE_ID"), os.Getenv("UMAMI_API_TOKEN"), os.Getenv("UMAMI_SHARE_ID")
	if base == "" || id == "" || (token == "" && shareID == "") {
		return Obj{"configured": false, "pageviews": 0, "visitors": 0, "countries": []any{}, "regions": []any{}}, nil
	}
	headers := http.Header{}
	fetch := func(suffix string) (any, error) {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(ctx, "GET", strings.TrimRight(base, "/")+suffix, nil)
		if err != nil {
			return nil, err
		}
		req.Header = headers.Clone()
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, httpError(502, "统计服务暂时不可用")
		}
		defer res.Body.Close()
		if res.StatusCode != 200 {
			return nil, httpError(502, "统计服务暂时不可用")
		}
		var data any
		err = json.NewDecoder(io.LimitReader(res.Body, 4<<20)).Decode(&data)
		if err != nil {
			return nil, httpError(502, "统计服务响应无效")
		}
		return data, nil
	}
	if shareID != "" {
		v, err := fetch("/api/share/" + url.PathEscape(shareID))
		if err != nil {
			return nil, err
		}
		share := asObject(v)
		if asString(share["websiteId"]) != id || asString(share["token"]) == "" {
			return nil, httpError(502, "统计分享配置无效")
		}
		headers.Set("x-umami-share-token", asString(share["token"]))
		headers.Set("x-umami-share-context", "website")
	} else {
		headers.Set("Authorization", "Bearer "+token)
	}
	query := fmt.Sprintf("?startAt=0&endAt=%d", time.Now().UnixMilli())
	prefix := "/api/websites/" + url.PathEscape(id) + "/"
	type result struct {
		value any
		err   error
	}
	results := make([]result, 3)
	var wg sync.WaitGroup
	for i, path := range []string{"stats" + query, "metrics" + query + "&type=country", "metrics" + query + "&type=region"} {
		wg.Add(1)
		go func(i int, path string) { defer wg.Done(); results[i].value, results[i].err = fetch(prefix + path) }(i, path)
	}
	wg.Wait()
	for _, res := range results {
		if res.err != nil {
			return nil, res.err
		}
	}
	metrics := func(v any) []Obj {
		out := []Obj{}
		if rows, ok := v.([]any); ok {
			for _, item := range rows {
				row := asObject(item)
				code := asString(row["x"])
				if code == "" {
					code = "unknown"
				}
				out = append(out, Obj{"code": code, "name": code, "count": number(row["y"])})
			}
		}
		return out
	}
	count := func(v any) float64 {
		if o := asObject(v); o != nil {
			return number(o["value"])
		}
		return number(v)
	}
	s := asObject(results[0].value)
	return Obj{"configured": true, "pageviews": count(s["pageviews"]), "visitors": count(s["visitors"]), "countries": metrics(results[1].value), "regions": metrics(results[2].value)}, nil
}
