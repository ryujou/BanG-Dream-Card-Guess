import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/server/game/state";
import { createPublicSnapshot, createRoleSnapshot } from "../../../src/server/game/snapshot";

function makeSnapshot(role: string) {
  const game = createInitialGameState({ roundSeconds: 60 }, { A: "A 队", B: "B 队" });
  game.status = "playing";
  game.current = {
    displayName: "Tae",
    acceptedAnswers: ["Tae", "花园多惠"],
    imageUrl: "/cards/card.png",
    imageWidth: 100,
    imageHeight: 200,
    crop: { x: 1, y: 2, size: 3 },
    sourceBuffer: Buffer.from("hidden"),
  };
  game.cropHistory = [{ x: 1, y: 2 }];
  game.recentCards = ["1"];
  game.recentCharacters = [1];
  game.undoStack = [{ score: 0 }];
  return createPublicSnapshot({
    appMode: "booth",
    role,
    game,
    settings: { roundSeconds: 60 },
    meta: { bands: [] },
    health: { totalCards: 1 },
  });
}

describe("game snapshot", () => {
  it("includes the existing AppSnapshot top-level fields", () => {
    const snapshot = makeSnapshot("player");
    expect(snapshot).toHaveProperty("appMode", "booth");
    expect(snapshot).toHaveProperty("settings");
    expect(snapshot).toHaveProperty("meta");
    expect(snapshot).toHaveProperty("health");
    expect(snapshot).toHaveProperty("game");
  });

  it("hides answer fields from player while preserving card display fields", () => {
    const snapshot = makeSnapshot("player");
    expect(snapshot.game.current.displayName).toBe("");
    expect(snapshot.game.current.acceptedAnswers).toEqual([]);
    expect(snapshot.game.current.imageUrl).toBe("/cards/card.png");
    expect(snapshot.game.current.sourceBuffer).toBeUndefined();
  });

  it("keeps host acceptedAnswers and canUndo while omitting private arrays", () => {
    const snapshot = createRoleSnapshot(makeSnapshotInput("host"));
    expect(snapshot.game.current.acceptedAnswers).toEqual(["Tae", "花园多惠"]);
    expect(snapshot.game.canUndo).toBe(true);
    expect(snapshot.game.cropHistory).toBeUndefined();
    expect(snapshot.game.recentCards).toBeUndefined();
    expect(snapshot.game.recentCharacters).toBeUndefined();
    expect(snapshot.game.undoStack).toBeUndefined();
  });
});

function makeSnapshotInput(role: string) {
  const game = createInitialGameState({ roundSeconds: 60 }, { A: "A 队", B: "B 队" });
  game.status = "playing";
  game.current = {
    displayName: "Tae",
    acceptedAnswers: ["Tae", "花园多惠"],
    imageUrl: "/cards/card.png",
    imageWidth: 100,
    imageHeight: 200,
    crop: { x: 1, y: 2, size: 3 },
  };
  game.undoStack = [{}];
  return {
    appMode: "booth",
    role,
    game,
    settings: { roundSeconds: 60 },
    meta: { bands: [] },
    health: { totalCards: 1 },
  };
}

