package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const securityOrigin = "http://security.test"
const securityPassword = "security-test-password"

func newSecurityApp(t *testing.T) *App {
	t.Helper()
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	app, err := NewApp(AppOptions{RootDir: root, DataDir: t.TempDir(), PublicOrigin: securityOrigin, BootstrapPassword: securityPassword})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(app.Close)
	return app
}

type securityClient struct {
	t         *testing.T
	app       *App
	cookie    *http.Cookie
	csrf      string
	peer      string
	forwarded string
}

func newSecurityClient(t *testing.T, app *App, address string) *securityClient {
	t.Helper()
	client := &securityClient{t: t, app: app, peer: address}
	client.initialize()
	return client
}

func (c *securityClient) initialize() {
	c.t.Helper()
	response := c.request("GET", "/api/auth/me", nil)
	if response.Code != 200 {
		c.t.Fatalf("initialize: %d %s", response.Code, response.Body.String())
	}
	c.csrf = asString(securityJSON(c.t, response)["csrfToken"])
}

func (c *securityClient) request(method, path string, body any) *httptest.ResponseRecorder {
	c.t.Helper()
	var encoded []byte
	if body != nil {
		var err error
		encoded, err = json.Marshal(body)
		if err != nil {
			c.t.Fatal(err)
		}
	}
	return c.raw(method, path, bytes.NewReader(encoded), nil)
}

func (c *securityClient) raw(method, path string, body io.Reader, headers map[string]string) *httptest.ResponseRecorder {
	c.t.Helper()
	r := httptest.NewRequest(method, path, body)
	r.RemoteAddr = c.peer
	r.Header.Set("Origin", securityOrigin)
	r.Header.Set("X-CSRF-Token", c.csrf)
	r.Header.Set("Content-Type", "application/json")
	if c.forwarded != "" {
		r.Header.Set("X-Forwarded-For", c.forwarded)
	}
	if c.cookie != nil {
		r.AddCookie(c.cookie)
	}
	for key, value := range headers {
		r.Header.Set(key, value)
	}
	w := httptest.NewRecorder()
	c.app.Handler().ServeHTTP(w, r)
	for _, cookie := range w.Result().Cookies() {
		if cookie.Name == sessionCookieName {
			c.cookie = cookie
		}
	}
	return w
}

func (c *securityClient) login(username, password string) *httptest.ResponseRecorder {
	c.t.Helper()
	response := c.request("POST", "/api/auth/login", Obj{"username": username, "password": password})
	if response.Code == 200 {
		c.csrf = asString(securityJSON(c.t, response)["csrfToken"])
	}
	return response
}

func securityJSON(t *testing.T, response *httptest.ResponseRecorder) Obj {
	t.Helper()
	var value Obj
	if err := json.Unmarshal(response.Body.Bytes(), &value); err != nil {
		t.Fatal("invalid JSON response", response.Body.String(), err)
	}
	return value
}

func securityStatus(t *testing.T, response *httptest.ResponseRecorder, want int) {
	t.Helper()
	if response.Code != want {
		t.Fatalf("status=%d want=%d response=%s", response.Code, want, response.Body.String())
	}
}

func TestHTTPSecurityLoginCSRFSessionRotationAndInjection(t *testing.T) {
	app := newSecurityApp(t)
	client := newSecurityClient(t, app, "198.51.100.1:1234")
	other := newSecurityClient(t, app, "198.51.100.2:1234")
	body := `{"username":"admin","password":"security-test-password"}`
	for _, headers := range []map[string]string{
		{"Origin": ""}, {"Origin": "null"}, {"Origin": "https://foreign.invalid"},
		{"X-CSRF-Token": ""}, {"X-CSRF-Token": other.csrf},
	} {
		securityStatus(t, client.raw("POST", "/api/auth/login", strings.NewReader(body), headers), 403)
	}
	for _, username := range []string{"' OR 1=1 --", "admin'--", "admin'; DROP TABLE users;--", `admin" OR "1"="1`} {
		securityStatus(t, client.login(username, "wrong-password"), 400)
		if securityJSON(t, client.request("GET", "/api/auth/me", nil))["user"] != nil {
			t.Fatal("SQL injection authenticated a user")
		}
	}
	oldCookie := *client.cookie
	oldCSRF := client.csrf
	securityStatus(t, client.login(" \tADMIN\n", securityPassword), 200)
	if client.cookie.Value == oldCookie.Value || client.csrf == oldCSRF {
		t.Fatal("login did not rotate both session and CSRF token")
	}
	old := &securityClient{t: t, app: app, peer: client.peer, cookie: &oldCookie, csrf: oldCSRF}
	securityStatus(t, old.request("GET", "/api/rooms", nil), 401)
	me := client.request("GET", "/api/auth/me", nil)
	securityStatus(t, me, 200)
	if me.Header().Get("Cache-Control") != "no-store" || strings.Contains(me.Body.String(), "password") {
		t.Fatal("authentication response exposed password material or may be cached")
	}
	loggedInCookie := *client.cookie
	securityStatus(t, client.request("POST", "/api/auth/logout", Obj{}), 200)
	client.cookie = &loggedInCookie
	securityStatus(t, client.request("GET", "/api/rooms", nil), 401)
}

func TestHTTPSecurityNormalizedLoginLimitSurvivesSuccess(t *testing.T) {
	app := newSecurityApp(t)
	client := newSecurityClient(t, app, "198.51.100.10:1234")
	variants := []string{"admin", " ADMIN ", "\tadmin", "admin\n"}
	for index := 0; index < 9; index++ {
		securityStatus(t, client.login(variants[index%len(variants)], "wrong-password"), 403)
	}
	securityStatus(t, client.login(" admin ", securityPassword), 200)
	securityStatus(t, client.login("\tADMIN\n", "wrong-password"), 403)
	securityStatus(t, client.login("admin", "wrong-password"), 429)
	otherIP := newSecurityClient(t, app, "198.51.100.11:1234")
	securityStatus(t, otherIP.login("admin", securityPassword), 200)
}

func TestHTTPSecuritySuccessfulLoginsDoNotExhaustFailureQuota(t *testing.T) {
	app := newSecurityApp(t)
	client := newSecurityClient(t, app, "198.51.100.12:1234")
	for index := 0; index < 15; index++ {
		securityStatus(t, client.login("admin", securityPassword), 200)
	}
}

func TestHTTPSecurityProxyClientsAndDistributedAccountLimit(t *testing.T) {
	app := newSecurityApp(t)
	for index, address := range []string{"198.51.100.21", "198.51.100.22", "198.51.100.23"} {
		client := &securityClient{t: t, app: app, peer: "127.0.0.1:5000", forwarded: address}
		client.initialize()
		for attempt := 0; attempt < 10; attempt++ {
			securityStatus(t, client.login(" ADMIN ", "wrong-password"), 403)
		}
		securityStatus(t, client.login("admin", "wrong-password"), 429)
		if index == 0 {
			untrusted := newSecurityClient(t, app, "203.0.113.8:1234")
			untrusted.forwarded = address
			securityStatus(t, untrusted.request("GET", "/api/auth/me", nil), 200)
		}
	}
	fourth := &securityClient{t: t, app: app, peer: "127.0.0.1:5001", forwarded: "198.51.100.24"}
	fourth.initialize()
	securityStatus(t, fourth.login("admin", securityPassword), 429)
}

func TestHTTPSecurityIPLimitAcrossUsernames(t *testing.T) {
	app := newSecurityApp(t)
	client := newSecurityClient(t, app, "198.51.100.30:1234")
	for index := 0; index < 50; index++ {
		securityStatus(t, client.login(fmt.Sprintf("missing-%02d", index), "wrong-password"), 403)
	}
	securityStatus(t, client.login("admin", securityPassword), 429)
	other := newSecurityClient(t, app, "198.51.100.31:1234")
	securityStatus(t, other.login("admin", securityPassword), 200)
}

func TestHTTPSecurityAdminAndRoomAuthorization(t *testing.T) {
	app := newSecurityApp(t)
	anonymous := newSecurityClient(t, app, "198.51.100.40:1234")
	for _, path := range []string{"/api/admin/users", "/api/diagnostics", "/api/rooms"} {
		securityStatus(t, anonymous.request("GET", path, nil), 401)
	}
	hostUser, err := app.store.CreateUser(Obj{"username": "security_host", "password": "security-host-password", "role": "host"})
	if err != nil {
		t.Fatal(err)
	}
	host := newSecurityClient(t, app, "198.51.100.41:1234")
	securityStatus(t, host.login("security_host", "security-host-password"), 200)
	for _, path := range []string{"/api/admin/users", "/api/diagnostics"} {
		securityStatus(t, host.request("GET", path, nil), 403)
	}
	securityStatus(t, host.request("PATCH", "/api/admin/users/"+hostUser.ID, Obj{"role": "super_admin"}), 403)
	securityStatus(t, host.request("PUT", "/api/community", Obj{}), 403)
	securityStatus(t, host.request("POST", "/api/uploads", Obj{}), 403)
	admin := newSecurityClient(t, app, "198.51.100.42:1234")
	securityStatus(t, admin.login("admin", securityPassword), 200)
	created := admin.request("POST", "/api/rooms", Obj{"name": "private management"})
	securityStatus(t, created, 201)
	code := asString(asObject(securityJSON(t, created)["room"])["code"])
	for _, test := range []struct{ method, suffix string }{{"GET", ""}, {"PATCH", ""}, {"DELETE", ""}, {"PATCH", "/settings"}} {
		securityStatus(t, host.request(test.method, "/api/rooms/"+code+test.suffix, Obj{}), 403)
	}
	securityStatus(t, anonymous.request("GET", "/api/rooms/"+code, nil), 401)
	securityStatus(t, admin.request("GET", "/api/rooms/"+code, nil), 200)
}

func TestHTTPSecurityJSONLimitsAndFileIsolation(t *testing.T) {
	app := newSecurityApp(t)
	client := newSecurityClient(t, app, "198.51.100.50:1234")
	for _, payload := range []string{"[]", "null", `{"username":`, "{} {}"} {
		securityStatus(t, client.raw("POST", "/api/auth/login", strings.NewReader(payload), nil), 400)
	}
	oversized := `{"username":"` + strings.Repeat("a", 1<<20) + `","password":"wrong-password"}`
	securityStatus(t, client.raw("POST", "/api/auth/login", strings.NewReader(oversized), nil), 413)
	securityStatus(t, client.request("POST", "/api/auth/login", Obj{"username": Obj{"$ne": nil}, "password": Obj{"$ne": nil}}), 400)
	securityStatus(t, client.login(strings.Repeat("a", 4096), "wrong-password"), 400)
	securityStatus(t, client.login("admin", strings.Repeat("x", 129)), 400)
	securityStatus(t, client.login("admin", strings.Repeat("😀", 65)), 400)
	app.limiter.mu.Lock()
	for key := range app.limiter.entries {
		if strings.HasPrefix(key, "login-pair:") || strings.HasPrefix(key, "login-account:") {
			t.Errorf("invalid credentials allocated a per-account key: %q", key)
		}
	}
	app.limiter.mu.Unlock()
	marker := "private-test-content-must-not-be-served"
	for _, name := range []string{".env", "sentinel.txt", "uploads/.private"} {
		if err := os.WriteFile(filepath.Join(app.dataDir, filepath.FromSlash(name)), []byte(marker), 0600); err != nil {
			t.Fatal(err)
		}
	}
	for _, path := range []string{"/api/unknown-security-test", "/.env", "/data/app.sqlite", "/package.json", "/src/server/app.ts", "/", "/uploads/", "/cards/", "/uploads/.private", "/uploads/%2e%2e/sentinel.txt", "/uploads/..%5csentinel.txt", "/cards/%2e%2e/.env"} {
		response := client.request("GET", path, nil)
		if response.Code != 404 && response.Code != 400 && response.Code != 301 {
			t.Errorf("unexpected file response %s: %d", path, response.Code)
		}
		if strings.Contains(response.Body.String(), marker) || strings.HasPrefix(response.Body.String(), "SQLite format 3") {
			t.Errorf("private file exposed by %s", path)
		}
	}
	securityStatus(t, client.request("GET", "/api/health", nil), 200)
}

type securityFailWriter struct{ header http.Header }

func (w *securityFailWriter) Header() http.Header { return w.header }
func (w *securityFailWriter) WriteHeader(int)     {}
func (w *securityFailWriter) Write([]byte) (int, error) {
	return 0, errors.New("test connection closed")
}

func TestJSONFailuresAreLoggedAndNotExposed(t *testing.T) {
	var logs bytes.Buffer
	previous := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(previous)
	w := httptest.NewRecorder()
	writeJSON(w, 200, Obj{"invalid": math.NaN()})
	if w.Code != 500 || !strings.Contains(logs.String(), "encode JSON response") || strings.Contains(w.Body.String(), "NaN") {
		t.Fatal("JSON encoding failure was not handled", w.Code, logs.String(), w.Body.String())
	}
	logs.Reset()
	w = httptest.NewRecorder()
	writeError(w, errors.New("internal diagnostic detail"))
	if w.Code != 500 || !strings.Contains(logs.String(), "internal diagnostic detail") || strings.Contains(w.Body.String(), "internal diagnostic detail") {
		t.Fatal("internal error was hidden from logs or exposed to client")
	}
	logs.Reset()
	writeJSON(&securityFailWriter{header: make(http.Header)}, 200, Obj{"ok": true})
	if !strings.Contains(logs.String(), "test connection closed") {
		t.Fatal("response write failure was silently ignored")
	}
}
