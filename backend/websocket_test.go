package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func fixtureWebSocketApp(t *testing.T) (*App, string, *Session, *Session, *Game) {
	t.Helper()
	store, err := NewStore(filepath.Join(t.TempDir(), "app.sqlite"), "websocket-test-password")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = store.Close() })
	g, _ := fixtureGame(t, Obj{"showTimer": false, "revealAfterJudge": false}, "booth")
	g.mu.Lock()
	g.clients = map[*GameClient]bool{}
	g.mu.Unlock()
	sessions := NewSessions(store, false, func(id string) { g.RevokeSession(id) })
	createSession := func() *Session {
		r := httptest.NewRequest("GET", "http://test.local/api/auth/me", nil)
		s, err := sessions.Ensure(httptest.NewRecorder(), r)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	host, guest := createSession(), createSession()
	admin, err := store.Authenticate("admin", "websocket-test-password")
	if err != nil {
		t.Fatal(err)
	}
	host, err = sessions.Mutate(host.ID, func(s *Session) error { s.UserID = admin.ID; return nil })
	if err != nil {
		t.Fatal(err)
	}
	g.OwnerID = admin.ID
	a := &App{store: store, sessions: sessions, rooms: map[string]*Game{g.Code: g}, solos: map[string]*Game{}, allowedOrigins: map[string]bool{"http://test.local": true}}
	server := httptest.NewServer(http.HandlerFunc(a.handleWebSocket))
	t.Cleanup(server.Close)
	return a, "ws" + strings.TrimPrefix(server.URL, "http"), host, guest, g
}
func connectGameSocket(t *testing.T, base, query string, session *Session, role string) *websocket.Conn {
	t.Helper()
	headers := http.Header{"Origin": []string{"http://test.local"}, "Cookie": []string{"xtbang_session=" + session.ID}}
	conn, resp, err := websocket.DefaultDialer.Dial(base+"/ws?"+query, headers)
	if err != nil {
		if resp != nil {
			t.Fatalf("dial: %v (%d)", err, resp.StatusCode)
		}
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if role != "" {
		if err = conn.WriteJSON(Obj{"type": "hello", "role": role}); err != nil {
			t.Fatal(err)
		}
	}
	return conn
}
func nextSocketMessage(t *testing.T, conn *websocket.Conn, predicate func(Obj) bool) Obj {
	t.Helper()
	if err := conn.SetReadDeadline(time.Now().Add(5 * time.Second)); err != nil {
		t.Fatal(err)
	}
	for {
		var message Obj
		if err := conn.ReadJSON(&message); err != nil {
			t.Fatalf("waiting for websocket message: %v", err)
		}
		if predicate(message) {
			return message
		}
	}
}
func socketState(status string) func(Obj) bool {
	return func(m Obj) bool {
		return m["type"] == "state" && asObject(asObject(m["state"])["game"])["status"] == status
	}
}
func socketCommand(t *testing.T, conn *websocket.Conn, command string, payload Obj) {
	t.Helper()
	if err := conn.WriteJSON(Obj{"type": "command", "command": command, "payload": payload}); err != nil {
		t.Fatal(err)
	}
}
func TestWebSocketHostedPlayHidesFinishedAnswerAndRevealsExplicitly(t *testing.T) {
	_, base, hostSession, guestSession, g := fixtureWebSocketApp(t)
	host := connectGameSocket(t, base, "room="+g.Code, hostSession, "host")
	nextSocketMessage(t, host, socketState("idle"))
	player := connectGameSocket(t, base, "room="+strings.ToLower(g.Code), guestSession, "player")
	nextSocketMessage(t, player, socketState("idle"))
	socketCommand(t, player, "next", nil)
	nextSocketMessage(t, player, func(m Obj) bool { return m["type"] == "error" && strings.Contains(asString(m["message"]), "权限") })
	socketCommand(t, host, "start", nil)
	hostState := nextSocketMessage(t, host, socketState("playing"))
	answer := asObject(asObject(asObject(hostState["state"])["game"])["current"])["displayName"]
	playing := nextSocketMessage(t, player, socketState("playing"))
	if asObject(asObject(asObject(playing["state"])["game"])["current"])["displayName"] != "" {
		t.Fatal("player received answer while playing")
	}
	socketCommand(t, host, "wrong", nil)
	finished := asObject(asObject(nextSocketMessage(t, player, socketState("finished"))["state"])["game"])
	current := asObject(finished["current"])
	if current["displayName"] != "" || current["imageUrl"] != "" || asObject(finished["history"].([]any)[0])["name"] != "" {
		t.Fatal("wire protocol leaked adjudicated hidden answer")
	}
	socketCommand(t, host, "reveal", nil)
	revealed := asObject(asObject(nextSocketMessage(t, player, socketState("revealed"))["state"])["game"])
	if asObject(revealed["current"])["displayName"] != answer || asObject(revealed["history"].([]any)[0])["name"] != answer {
		t.Fatal("wire explicit reveal mismatch")
	}
	socketCommand(t, host, "undo", nil)
	undone := asObject(asObject(nextSocketMessage(t, player, socketState("playing"))["state"])["game"])
	if len(undone["history"].([]any)) != 0 || asObject(undone["current"])["displayName"] != "" {
		t.Fatal("wire undo failed")
	}
}
func TestWebSocketOriginSessionRolesAndRevocation(t *testing.T) {
	a, base, host, guest, g := fixtureWebSocketApp(t)
	for _, headers := range []http.Header{{"Origin": []string{"https://foreign.test"}, "Cookie": []string{"xtbang_session=" + guest.ID}}, {"Origin": []string{"http://test.local"}}} {
		conn, response, err := websocket.DefaultDialer.Dial(base+"/ws?room="+g.Code, headers)
		if conn != nil {
			conn.Close()
		}
		if err == nil || response == nil || response.StatusCode != 403 {
			t.Fatal("untrusted origin or absent session accepted")
		}
	}
	conn := connectGameSocket(t, base, "room="+g.Code, guest, "host")
	nextSocketMessage(t, conn, func(m Obj) bool { return m["type"] == "authRequired" })
	missing := connectGameSocket(t, base, "room=MISSING", guest, "")
	nextSocketMessage(t, missing, func(m Obj) bool { return m["type"] == "roomNotFound" })
	active := connectGameSocket(t, base, "room="+g.Code, host, "host")
	nextSocketMessage(t, active, socketState("idle"))
	a.sessions.Revoke(host.ID)
	nextSocketMessage(t, active, func(m Obj) bool { return m["type"] == "authRequired" })
	if g.HostCount() != 0 {
		t.Fatal("revoked host remained connected")
	}
}
func TestWebSocketSoloOwnershipAndCommands(t *testing.T) {
	a, base, host, guest, _ := fixtureWebSocketApp(t)
	g, _ := fixtureGame(t, Obj{"showTimer": false}, "solo")
	g.mu.Lock()
	g.clients = map[*GameClient]bool{}
	g.OwnerID = guest.ID
	g.mu.Unlock()
	a.roomsMu.Lock()
	a.solos["solo-game"] = g
	a.roomsMu.Unlock()
	headers := http.Header{"Origin": []string{"http://test.local"}, "Cookie": []string{"xtbang_session=" + host.ID}}
	conn, response, err := websocket.DefaultDialer.Dial(base+"/ws?solo=solo-game", headers)
	if conn != nil {
		conn.Close()
	}
	if err == nil || response == nil || response.StatusCode != 403 {
		t.Fatal("solo ownership not enforced")
	}
	self := connectGameSocket(t, base, "solo=solo-game", guest, "host")
	nextSocketMessage(t, self, socketState("idle"))
	socketCommand(t, self, "correct", nil)
	nextSocketMessage(t, self, func(m Obj) bool { return m["type"] == "error" })
	socketCommand(t, self, "start", nil)
	nextSocketMessage(t, self, socketState("playing"))
	g.mu.Lock()
	alias := g.state.Current.AcceptedAnswers[0]
	g.mu.Unlock()
	socketCommand(t, self, "selfGuess", Obj{"guess": alias})
	state := asObject(asObject(nextSocketMessage(t, self, socketState("revealed"))["state"])["game"])
	if gameNumber(state["score"]) != 1 {
		t.Fatal("solo websocket correct answer was not scored")
	}
}
func TestWebSocketMessageAndConnectionLimits(t *testing.T) {
	a, base, _, guest, g := fixtureWebSocketApp(t)
	conn := connectGameSocket(t, base, "room="+g.Code, guest, "player")
	nextSocketMessage(t, conn, socketState("idle"))
	for i := 0; i < 120; i++ {
		socketCommand(t, conn, "next", nil)
		message := nextSocketMessage(t, conn, func(m Obj) bool { return m["type"] == "error" })
		if i == 119 && !strings.Contains(asString(message["message"]), "频繁") {
			t.Fatal("message rate limit missing")
		}
	}
	conn.Close()
	oversized := connectGameSocket(t, base, "room="+g.Code, guest, "player")
	nextSocketMessage(t, oversized, socketState("idle"))
	if err := oversized.WriteMessage(websocket.TextMessage, []byte(strings.Repeat("x", 65537))); err != nil {
		t.Fatal(err)
	}
	_ = oversized.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, _, err := oversized.ReadMessage()
	if !websocket.IsCloseError(err, websocket.CloseMessageTooBig) {
		t.Fatalf("oversized frame not rejected: %v", err)
	}
	oversized.Close()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		a.wsMu.Lock()
		count := a.wsCount
		a.wsMu.Unlock()
		if count == 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	connections := []*websocket.Conn{}
	for i := 0; i < 64; i++ {
		connections = append(connections, connectGameSocket(t, base, "room="+g.Code, guest, ""))
	}
	headers := http.Header{"Origin": []string{"http://test.local"}, "Cookie": []string{"xtbang_session=" + guest.ID}}
	extra, response, err := websocket.DefaultDialer.Dial(base+"/ws?room="+g.Code, headers)
	if extra != nil {
		extra.Close()
	}
	if err == nil || response == nil || response.StatusCode != 429 {
		t.Fatal("per-IP 64 connection limit not enforced")
	}
	for _, c := range connections {
		c.Close()
	}
	deadline = time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		a.wsMu.Lock()
		count, ips := a.wsCount, len(a.wsByIP)
		a.wsMu.Unlock()
		if count == 0 && ips == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("closed websocket connections leaked capacity")
}
