package main

import (
	"encoding/json"
	"strings"
	"sync"
	"testing"
	"time"
)

func fixtureGame(t *testing.T, settings Obj, mode string) (*Game, *GameClient) {
	t.Helper()
	cards := fixtureCards(t, "bangdream")
	settings = NormalizeSettings(DefaultSettings(), settings, "bangdream")
	g := NewGame(cards, "ABC123", "测试房间", "owner", mode, settings)
	client := &GameClient{Role: "host", SessionID: "session"}
	if mode == "solo" {
		client.Role = "self"
	}
	if err := g.AddClient(client); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { g.Dispose("测试结束"); g.workers.Wait() })
	return g, client
}
func commandOK(t *testing.T, g *Game, c *GameClient, command string, payload Obj) {
	t.Helper()
	if err := g.Command(c, command, payload); err != nil {
		t.Fatalf("%s failed: %v", command, err)
	}
}
func visibleGame(g *Game, role string) Obj { return g.Snapshot(role)["game"].(Obj) }
func assertCurrentHidden(t *testing.T, g *Game, role string) {
	t.Helper()
	state := visibleGame(g, role)
	current := state["current"].(Obj)
	if current["displayName"] != "" || current["imageUrl"] != "" || len(current["acceptedAnswers"].([]string)) != 0 {
		t.Fatalf("%s received answer before reveal: %#v", role, current)
	}
	if gameNumber(current["imageWidth"]) != 0 || gameNumber(current["imageHeight"]) != 0 {
		t.Fatal("Original image dimensions identified an unrevealed card")
	}
	if current["crop"].(Crop).Image == "" {
		t.Fatal("cropped image was unavailable")
	}
}
func TestGameFinishedAnswersStayPrivate(t *testing.T) {
	for _, result := range []string{"correct", "wrong", "skip", "timeout"} {
		t.Run(result, func(t *testing.T) {
			g, host := fixtureGame(t, Obj{"revealAfterJudge": false, "showTimer": false}, "booth")
			commandOK(t, g, host, "start", nil)
			hostCard := visibleGame(g, "host")["current"].(Obj)
			answer := hostCard["displayName"].(string)
			if gameNumber(hostCard["imageWidth"]) <= 0 || gameNumber(hostCard["imageHeight"]) <= 0 {
				t.Fatal("Host did not retain original image dimensions")
			}
			if result == "timeout" {
				g.mu.Lock()
				g.finishLocked(result)
				g.mu.Unlock()
			} else {
				commandOK(t, g, host, result, nil)
			}
			for _, role := range []string{"player", "self"} {
				assertCurrentHidden(t, g, role)
				snapshot := visibleGame(g, role)
				if snapshot["status"] != "finished" || snapshot["history"].([]Obj)[0]["name"] != "" {
					t.Fatal("finished history exposed answer")
				}
				wire, err := json.Marshal(snapshot)
				if err != nil {
					t.Fatal(err)
				}
				if strings.Contains(string(wire), answer) || strings.Contains(gameString(snapshot["message"]), answer) {
					t.Fatal("answer leaked outside current field")
				}
			}
			if visibleGame(g, "host")["history"].([]Obj)[0]["name"] != answer {
				t.Fatal("host should retain adjudication answer")
			}
			commandOK(t, g, host, "reveal", nil)
			for _, role := range []string{"player", "self"} {
				state := visibleGame(g, role)
				if state["current"].(Obj)["displayName"] != answer || state["history"].([]Obj)[0]["name"] != answer {
					t.Fatal("explicit reveal did not disclose current answer and history")
				}
				if state["current"].(Obj)["imageWidth"] != hostCard["imageWidth"] || state["current"].(Obj)["imageHeight"] != hostCard["imageHeight"] {
					t.Fatal("Explicit reveal did not restore original image dimensions")
				}
			}
		})
	}
}
func TestGameHistoryDisclosureBelongsToItsRoundAndUndo(t *testing.T) {
	g, host := fixtureGame(t, Obj{"revealAfterJudge": false, "showTimer": false}, "booth")
	commandOK(t, g, host, "start", nil)
	commandOK(t, g, host, "wrong", nil)
	if err := g.UpdateSettings(Obj{"revealAfterJudge": true}); err != nil {
		t.Fatal(err)
	}
	assertCurrentHidden(t, g, "player")
	commandOK(t, g, host, "next", nil)
	commandOK(t, g, host, "correct", nil)
	if err := g.UpdateSettings(Obj{"revealAfterJudge": false}); err != nil {
		t.Fatal(err)
	}
	history := visibleGame(g, "player")["history"].([]Obj)
	if history[0]["name"] == "" || history[1]["name"] != "" {
		t.Fatal("settings change altered older round disclosure")
	}
	commandOK(t, g, host, "next", nil)
	commandOK(t, g, host, "wrong", nil)
	commandOK(t, g, host, "reveal", nil)
	history = visibleGame(g, "player")["history"].([]Obj)
	if history[0]["name"] == "" || history[1]["name"] == "" || history[2]["name"] != "" {
		t.Fatal("reveal disclosed unrelated older answer")
	}
	commandOK(t, g, host, "undo", nil)
	assertCurrentHidden(t, g, "player")
	state := visibleGame(g, "player")
	history = state["history"].([]Obj)
	if state["total"] != 2 || len(history) != 2 || history[0]["name"] == "" || history[1]["name"] != "" {
		t.Fatal("undo failed to restore score/history privacy")
	}
	commandOK(t, g, host, "next", nil)
	assertCurrentHidden(t, g, "player")
	commandOK(t, g, host, "reveal", nil)
	history = visibleGame(g, "player")["history"].([]Obj)
	if history[1]["name"] != "" {
		t.Fatal("revealing an unjudged new round exposed an old answer")
	}
}
func TestGamePermissionsRecropTeamsAndReset(t *testing.T) {
	g, host := fixtureGame(t, Obj{"showTimer": false, "mode": "versus", "correctPoints": 5, "streakBonus": true, "maxRecrops": 1}, "booth")
	player := &GameClient{Role: "player", SessionID: "guest"}
	if err := g.AddClient(player); err != nil {
		t.Fatal(err)
	}
	if err := g.Command(player, "start", nil); err == nil {
		t.Fatal("player started hosted game")
	}
	commandOK(t, g, host, "settings", Obj{"teamAName": "红队", "teamBName": "蓝队"})
	commandOK(t, g, host, "start", nil)
	commandOK(t, g, player, "recrop", nil)
	commandOK(t, g, player, "recrop", nil)
	if visibleGame(g, "player")["recrops"] != 1 {
		t.Fatal("recrop maximum not enforced")
	}
	commandOK(t, g, host, "team", Obj{"team": "B"})
	commandOK(t, g, host, "correct", nil)
	if gameNumber(g.Teams()["B"].(Obj)["score"]) != 5 {
		t.Fatal("versus points assigned to wrong team")
	}
	commandOK(t, g, host, "hideAnswer", nil)
	assertCurrentHidden(t, g, "player")
	commandOK(t, g, host, "correct", nil)
	if visibleGame(g, "host")["total"] != 1 {
		t.Fatal("hiding a judged answer allowed duplicate scoring")
	}
	commandOK(t, g, host, "undo", nil)
	if gameNumber(g.Teams()["B"].(Obj)["score"]) != 0 {
		t.Fatal("undo did not restore team score")
	}
	commandOK(t, g, host, "stop", nil)
	commandOK(t, g, host, "reset", nil)
	state := visibleGame(g, "player")
	if state["status"] != "idle" || state["current"] != nil || state["total"] != 0 || g.Teams()["B"].(Obj)["name"] != "蓝队" {
		t.Fatal("reset did not preserve team names and clear round")
	}
	g.RevokeSession("session")
	if err := g.Command(host, "start", nil); err == nil {
		t.Fatal("revoked session retained game commands")
	}
}
func TestGameSoloGuessAndTimer(t *testing.T) {
	g, self := fixtureGame(t, Obj{"showTimer": false, "revealAfterJudge": false}, "solo")
	if err := g.Command(self, "correct", nil); err == nil {
		t.Fatal("solo role bypassed answer validation")
	}
	commandOK(t, g, self, "start", nil)
	g.mu.Lock()
	alias := g.state.Current.AcceptedAnswers[0]
	g.mu.Unlock()
	commandOK(t, g, self, "selfGuess", Obj{"guess": strings.ToUpper(alias)})
	assertCurrentHidden(t, g, "self")
	if visibleGame(g, "self")["score"] != float64(1) {
		t.Fatal("case-insensitive solo guess not scored")
	}
	commandOK(t, g, self, "undo", nil)
	g.mu.Lock()
	g.settings["showTimer"] = true
	g.state.LeftSeconds = 1
	g.startTimerLocked()
	g.mu.Unlock()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if visibleGame(g, "self")["status"] == "finished" {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	state := visibleGame(g, "self")
	if state["status"] != "finished" || state["history"].([]Obj)[0]["result"] != "timeout" {
		t.Fatal("timer did not finish timed-out round")
	}
	assertCurrentHidden(t, g, "self")
}
func TestGameConcurrentSnapshotsAndCommands(t *testing.T) {
	g, host := fixtureGame(t, Obj{"showTimer": false}, "booth")
	commandOK(t, g, host, "start", nil)
	var wg sync.WaitGroup
	for worker := 0; worker < 4; worker++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < 30; i++ {
				g.Snapshot("player")
				g.Summary()
				g.SettingsCopy()
				g.Teams()
				g.ClientCount()
				g.HostCount()
			}
		}()
	}
	for i := 0; i < 20; i++ {
		commandOK(t, g, host, "settings", Obj{"revealAfterJudge": i%2 == 0})
		commandOK(t, g, host, "team", Obj{"team": "A"})
	}
	wg.Wait()
}

func TestGameStreakAutoNextAndCancellation(t *testing.T) {
	g, host := fixtureGame(t, Obj{"showTimer": false, "correctPoints": 2, "streakBonus": true}, "booth")
	commandOK(t, g, host, "start", nil)
	commandOK(t, g, host, "correct", nil)
	commandOK(t, g, host, "next", nil)
	commandOK(t, g, host, "correct", nil)
	if visibleGame(g, "host")["score"] != float64(5) {
		t.Fatal("streak bonus was not cumulative")
	}
	commandOK(t, g, host, "importSettings", Obj{"autoNext": true, "autoNextDelay": 500})
	commandOK(t, g, host, "next", nil)
	commandOK(t, g, host, "wrong", nil)
	commandOK(t, g, host, "settings", Obj{"autoNext": false})
	time.Sleep(600 * time.Millisecond)
	if visibleGame(g, "host")["status"] != "revealed" {
		t.Fatal("disabled auto-next still advanced")
	}
	commandOK(t, g, host, "settings", Obj{"autoNext": true})
	commandOK(t, g, host, "next", nil)
	commandOK(t, g, host, "wrong", nil)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if visibleGame(g, "host")["status"] == "playing" {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("auto-next did not start a new round")
}
