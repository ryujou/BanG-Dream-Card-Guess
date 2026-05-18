import { describe, it, expect } from "vitest";
import {
  normalizeNoteShooterScore, normalizeNoteShooterPlayerId,
  normalizeNoteShooterPlayerName, normalizeNoteShooterLevel,
  normalizeNoteShooterDifficulty, normalizeNoteShooterRank,
  normalizeQueueScore, normalizeQueueUsername,
  formatLocalDateTime,
} from "../../src/server/scores";

describe("scores.ts", () => {
  describe("normalizeQueueUsername", () => {
    it("case 1", () => {
      const long = "a".repeat(50);
      expect(normalizeQueueUsername(long).length).toBeLessThanOrEqual(30);
    });

    it("case 2", () => {
      expect(normalizeQueueUsername("")).toBe("匿名");
      expect(normalizeQueueUsername(null)).toBe("匿名");
    });

    it("case 3", () => {
      expect(normalizeQueueUsername("  test  ")).toBe("test");
    });
  });

  describe("normalizeQueueScore", () => {
    it("case 4", () => {
      const result = normalizeQueueScore({ username: "player1", score: 100, duration: 30 });
      expect(result).toBeTruthy();
      expect(result.username).toBe("player1");
      expect(result.score).toBe(100);
    });

    it("case 5", () => {
      expect(normalizeQueueScore(null)).toBeNull();
      expect(normalizeQueueScore("string")).toBeNull();
    });

    it("case 6", () => {
      const result = normalizeQueueScore({ username: "test", score: -50 });
      expect(result.score).toBe(0);
    });

    it("keeps legacy queue score shape after normalization", () => {
      expect(normalizeQueueScore({ username: "player", score: "12", duration: "3", at: 100 })).toEqual({
        username: "player",
        score: 12,
        duration: 3,
        at: 100,
      });
    });
  });

  describe("normalizeNoteShooterPlayerId", () => {
    it("case 7", () => {
      const long = "x".repeat(100);
      expect(normalizeNoteShooterPlayerId(long).length).toBeLessThanOrEqual(64);
    });

    it("case 8", () => {
      expect(normalizeNoteShooterPlayerId("")).toBe("");
      expect(normalizeNoteShooterPlayerId(null)).toBe("");
    });
  });

  describe("normalizeNoteShooterPlayerName", () => {
    it("case 9", () => {
      const long = "n".repeat(50);
      expect(normalizeNoteShooterPlayerName(long).length).toBeLessThanOrEqual(30);
    });

    it("case 10", () => {
      expect(normalizeNoteShooterPlayerName("")).toBe("玩家");
    });
  });

  describe("normalizeNoteShooterLevel", () => {
    it("case 11", () => {
      expect(normalizeNoteShooterLevel("easy")).toBe("easy");
      expect(normalizeNoteShooterLevel("normal")).toBe("normal");
      expect(normalizeNoteShooterLevel("hard")).toBe("hard");
    });

    it("case 12", () => {
      expect(normalizeNoteShooterLevel("insane")).toBe("normal");
      expect(normalizeNoteShooterLevel("")).toBe("normal");
    });
  });

  describe("normalizeNoteShooterDifficulty", () => {
    it("case 13", () => {
      expect(normalizeNoteShooterDifficulty(5)).toBe(5);
      expect(normalizeNoteShooterDifficulty(1)).toBe(1);
      expect(normalizeNoteShooterDifficulty(10)).toBe(10);
    });

    it("case 14", () => {
      expect(normalizeNoteShooterDifficulty(99)).toBe(1);
      expect(normalizeNoteShooterDifficulty(0)).toBe(1);
    });
  });

  describe("normalizeNoteShooterRank", () => {
    it("case 15", () => {
      expect(normalizeNoteShooterRank("sss")).toBe("sss");
      expect(normalizeNoteShooterRank("s")).toBe("s");
      expect(normalizeNoteShooterRank("a")).toBe("a");
      expect(normalizeNoteShooterRank("d")).toBe("d");
    });

    it("case 16", () => {
      expect(normalizeNoteShooterRank("z")).toBe("d");
      expect(normalizeNoteShooterRank("")).toBe("d");
    });

    it("case 17", () => {
      expect(normalizeNoteShooterRank("SSS")).toBe("sss");
      expect(normalizeNoteShooterRank("A")).toBe("a");
    });
  });

  describe("normalizeNoteShooterScore", () => {
    it("case 18", () => {
      const entry = {
        playerId: "P1",
        playerName: "Test",
        levels: "normal",
        difficulty: 3,
        finalScore: 50000,
        duration: 120,
        maxCombo: 500,
        ranks: "s",
      };
      const result = normalizeNoteShooterScore(entry);
      expect(result).toBeTruthy();
      expect(result.final_score).toBe(50000);
      expect(result.player_name).toBe("Test");
      expect(result.ranks).toBe("s");
    });

    it("case 19", () => {
      expect(normalizeNoteShooterScore(null)).toBeNull();
      expect(normalizeNoteShooterScore({})).toBeNull();
    });

    it("case 20", () => {
      const entry = { playerId: "P1", finalScore: 999999999 };
      const result = normalizeNoteShooterScore(entry);
      expect(result.final_score).toBe(99999999);
    });

    it("accepts old snake_case score file entries", () => {
      const result = normalizeNoteShooterScore({ player_id: "P2", player_name: "Old", final_score: 12345, max_combo: 8, kuma_live: 0 });
      expect(result).toMatchObject({ player_id: "P2", player_name: "Old", final_score: 12345, max_combo: 8 });
    });
  });

  describe("formatLocalDateTime", () => {
    it("case 21", () => {
      const date = new Date("2026-01-15T14:30:00");
      const result = formatLocalDateTime(date.getTime());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it("case 22", () => {
      const result = formatLocalDateTime();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });
});
