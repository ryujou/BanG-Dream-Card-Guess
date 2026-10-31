package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type scoreSubscription struct{ kind, ip string }
type Scores struct {
	store   *Store
	mu      sync.Mutex
	streams map[chan Obj]scoreSubscription
}

func NewScores(store *Store) *Scores {
	return &Scores{store: store, streams: make(map[chan Obj]scoreSubscription)}
}

func betterScore(a, b Obj) bool {
	if number(a["final_score"]) != number(b["final_score"]) {
		return number(a["final_score"]) > number(b["final_score"])
	}
	if number(a["duration"]) != number(b["duration"]) {
		return number(a["duration"]) < number(b["duration"])
	}
	return number(a["at"]) < number(b["at"])
}
func scoreItem(row Obj) Obj {
	name := asString(row["player_name"])
	if name == "" {
		name = asString(row["player_id"])
	}
	return Obj{"id": row["id"], "username": name, "playerId": row["player_id"], "score": row["final_score"], "duration": row["duration"], "at": row["at"], "max_combo": row["max_combo"], "full_combo": row["full_combo"], "rank": row["ranks"], "level": row["levels"], "difficulty": row["difficulty"]}
}
func (s *Scores) State(kind string) (Obj, error) {
	rows, err := s.store.ScoreRows(kind)
	if err != nil {
		return nil, err
	}
	if kind == "queue" {
		top := append([]Obj{}, rows...)
		sort.SliceStable(top, func(i, j int) bool { return number(top[i]["score"]) > number(top[j]["score"]) })
		if len(top) > 20 {
			top = top[:20]
		}
		recent := rows
		if len(recent) > 20 {
			recent = recent[:20]
		}
		if recent == nil {
			recent = []Obj{}
		}
		return Obj{"total": len(rows), "top": top, "leaderboard": top, "recent": recent}, nil
	}
	best := map[string]Obj{}
	for _, row := range rows {
		id := asString(row["player_id"])
		previous := best[id]
		if previous == nil || betterScore(row, previous) {
			best[id] = row
		}
	}
	ordered := []Obj{}
	for _, row := range best {
		ordered = append(ordered, row)
	}
	sort.Slice(ordered, func(i, j int) bool { return betterScore(ordered[i], ordered[j]) })
	if len(ordered) > 20 {
		ordered = ordered[:20]
	}
	leaderboard, recent := []Obj{}, []Obj{}
	for _, row := range ordered {
		leaderboard = append(leaderboard, scoreItem(row))
	}
	for i, row := range rows {
		if i == 20 {
			break
		}
		recent = append(recent, scoreItem(row))
	}
	return Obj{"total": len(rows), "top": leaderboard, "leaderboard": leaderboard, "recent": recent}, nil
}
func (s *Scores) Ranking(query url.Values, my bool) ([]Obj, error) {
	rows, err := s.store.ScoreRows("note")
	if err != nil {
		return nil, err
	}
	level, _ := strconv.Atoi(query.Get("levels"))
	if level == 0 {
		level = 1
	}
	difficulty := query.Get("difficulty")
	if difficulty == "" {
		difficulty = "normal"
	}
	filtered := []Obj{}
	for _, row := range rows {
		if int(number(row["levels"])) == level && asString(row["difficulty"]) == difficulty {
			filtered = append(filtered, row)
		}
	}
	sort.SliceStable(filtered, func(i, j int) bool { return betterScore(filtered[i], filtered[j]) })
	typeName := query.Get("type")
	if typeName == "" {
		typeName = "top"
	}
	if my {
		typeName = "myRank"
	}
	if typeName == "top" || typeName == "myRank" {
		seen := map[string]bool{}
		unique := []Obj{}
		for _, row := range filtered {
			id := asString(row["player_id"])
			if !seen[id] {
				unique = append(unique, row)
				seen[id] = true
			}
		}
		filtered = unique
	}
	if typeName == "recent" || typeName == "myRecent" {
		sort.SliceStable(filtered, func(i, j int) bool { return number(filtered[i]["at"]) > number(filtered[j]["at"]) })
	}
	if typeName == "myRecent" || typeName == "myBest" {
		personal := []Obj{}
		for _, row := range filtered {
			if asString(row["player_id"]) == query.Get("playerId") {
				personal = append(personal, row)
			}
		}
		filtered = personal
	}
	result := []Obj{}
	for index, row := range filtered {
		if typeName == "myRank" && asString(row["player_id"]) != query.Get("playerId") {
			continue
		}
		copy := Obj{}
		for k, v := range row {
			copy[k] = v
		}
		copy["user_rank"] = index + 1
		result = append(result, copy)
		if len(result) == 30 {
			break
		}
	}
	return result, nil
}
func (s *Scores) subscribe(kind, ip string) (chan Obj, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	count := 0
	for _, entry := range s.streams {
		if entry.ip == ip {
			count++
		}
	}
	if len(s.streams) >= 1024 || count >= 64 {
		return nil, httpError(429, "实时成绩连接过多，请关闭重复页面后重试")
	}
	ch := make(chan Obj, 1)
	s.streams[ch] = scoreSubscription{kind, ip}
	return ch, nil
}
func (s *Scores) unsubscribe(ch chan Obj) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.streams[ch]; ok {
		delete(s.streams, ch)
		close(ch)
	}
}
func (s *Scores) Broadcast(kind string) {
	state, err := s.State(kind)
	if err != nil {
		log.Printf("read %s scores for broadcast: %v", kind, err)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch, entry := range s.streams {
		if entry.kind != kind {
			continue
		}
		select {
		case ch <- state:
		default:
			select {
			case <-ch:
			default:
			}
			ch <- state
		}
	}
}
func (s *Scores) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for ch := range s.streams {
		close(ch)
		delete(s.streams, ch)
	}
}
func (s *Scores) serveEvents(w http.ResponseWriter, r *http.Request, kind string) error {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return httpError(500, "当前连接不支持实时更新")
	}
	ch, err := s.subscribe(kind, ClientIP(r))
	if err != nil {
		return err
	}
	defer s.unsubscribe(ch)
	initial, err := s.State(kind)
	if err != nil {
		return err
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("X-Accel-Buffering", "no")
	send := func(data Obj) error {
		encoded, err := json.Marshal(data)
		if err != nil {
			return err
		}
		prefix := ""
		if kind == "note" {
			prefix = "event: scores\n"
		}
		_, err = fmt.Fprintf(w, "%sdata: %s\n\n", prefix, encoded)
		flusher.Flush()
		return err
	}
	if err = send(initial); err != nil {
		return nil
	}
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return nil
		case data, open := <-ch:
			if !open {
				return nil
			}
			if send(data) != nil {
				return nil
			}
		case <-ticker.C:
			if _, err = fmt.Fprint(w, ": keepalive\n\n"); err != nil {
				return nil
			}
			flusher.Flush()
		}
	}
}

func scoreField(body Obj, camel, snake string) any {
	if v, ok := body[camel]; ok {
		return v
	}
	return body[snake]
}
func scoreNumeric(value any) (float64, bool) {
	var n float64
	switch v := value.(type) {
	case float64:
		n = v
	case float32:
		n = float64(v)
	case int:
		n = float64(v)
	case int64:
		n = float64(v)
	case json.Number:
		parsed, err := v.Float64()
		if err != nil {
			return 0, false
		}
		n = parsed
	default:
		return 0, false
	}
	return n, !math.IsNaN(n) && !math.IsInf(n, 0)
}
func scoreInt(value any, min, max int) (int, error) {
	n, ok := scoreNumeric(value)
	if !ok || math.Trunc(n) != n || n < float64(min) || n > float64(max) {
		return 0, httpError(400, "成绩数值无效")
	}
	return int(n), nil
}
func noteMode(body Obj) (int, string, error) {
	level, err := scoreInt(body["levels"], 1, 3)
	difficulty := asString(body["difficulty"])
	if err != nil {
		return 0, "", err
	}
	switch difficulty {
	case "easy", "normal", "hard", "endless":
		return level, difficulty, nil
	}
	return 0, "", httpError(400, "关卡或难度无效")
}
func normalizeNote(body Obj, playerID string, run *NoteRun, now int64) (Obj, error) {
	if asString(scoreField(body, "playerId", "player_id")) != playerID {
		return nil, httpError(403, "成绩身份与当前会话不一致")
	}
	level, difficulty, err := noteMode(body)
	if err != nil {
		return nil, err
	}
	if level != run.Levels || difficulty != run.Difficulty {
		return nil, httpError(400, "成绩关卡与本次开局不一致")
	}
	duration, err := scoreInt(body["duration"], 15, 3600)
	if err != nil {
		return nil, httpError(400, "游玩至少15秒后才可提交有效成绩")
	}
	if now-run.StartedAt < 15000 || int64(duration)*1000 > now-run.StartedAt+1000 {
		return nil, httpError(400, "成绩时长超过本次实际开局时间")
	}
	finalScore, err := scoreInt(scoreField(body, "finalScore", "final_score"), 0, 99999999)
	if err != nil {
		return nil, err
	}
	interval := 800
	if difficulty == "normal" || difficulty == "endless" {
		interval = 750
		if level == 3 {
			interval = 790
		}
	} else if difficulty == "hard" {
		interval = 700
		if level == 3 {
			interval = 780
		}
	}
	// Each spawn row has at most six bears. One extra second accounts for the client's floored duration.
	spawnRows := int(math.Ceil(float64((duration+1)*1000) / float64(interval)))
	maxBears := spawnRows * 6
	optionalInt := func(camel, snake string, max int) (int, error) {
		v := scoreField(body, camel, snake)
		if v == nil {
			return 0, nil
		}
		return scoreInt(v, 0, max)
	}
	kills, err := optionalInt("kumaKill", "kuma_kill", maxBears)
	if err != nil {
		return nil, err
	}
	escaped, err := optionalInt("kumaLive", "kuma_live", maxBears)
	if err != nil {
		return nil, err
	}
	combo, err := optionalInt("maxCombo", "max_combo", maxBears)
	if err != nil {
		return nil, err
	}
	if kills+escaped > maxBears || combo > kills {
		return nil, httpError(400, "连击或击杀数超过本次游戏可能范围")
	}
	bossHealth := map[string][]int{"easy": {800, 4500, 6000}, "normal": {1400, 9000, 9500}, "endless": {1400, 9000, 9500}, "hard": {2800, 13500, 14000}}[difficulty][level-1]
	maxScore := maxBears*50 + bossHealth*5 + duration*50 + 2100
	// Level three adds shield kills, items and attack bonuses; this is a conservative ceiling, not authoritative gameplay verification.
	if level == 3 {
		maxScore = maxBears*600 + spawnRows*2000 + (bossHealth+5+5*spawnRows)*10 + duration*50 + 15000
	}
	if finalScore > maxScore {
		return nil, httpError(400, "分数超过本次时长和关卡的可能范围")
	}
	name := []rune(strings.TrimSpace(asString(scoreField(body, "playerName", "player_name"))))
	if len(name) > 30 {
		name = name[:30]
	}
	if len(name) == 0 {
		name = []rune("玩家")
	}
	rank := asString(scoreField(body, "ranks", "rank"))
	switch rank {
	case "sss", "ssp", "ss", "sp", "s", "ap", "a", "bp", "b", "cp", "c", "d":
	default:
		rank = "d"
	}
	fullCombo := 0
	if combo > 0 && escaped == 0 {
		fullCombo = 1
	}
	row := Obj{"player_id": playerID, "player_name": string(name), "levels": level, "difficulty": difficulty, "final_score": finalScore, "duration": duration, "max_combo": combo, "full_combo": fullCombo, "ranks": rank, "kuma_kill": kills, "kuma_live": escaped, "at": now, "create_time": time.UnixMilli(now).UTC().Format(time.RFC3339Nano)}
	for _, field := range []struct {
		camel, snake string
		max          int
	}{{"fps", "fps", 1000}, {"win", "win", 1}, {"life", "life", 2*spawnRows + 5}, {"lifeLost", "life_lost", maxBears + 2*spawnRows + 5}} {
		n, err := optionalInt(field.camel, field.snake, field.max)
		if err != nil {
			return nil, err
		}
		row[field.snake] = n
	}
	for _, field := range [][2]string{{"bossRatio", "boss_ratio"}, {"bulletRatio", "bullet_ratio"}, {"itemRatio", "item_ratio"}} {
		v := scoreField(body, field[0], field[1])
		n := 0.0
		if v != nil {
			var ok bool
			n, ok = scoreNumeric(v)
			if !ok || n < 0 || n > 1 {
				return nil, httpError(400, "成绩比例无效")
			}
		}
		row[field[1]] = n
	}
	return row, nil
}

func RegisterScores(mux *http.ServeMux, a *App) {
	handle := func(pattern string, fn func(http.ResponseWriter, *http.Request) error) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			if err := fn(w, r); err != nil {
				a.requestError(err)
				writeError(w, err)
			}
		})
	}
	for _, route := range []struct{ path, kind string }{{"/api/scores", "note"}, {"/api/note-shooter-scores", "note"}, {"/api/queue-scores", "queue"}} {
		handle("GET "+route.path, func(w http.ResponseWriter, r *http.Request) error {
			state, err := a.scores.State(route.kind)
			if err == nil {
				writeJSON(w, 200, state)
			}
			return err
		})
		handle("GET "+route.path+"/events", func(w http.ResponseWriter, r *http.Request) error { return a.scores.serveEvents(w, r, route.kind) })
	}
	handle("DELETE /api/scores/{id}", func(w http.ResponseWriter, r *http.Request) error {
		if _, err := a.requireUser(r, false); err != nil {
			return err
		}
		if err := a.store.DeleteScore(r.PathValue("id")); err != nil {
			return err
		}
		a.scores.Broadcast("note")
		writeJSON(w, 200, Obj{"ok": true})
		return nil
	})
	handle("DELETE /api/scores", func(w http.ResponseWriter, r *http.Request) error {
		if _, err := a.requireUser(r, true); err != nil {
			return err
		}
		if err := a.store.ClearScores(""); err != nil {
			return err
		}
		a.scores.Broadcast("note")
		a.scores.Broadcast("queue")
		writeJSON(w, 200, Obj{"ok": true})
		return nil
	})
	handle("DELETE /api/note-shooter-scores", func(w http.ResponseWriter, r *http.Request) error {
		if _, err := a.requireUser(r, false); err != nil {
			return err
		}
		body, err := readBody(w, r, 1<<20)
		if err != nil {
			return err
		}
		if asString(body["scope"]) == "player" && asString(body["playerId"]) != "" {
			rows, err := a.store.ScoreRows("note")
			if err != nil {
				return err
			}
			for _, row := range rows {
				if asString(row["player_id"]) == asString(body["playerId"]) {
					if err = a.store.DeleteScore(asString(row["id"])); err != nil {
						return err
					}
				}
			}
		} else {
			if err = a.store.DeleteScore(asString(body["id"])); err != nil {
				return err
			}
		}
		a.scores.Broadcast("note")
		writeJSON(w, 200, Obj{"ok": true})
		return nil
	})
	handle("POST /api/queue-scores", func(w http.ResponseWriter, r *http.Request) error {
		if _, err := a.requireUser(r, false); err != nil {
			return err
		}
		if err := a.limit("score:"+ClientIP(r), 30, time.Minute); err != nil {
			return err
		}
		body, err := readBody(w, r, 1<<20)
		if err != nil {
			return err
		}
		score, err := scoreInt(body["score"], 0, 999999)
		if err != nil {
			return err
		}
		duration, err := scoreInt(body["duration"], 0, 3600)
		if err != nil {
			return err
		}
		name := []rune(strings.TrimSpace(asString(body["username"])))
		if len(name) > 30 {
			name = name[:30]
		}
		if len(name) == 0 {
			name = []rune("匿名")
		}
		if _, err = a.store.AddScore("queue", Obj{"username": string(name), "score": score, "duration": duration, "at": time.Now().UnixMilli()}); err != nil {
			return err
		}
		a.scores.Broadcast("queue")
		state, err := a.scores.State("queue")
		if err != nil {
			return err
		}
		state["ok"] = true
		writeJSON(w, 200, state)
		return nil
	})
	handle("POST /note-shooter-api/openStat", func(w http.ResponseWriter, r *http.Request) error {
		if err := a.limit("open:"+ClientIP(r), 300, time.Minute); err != nil {
			return err
		}
		if _, err := readBody(w, r, 1<<20); err != nil {
			return err
		}
		session := a.session(r)
		if session == nil {
			return httpError(401, "请刷新页面后重试")
		}
		updated, err := a.sessions.Mutate(session.ID, func(s *Session) error {
			if s.NotePlayerID == "" {
				s.NotePlayerID = "P" + randomID()
			}
			return nil
		})
		if err != nil {
			return err
		}
		writeJSON(w, 200, Obj{"ok": true, "playerId": updated.NotePlayerID})
		return nil
	})
	handle("POST /note-shooter-api/startStat", func(w http.ResponseWriter, r *http.Request) error {
		if err := a.limit("start:"+ClientIP(r), 300, time.Minute); err != nil {
			return err
		}
		body, err := readBody(w, r, 1<<20)
		if err != nil {
			return err
		}
		level, difficulty, err := noteMode(body)
		if err != nil {
			return err
		}
		session := a.session(r)
		if session == nil {
			return httpError(401, "请刷新页面后重试")
		}
		updated, err := a.sessions.Mutate(session.ID, func(s *Session) error {
			if s.NotePlayerID == "" {
				s.NotePlayerID = "P" + randomID()
			}
			s.NoteRun = &NoteRun{ID: randomID(), StartedAt: time.Now().UnixMilli(), Levels: level, Difficulty: difficulty}
			return nil
		})
		if err != nil {
			return err
		}
		writeJSON(w, 200, Obj{"ok": true, "playerId": updated.NotePlayerID, "runId": updated.NoteRun.ID})
		return nil
	})
	handle("POST /note-shooter-api/gameStat", func(w http.ResponseWriter, r *http.Request) error {
		if err := a.limit("score:"+ClientIP(r), 300, time.Minute); err != nil {
			return err
		}
		body, err := readBody(w, r, 1<<20)
		if err != nil {
			return err
		}
		session := a.session(r)
		if session == nil {
			return httpError(401, "请刷新页面后重试")
		}
		_, err = a.sessions.Mutate(session.ID, func(s *Session) error {
			if s.NoteRun == nil || s.NoteRun.ID != asString(body["runId"]) {
				return httpError(409, "本次对局不存在或成绩已提交")
			}
			row, err := normalizeNote(body, s.NotePlayerID, s.NoteRun, time.Now().UnixMilli())
			if err != nil {
				return err
			}
			if _, err = a.store.AddScore("note", row); err != nil {
				return err
			}
			s.NoteRun = nil
			return nil
		})
		if err != nil {
			return err
		}
		a.scores.Broadcast("note")
		writeJSON(w, 200, Obj{"ok": true})
		return nil
	})
	for _, route := range []struct {
		path string
		my   bool
	}{{"/note-shooter-api/getRanking", false}, {"/note-shooter-api/getMyRanking", true}} {
		handle("GET "+route.path, func(w http.ResponseWriter, r *http.Request) error {
			query := r.URL.Query()
			if route.my || strings.HasPrefix(query.Get("type"), "my") {
				session := a.session(r)
				id := ""
				if session != nil {
					id = session.NotePlayerID
				}
				query.Set("playerId", id)
			}
			rows, err := a.scores.Ranking(query, route.my)
			if err != nil {
				return err
			}
			writeJSON(w, 200, Obj{"ok": true, "data": rows})
			return nil
		})
	}
}
