package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
)

var bandOptions = []Obj{
	{"id": "poppin-party", "name": "Poppin'Party", "characters": []int{1, 2, 3, 4, 5}},
	{"id": "afterglow", "name": "Afterglow", "characters": []int{6, 7, 8, 9, 10}},
	{"id": "hello-happy-world", "name": "Hello, Happy World!", "characters": []int{11, 12, 13, 14, 15}},
	{"id": "pastel-palettes", "name": "Pastel*Palettes", "characters": []int{16, 17, 18, 19, 20}},
	{"id": "roselia", "name": "Roselia", "characters": []int{21, 22, 23, 24, 25}},
	{"id": "morfonica", "name": "Morfonica", "characters": []int{26, 27, 28, 29, 30}},
	{"id": "raise-a-suilen", "name": "RAISE A SUILEN", "characters": []int{31, 32, 33, 34, 35}},
	{"id": "mygo", "name": "MyGO!!!!!", "characters": []int{36, 37, 38, 39, 40}},
}
var sekaiBands = []Obj{
	{"id": "leo-need", "name": "Leo/need", "characters": []int{1, 2, 3, 4}},
	{"id": "more-more-jump", "name": "MORE MORE JUMP!", "characters": []int{5, 6, 7, 8}},
	{"id": "vivid-bad-squad", "name": "Vivid BAD SQUAD", "characters": []int{9, 10, 11, 12}},
	{"id": "wonderlands-showtime", "name": "Wonderlands×Showtime", "characters": []int{13, 14, 15, 16}},
	{"id": "nightcord", "name": "25时，在Nightcord。", "characters": []int{17, 18, 19, 20}},
	{"id": "virtual-singer", "name": "VIRTUAL SINGER", "characters": []int{21, 22, 23, 24, 25, 26}},
}
var difficultyPresets = Obj{"easy": Obj{"cropSize": 230, "candidateCount": 90}, "normal": Obj{"cropSize": 180, "candidateCount": 120}, "hard": Obj{"cropSize": 130, "candidateCount": 170}}
var numericRanges = map[string][2]float64{
	"roundSeconds": {5, 600}, "questionsPerPlayer": {1, 50}, "cropSize": {60, 260}, "candidateCount": {10, 500},
	"maxRecrops": {0, 10}, "correctPoints": {0, 1000}, "wrongPenalty": {0, 1000}, "autoNextDelay": {500, 30000},
	"avoidRecentCards": {0, 200}, "avoidRecentCharacters": {0, 100}, "stopwatchTargetSeconds": {1, 99.99}, "stopwatchToleranceSeconds": {0.01, 99.99},
}

func GameMeta(faceCount int, theme string) Obj {
	bands, rarities, attributes, faceModes := bandOptions, []int{1, 2, 3, 4, 5}, []string{"cool", "happy", "powerful", "pure"}, []string{"auto", "none", "avoid", "prefer", "only"}
	variants, characterLimits := []string{"normal", "trained"}, []string{"single", "multiple"}
	if theme == "sekai" {
		bands, rarities, attributes, faceModes = sekaiBands, []int{3, 4}, []string{"cool", "cute", "happy", "pure", "mysterious"}, []string{"none"}
	} else if theme == "bluearchive" {
		bands, rarities, attributes, faceModes = blueArchiveBands, []int{}, []string{}, []string{"none"}
		variants, characterLimits = []string{"normal"}, []string{}
	}
	return gameCopy(Obj{"bands": bands, "rarities": rarities, "attributes": attributes, "difficultyPresets": difficultyPresets, "faceCropModes": faceModes, "cardCharacterLimits": characterLimits, "cardVariants": variants, "numericRanges": numericRanges, "faceBoxImages": faceCount})
}

func DefaultSettings() Obj {
	bands := []string{}
	for _, band := range bandOptions {
		bands = append(bands, band["id"].(string))
	}
	return Obj{"mode": "single", "difficulty": "normal", "faceCropMode": "auto", "cardCharacterLimits": []string{"single", "multiple"}, "cardVariants": []string{"normal", "trained"}, "roundSeconds": 60, "questionsPerPlayer": 3, "allowRecrop": true, "showPlayerRecrop": true, "soundEnabled": true, "maxRecrops": 3, "cropSize": 180, "candidateCount": 120, "avoidRecentCards": 20, "avoidRecentCharacters": 8, "cardBands": bands, "cardRarities": []int{1, 2, 3, 4, 5}, "cardAttributes": []string{"cool", "happy", "powerful", "pure"}, "correctPoints": 1, "wrongPenalty": 0, "streakBonus": false, "showTimer": true, "revealAfterJudge": true, "autoNext": false, "autoNextDelay": 1800, "currentTeam": "A", "stopwatchTargetSeconds": 10, "stopwatchToleranceSeconds": .02}
}

func ThemeSettings(base Obj, theme string) Obj {
	s := gameCopy(base)
	if theme == "sekai" {
		bands := []string{}
		for _, b := range sekaiBands {
			bands = append(bands, b["id"].(string))
		}
		s["cardBands"], s["cardRarities"], s["cardAttributes"] = bands, []int{3, 4}, []string{"cool", "cute", "happy", "pure", "mysterious"}
		s["faceCropMode"], s["cardCharacterLimits"] = "none", []string{"single", "multiple"}
	} else if theme == "bluearchive" {
		bands := []string{}
		for _, b := range blueArchiveBands {
			bands = append(bands, b["id"].(string))
		}
		s["cardBands"], s["cardRarities"], s["cardAttributes"] = bands, []int{}, []string{}
		s["faceCropMode"], s["cardCharacterLimits"], s["cardVariants"] = "none", []string{"single", "multiple"}, []string{"normal"}
	}
	return s
}

func NormalizeSettings(base, next Obj, theme string) Obj {
	s := gameCopy(base)
	choices := map[string][]string{"mode": {"single", "versus"}, "difficulty": {"easy", "normal", "hard"}, "faceCropMode": {"auto", "none", "avoid", "prefer", "only"}, "currentTeam": {"A", "B"}}
	for key, allowed := range choices {
		if containsString(allowed, gameString(next[key])) {
			s[key] = next[key]
		}
	}
	for key, limits := range numericRanges {
		if v, exists := next[key]; exists {
			if n, ok := settingNumber(v); ok {
				s[key] = math.Max(limits[0], math.Min(limits[1], n))
			}
		}
	}
	for _, key := range []string{"allowRecrop", "showPlayerRecrop", "soundEnabled", "streakBonus", "showTimer", "revealAfterJudge", "autoNext"} {
		if v, ok := next[key].(bool); ok {
			s[key] = v
		}
	}
	defaults, meta := ThemeSettings(DefaultSettings(), theme), GameMeta(0, theme)
	for _, key := range []string{"cardBands", "cardAttributes", "cardCharacterLimits", "cardVariants", "cardRarities"} {
		v, exists := next[key]
		if !exists {
			continue
		}
		allowed := gameStrings(defaults[key])
		if key == "cardAttributes" {
			allowed = gameStrings(meta["attributes"])
		}
		items := []string{}
		for _, item := range gameStrings(v) {
			if containsString(allowed, item) && !containsString(items, item) {
				items = append(items, item)
			}
		}
		if len(items) == 0 {
			items = gameStrings(defaults[key])
		}
		if key == "cardRarities" {
			numbers := []int{}
			for _, item := range items {
				n, _ := strconv.Atoi(item)
				numbers = append(numbers, n)
			}
			s[key] = numbers
		} else {
			s[key] = items
		}
	}
	if s["difficulty"] != base["difficulty"] {
		for key, v := range difficultyPresets[gameString(s["difficulty"])].(Obj) {
			s[key] = v
		}
	}
	s["stopwatchToleranceSeconds"] = math.Min(gameNumber(s["stopwatchToleranceSeconds"]), gameNumber(s["stopwatchTargetSeconds"]))
	if theme == "sekai" || theme == "bluearchive" {
		s["faceCropMode"], s["cardCharacterLimits"] = "none", []string{"single", "multiple"}
	}
	if theme == "bluearchive" {
		s["cardRarities"], s["cardAttributes"], s["cardVariants"] = []int{}, []string{}, []string{"normal"}
	}
	return s
}

func roundConfigKey(s Obj) string {
	values := []any{}
	for _, key := range []string{"cropSize", "candidateCount", "difficulty", "cardBands", "cardRarities", "cardAttributes", "cardVariants", "cardCharacterLimits", "faceCropMode", "avoidRecentCards", "avoidRecentCharacters"} {
		values = append(values, s[key])
	}
	b, _ := json.Marshal(values)
	return string(b)
}
func effectiveFaceMode(s Obj) string {
	mode := gameString(s["faceCropMode"])
	if containsString([]string{"none", "avoid", "prefer", "only"}, mode) {
		return mode
	}
	switch s["difficulty"] {
	case "easy":
		return "prefer"
	case "hard":
		return "avoid"
	}
	return "none"
}
func gameCopy(o Obj) Obj {
	b, _ := json.Marshal(o)
	var result Obj
	_ = json.Unmarshal(b, &result)
	return result
}
func gameString(v any) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}
func settingNumber(v any) (float64, bool) {
	n, err := strconv.ParseFloat(strings.TrimSpace(gameString(v)), 64)
	return n, err == nil && !math.IsNaN(n) && !math.IsInf(n, 0)
}
func gameNumber(v any) float64 { n, _ := settingNumber(v); return n }
func gameBool(v any) bool      { b, _ := v.(bool); return b }
func gameStrings(v any) []string {
	var raw []string
	switch a := v.(type) {
	case []string:
		raw = a
	case []int:
		for _, x := range a {
			raw = append(raw, strconv.Itoa(x))
		}
	case []any:
		for _, x := range a {
			raw = append(raw, gameString(x))
		}
	case nil:
		return []string{}
	default:
		raw = strings.Split(gameString(v), ",")
	}
	result := []string{}
	for _, item := range raw {
		if s := strings.TrimSpace(item); s != "" {
			result = append(result, s)
		}
	}
	return result
}
func containsString(a []string, s string) bool {
	for _, v := range a {
		if v == s {
			return true
		}
	}
	return false
}
