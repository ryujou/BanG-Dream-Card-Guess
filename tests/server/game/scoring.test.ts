import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/server/game/state";
import { applyCorrect, applyRoundResult, applySkip, applyWrong, calculateStreakBonus } from "../../../src/server/game/scoring";

const messages = {
  correct: "回答正确",
  wrong: "回答错误",
  timeout: "时间到",
  skip: "已跳过",
};

function makeGame() {
  const game = createInitialGameState({ roundSeconds: 60 }, { A: "A 队", B: "B 队" });
  game.status = "playing";
  game.current = { displayName: "Kasumi" };
  return game;
}

describe("game scoring", () => {
  it("correct increases score and streak", () => {
    const game = makeGame();
    applyCorrect(game, { correctPoints: 2, streakBonus: false, mode: "single" });
    expect(game.score).toBe(2);
    expect(game.streak).toBe(1);
  });

  it("wrong applies the old penalty rule and clears streak", () => {
    const game = makeGame();
    game.score = 1;
    game.streak = 3;
    applyWrong(game, { wrongPenalty: 5 });
    expect(game.score).toBe(0);
    expect(game.streak).toBe(0);
  });

  it("skip follows the same penalty path as non-correct results", () => {
    const game = makeGame();
    game.score = 4;
    game.streak = 2;
    applySkip(game, { wrongPenalty: 1 });
    expect(game.score).toBe(3);
    expect(game.streak).toBe(0);
  });

  it("streak bonus uses current streak before increment", () => {
    const game = makeGame();
    game.streak = 3;
    expect(calculateStreakBonus(game, { streakBonus: true })).toBe(3);
    applyCorrect(game, { correctPoints: 1, streakBonus: true, mode: "single" });
    expect(game.score).toBe(4);
    expect(game.streak).toBe(4);
  });

  it("team score changes only for correct answers in versus mode", () => {
    const game = makeGame();
    applyRoundResult(game, { correctPoints: 2, streakBonus: false, mode: "versus", currentTeam: "B", revealAfterJudge: true }, "correct", 1000, messages);
    expect(game.teams.B.score).toBe(2);
    expect(game.teams.A.score).toBe(0);
    expect(game.history[0]).toMatchObject({ result: "correct", name: "Kasumi", team: "B", at: 1000 });
  });
});

