import { describe, expect, it } from "vitest";
import type { AppSnapshot, CommandMessage, HelloMessage, ServerMessage } from "../../src/shared/types/websocket";
import type { DiagnosticsSnapshot, HealthSnapshot } from "../../src/shared/types/diagnostics";
import type { NoteShooterScoreEntry, QueueScoreEntry } from "../../src/shared/types/scores";

describe("shared type contracts", () => {
  it("covers websocket message shapes without changing wire fields", () => {
    const hello: HelloMessage = { type: "hello", role: "player" };
    const command: CommandMessage = { type: "command", command: "start", payload: {} };
    const server: ServerMessage = { type: "authRequired" };

    expect(hello.type).toBe("hello");
    expect(command.type).toBe("command");
    expect(server.type).toBe("authRequired");
  });

  it("covers app snapshot, health, diagnostics, and scores structures", () => {
    const snapshot: AppSnapshot = { game: { status: "idle" }, settings: {}, meta: {}, health: {} };
    const health: HealthSnapshot = {
      totalCards: 0,
      filteredCards: 0,
      cachedSets: 0,
      cachePercent: 0,
      roleCounts: {},
      preloaded: false,
      effectiveFaceCropMode: "none",
      ok: true,
      appMode: "booth",
      uptimeMs: 1,
      version: "1.5.1",
      nodeVersion: process.version,
      connectedClients: 0,
      roles: {},
      cache: {},
      game: {},
      services: {},
      network: {},
      errors: {},
    };
    const diagnostics: DiagnosticsSnapshot = {
      ok: true,
      exportMode: false,
      generatedAt: new Date(0).toISOString(),
      health,
      network: {},
      websocket: {},
      game: {},
      cache: {},
      scores: {},
      recentErrors: [],
    };
    const queueScore: QueueScoreEntry = { username: "u", score: 1, duration: 1, at: 1 };
    const noteScore: NoteShooterScoreEntry = {
      id: "id",
      player_id: "p",
      player_name: "name",
      levels: "normal",
      difficulty: 1,
      fps: 60,
      win: 1,
      ranks: "s",
      duration: 1,
      kuma_kill: 0,
      kuma_live: 0,
      max_combo: 1,
      life: 1,
      life_lost: 0,
      boss_ratio: 0,
      bullet_ratio: 0,
      item_ratio: 0,
      final_score: 1,
      full_combo: 1,
      create_time: "2026-01-01 00:00",
      at: 1,
    };

    expect(snapshot.game?.status).toBe("idle");
    expect(diagnostics.health.ok).toBe(true);
    expect(queueScore.score).toBe(1);
    expect(noteScore.final_score).toBe(1);
  });
});
