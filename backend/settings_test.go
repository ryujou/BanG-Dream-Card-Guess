package main

import "testing"

func TestSettingsBoundsThemeAndIndependentCopies(t *testing.T) {
	base := DefaultSettings()
	next := NormalizeSettings(base, Obj{"difficulty": "hard", "cropSize": 1, "roundSeconds": 999, "wrongPenalty": -1, "showTimer": false, "cardBands": []string{"unknown"}, "stopwatchTargetSeconds": 1, "stopwatchToleranceSeconds": 20}, "bangdream")
	if gameNumber(next["cropSize"]) != 130 || gameNumber(next["candidateCount"]) != 170 || gameNumber(next["roundSeconds"]) != 600 || gameNumber(next["wrongPenalty"]) != 0 || gameBool(next["showTimer"]) {
		t.Fatalf("normalization failed: %v", next)
	}
	if len(gameStrings(next["cardBands"])) != 8 || gameNumber(next["stopwatchToleranceSeconds"]) != 1 {
		t.Fatal("empty filter fallback or tolerance bound failed")
	}
	if gameNumber(base["cropSize"]) != 180 || !gameBool(base["showTimer"]) {
		t.Fatal("normalization changed caller settings")
	}
	sekai := NormalizeSettings(ThemeSettings(base, "sekai"), Obj{"faceCropMode": "only", "cardCharacterLimits": []string{"single"}, "cardRarities": []int{1, 4}, "cardAttributes": "cute,invalid"}, "sekai")
	if sekai["faceCropMode"] != "none" || len(gameStrings(sekai["cardCharacterLimits"])) != 2 || len(gameStrings(sekai["cardRarities"])) != 1 || gameStrings(sekai["cardRarities"])[0] != "4" || gameStrings(sekai["cardAttributes"])[0] != "cute" {
		t.Fatalf("wrong sekai restrictions %v", sekai)
	}
	metadata := GameMeta(12, "sekai")
	if gameNumber(metadata["faceBoxImages"]) != 12 || len(metadata["bands"].([]any)) != 6 {
		t.Fatal("wrong theme metadata")
	}
}
