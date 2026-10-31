package main

import (
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type gameHistory struct {
	Result, Name, Team string
	At                 int64
	RoundID            uint64
	Revealed           bool
}
type gameTeam struct {
	Name  string
	Score float64
}
type gameState struct {
	Status, Message        string
	LeftSeconds, Score     float64
	Loading                bool
	Streak, Total, Recrops int
	Current                *Round
	RoundID                uint64
	History                []gameHistory
	Teams                  map[string]gameTeam
}
type gameUndo struct {
	State            gameState
	CropHistory      []Point
	RecentCards      []string
	RecentCharacters []int
}
type preparedRound struct {
	Round *Round
	Err   error
}
type Game struct {
	mu                                                 sync.Mutex
	commandMu                                          sync.Mutex
	broadcastMu                                        sync.Mutex
	workers                                            sync.WaitGroup
	Code, OwnerID, Mode                                string
	id, name                                           string
	cards                                              *Cards
	settings                                           Obj
	state                                              gameState
	clients                                            map[*GameClient]bool
	createdAt, updatedAt, lastHostSeenAt, lastActiveAt time.Time
	disposed                                           bool
	generation, timerEpoch                             uint64
	timer, autoNextTimer                               *time.Timer
	recentCards                                        []string
	recentCharacters                                   []int
	cropHistory                                        []Point
	undoStack                                          []gameUndo
	prepared                                           chan preparedRound
	preparedKey                                        string
}

func NewGame(cards *Cards, code, name, ownerID, mode string, settings Obj) *Game {
	now := time.Now()
	g := &Game{Code: code, OwnerID: ownerID, Mode: mode, id: randomID(), name: name, cards: cards, settings: gameCopy(settings), clients: map[*GameClient]bool{}, createdAt: now, updatedAt: now, lastHostSeenAt: now, lastActiveAt: now}
	g.state = g.initial()
	return g
}
func (g *Game) initial() gameState {
	message := "等待主持开始"
	if g.Mode == "solo" {
		message = "准备开始你的挑战"
	}
	return gameState{Status: "idle", Message: message, LeftSeconds: gameNumber(g.settings["roundSeconds"]), History: []gameHistory{}, Teams: map[string]gameTeam{"A": {"A 队", 0}, "B": {"B 队", 0}}}
}
func (g *Game) countsLocked() Obj {
	c := Obj{"player": 0, "host": 0, "self": 0}
	for client := range g.clients {
		c[client.Role] = c[client.Role].(int) + 1
	}
	return c
}
func (g *Game) summaryLocked() Obj {
	c := g.countsLocked()
	owner := g.OwnerID
	if g.Mode == "solo" {
		owner = ""
	}
	return Obj{"id": g.id, "theme": g.cards.Theme, "code": g.Code, "name": g.name, "ownerId": owner, "status": g.state.Status, "players": c["player"], "hosts": c["host"], "createdAt": g.createdAt.UnixMilli(), "updatedAt": g.updatedAt.UnixMilli(), "lastHostSeenAt": g.lastHostSeenAt.UnixMilli()}
}
func (g *Game) Summary() Obj      { g.mu.Lock(); defer g.mu.Unlock(); return g.summaryLocked() }
func (g *Game) SettingsCopy() Obj { g.mu.Lock(); defer g.mu.Unlock(); return gameCopy(g.settings) }
func (g *Game) teamsLocked() Obj {
	teams := Obj{}
	for key, team := range g.state.Teams {
		teams[key] = Obj{"name": team.Name, "score": team.Score}
	}
	return teams
}
func (g *Game) Teams() Obj                { g.mu.Lock(); defer g.mu.Unlock(); return g.teamsLocked() }
func (g *Game) LastActiveAt() time.Time   { g.mu.Lock(); defer g.mu.Unlock(); return g.lastActiveAt }
func (g *Game) LastHostSeenAt() time.Time { g.mu.Lock(); defer g.mu.Unlock(); return g.lastHostSeenAt }
func (g *Game) HostCount() int {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.countsLocked()["host"].(int)
}
func (g *Game) ClientCount() int { g.mu.Lock(); defer g.mu.Unlock(); return len(g.clients) }
func (g *Game) Rename(name string) {
	g.mu.Lock()
	g.name = name
	g.updatedAt = time.Now()
	g.mu.Unlock()
	g.broadcast()
}
func (g *Game) snapshotLocked(role string) Obj {
	s := g.state
	var current any
	if r := s.Current; r != nil {
		hidden := role != "host" && s.Status != "revealed"
		name, url := r.DisplayName, r.ImageURL
		width, height := r.ImageWidth, r.ImageHeight
		answers := []string{}
		if hidden {
			name, url = "", ""
			width, height = 0, 0
		}
		if role == "host" {
			answers = append(answers, r.AcceptedAnswers...)
		}
		current = Obj{"displayName": name, "acceptedAnswers": answers, "imageUrl": url, "imageWidth": width, "imageHeight": height, "crop": r.Crop}
	}
	history := []Obj{}
	for _, h := range s.History {
		name := h.Name
		if role != "host" && !h.Revealed {
			name = ""
		}
		history = append(history, Obj{"result": h.Result, "name": name, "team": h.Team, "at": h.At})
	}
	return Obj{"appMode": g.Mode, "room": g.summaryLocked(), "settings": gameCopy(g.settings), "meta": GameMeta(g.cards.FaceBoxImages(), g.cards.Theme), "health": Obj{"clients": len(g.clients), "roleCounts": g.countsLocked(), "preloaded": g.prepared != nil}, "game": Obj{"status": s.Status, "leftSeconds": s.LeftSeconds, "loading": s.Loading, "score": s.Score, "streak": s.Streak, "total": s.Total, "recrops": s.Recrops, "current": current, "history": history, "teams": g.teamsLocked(), "message": s.Message, "canUndo": len(g.undoStack) > 0}}
}
func (g *Game) Snapshot(role string) Obj {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.snapshotLocked(role)
}
func (g *Game) broadcast() {
	g.broadcastMu.Lock()
	defer g.broadcastMu.Unlock()
	g.mu.Lock()
	messages := make(map[*GameClient]Obj, len(g.clients))
	for client := range g.clients {
		messages[client] = Obj{"type": "state", "state": g.snapshotLocked(client.Role)}
	}
	g.mu.Unlock()
	for client, message := range messages {
		if err := client.send(message); err != nil {
			client.close(websocket.CloseGoingAway, "Connection lost")
		}
	}
}
func (g *Game) AddClient(client *GameClient) error {
	g.mu.Lock()
	if g.disposed {
		g.mu.Unlock()
		return errors.New("对局已关闭")
	}
	g.clients[client] = true
	if client.Role == "host" {
		g.lastHostSeenAt = time.Now()
	}
	g.lastActiveAt = time.Now()
	g.mu.Unlock()
	g.broadcast()
	return nil
}
func (g *Game) RemoveClient(client *GameClient) {
	g.mu.Lock()
	if !g.clients[client] {
		g.mu.Unlock()
		return
	}
	if client.Role == "host" {
		g.lastHostSeenAt = time.Now()
	}
	if client.Role == "self" {
		g.lastActiveAt = time.Now()
	}
	delete(g.clients, client)
	g.mu.Unlock()
	g.broadcast()
}
func (g *Game) RevokeSession(sessionID string) {
	g.mu.Lock()
	clients := []*GameClient{}
	for client := range g.clients {
		if client.SessionID == sessionID {
			clients = append(clients, client)
		}
	}
	g.mu.Unlock()
	for _, client := range clients {
		g.RemoveClient(client)
		_ = client.send(Obj{"type": "authRequired", "message": "会话已失效，请重新进入"})
		client.close(websocket.ClosePolicyViolation, "Session revoked")
	}
}
func (g *Game) Command(client *GameClient, command string, payload Obj) error {
	g.commandMu.Lock()
	defer g.commandMu.Unlock()
	g.mu.Lock()
	if !g.clients[client] || g.disposed {
		g.mu.Unlock()
		return httpError(403, "对局连接已失效")
	}
	if client.Role == "player" && (command != "recrop" || !gameBool(g.settings["allowRecrop"]) || !gameBool(g.settings["showPlayerRecrop"])) || client.Role == "self" && !containsString([]string{"start", "next", "recrop", "reveal", "stop", "reset", "selfGuess", "settings", "importSettings", "skip", "undo"}, command) {
		g.mu.Unlock()
		return httpError(403, "没有执行此命令的权限")
	}
	g.lastActiveAt, g.updatedAt = time.Now(), time.Now()
	g.mu.Unlock()
	switch command {
	case "start", "next":
		return g.start()
	case "recrop":
		return g.recrop()
	case "settings", "importSettings":
		return g.updateSettings(payload)
	}
	g.mu.Lock()
	switch command {
	case "correct", "wrong", "skip":
		g.finishLocked(command)
	case "selfGuess":
		if g.Mode == "solo" && g.state.Current != nil && g.state.Status == "playing" {
			guess := strings.TrimSpace(gameString(payload["guess"]))
			if guess == "" {
				g.state.Message = "请输入答案"
			} else {
				result := "wrong"
				for _, name := range g.state.Current.AcceptedAnswers {
					if strings.EqualFold(name, guess) {
						result = "correct"
						break
					}
				}
				g.finishLocked(result)
			}
		}
	case "undo":
		g.undoLocked()
	case "stop":
		g.clearTimersLocked()
		g.generation++
		g.prepared = nil
		g.state.Status = "stopped"
		g.state.Current = nil
		g.state.Loading = false
		g.state.Message = "游戏已停止"
	case "reset":
		g.clearTimersLocked()
		g.generation++
		g.prepared = nil
		teams := g.state.Teams
		g.state = g.initial()
		for key, team := range teams {
			g.state.Teams[key] = gameTeam{Name: team.Name}
		}
		g.recentCards = nil
		g.recentCharacters = nil
		g.cropHistory = nil
		g.undoStack = nil
	case "reveal":
		if g.state.Current != nil {
			g.clearTimersLocked()
			g.state.Status = "revealed"
			g.state.Message = "答案揭晓"
			for i := range g.state.History {
				if g.state.History[i].RoundID == g.state.RoundID {
					g.state.History[i].Revealed = true
				}
			}
		}
	case "hideAnswer":
		if g.state.Status == "revealed" {
			g.state.Status = "playing"
			for _, entry := range g.state.History {
				if entry.RoundID == g.state.RoundID {
					g.state.Status = "finished"
					break
				}
			}
			g.state.Message = "答案已隐藏"
			if g.state.Status == "playing" {
				g.startTimerLocked()
			}
		}
	case "team":
		if team := gameString(payload["team"]); team == "A" || team == "B" {
			g.settings["currentTeam"] = team
		}
	default:
		g.mu.Unlock()
		return httpError(400, "未知游戏命令")
	}
	g.mu.Unlock()
	g.broadcast()
	return nil
}
func (g *Game) UpdateSettings(next Obj) error {
	g.commandMu.Lock()
	defer g.commandMu.Unlock()
	return g.updateSettings(next)
}
func (g *Game) updateSettings(next Obj) error {
	g.mu.Lock()
	if g.disposed {
		g.mu.Unlock()
		return httpError(410, "对局已关闭")
	}
	previous := g.settings
	g.settings = NormalizeSettings(previous, next, g.cards.Theme)
	for _, key := range []string{"A", "B"} {
		if v, ok := next["team"+key+"Name"]; ok {
			name := []rune(strings.TrimSpace(gameString(v)))
			if len(name) > 20 {
				name = name[:20]
			}
			label := string(name)
			if label == "" {
				label = key + " 队"
			}
			team := g.state.Teams[key]
			team.Name = label
			g.state.Teams[key] = team
		}
	}
	if roundConfigKey(previous) != roundConfigKey(g.settings) || previous["mode"] != g.settings["mode"] {
		g.clearTimersLocked()
		g.generation++
		g.prepared = nil
		g.state.Status = "idle"
		g.state.Current = nil
		g.state.Loading = false
		g.state.Message = "配置已更新"
	} else if previous["showTimer"] != g.settings["showTimer"] && g.state.Status == "playing" {
		g.startTimerLocked()
	}
	g.updatedAt = time.Now()
	if !gameBool(g.settings["autoNext"]) && g.autoNextTimer != nil {
		g.autoNextTimer.Stop()
		g.autoNextTimer = nil
	}
	g.mu.Unlock()
	g.broadcast()
	return nil
}
func (g *Game) start() error {
	g.mu.Lock()
	if g.disposed {
		g.mu.Unlock()
		return nil
	}
	g.generation++
	token := g.generation
	g.clearTimersLocked()
	g.state.Status = "loading"
	g.state.Loading = true
	g.state.LeftSeconds = gameNumber(g.settings["roundSeconds"])
	g.state.Recrops = 0
	g.state.Current = nil
	g.state.RoundID = token
	g.state.Message = "加载下一题"
	g.cropHistory = nil
	s := gameCopy(g.settings)
	recentCards := append([]string{}, g.recentCards...)
	recentCharacters := append([]int{}, g.recentCharacters...)
	var prepared chan preparedRound
	if g.preparedKey == roundConfigKey(s) {
		prepared = g.prepared
	}
	g.prepared = nil
	g.mu.Unlock()
	g.broadcast()
	var round *Round
	var err error
	if prepared != nil {
		result := <-prepared
		round, err = result.Round, result.Err
	}
	if round == nil {
		round, err = g.cards.Round(s, recentCards, recentCharacters)
	}
	g.mu.Lock()
	if token != g.generation || g.disposed {
		g.mu.Unlock()
		return nil
	}
	if err != nil {
		g.state.Status = "idle"
		g.state.Loading = false
		g.state.Message = "题目加载失败，请检查卡池和资源连接"
		g.mu.Unlock()
		g.broadcast()
		return err
	}
	g.recentCards = uniqueRecentStrings(round.CardID, g.recentCards, max(4, int(gameNumber(s["avoidRecentCards"]))+8))
	g.recentCharacters = uniqueRecentInts(round.CharacterID, g.recentCharacters, max(4, int(gameNumber(s["avoidRecentCharacters"]))+4))
	g.cropHistory = []Point{{round.Crop.X, round.Crop.Y}}
	g.state.Status = "playing"
	g.state.Loading = false
	g.state.Current = round
	g.state.Message = "答题中"
	g.startTimerLocked()
	channel := make(chan preparedRound, 1)
	g.prepared = channel
	g.preparedKey = roundConfigKey(s)
	recentCards = append([]string{}, g.recentCards...)
	recentCharacters = append([]int{}, g.recentCharacters...)
	g.workers.Add(1)
	g.mu.Unlock()
	g.broadcast()
	go func() {
		defer g.workers.Done()
		r, e := g.cards.Round(s, recentCards, recentCharacters)
		channel <- preparedRound{r, e}
	}()
	return nil
}
func (g *Game) recrop() error {
	g.mu.Lock()
	if g.state.Current == nil || g.state.Status != "playing" || g.state.Loading || !gameBool(g.settings["allowRecrop"]) || g.state.Recrops >= int(gameNumber(g.settings["maxRecrops"])) {
		g.mu.Unlock()
		return nil
	}
	g.state.Loading = true
	round := g.state.Current
	token := g.generation
	s := gameCopy(g.settings)
	history := append([]Point{}, g.cropHistory...)
	g.mu.Unlock()
	g.broadcast()
	crop, err := g.cards.Recrop(round, s, history)
	g.mu.Lock()
	if !g.disposed && token == g.generation {
		g.state.Loading = false
		if err == nil {
			copy := *round
			copy.Crop = crop
			g.state.Current = &copy
			g.state.Recrops++
			g.cropHistory = append(g.cropHistory, Point{crop.X, crop.Y})
			if len(g.cropHistory) > 8 {
				g.cropHistory = g.cropHistory[len(g.cropHistory)-8:]
			}
			g.state.Message = "已重切"
		}
	}
	g.mu.Unlock()
	g.broadcast()
	return err
}
func cloneGameState(s gameState) gameState {
	s.History = append([]gameHistory{}, s.History...)
	teams := map[string]gameTeam{}
	for k, v := range s.Teams {
		teams[k] = v
	}
	s.Teams = teams
	return s
}
func (g *Game) finishLocked(result string) {
	if g.state.Current == nil || g.state.Status != "playing" {
		return
	}
	g.clearTimersLocked()
	saved := gameUndo{cloneGameState(g.state), append([]Point{}, g.cropHistory...), append([]string{}, g.recentCards...), append([]int{}, g.recentCharacters...)}
	g.undoStack = append([]gameUndo{saved}, g.undoStack...)
	if len(g.undoStack) > 8 {
		g.undoStack = g.undoStack[:8]
	}
	s := &g.state
	s.Total++
	s.Status = "finished"
	revealed := gameBool(g.settings["revealAfterJudge"])
	if revealed {
		s.Status = "revealed"
	}
	if result == "correct" {
		points := gameNumber(g.settings["correctPoints"])
		if gameBool(g.settings["streakBonus"]) {
			points += float64(s.Streak)
		}
		s.Score += points
		s.Streak++
		if g.settings["mode"] == "versus" {
			key := gameString(g.settings["currentTeam"])
			team := s.Teams[key]
			team.Score += points
			s.Teams[key] = team
		}
		s.Message = "回答正确"
	} else {
		s.Score = max(0, s.Score-gameNumber(g.settings["wrongPenalty"]))
		s.Streak = 0
		switch result {
		case "wrong":
			s.Message = "回答错误"
		case "timeout":
			s.Message = "时间到"
		default:
			s.Message = "已跳过"
		}
	}
	s.History = append([]gameHistory{{result, s.Current.DisplayName, gameString(g.settings["currentTeam"]), time.Now().UnixMilli(), s.RoundID, revealed}}, s.History...)
	if len(s.History) > 12 {
		s.History = s.History[:12]
	}
	if gameBool(g.settings["autoNext"]) {
		token, epoch := g.generation, g.timerEpoch
		g.autoNextTimer = time.AfterFunc(time.Duration(gameNumber(g.settings["autoNextDelay"]))*time.Millisecond, func() {
			g.commandMu.Lock()
			defer g.commandMu.Unlock()
			g.mu.Lock()
			valid := !g.disposed && token == g.generation && epoch == g.timerEpoch && gameBool(g.settings["autoNext"])
			g.mu.Unlock()
			if valid {
				_ = g.start()
			}
		})
	}
}
func (g *Game) undoLocked() {
	if len(g.undoStack) == 0 {
		return
	}
	saved := g.undoStack[0]
	g.undoStack = g.undoStack[1:]
	g.clearTimersLocked()
	g.generation++
	g.prepared = nil
	g.state = saved.State
	g.cropHistory = saved.CropHistory
	g.recentCards = saved.RecentCards
	g.recentCharacters = saved.RecentCharacters
	if g.state.Status == "playing" {
		g.startTimerLocked()
	}
}
func (g *Game) clearTimersLocked() {
	g.timerEpoch++
	if g.timer != nil {
		g.timer.Stop()
		g.timer = nil
	}
	if g.autoNextTimer != nil {
		g.autoNextTimer.Stop()
		g.autoNextTimer = nil
	}
}
func (g *Game) startTimerLocked() {
	g.clearTimersLocked()
	if !gameBool(g.settings["showTimer"]) {
		return
	}
	epoch := g.timerEpoch
	var tick func()
	tick = func() {
		g.mu.Lock()
		if g.disposed || epoch != g.timerEpoch || g.state.Status != "playing" {
			g.mu.Unlock()
			return
		}
		g.state.LeftSeconds = max(0, g.state.LeftSeconds-1)
		if g.state.LeftSeconds == 0 {
			g.finishLocked("timeout")
		} else {
			g.timer = time.AfterFunc(time.Second, tick)
		}
		g.mu.Unlock()
		g.broadcast()
	}
	g.timer = time.AfterFunc(time.Second, tick)
}
func (g *Game) Dispose(message string) {
	g.mu.Lock()
	if g.disposed {
		g.mu.Unlock()
		return
	}
	g.disposed = true
	g.generation++
	g.clearTimersLocked()
	g.prepared = nil
	clients := []*GameClient{}
	for c := range g.clients {
		clients = append(clients, c)
	}
	g.clients = map[*GameClient]bool{}
	g.state.Current = nil
	g.mu.Unlock()
	for _, c := range clients {
		_ = c.send(Obj{"type": "roomClosed", "message": message})
		c.close(websocket.CloseNormalClosure, "Game closed")
	}
}
func uniqueRecentStrings(value string, old []string, limit int) []string {
	result := []string{value}
	for _, v := range old {
		if v != value && len(result) < limit {
			result = append(result, v)
		}
	}
	return result
}
func uniqueRecentInts(value int, old []int, limit int) []int {
	result := []int{value}
	for _, v := range old {
		if v != value && len(result) < limit {
			result = append(result, v)
		}
	}
	return result
}
