import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/server/game/state";
import { applyGameCommand } from "../../../src/server/game/reducer";

const messages = {
  correct: "回答正确",
  wrong: "回答错误",
  timeout: "时间到",
  skip: "已跳过",
  loading: "加载下一题",
  recropDone: "已重切",
  reveal: "答案揭晓",
  hideAnswer: "答案已隐藏",
  reset: "已重置",
  stop: "游戏已停止",
  emptyGuess: "请输入角色名或昵称",
};

function context(appMode = "booth") {
  return { appMode, now: 1234, teamNames: { A: "A 队", B: "B 队" }, messages };
}

function makeGame() {
  const game = createInitialGameState({ roundSeconds: 60 }, { A: "A 队", B: "B 队" });
  game.status = "playing";
  game.current = { displayName: "Rimi", acceptedAnswers: ["Rimi", "牛込里美"] };
  return game;
}

describe("game reducer", () => {
  it("start and next enter the same loading state", () => {
    for (const command of ["start", "next"]) {
      const game = makeGame();
      applyGameCommand(game, { roundSeconds: 30 }, command, {}, context());
      expect(game.status).toBe("loading");
      expect(game.loading).toBe(true);
      expect(game.leftSeconds).toBe(30);
      expect(game.current).toBeNull();
      expect(game.recrops).toBe(0);
    }
  });

  it("recrop increments count without handling crop side effects", () => {
    const game = makeGame();
    applyGameCommand(game, { allowRecrop: true, maxRecrops: 3 }, "recrop", {}, context());
    expect(game.recrops).toBe(1);
  });

  it("reveal, stop, and reset preserve existing state transitions", () => {
    const game = makeGame();
    applyGameCommand(game, {}, "reveal", {}, context());
    expect(game.status).toBe("revealed");
    applyGameCommand(game, {}, "stop", {}, context());
    expect(game.status).toBe("stopped");
    expect(game.current).toBeNull();
    applyGameCommand(game, { roundSeconds: 60 }, "reset", {}, context());
    expect(game.status).toBe("idle");
    expect(game.score).toBe(0);
    expect(game.history).toEqual([]);
  });

  it("team command remains unhandled by pure reducer, matching server command handling", () => {
    const game = makeGame();
    const result = applyGameCommand(game, { currentTeam: "A" }, "team", { team: "B" }, context());
    expect(result.handled).toBe(false);
  });

  it("selfGuess follows solo matching behavior", () => {
    const game = makeGame();
    applyGameCommand(game, { correctPoints: 1, revealAfterJudge: true, mode: "single", currentTeam: "A" }, "selfGuess", { guess: "Rimi" }, context("solo"));
    expect(game.status).toBe("revealed");
    expect(game.score).toBe(1);
    expect(game.history[0].result).toBe("correct");
  });

  it("empty selfGuess only updates the message", () => {
    const game = makeGame();
    applyGameCommand(game, {}, "selfGuess", { guess: " " }, context("solo"));
    expect(game.status).toBe("playing");
    expect(game.message).toBe("请输入角色名或昵称");
  });
});

