package main

import (
	"testing"
	"time"
)

func TestGamesTwoRoomsAndTwoSoloTimersStayIndependent(t *testing.T) {
	games := make([]*Game, 4)
	clients := make([]*GameClient, 4)
	for i, mode := range []string{"booth", "booth", "solo", "solo"} {
		games[i], clients[i] = fixtureGame(t, Obj{"showTimer": false}, mode)
		commandOK(t, games[i], clients[i], "start", nil)
	}
	for i, seconds := range []float64{1, 4, 2, 5} {
		games[i].mu.Lock()
		games[i].settings["showTimer"] = true
		games[i].state.LeftSeconds = seconds
		games[i].startTimerLocked()
		games[i].mu.Unlock()
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if visibleGame(games[0], "host")["status"] == "revealed" {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	first := visibleGame(games[0], "host")
	history := first["history"].([]Obj)
	if first["status"] != "revealed" || len(history) != 1 || history[0]["result"] != "timeout" {
		t.Fatal("first room did not time out independently")
	}
	for _, i := range []int{1, 2, 3} {
		state := visibleGame(games[i], "player")
		if state["status"] != "playing" || gameNumber(state["leftSeconds"]) <= 0 {
			t.Fatalf("game %d was changed by another room timeout", i)
		}
	}
	commandOK(t, games[1], clients[1], "stop", nil)
	deadline = time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if visibleGame(games[2], "self")["status"] == "revealed" {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if visibleGame(games[2], "self")["status"] != "revealed" || visibleGame(games[1], "host")["status"] != "stopped" || visibleGame(games[3], "self")["status"] != "playing" {
		t.Fatal("stopping one room altered independent solo timers")
	}
}

func TestAppSweepsOnlyDisconnectedGamesAfterTwoHours(t *testing.T) {
	roomExpired, hostExpired := fixtureGame(t, Obj{"showTimer": false}, "booth")
	roomOnline, _ := fixtureGame(t, Obj{"showTimer": false}, "booth")
	soloExpired, selfExpired := fixtureGame(t, Obj{"showTimer": false}, "solo")
	soloOnline, _ := fixtureGame(t, Obj{"showTimer": false}, "solo")
	roomExpired.RemoveClient(hostExpired)
	soloExpired.RemoveClient(selfExpired)
	now := time.Now()
	for _, g := range []*Game{roomExpired, roomOnline, soloExpired, soloOnline} {
		g.mu.Lock()
		g.lastHostSeenAt = now.Add(-2 * time.Hour)
		g.lastActiveAt = now.Add(-2 * time.Hour)
		g.mu.Unlock()
	}
	a := &App{sessions: NewSessions(nil, false, nil), limiter: NewLimiter(), rooms: map[string]*Game{"expired": roomExpired, "online": roomOnline}, solos: map[string]*Game{"expired": soloExpired, "online": soloOnline}}
	a.sweep(now.Add(-time.Millisecond))
	if len(a.rooms) != 2 || len(a.solos) != 2 {
		t.Fatal("cleanup removed games before two-hour boundary")
	}
	a.sweep(now)
	if len(a.rooms) != 1 || a.rooms["online"] != roomOnline || len(a.solos) != 1 || a.solos["online"] != soloOnline {
		t.Fatal("cleanup failed to distinguish disconnected and online games")
	}
	for _, g := range []*Game{roomExpired, soloExpired} {
		g.mu.Lock()
		disposed := g.disposed
		g.mu.Unlock()
		if !disposed {
			t.Fatal("expired game retained its timers and connections")
		}
	}
}
