import { describe, expect, test } from "vitest";
import { gameView, gameSoundNotes } from "../../src/client/features/game/game-rules";
import { readSettingsFile, settingsFile, withDifficulty } from "../../src/client/features/game/settings-rules";
import { stopwatchOutcome } from "../../src/client/features/game/useStopwatch";
import { gameMeta, gameSettings, snapshot } from "./game-fixtures";

test("only a revealed round exposes the full-card presentation; recrops obey the current round", () => {
  expect(gameView(null)).toEqual({ timerText: "00:00", canPlay: false, canRecrop: false, revealed: false });
  expect(gameView(snapshot({ leftSeconds: 125 }))).toMatchObject({ timerText: "02:05", canPlay: true, canRecrop: true });
  expect(gameView(snapshot({ status: "finished", leftSeconds: -1 }))).toMatchObject({ timerText: "00:00", revealed: false, canRecrop: false });
  expect(gameView(snapshot({ status: "revealed" }))).toMatchObject({ revealed: true, canPlay: false });
  expect(gameView(snapshot({ recrops: 2 })).canRecrop).toBe(false);
  expect(gameView(snapshot({}, { allowRecrop: false })).canRecrop).toBe(false);
  expect(gameView(snapshot({ current: null })).canRecrop).toBe(false);
});

test("sound follows score, round transitions and only the last five changing seconds", () => {
  const before = snapshot({ status: "idle" });
  expect(gameSoundNotes(before, snapshot())).toEqual([440, 659]);
  expect(gameSoundNotes(snapshot(), snapshot({ status: "revealed" }))).toEqual([659, 784]);
  expect(gameSoundNotes(snapshot(), snapshot({ total: 1, history: [{ result: "correct", name: "", team: "A", at: 1 }] }))).toEqual([523, 659, 784]);
  expect(gameSoundNotes(snapshot(), snapshot({ total: 1 }))).toEqual([294, 220]);
  expect(gameSoundNotes(snapshot({ leftSeconds: 6 }), snapshot({ leftSeconds: 5 }))).toEqual([880]);
  expect(gameSoundNotes(snapshot({ leftSeconds: 5 }), snapshot({ leftSeconds: 5 }))).toEqual([]);
  expect(gameSoundNotes(snapshot({ leftSeconds: 8 }), snapshot({ leftSeconds: 7 }))).toEqual([]);
  expect(gameSoundNotes(before, snapshot({}, { soundEnabled: false }))).toEqual([]);
});

describe("settings files", () => {
  const teams = snapshot().game.teams;
  test("imports known keys only, preserves scores, bounds team names, and never mutates the source", () => {
    const result = readSettingsFile(JSON.stringify({ settings: { roundSeconds: 90, cardRarities: [4], unrelated: true }, teams: { A: { name: "长".repeat(30), score: 999 } } }), gameSettings, teams, true);
    expect(result.settings.roundSeconds).toBe(90); expect(result.settings.cardRarities).toEqual([4]);
    expect(result.settings).not.toHaveProperty("unrelated"); expect(gameSettings.roundSeconds).toBe(60);
    expect(result.teams.A).toEqual({ name: "长".repeat(20), score: 10 }); expect(result.teams.B).toEqual(teams.B);
    expect(readSettingsFile('{"teamAName":"甲","teamBName":"乙"}', gameSettings, teams, true).teams.A.name).toBe("甲");
    expect(readSettingsFile('{"settings":{"roundSeconds":30}}', gameSettings, teams, false).teams).toBe(teams);
  });
  test.each(["null", "[]", '"text"', "123"])("rejects a non-settings document: %s", text => {
    expect(() => readSettingsFile(text, gameSettings, teams, true)).toThrow("请选择游戏设置 JSON 文件");
  });
  test.each([{ roundSeconds: "20" }, { cardBands: [] }, { cardRarities: ["4"] }, { soundEnabled: 1 }])("rejects mismatched field types: %j", fields => {
    expect(() => readSettingsFile(JSON.stringify(fields), gameSettings, teams, true)).toThrow("格式不正确");
  });
  test("exports room names only for room settings and applies the selected difficulty preset", () => {
    expect(JSON.parse(settingsFile(gameSettings, teams, true))).toEqual({ settings: gameSettings, teams });
    expect(JSON.parse(settingsFile(gameSettings, teams, false))).not.toHaveProperty("teams");
    expect(withDifficulty(gameSettings, "hard", gameMeta)).toMatchObject({ difficulty: "hard", cropSize: 40, candidateCount: 40, roundSeconds: 60 });
    expect(gameSettings.cropSize).toBe(80);
  });
});

test.each([[2.48, "win"], [2.5, "win"], [2.52, "win"], [2.479999, "lose"], [2.520001, "lose"], [0, "lose"]] as const)("stopwatch includes both tolerance boundaries: %s → %s", (seconds, expected) => {
  expect(stopwatchOutcome(seconds, { targetSeconds: 2.5, toleranceSeconds: 0.02 })).toBe(expected);
});
