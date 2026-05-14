import { describe, it, expect } from "vitest";
import {
  normalizeNoteShooterScore, normalizeNoteShooterPlayerId,
  normalizeNoteShooterPlayerName, normalizeNoteShooterLevel,
  normalizeNoteShooterDifficulty, normalizeNoteShooterRank,
  normalizeQueueScore, normalizeQueueUsername,
  formatLocalDateTime,
} from "../../src/server/scores.mjs";

describe("scores.mjs", () => {
  describe("normalizeQueueUsername", () => {
    it("应截断超过 30 字符的用户名", () => {
      const long = "a".repeat(50);
      expect(normalizeQueueUsername(long).length).toBeLessThanOrEqual(30);
    });

    it("空值应返回 '匿名'", () => {
      expect(normalizeQueueUsername("")).toBe("匿名");
      expect(normalizeQueueUsername(null)).toBe("匿名");
    });

    it("应去除首尾空白", () => {
      expect(normalizeQueueUsername("  test  ")).toBe("test");
    });
  });

  describe("normalizeQueueScore", () => {
    it("应规范化有效成绩", () => {
      const result = normalizeQueueScore({ username: "player1", score: 100, duration: 30 });
      expect(result).toBeTruthy();
      expect(result.username).toBe("player1");
      expect(result.score).toBe(100);
    });

    it("无效输入应返回 null", () => {
      expect(normalizeQueueScore(null)).toBeNull();
      expect(normalizeQueueScore("string")).toBeNull();
    });

    it("负分应被限制为 0", () => {
      const result = normalizeQueueScore({ username: "test", score: -50 });
      expect(result.score).toBe(0);
    });
  });

  describe("normalizeNoteShooterPlayerId", () => {
    it("应截断超过 64 字符的 ID", () => {
      const long = "x".repeat(100);
      expect(normalizeNoteShooterPlayerId(long).length).toBeLessThanOrEqual(64);
    });

    it("空值应返回空字符串", () => {
      expect(normalizeNoteShooterPlayerId("")).toBe("");
      expect(normalizeNoteShooterPlayerId(null)).toBe("");
    });
  });

  describe("normalizeNoteShooterPlayerName", () => {
    it("应截断超过 30 字符的名字", () => {
      const long = "n".repeat(50);
      expect(normalizeNoteShooterPlayerName(long).length).toBeLessThanOrEqual(30);
    });

    it("空值应返回 '玩家'", () => {
      expect(normalizeNoteShooterPlayerName("")).toBe("玩家");
    });
  });

  describe("normalizeNoteShooterLevel", () => {
    it("有效等级应返回原值", () => {
      expect(normalizeNoteShooterLevel("easy")).toBe("easy");
      expect(normalizeNoteShooterLevel("normal")).toBe("normal");
      expect(normalizeNoteShooterLevel("hard")).toBe("hard");
    });

    it("无效等级应返回 'normal'", () => {
      expect(normalizeNoteShooterLevel("insane")).toBe("normal");
      expect(normalizeNoteShooterLevel("")).toBe("normal");
    });
  });

  describe("normalizeNoteShooterDifficulty", () => {
    it("有效难度 1-10 应返回原值", () => {
      expect(normalizeNoteShooterDifficulty(5)).toBe(5);
      expect(normalizeNoteShooterDifficulty(1)).toBe(1);
      expect(normalizeNoteShooterDifficulty(10)).toBe(10);
    });

    it("无效难度应返回 1", () => {
      expect(normalizeNoteShooterDifficulty(99)).toBe(1);
      expect(normalizeNoteShooterDifficulty(0)).toBe(1);
    });
  });

  describe("normalizeNoteShooterRank", () => {
    it("有效评级应返回原值", () => {
      expect(normalizeNoteShooterRank("sss")).toBe("sss");
      expect(normalizeNoteShooterRank("s")).toBe("s");
      expect(normalizeNoteShooterRank("a")).toBe("a");
      expect(normalizeNoteShooterRank("d")).toBe("d");
    });

    it("无效评级应返回 'd'", () => {
      expect(normalizeNoteShooterRank("z")).toBe("d");
      expect(normalizeNoteShooterRank("")).toBe("d");
    });

    it("大小写不敏感", () => {
      expect(normalizeNoteShooterRank("SSS")).toBe("sss");
      expect(normalizeNoteShooterRank("A")).toBe("a");
    });
  });

  describe("normalizeNoteShooterScore", () => {
    it("应规范化完整成绩对象", () => {
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

    it("无效成绩应返回 null", () => {
      expect(normalizeNoteShooterScore(null)).toBeNull();
      expect(normalizeNoteShooterScore({})).toBeNull();
    });

    it("分数应限制在 0-99999999 范围", () => {
      const entry = { playerId: "P1", finalScore: 999999999 };
      const result = normalizeNoteShooterScore(entry);
      expect(result.final_score).toBe(99999999);
    });
  });

  describe("formatLocalDateTime", () => {
    it("应返回 YYYY-MM-DD HH:mm 格式", () => {
      const date = new Date("2026-01-15T14:30:00");
      const result = formatLocalDateTime(date.getTime());
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it("无参数时应返回当前时间", () => {
      const result = formatLocalDateTime();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });
});
