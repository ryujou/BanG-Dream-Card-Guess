package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type GameClient struct {
	Conn            *websocket.Conn
	Role, SessionID string
	writeMu         sync.Mutex
}

func (c *GameClient) send(message Obj) error {
	if c.Conn == nil {
		return nil
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if err := c.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second)); err != nil {
		return err
	}
	return c.Conn.WriteJSON(message)
}
func (c *GameClient) close(code int, reason string) {
	if c.Conn == nil {
		return
	}
	_ = c.Conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(code, reason), time.Now().Add(time.Second))
	_ = c.Conn.Close()
}
func (c *GameClient) reject(kind, message string) {
	_ = c.send(Obj{"type": kind, "message": message})
	c.close(websocket.ClosePolicyViolation, kind)
}

func (a *App) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	if !a.allowedOrigins[r.Header.Get("Origin")] {
		writeError(w, httpError(403, "请求来源无效"))
		return
	}
	session := a.session(r)
	if session == nil {
		writeError(w, httpError(403, "会话已失效，请刷新后重试"))
		return
	}
	soloID, roomCode := r.URL.Query().Get("solo"), strings.ToUpper(r.URL.Query().Get("room"))
	a.roomsMu.Lock()
	game := a.rooms[roomCode]
	if soloID != "" {
		game = a.solos[soloID]
	}
	a.roomsMu.Unlock()
	if soloID != "" && (game == nil || game.OwnerID != session.ID) {
		writeError(w, httpError(403, "无权进入此单人对局"))
		return
	}
	ip := ClientIP(r)
	a.wsMu.Lock()
	if a.wsByIP == nil {
		a.wsByIP = map[string]int{}
	}
	if a.wsCount >= 1024 || a.wsByIP[ip] >= 64 {
		a.wsMu.Unlock()
		writeError(w, httpError(429, "连接过于频繁，请稍后重试"))
		return
	}
	a.wsCount++
	a.wsByIP[ip]++
	a.wsMu.Unlock()
	defer func() {
		a.wsMu.Lock()
		a.wsCount--
		a.wsByIP[ip]--
		if a.wsByIP[ip] == 0 {
			delete(a.wsByIP, ip)
		}
		a.wsMu.Unlock()
	}()
	upgrader := websocket.Upgrader{HandshakeTimeout: 10 * time.Second, CheckOrigin: func(r *http.Request) bool { return a.allowedOrigins[r.Header.Get("Origin")] }}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := &GameClient{Conn: conn, SessionID: session.ID}
	defer conn.Close()
	if game == nil {
		client.reject("roomNotFound", "房间不存在或已关闭")
		return
	}
	defer game.RemoveClient(client)
	conn.SetReadLimit(64 * 1024)
	_ = conn.SetReadDeadline(time.Now().Add(15 * time.Second))
	conn.SetPongHandler(func(string) error { return conn.SetReadDeadline(time.Now().Add(90 * time.Second)) })
	joined := false
	windowStart, count := time.Now(), 0
	done := make(chan struct{})
	defer close(done)
	for {
		kind, data, readErr := conn.ReadMessage()
		if readErr != nil {
			return
		}
		if kind != websocket.TextMessage {
			client.reject("error", "仅支持 JSON 文本消息")
			return
		}
		if time.Since(windowStart) >= time.Minute {
			windowStart, count = time.Now(), 0
		}
		count++
		if count > 120 {
			client.reject("error", "操作过于频繁，请稍后重试")
			return
		}
		active := a.sessions.Get(session.ID)
		if active == nil {
			client.reject("authRequired", "会话已失效，请重新进入")
			return
		}
		var message Obj
		if json.Unmarshal(data, &message) != nil || message == nil {
			_ = client.send(Obj{"type": "error", "message": "消息格式无效"})
			continue
		}
		switch gameString(message["type"]) {
		case "hello":
			if joined {
				continue
			}
			wantsHost := message["role"] == "host" || message["role"] == "settings"
			if wantsHost && soloID == "" {
				user, userErr := a.sessions.User(active)
				if userErr != nil || user == nil {
					client.reject("authRequired", "请先登录主持账号")
					return
				}
				if user.Role != "super_admin" && user.ID != game.OwnerID {
					client.reject("forbidden", "无权主持该房间")
					return
				}
			}
			client.Role = "player"
			if soloID != "" {
				client.Role = "self"
			} else if wantsHost {
				client.Role = "host"
			}
			if err := game.AddClient(client); err != nil {
				client.reject("roomClosed", "房间已关闭")
				return
			}
			joined = true
			_ = conn.SetReadDeadline(time.Now().Add(90 * time.Second))
			go func() {
				ticker := time.NewTicker(30 * time.Second)
				defer ticker.Stop()
				for {
					select {
					case <-done:
						return
					case <-ticker.C:
						if err := conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)); err != nil {
							_ = conn.Close()
							return
						}
					}
				}
			}()
		case "command":
			if !joined {
				_ = client.send(Obj{"type": "error", "message": "请先加入对局"})
				continue
			}
			if client.Role == "host" {
				user, userErr := a.sessions.User(active)
				if userErr != nil || user == nil || user.Role != "super_admin" && user.ID != game.OwnerID {
					game.RemoveClient(client)
					client.reject("authRequired", "主持权限已失效")
					return
				}
			}
			payload := Obj{}
			if value, exists := message["payload"]; exists && value != nil {
				var ok bool
				payload, ok = value.(map[string]any)
				if !ok {
					_ = client.send(Obj{"type": "error", "message": "命令参数格式无效"})
					continue
				}
			}
			if err := game.Command(client, gameString(message["command"]), payload); err != nil {
				_ = client.send(Obj{"type": "error", "message": err.Error()})
			}
		default:
			_ = client.send(Obj{"type": "error", "message": "未知消息类型"})
		}
	}
}
