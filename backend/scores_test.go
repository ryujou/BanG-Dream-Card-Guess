package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type scoreHTTPClient struct {
	client     *http.Client
	base, csrf string
	sessionID  string
}

func scoreFixture(t *testing.T) (*App, *httptest.Server) {
	t.Helper()
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	app, err := NewApp(AppOptions{RootDir: root, DataDir: t.TempDir(), PublicOrigin: "http://score.test", BootstrapPassword: "score-test-password"})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(app.Handler())
	t.Cleanup(func() { app.Close(); server.Close() })
	return app, server
}
func scoreClient(t *testing.T, base string) *scoreHTTPClient {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	client := &scoreHTTPClient{client: &http.Client{Jar: jar, Timeout: 5 * time.Second}, base: base}
	status, body := client.request(t, "GET", "/api/auth/me", nil)
	if status != 200 {
		t.Fatalf("session: %d %v", status, body)
	}
	client.csrf = asString(body["csrfToken"])
	u, _ := url.Parse(base)
	for _, cookie := range jar.Cookies(u) {
		if cookie.Name == sessionCookieName {
			client.sessionID = cookie.Value
		}
	}
	return client
}
func (c *scoreHTTPClient) request(t *testing.T, method, path string, body Obj) (int, Obj) {
	t.Helper()
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req, err := http.NewRequest(method, c.base+path, bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", "http://score.test")
	req.Header.Set("X-CSRF-Token", c.csrf)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	response, err := c.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var result Obj
	if err = json.NewDecoder(response.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	return response.StatusCode, result
}
func (c *scoreHTTPClient) start(t *testing.T, level int, difficulty string) Obj {
	t.Helper()
	status, run := c.request(t, "POST", "/note-shooter-api/startStat", Obj{"levels": level, "difficulty": difficulty})
	if status != 200 {
		t.Fatalf("start: %d %v", status, run)
	}
	return run
}
func ageScoreRun(t *testing.T, app *App, client *scoreHTTPClient, elapsed time.Duration) {
	t.Helper()
	_, err := app.sessions.Mutate(client.sessionID, func(s *Session) error { s.NoteRun.StartedAt = time.Now().Add(-elapsed).UnixMilli(); return nil })
	if err != nil {
		t.Fatal(err)
	}
}
func validScore(run Obj) Obj {
	return Obj{"runId": run["runId"], "playerId": run["playerId"], "playerName": "成绩验收", "levels": 1, "difficulty": "normal", "duration": 16, "finalScore": 900, "kumaKill": 20, "kumaLive": 0, "maxCombo": 20, "life": 1, "fps": 60, "win": 0, "bossRatio": 0, "bulletRatio": 0, "itemRatio": 0}
}

func TestScoresSessionRunValidationAndAtomicReplay(t *testing.T) {
	app, server := scoreFixture(t)
	a, b := scoreClient(t, server.URL), scoreClient(t, server.URL)
	status, identity := a.request(t, "POST", "/note-shooter-api/openStat", Obj{"playerId": "someone-else"})
	if status != 200 || identity["playerId"] == "someone-else" {
		t.Fatalf("client selected identity: %d %v", status, identity)
	}
	_, again := a.request(t, "POST", "/note-shooter-api/openStat", Obj{"playerId": "another-person"})
	if identity["playerId"] != again["playerId"] {
		t.Fatal("same session lost player identity")
	}
	run := a.start(t, 1, "normal")
	payload := validScore(run)
	if status, _ = a.request(t, "POST", "/note-shooter-api/gameStat", payload); status != 400 {
		t.Fatalf("early score accepted: %d", status)
	}
	if status, _ = b.request(t, "POST", "/note-shooter-api/gameStat", payload); status != 409 {
		t.Fatalf("cross-session run accepted: %d", status)
	}
	// Only the server-owned start timestamp is advanced; production validation remains active.
	ageScoreRun(t, app, a, 30*time.Second)
	for _, test := range []struct {
		field  string
		value  any
		status int
	}{{"playerId", "someone-else", 403}, {"runId", "unknown-run", 409}, {"duration", 14, 400}, {"duration", 300, 400}, {"duration", 16.5, 400}, {"finalScore", 99999999, 400}, {"finalScore", -1, 400}, {"maxCombo", 21, 400}, {"kumaKill", 1000, 400}, {"difficulty", "hard", 400}, {"levels", 2, 400}, {"bossRatio", 2, 400}} {
		bad := Obj{}
		for k, v := range payload {
			bad[k] = v
		}
		bad[test.field] = test.value
		if status, body := a.request(t, "POST", "/note-shooter-api/gameStat", bad); status != test.status {
			t.Errorf("%s=%v: %d %v", test.field, test.value, status, body)
		}
	}
	statuses := make(chan int, 2)
	for range 2 {
		go func() { code, _ := a.request(t, "POST", "/note-shooter-api/gameStat", payload); statuses <- code }()
	}
	first, second := <-statuses, <-statuses
	if !((first == 200 && second == 409) || (first == 409 && second == 200)) {
		t.Fatalf("run consumed more than once: %d %d", first, second)
	}
	_, state := a.request(t, "GET", "/api/scores", nil)
	if number(state["total"]) != 1 {
		t.Fatalf("unexpected scores: %v", state)
	}
}

func TestScoresPersonalRankingHistoryAndQueueAuthorization(t *testing.T) {
	app, server := scoreFixture(t)
	a, b := scoreClient(t, server.URL), scoreClient(t, server.URL)
	var firstID string
	for i, client := range []*scoreHTTPClient{a, a, b} {
		run := client.start(t, 1, "normal")
		if i == 0 {
			firstID = asString(run["playerId"])
		}
		ageScoreRun(t, app, client, 30*time.Second)
		payload := validScore(run)
		payload["finalScore"] = 1000 - i*100
		if status, body := client.request(t, "POST", "/note-shooter-api/gameStat", payload); status != 200 {
			t.Fatalf("score: %d %v", status, body)
		}
	}
	_, top := a.request(t, "GET", "/note-shooter-api/getRanking?levels=1&difficulty=normal&type=top", nil)
	if len(top["data"].([]any)) != 2 {
		t.Fatalf("best per player: %v", top)
	}
	_, personal := a.request(t, "GET", "/note-shooter-api/getRanking?levels=1&difficulty=normal&type=myRecent&playerId=forged", nil)
	rows := personal["data"].([]any)
	if len(rows) != 2 {
		t.Fatalf("personal attempts: %v", personal)
	}
	for _, item := range rows {
		if asObject(item)["player_id"] != firstID {
			t.Fatal("personal ranking used supplied identity")
		}
	}
	_, rank := a.request(t, "GET", "/note-shooter-api/getMyRanking?levels=1&difficulty=normal&playerId=forged", nil)
	if number(asObject(rank["data"].([]any)[0])["user_rank"]) != 1 {
		t.Fatalf("personal position: %v", rank)
	}
	if _, err := app.store.AddScore("note", Obj{"player_id": "historical-player", "player_name": "历史成绩", "levels": 2, "difficulty": "easy", "final_score": 500, "duration": 20, "max_combo": 0, "full_combo": 0, "ranks": "d"}); err != nil {
		t.Fatal(err)
	}
	_, history := a.request(t, "GET", "/note-shooter-api/getRanking?levels=2&difficulty=easy", nil)
	if len(history["data"].([]any)) != 1 {
		t.Fatal("historical records disappeared")
	}
	if status, _ := a.request(t, "POST", "/api/queue-scores", Obj{"username": "匿名", "score": 99, "duration": 20}); status != 401 {
		t.Fatalf("anonymous queue score accepted: %d", status)
	}
	status, login := a.request(t, "POST", "/api/auth/login", Obj{"username": "admin", "password": "score-test-password"})
	if status != 200 {
		t.Fatalf("login: %d %v", status, login)
	}
	a.csrf = asString(login["csrfToken"])
	if status, _ = a.request(t, "POST", "/api/queue-scores", Obj{"username": "主持", "score": -1, "duration": 20}); status != 400 {
		t.Fatalf("negative queue score: %d", status)
	}
	if status, body := a.request(t, "POST", "/api/queue-scores", Obj{"username": "主持", "score": 99, "duration": 20}); status != 200 || number(body["total"]) != 1 {
		t.Fatalf("host queue score: %d %v", status, body)
	}
}

func TestScoresSSECapacityDisconnectAndUpdates(t *testing.T) {
	app, server := scoreFixture(t)
	request, err := http.NewRequest("GET", server.URL+"/api/scores/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	response, err := http.DefaultClient.Do(request.WithContext(ctx))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal(response.StatusCode)
	}
	reader := bufio.NewReader(response.Body)
	if line, err := reader.ReadString('\n'); err != nil || line != "event: scores\n" {
		t.Fatalf("initial event: %q %v", line, err)
	}
	if _, err = reader.ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	if _, err = reader.ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	if _, err = app.store.AddScore("note", Obj{"player_id": "sse-player", "player_name": "实时玩家", "levels": 1, "difficulty": "normal", "final_score": 50, "duration": 16}); err != nil {
		t.Fatal(err)
	}
	app.scores.Broadcast("note")
	if _, err = reader.ReadString('\n'); err != nil {
		t.Fatal(err)
	}
	line, err := reader.ReadString('\n')
	if err != nil || !strings.Contains(line, "实时玩家") {
		t.Fatalf("broadcast: %q %v", line, err)
	}
	cancel()
	response.Body.Close()
	deadline := time.Now().Add(time.Second)
	for {
		app.scores.mu.Lock()
		count := len(app.scores.streams)
		app.scores.mu.Unlock()
		if count == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("disconnected stream retained")
		}
		time.Sleep(5 * time.Millisecond)
	}
	channels := []chan Obj{}
	for i := 0; i < 64; i++ {
		ch, err := app.scores.subscribe("note", "127.0.0.1")
		if err != nil {
			t.Fatalf("normal shared audience rejected at %d: %v", i, err)
		}
		channels = append(channels, ch)
	}
	if _, err = app.scores.subscribe("note", "127.0.0.1"); err == nil {
		t.Fatal("per-IP limit not enforced")
	}
	limited, err := http.Get(server.URL + "/api/scores/events")
	if err != nil {
		t.Fatal(err)
	}
	limited.Body.Close()
	if limited.StatusCode != 429 {
		t.Fatalf("HTTP SSE capacity response: %d", limited.StatusCode)
	}
	app.scores.unsubscribe(channels[0])
	if _, err = app.scores.subscribe("note", "127.0.0.1"); err != nil {
		t.Fatal("closed stream did not release capacity")
	}
	for i := 64; i < 1024; i++ {
		if _, err = app.scores.subscribe("note", fmt.Sprintf("viewer-%d", i)); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = app.scores.subscribe("note", "extra-viewer"); err == nil {
		t.Fatal("global limit not enforced")
	}
	app.scores.Close()
	app.scores.mu.Lock()
	remaining := len(app.scores.streams)
	app.scores.mu.Unlock()
	if remaining != 0 {
		t.Fatal("streams not cleared")
	}
}

func TestScoresFiftyPlayersBehindOneAddress(t *testing.T) {
	app, server := scoreFixture(t)
	clients := make([]*scoreHTTPClient, 50)
	for i := range clients {
		clients[i] = scoreClient(t, server.URL)
	}
	identities := make(chan string, len(clients))
	var group sync.WaitGroup
	for i, client := range clients {
		group.Add(1)
		go func(index int, client *scoreHTTPClient) {
			defer group.Done()
			status, identity := client.request(t, "POST", "/note-shooter-api/openStat", Obj{})
			if status != 200 {
				t.Errorf("player %d open: %d %v", index, status, identity)
				return
			}
			run := client.start(t, 1, "normal")
			if identity["playerId"] != run["playerId"] {
				t.Errorf("player %d identity changed", index)
				return
			}
			ageScoreRun(t, app, client, 20*time.Second)
			payload := validScore(run)
			payload["playerName"] = fmt.Sprintf("同出口玩家%d", index)
			if status, body := client.request(t, "POST", "/note-shooter-api/gameStat", payload); status != 200 {
				t.Errorf("player %d submit: %d %v", index, status, body)
				return
			}
			_, personal := client.request(t, "GET", "/note-shooter-api/getRanking?levels=1&difficulty=normal&type=myRecent", nil)
			rows := personal["data"].([]any)
			if len(rows) != 1 || asObject(rows[0])["player_id"] != run["playerId"] || asObject(rows[0])["player_name"] != payload["playerName"] {
				t.Errorf("player %d received another player's score: %v", index, personal)
				return
			}
			identities <- asString(run["playerId"])
		}(i, client)
	}
	group.Wait()
	close(identities)
	unique := map[string]bool{}
	for id := range identities {
		if unique[id] {
			t.Errorf("identity reused: %s", id)
		}
		unique[id] = true
	}
	if len(unique) != 50 {
		t.Fatalf("successful independent players: %d", len(unique))
	}
	_, state := clients[0].request(t, "GET", "/api/scores", nil)
	if number(state["total"]) != 50 {
		t.Fatalf("expected 50 records: %v", state)
	}
}
