package main

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestClientIPTrustsOnlyLoopbackProxy(t *testing.T) {
	for _, test := range []struct{ peer, forwarded, want string }{
		{"198.51.100.1:1234", "203.0.113.9", "198.51.100.1"},
		{"10.0.0.2:1234", "203.0.113.9", "10.0.0.2"},
		{"127.0.0.1:1234", "203.0.113.9", "203.0.113.9"},
		{"[::1]:1234", "198.51.100.7, 203.0.113.9", "203.0.113.9"},
		{"[::ffff:127.0.0.1]:1234", "198.51.100.7, 127.0.0.2", "198.51.100.7"},
		{"127.0.0.1:1234", "not-an-address", "127.0.0.1"},
		{"127.0.0.1:1234", "", "127.0.0.1"},
	} {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = test.peer
		r.Header.Set("X-Forwarded-For", test.forwarded)
		if got := ClientIP(r); got != test.want {
			t.Errorf("peer=%q forwarded=%q got=%q want=%q", test.peer, test.forwarded, got, test.want)
		}
	}
}

func TestLimiterConcurrentQuotaAndExpiration(t *testing.T) {
	limiter := NewLimiter()
	var accepted atomic.Int32
	var wg sync.WaitGroup
	for index := 0; index < 100; index++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if limiter.Allow("login:"+NormalizeUsername(" \tAdMiN\n"), 10, time.Minute) {
				accepted.Add(1)
			}
		}()
	}
	wg.Wait()
	if accepted.Load() != 10 || limiter.Allow("login:admin", 10, time.Minute) {
		t.Fatalf("quota admitted %d attempts", accepted.Load())
	}
	limiter.mu.Lock()
	limiter.entries["login:admin"] = limitEntry{count: 10, expires: time.Now().Add(-time.Second)}
	limiter.mu.Unlock()
	limiter.Sweep()
	if !limiter.Allow("login:admin", 10, time.Minute) {
		t.Fatal("expired counter did not reset")
	}
}

func TestLimiterRefundKeepsPriorFailures(t *testing.T) {
	limiter := NewLimiter()
	for index := 0; index < 10; index++ {
		if !limiter.Allow("account", 10, time.Minute) {
			t.Fatal("reservation rejected before quota")
		}
	}
	limiter.Refund("account")
	if !limiter.Allow("account", 10, time.Minute) || limiter.Allow("account", 10, time.Minute) {
		t.Fatal("success must refund only its own reservation, not prior failures")
	}
	if !limiter.Allow("all-successful", 1, time.Minute) {
		t.Fatal("initial reservation failed")
	}
	limiter.Refund("all-successful")
	if !limiter.Allow("all-successful", 1, time.Minute) {
		t.Fatal("refunded reservation remained consumed")
	}
}

func TestSessionsCookieCopiesAndAtomicMutation(t *testing.T) {
	store := testAuthStore(t)
	sessions := NewSessions(store, true, nil)
	r := httptest.NewRequest("GET", "https://site.test/api/auth/me", nil)
	r.RemoteAddr = "192.0.2.1:1234"
	w := httptest.NewRecorder()
	session, err := sessions.Ensure(w, r)
	if err != nil {
		t.Fatal(err)
	}
	cookies := w.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteLaxMode || cookies[0].Path != "/" {
		t.Fatalf("cookie flags: %+v", cookies)
	}
	if len(session.ID) != 64 || len(session.CSRFToken) != 48 {
		t.Fatal("session and CSRF entropy changed")
	}
	admin, _ := store.Authenticate("admin", "test-admin-password")
	_, err = sessions.Mutate(session.ID, func(value *Session) error {
		value.UserID = admin.ID
		value.NoteRun = &NoteRun{ID: "test-run", Levels: 1}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	copy := sessions.Get(session.ID)
	copy.UserID = "other"
	copy.NoteRun.ID = "other-run"
	stored := sessions.Get(session.ID)
	if stored.UserID != admin.ID || stored.NoteRun.ID != "test-run" {
		t.Fatal("Get exposed mutable session state")
	}
	_, err = sessions.Mutate(session.ID, func(value *Session) error {
		value.NoteRun = nil
		return errors.New("database failure")
	})
	if err == nil || sessions.Get(session.ID).NoteRun == nil {
		t.Fatal("failed update consumed a game run")
	}
	var accepted atomic.Int32
	var wg sync.WaitGroup
	for index := 0; index < 25; index++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := sessions.Mutate(session.ID, func(value *Session) error {
				if value.NoteRun == nil {
					return httpError(409, "对局已提交")
				}
				value.NoteRun = nil
				return nil
			})
			if err == nil {
				accepted.Add(1)
			}
		}()
	}
	wg.Wait()
	if accepted.Load() != 1 {
		t.Fatalf("game run consumed %d times", accepted.Load())
	}
	r.AddCookie(cookies[0])
	current, err := sessions.Require(r, true)
	if err != nil || current == nil || current.ID != admin.ID {
		t.Fatal("administrator session was not recognized", err)
	}
	user, err := sessions.User(sessions.Get(session.ID))
	if err != nil || user == nil {
		t.Fatal(err)
	}
}

func TestSessionsRevokeExpirationAndAuthorization(t *testing.T) {
	store := testAuthStore(t)
	host, err := store.CreateUser(Obj{"username": "session_host", "password": "session-host-password"})
	if err != nil {
		t.Fatal(err)
	}
	var sessions *Sessions
	var revoked []string
	sessions = NewSessions(store, false, func(id string) {
		_ = sessions.Count() // Revocation callbacks must run outside the session lock.
		revoked = append(revoked, id)
	})
	var ids []string
	for index := 0; index < 2; index++ {
		r := httptest.NewRequest("GET", "/api/auth/me", nil)
		session, err := sessions.Ensure(httptest.NewRecorder(), r)
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, session.ID)
		if _, err := sessions.Mutate(session.ID, func(value *Session) error { value.UserID = host.ID; return nil }); err != nil {
			t.Fatal(err)
		}
	}
	r := httptest.NewRequest("GET", "/api/admin/users", nil)
	r.AddCookie(&http.Cookie{Name: sessionCookieName, Value: ids[0]})
	_, err = sessions.Require(r, true)
	requireHTTPStatus(t, err, 403)
	sessions.RevokeUser(host.ID)
	if sessions.Count() != 0 || len(revoked) != 2 {
		t.Fatal("user-wide revocation did not remove both sessions")
	}
	_, err = sessions.Require(r, false)
	requireHTTPStatus(t, err, 401)
	expiring, err := sessions.Ensure(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sessions.Mutate(expiring.ID, func(value *Session) error { value.ExpiresAt = time.Now().Add(-time.Second).UnixMilli(); return nil }); err != nil {
		t.Fatal(err)
	}
	if sessions.Get(expiring.ID) != nil || len(revoked) != 3 {
		t.Fatal("expired session was not revoked")
	}
	sessions.Revoke(expiring.ID)
	if len(revoked) != 3 {
		t.Fatal("revocation callback ran twice")
	}
}

func TestSessionInitializationPerIPAndGlobalLimits(t *testing.T) {
	sessions := NewSessions(nil, false, nil)
	r := httptest.NewRequest("GET", "/api/auth/me", nil)
	r.RemoteAddr = "192.0.2.1:1234"
	var first *Session
	for index := 0; index < 120; index++ {
		session, err := sessions.Ensure(httptest.NewRecorder(), r)
		if err != nil {
			t.Fatal(err)
		}
		if first == nil {
			first = session
		}
	}
	_, err := sessions.Ensure(httptest.NewRecorder(), r)
	requireHTTPStatus(t, err, 429)
	r.AddCookie(&http.Cookie{Name: sessionCookieName, Value: first.ID})
	if same, err := sessions.Ensure(httptest.NewRecorder(), r); err != nil || same.ID != first.ID {
		t.Fatal("existing session should not consume initialization quota", err)
	}
	other := httptest.NewRequest("GET", "/api/auth/me", nil)
	other.RemoteAddr = "192.0.2.2:1234"
	if _, err := sessions.Ensure(httptest.NewRecorder(), other); err != nil {
		t.Fatal("a different public client shared the IP quota", err)
	}
	capped := NewSessions(nil, false, nil)
	for index := 0; index < 5000; index++ {
		id := fmt.Sprint(index)
		capped.entries[id] = &Session{ID: id, ExpiresAt: time.Now().Add(time.Hour).UnixMilli()}
	}
	_, err = capped.Ensure(httptest.NewRecorder(), other)
	requireHTTPStatus(t, err, 503)
	if capped.Count() != 5000 {
		t.Fatal("global session capacity exceeded")
	}
}
