import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/server/game/state";
import { appendHistory, captureUndoState, pushUndoState, undoHistory } from "../../../src/server/game/history";

function makeGame() {
  const game = createInitialGameState({ roundSeconds: 60 }, { A: "A 队", B: "B 队" });
  game.status = "playing";
  game.current = { displayName: "Arisa" };
  return game;
}

describe("game history", () => {
  it("writes judgement history in the existing format and order", () => {
    const game = makeGame();
    appendHistory(game, "correct", "A", 1);
    appendHistory(game, "wrong", "B", 2);
    expect(game.history).toEqual([
      { result: "wrong", name: "Arisa", team: "B", at: 2 },
      { result: "correct", name: "Arisa", team: "A", at: 1 },
    ]);
  });

  it("captures undo state without exposing live history array references", () => {
    const game = makeGame();
    appendHistory(game, "skip", "A", 1);
    const undo = captureUndoState(game);
    game.history[0].result = "changed";
    expect(undo.history[0].result).toBe("skip");
  });

  it("undo restores old state and preserves undo stack limit behavior", () => {
    const game = makeGame();
    game.score = 3;
    pushUndoState(game);
    game.score = 10;
    const result = undoHistory(game);
    expect(result.restored).toBe(true);
    expect(game.score).toBe(3);
    expect(game.undoStack.length).toBe(0);
  });
});

