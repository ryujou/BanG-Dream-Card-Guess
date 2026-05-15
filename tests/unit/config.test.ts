import { describe, it, expect } from "vitest";
import {
  unique, arraySetting, numberArraySetting, defaultSettings,
  effectiveFaceCropMode, roundConfigKey,
  BAND_OPTIONS, RARITY_OPTIONS, ATTRIBUTE_OPTIONS,
  FACE_CROP_MODES, DIFFICULTY_PRESETS, MIME,
} from "../../src/server/config";

describe("config.ts", () => {
  describe("unique", () => {
    it("case 1", () => {
      expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    });

    it("case 2", () => {
      expect(unique([1, 0, null, undefined, "", 2, false])).toEqual([1, 2]);
    });

    it("case 3", () => {
      expect(unique([])).toEqual([]);
    });
  });

  describe("arraySetting", () => {
    it("case 4", () => {
      expect(arraySetting(["a", "b"], ["x"], ["a", "b", "c"])).toEqual(["a", "b"]);
    });

    it("case 5", () => {
      expect(arraySetting(["a", "d", "b"], ["x"], ["a", "b"])).toEqual(["a", "b"]);
    });

    it("case 6", () => {
      expect(arraySetting(undefined, ["default"], ["a"])).toEqual(["default"]);
    });

    it("case 7", () => {
      expect(arraySetting("", ["default"], ["a"])).toEqual(["default"]);
    });
  });

  describe("numberArraySetting", () => {
    it("case 8", () => {
      expect(numberArraySetting([1, 2, 5], [1], [1, 2, 3, 4, 5])).toEqual([1, 2, 5]);
    });

    it("case 9", () => {
      expect(numberArraySetting([1, 99], [1], [1, 2, 3])).toEqual([1]);
    });
  });

  describe("defaultSettings", () => {
    it("case 10", () => {
      expect(defaultSettings).toHaveProperty("difficulty");
      expect(defaultSettings).toHaveProperty("mode");
      expect(defaultSettings).toHaveProperty("roundSeconds");
      expect(defaultSettings).toHaveProperty("cardBands");
      expect(defaultSettings).toHaveProperty("cardRarities");
    });
  });

  describe("effectiveFaceCropMode", () => {
    it("case 11", () => {
      const easy = effectiveFaceCropMode({ difficulty: "easy", faceCropMode: "auto" });
      const normal = effectiveFaceCropMode({ difficulty: "normal", faceCropMode: "auto" });
      const hard = effectiveFaceCropMode({ difficulty: "hard", faceCropMode: "auto" });
      // 楠岃瘉杩斿洖鏈夋晥鐨勮鍓ā寮?      expect(FACE_CROP_MODES).toContain(easy);
      expect(FACE_CROP_MODES).toContain(normal);
      expect(FACE_CROP_MODES).toContain(hard);
    });

    it("case 12", () => {
      expect(effectiveFaceCropMode({ difficulty: "easy", faceCropMode: "prefer" })).toBe("prefer");
      expect(effectiveFaceCropMode({ difficulty: "hard", faceCropMode: "only" })).toBe("only");
    });
  });

  describe("roundConfigKey", () => {
    it("case 13", () => {
      const key = roundConfigKey({ difficulty: "normal" });
      expect(key).toContain("normal");
    });

    it("case 14", () => {
      const key1 = roundConfigKey({ difficulty: "easy" });
      const key2 = roundConfigKey({ difficulty: "hard" });
      expect(key1).not.toBe(key2);
    });
  });

  describe("甯搁噺閰嶇疆", () => {
    it("case 15", () => {
      expect(BAND_OPTIONS).toHaveLength(8);
    });

    it("case 16", () => {
      expect(RARITY_OPTIONS).toEqual([1, 2, 3, 4, 5]);
    });

    it("case 17", () => {
      expect(ATTRIBUTE_OPTIONS).toEqual(["cool", "happy", "powerful", "pure"]);
    });

    it("case 18", () => {
      expect(FACE_CROP_MODES).toHaveLength(5);
    });

    it("case 19", () => {
      expect(Object.keys(DIFFICULTY_PRESETS)).toEqual(["easy", "normal", "hard"]);
    });
  });

  describe("MIME types", () => {
    it("case 20", () => {
      expect(MIME[".html"]).toContain("text/html");
      expect(MIME[".js"]).toContain("text/javascript");
      expect(MIME[".css"]).toContain("text/css");
      expect(MIME[".json"]).toContain("application/json");
      expect(MIME[".png"]).toContain("image/png");
      expect(MIME[".svg"]).toContain("image/svg+xml");
    });

    it("case 21", () => {
      for (const [ext, mime] of Object.entries(MIME)) {
        if (![".png", ".jpg", ".jpeg", ".webp", ".mp3", ".ico"].includes(ext)) {
          expect(mime).toContain("charset=utf-8");
        }
      }
    });
  });
});
