package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gorilla/websocket"
)

func realBlueArchiveCards(t *testing.T, one bool) *Cards {
	t.Helper()
	cards, err := NewCards(filepath.Join("..", "resource", "bluearchive"), filepath.Join("..", "public", "cards", "bluearchive"), "bluearchive")
	if err != nil {
		t.Fatal(err)
	}
	if one {
		for _, card := range cards.pool {
			if card.ID == "10010" {
				cards.pool = []Card{card}
				return cards
			}
		}
		t.Fatal("Real Shiroko memorial lobby is missing")
	}
	return cards
}

func TestBlueArchiveMemorialInventoryAndActualCrop(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "resource", "bluearchive", "sources.json"))
	if err != nil {
		t.Fatal(err)
	}
	var manifest struct {
		Kind   string `json:"kind"`
		Count  int    `json:"count"`
		Images []struct {
			ID          string `json:"id"`
			Name        string `json:"name"`
			Width       int    `json:"width"`
			Height      int    `json:"height"`
			LocalWidth  int    `json:"localWidth"`
			LocalHeight int    `json:"localHeight"`
		} `json:"images"`
	}
	if err = json.Unmarshal(data, &manifest); err != nil {
		t.Fatal(err)
	}
	all := realBlueArchiveCards(t, false)
	if manifest.Kind != "memorial-lobby" || manifest.Count != all.Count() || len(manifest.Images) != all.Count() || all.Count() < 200 {
		t.Fatal("Memorial inventory is incomplete or contains the wrong artwork category")
	}
	for _, entry := range manifest.Images {
		file, err := os.Open(filepath.Join(all.cacheDir, entry.ID+"_rip", "memorial.jpg"))
		if err != nil {
			t.Fatal(err)
		}
		config, format, err := image.DecodeConfig(file)
		file.Close()
		if err != nil || format != "jpeg" || config.Width < 1280 || config.Width > 1920 || config.Width <= config.Height || config.Width != entry.LocalWidth || config.Height != entry.LocalHeight || math.Abs(float64(config.Width)/float64(config.Height)-float64(entry.Width)/float64(entry.Height)) > .003 || !strings.HasPrefix(entry.Name, "Memorial_Lobby_") {
			t.Fatalf("Invalid full-scene memorial image %s: %v %v", entry.Name, config, err)
		}
	}
	cards := realBlueArchiveCards(t, true)
	settings := ThemeSettings(DefaultSettings(), "bluearchive")
	round, err := cards.Round(settings, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if round.ImageURL != "/cards/bluearchive/10010_rip/memorial.jpg" || round.ImageWidth != 1742 || round.ImageHeight != 1177 || round.DisplayName != "砂狼白子" {
		t.Fatalf("Wrong source image or character: %#v", round)
	}
	for _, alias := range []string{"白子", "シロコ", "Shiroko"} {
		if !containsString(round.AcceptedAnswers, alias) {
			t.Fatalf("Missing metadata alias: %s", alias)
		}
	}
	for _, size := range []int{180, 90} {
		settings["cropSize"] = size
		crop, err := cards.Recrop(round, settings, nil)
		if err != nil {
			t.Fatal(err)
		}
		encoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(crop.Image, "data:image/jpeg;base64,"))
		if err != nil {
			t.Fatal(err)
		}
		image, _, err := image.Decode(bytes.NewReader(encoded))
		if err != nil || image.Bounds().Dx() != size || image.Bounds().Dy() != size {
			t.Fatalf("Bad real image crop %d: %v", size, err)
		}
	}
	cards.cacheDir = t.TempDir()
	if _, err = cards.Round(settings, nil, nil); err == nil || !strings.Contains(err.Error(), "本地记忆大厅图片不存在") {
		t.Fatalf("Missing local artwork must fail without a remote fallback: %v", err)
	}
}

func TestBlueArchiveSettingsOnlyExposeSupportedFilters(t *testing.T) {
	base := ThemeSettings(DefaultSettings(), "bluearchive")
	next := NormalizeSettings(base, Obj{"cardBands": []string{"abydos"}, "cardRarities": []int{4}, "cardAttributes": []string{"cool"}, "cardVariants": []string{"trained"}, "faceCropMode": "only", "cardCharacterLimits": []string{"single"}}, "bluearchive")
	if len(gameStrings(next["cardBands"])) != 1 || gameStrings(next["cardBands"])[0] != "abydos" || len(gameStrings(next["cardRarities"])) != 0 || len(gameStrings(next["cardAttributes"])) != 0 || len(gameStrings(next["cardVariants"])) != 1 || gameStrings(next["cardVariants"])[0] != "normal" || next["faceCropMode"] != "none" || len(gameStrings(next["cardCharacterLimits"])) != 2 {
		t.Fatalf("Unsupported filters entered the memorial pool: %v", next)
	}
	meta := GameMeta(0, "bluearchive")
	if len(gameStrings(meta["rarities"])) != 0 || len(gameStrings(meta["attributes"])) != 0 || len(gameStrings(meta["cardCharacterLimits"])) != 0 || len(gameStrings(meta["cardVariants"])) != 1 || len(meta["bands"].([]any)) < 10 {
		t.Fatalf("Misleading memorial metadata: %v", meta)
	}
	cards := realBlueArchiveCards(t, false)
	pool := cards.filtered(next)
	if len(pool) == 0 {
		t.Fatal("School filter has no cards")
	}
	for _, card := range pool {
		if !strings.Contains(gameString(meta["bands"]), "阿拜多斯") {
			t.Fatal("School names missing")
		}
		if cards.bandByCharacter[card.CharacterID] != "abydos" {
			t.Fatal("Another school's character leaked into the Abydos filter")
		}
	}
}

func blueArchiveSocket(t *testing.T, base, query, role string, client *scoreHTTPClient) *websocket.Conn {
	t.Helper()
	u, _ := url.Parse(base)
	cookies := []string{}
	for _, cookie := range client.client.Jar.Cookies(u) {
		cookies = append(cookies, cookie.String())
	}
	headers := http.Header{"Origin": []string{"http://score.test"}, "Cookie": []string{strings.Join(cookies, "; ")}}
	conn, response, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(base, "http")+"/ws?"+query, headers)
	if err != nil {
		t.Fatalf("Memorial WebSocket failed: %v %v", err, response)
	}
	t.Cleanup(func() { conn.Close() })
	if err = conn.WriteJSON(Obj{"type": "hello", "role": role}); err != nil {
		t.Fatal(err)
	}
	return conn
}

func TestBlueArchiveHTTPThemeIsolationAndWebSocketPlay(t *testing.T) {
	app, server := scoreFixture(t)
	app.blueArchiveCards = realBlueArchiveCards(t, true)
	guest := scoreClient(t, server.URL)
	ids := map[string]string{}
	for _, theme := range []string{"bangdream", "sekai", "bluearchive"} {
		status, body := guest.request(t, "POST", "/api/solo", Obj{"theme": theme})
		if status != 200 {
			t.Fatalf("%s solo: %d %v", theme, status, body)
		}
		ids[theme] = asString(body["id"])
		status, repeated := guest.request(t, "POST", "/api/solo", Obj{"theme": theme})
		if status != 200 || repeated["id"] != ids[theme] {
			t.Fatal("Theme-specific solo was not reused")
		}
		if app.solos[ids[theme]].Summary()["theme"] != theme {
			t.Fatal("Wrong solo theme")
		}
	}
	if ids["bluearchive"] == ids["bangdream"] || ids["bluearchive"] == ids["sekai"] || ids["bangdream"] == ids["sekai"] {
		t.Fatal("Solo themes shared a session")
	}
	status, unknown := guest.request(t, "POST", "/api/solo", Obj{"theme": "unrecognized"})
	if status != 200 || unknown["id"] != ids["bangdream"] {
		t.Fatal("Unknown theme did not retain the default")
	}
	status, meta := guest.request(t, "GET", "/api/settings/meta?theme=bluearchive", nil)
	if status != 200 || len(meta["rarities"].([]any)) != 0 {
		t.Fatal("HTTP metadata did not honor BA theme")
	}
	self := blueArchiveSocket(t, server.URL, "solo="+ids["bluearchive"], "self", guest)
	idle := asObject(nextSocketMessage(t, self, socketState("idle"))["state"])
	if asObject(idle["room"])["theme"] != "bluearchive" {
		t.Fatal("Solo wire theme mismatch")
	}
	socketCommand(t, self, "settings", Obj{"showTimer": false, "revealAfterJudge": false})
	socketCommand(t, self, "start", nil)
	playing := asObject(asObject(nextSocketMessage(t, self, socketState("playing"))["state"])["game"])
	if asObject(playing["current"])["displayName"] != "" || asObject(playing["current"])["imageUrl"] != "" {
		t.Fatal("Solo answer leaked before guessing")
	}
	if gameNumber(asObject(playing["current"])["imageWidth"]) != 0 || gameNumber(asObject(playing["current"])["imageHeight"]) != 0 {
		t.Fatal("Solo original dimensions identified an unrevealed memorial")
	}
	socketCommand(t, self, "selfGuess", Obj{"guess": "SHIROKO"})
	finished := asObject(asObject(nextSocketMessage(t, self, socketState("finished"))["state"])["game"])
	if gameNumber(finished["score"]) != 1 || asObject(finished["current"])["displayName"] != "" {
		t.Fatal("Real English alias failed or exposed a hidden answer")
	}
	socketCommand(t, self, "reveal", nil)
	revealed := asObject(asObject(nextSocketMessage(t, self, socketState("revealed"))["state"])["game"])
	if asObject(revealed["current"])["imageUrl"] != "/cards/bluearchive/10010_rip/memorial.jpg" {
		t.Fatal("Wrong memorial reveal URL")
	}
	if gameNumber(asObject(revealed["current"])["imageWidth"]) != 1742 || gameNumber(asObject(revealed["current"])["imageHeight"]) != 1177 {
		t.Fatal("Revealed solo dimensions did not match the actual memorial")
	}

	host := scoreClient(t, server.URL)
	loginBusinessClient(t, host, "admin", "score-test-password")
	status, created := host.request(t, "POST", "/api/rooms", Obj{"theme": "bluearchive", "settings": Obj{"showTimer": false, "revealAfterJudge": false}})
	if status != 201 {
		t.Fatal("Room creation failed", created)
	}
	code := asString(asObject(created["room"])["code"])
	status, fallbackRoom := host.request(t, "POST", "/api/rooms", Obj{"theme": "unrecognized"})
	if status != 201 || asObject(fallbackRoom["room"])["theme"] != "bangdream" {
		t.Fatal("Unknown room theme did not select the default")
	}
	status, renamed := host.request(t, "PATCH", "/api/rooms/"+code, Obj{"theme": "sekai", "name": "记忆大厅房间"})
	if status != 200 || asObject(renamed["room"])["theme"] != "bluearchive" {
		t.Fatal("Room theme changed after creation")
	}
	status, settings := host.request(t, "PATCH", "/api/rooms/"+code+"/settings", Obj{"theme": "bangdream", "cardVariants": []string{"trained"}, "faceCropMode": "only"})
	if status != 200 || asObject(settings["settings"])["faceCropMode"] != "none" {
		t.Fatal("Room settings accepted another theme's filters")
	}
	booth := blueArchiveSocket(t, server.URL, "room="+code+"&theme=sekai", "host", host)
	roomState := asObject(nextSocketMessage(t, booth, socketState("idle"))["state"])
	if asObject(roomState["room"])["theme"] != "bluearchive" {
		t.Fatal("WebSocket query overrode room theme")
	}
	player := blueArchiveSocket(t, server.URL, "room="+code, "player", guest)
	nextSocketMessage(t, player, socketState("idle"))
	socketCommand(t, booth, "start", nil)
	playing = asObject(asObject(nextSocketMessage(t, player, socketState("playing"))["state"])["game"])
	if asObject(playing["current"])["displayName"] != "" {
		t.Fatal("Multiplayer answer leaked")
	}
	if gameNumber(asObject(playing["current"])["imageWidth"]) != 0 || gameNumber(asObject(playing["current"])["imageHeight"]) != 0 {
		t.Fatal("Player original dimensions identified an unrevealed memorial")
	}
	hostPlaying := asObject(asObject(nextSocketMessage(t, booth, socketState("playing"))["state"])["game"])
	if gameNumber(asObject(hostPlaying["current"])["imageWidth"]) != 1742 || gameNumber(asObject(hostPlaying["current"])["imageHeight"]) != 1177 {
		t.Fatal("Host dimensions did not match the actual memorial")
	}
	socketCommand(t, booth, "correct", nil)
	finished = asObject(asObject(nextSocketMessage(t, player, socketState("finished"))["state"])["game"])
	if asObject(finished["current"])["imageUrl"] != "" {
		t.Fatal("Hidden multiplayer result exposed original")
	}
	if gameNumber(asObject(finished["current"])["imageWidth"]) != 0 || gameNumber(asObject(finished["current"])["imageHeight"]) != 0 {
		t.Fatal("Finished multiplayer result exposed original dimensions")
	}
	socketCommand(t, booth, "reveal", nil)
	revealed = asObject(asObject(nextSocketMessage(t, player, socketState("revealed"))["state"])["game"])
	if asObject(revealed["current"])["displayName"] != "砂狼白子" {
		t.Fatal("Multiplayer reveal returned another theme's character")
	}
	response, err := guest.client.Get(server.URL + "/cards/bluearchive/10010_rip/memorial.jpg")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	config, _, err := image.DecodeConfig(response.Body)
	if response.StatusCode != 200 || err != nil || config.Width != 1742 {
		t.Fatal("Self-hosted original image unavailable", err)
	}
	status, _ = guest.request(t, "POST", "/api/auth/logout", Obj{})
	if status != 200 {
		t.Fatal("Anonymous logout failed")
	}
	app.roomsMu.Lock()
	remaining := len(app.solos)
	app.roomsMu.Unlock()
	if remaining != 0 {
		t.Fatal("Logout left a theme-specific solo instance behind")
	}
}
