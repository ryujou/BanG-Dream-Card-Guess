import { describe, expect, it } from "vitest";
import { createInitialGameState, markRoundLoading, markRoundPlaying } from "../../../src/server/game/state";
import { createFakeCardProvider } from "../../../src/server/services/cardProvider";
import { createFakeTimerService } from "../../../src/server/services/timerService";

describe("round flow with fake services", () => {
  it("starts a round and times out deterministically without real IO", async () => {
    const game = createInitialGameState({ roundSeconds: 2 }, { A: "A", B: "B" });
    const round = {
      cardId: "1",
      characterId: 1,
      displayName: "Kasumi",
      acceptedAnswers: ["Kasumi"],
      imageUrl: "/cards/res001_rip/card_normal.png",
      crop: { x: 0, y: 0, width: 100, height: 100 },
    };
    const provider = createFakeCardProvider([round]);
    const timer = createFakeTimerService();

    markRoundLoading(game, { roundSeconds: 2 }, "loading");
    markRoundPlaying(game, { roundSeconds: 2 }, await provider.createRound(), "playing");
    timer.startRoundTimer(game.leftSeconds, (left) => { game.leftSeconds = left; }, () => { game.status = "finished"; });
    timer.tick();
    timer.tick();

    expect(game.current?.displayName).toBe("Kasumi");
    expect(game.leftSeconds).toBe(1);
    expect(game.status).toBe("finished");
  });
});
