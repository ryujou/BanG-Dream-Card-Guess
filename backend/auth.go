package main

import (
	"crypto/rand"
	"encoding/hex"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"sync"
	"time"
)

const sessionCookieName = "xtbang_session"

type NoteRun struct {
	ID         string
	StartedAt  int64
	Levels     int
	Difficulty string
}

type Session struct {
	ID                string
	UserID            string
	CSRFToken         string
	ExpiresAt         int64
	SoloID            string
	SekaiSoloID       string
	BlueArchiveSoloID string
	NotePlayerID      string
	NoteRun           *NoteRun
}

type Sessions struct {
	mu              sync.Mutex
	entries         map[string]*Session
	store           *Store
	secure          bool
	revoked         func(string)
	initializations *Limiter
}

func NewSessions(store *Store, secure bool, revoked func(string)) *Sessions {
	return &Sessions{entries: make(map[string]*Session), store: store, secure: secure, revoked: revoked, initializations: NewLimiter()}
}

func copySession(session *Session) *Session {
	if session == nil {
		return nil
	}
	copy := *session
	if session.NoteRun != nil {
		run := *session.NoteRun
		copy.NoteRun = &run
	}
	return &copy
}

func (s *Sessions) Get(id string) *Session {
	s.mu.Lock()
	entry := s.entries[id]
	expired := entry != nil && entry.ExpiresAt <= time.Now().UnixMilli()
	if expired {
		delete(s.entries, id)
		entry = nil
	}
	copy := copySession(entry)
	s.mu.Unlock()
	if expired && s.revoked != nil {
		s.revoked(id)
	}
	return copy
}

func (s *Sessions) Ensure(w http.ResponseWriter, r *http.Request) (*Session, error) {
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		if session := s.Get(cookie.Value); session != nil {
			return session, nil
		}
	}
	if !s.initializations.Allow(ClientIP(r), 120, time.Minute) {
		return nil, httpError(429, "新建会话过于频繁，请稍后再试")
	}
	id, err := randomSessionToken(32)
	if err != nil {
		return nil, err
	}
	csrf, err := randomSessionToken(24)
	if err != nil {
		return nil, err
	}
	entry := &Session{ID: id, CSRFToken: csrf, ExpiresAt: time.Now().Add(24 * time.Hour).UnixMilli()}
	s.mu.Lock()
	if len(s.entries) >= 5000 {
		s.mu.Unlock()
		return nil, httpError(503, "网站会话已满，请稍后再试")
	}
	s.entries[id] = entry
	s.mu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: sessionCookieName, Value: id, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: s.secure, MaxAge: 86400})
	return copySession(entry), nil
}

func (s *Sessions) Mutate(id string, update func(*Session) error) (*Session, error) {
	s.mu.Lock()
	entry := s.entries[id]
	if entry == nil || entry.ExpiresAt <= time.Now().UnixMilli() {
		delete(s.entries, id)
		s.mu.Unlock()
		if entry != nil && s.revoked != nil {
			s.revoked(id)
		}
		return nil, httpError(401, "会话已失效，请重新进入")
	}
	next := copySession(entry)
	if err := update(next); err != nil {
		s.mu.Unlock()
		return nil, err
	}
	s.entries[id] = copySession(next)
	s.mu.Unlock()
	return next, nil
}

func (s *Sessions) User(session *Session) (*User, error) {
	if session == nil || session.UserID == "" {
		return nil, nil
	}
	user, err := s.store.User(session.UserID)
	if err != nil || user == nil || !user.Enabled {
		return nil, err
	}
	return user, nil
}

func (s *Sessions) Require(r *http.Request, admin bool) (*User, error) {
	var session *Session
	if cookie, err := r.Cookie(sessionCookieName); err == nil {
		session = s.Get(cookie.Value)
	}
	user, err := s.User(session)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, httpError(401, "请先登录")
	}
	if admin && user.Role != "super_admin" {
		return nil, httpError(403, "需要管理员权限")
	}
	return user, nil
}

func (s *Sessions) Revoke(id string) {
	s.mu.Lock()
	_, existed := s.entries[id]
	delete(s.entries, id)
	s.mu.Unlock()
	if existed && s.revoked != nil {
		s.revoked(id)
	}
}

func (s *Sessions) RevokeUser(userID string) {
	var revoked []string
	s.mu.Lock()
	for id, session := range s.entries {
		if session.UserID == userID {
			delete(s.entries, id)
			revoked = append(revoked, id)
		}
	}
	s.mu.Unlock()
	if s.revoked != nil {
		for _, id := range revoked {
			s.revoked(id)
		}
	}
}

func (s *Sessions) Sweep() {
	now := time.Now().UnixMilli()
	var revoked []string
	s.mu.Lock()
	for id, session := range s.entries {
		if session.ExpiresAt <= now {
			delete(s.entries, id)
			revoked = append(revoked, id)
		}
	}
	s.mu.Unlock()
	s.initializations.Sweep()
	if s.revoked != nil {
		for _, id := range revoked {
			s.revoked(id)
		}
	}
}

func (s *Sessions) Count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.entries)
}

func randomSessionToken(size int) (string, error) {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// Nginx overwrites X-Forwarded-For; only local proxy peers may supply it.
func ClientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	address, err := netip.ParseAddr(host)
	if err != nil {
		return host
	}
	address = address.Unmap()
	if !address.IsLoopback() {
		return address.String()
	}
	forwarded := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
	for i := len(forwarded) - 1; i >= 0; i-- {
		candidate, err := netip.ParseAddr(strings.TrimSpace(forwarded[i]))
		if err != nil {
			break
		}
		address = candidate.Unmap()
		if !address.IsLoopback() {
			break
		}
	}
	return address.String()
}

type limitEntry struct {
	count   int
	expires time.Time
}

type Limiter struct {
	mu      sync.Mutex
	entries map[string]limitEntry
}

func NewLimiter() *Limiter { return &Limiter{entries: make(map[string]limitEntry)} }

func (l *Limiter) Allow(key string, max int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	entry := l.entries[key]
	if !entry.expires.After(now) {
		entry = limitEntry{expires: now.Add(window)}
	}
	if entry.count >= max {
		return false
	}
	entry.count++
	l.entries[key] = entry
	return true
}

func (l *Limiter) Sweep() {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	for key, entry := range l.entries {
		if !entry.expires.After(now) {
			delete(l.entries, key)
		}
	}
}

func (l *Limiter) Refund(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	entry, exists := l.entries[key]
	if !exists {
		return
	}
	if entry.count <= 1 {
		delete(l.entries, key)
	} else {
		entry.count--
		l.entries[key] = entry
	}
}
