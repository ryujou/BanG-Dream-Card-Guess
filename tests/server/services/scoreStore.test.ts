import { describe, expect, it } from "vitest";
import { createMemoryScoreStore } from "../../../src/server/services/scoreStore";

describe("score store service", () => {
  it("keeps queue score state structure unchanged", async () => {
    const store = createMemoryScoreStore();
    await store.writeQueueScores([{ username: "alice", score: 10, duration: 3, at: 1 }]);
    const state = store.queueScoreState();
    expect(state).toMatchObject({ total: 1 });
    expect(state.top[0]).toMatchObject({ username: "alice", score: 10, duration: 3 });
  });

  it("keeps note-shooter score state structure unchanged", async () => {
    const store = createMemoryScoreStore();
    await store.writeNoteShooterScores([{ player_id: "P1", player_name: "p", levels: "normal", difficulty: 1, final_score: 100, duration: 2, max_combo: 3, at: 1 }]);
    const state = store.noteShooterScoreState();
    expect(state).toMatchObject({ total: 1 });
    expect(state.leaderboard[0]).toMatchObject({ playerId: "P1", score: 100 });
  });
});
