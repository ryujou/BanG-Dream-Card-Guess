import { describe, it, expect } from "vitest";
import {
  unique, arraySetting, numberArraySetting, defaultSettings,
  effectiveFaceCropMode, roundConfigKey,
  BAND_OPTIONS, RARITY_OPTIONS, ATTRIBUTE_OPTIONS,
  FACE_CROP_MODES, DIFFICULTY_PRESETS, MIME,
} from "../../src/server/config.mjs";

describe("config.mjs", () => {
  describe("unique", () => {
    it("应去除重复值", () => {
      expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    });

    it("应过滤 falsy 值", () => {
      expect(unique([1, 0, null, undefined, "", 2, false])).toEqual([1, 2]);
    });

    it("空数组返回空数组", () => {
      expect(unique([])).toEqual([]);
    });
  });

  describe("arraySetting", () => {
    it("应返回有效数组", () => {
      expect(arraySetting(["a", "b"], ["x"], ["a", "b", "c"])).toEqual(["a", "b"]);
    });

    it("应过滤掉不在 allowed 中的值", () => {
      expect(arraySetting(["a", "d", "b"], ["x"], ["a", "b"])).toEqual(["a", "b"]);
    });

    it("undefined 应返回 fallback", () => {
      expect(arraySetting(undefined, ["default"], ["a"])).toEqual(["default"]);
    });

    it("空字符串应返回 fallback", () => {
      expect(arraySetting("", ["default"], ["a"])).toEqual(["default"]);
    });
  });

  describe("numberArraySetting", () => {
    it("应返回有效数字数组", () => {
      expect(numberArraySetting([1, 2, 5], [1], [1, 2, 3, 4, 5])).toEqual([1, 2, 5]);
    });

    it("应过滤无效值", () => {
      expect(numberArraySetting([1, 99], [1], [1, 2, 3])).toEqual([1]);
    });
  });

  describe("defaultSettings", () => {
    it("应包含所有必要字段", () => {
      expect(defaultSettings).toHaveProperty("difficulty");
      expect(defaultSettings).toHaveProperty("mode");
      expect(defaultSettings).toHaveProperty("roundSeconds");
      expect(defaultSettings).toHaveProperty("cardBands");
      expect(defaultSettings).toHaveProperty("cardRarities");
    });
  });

  describe("effectiveFaceCropMode", () => {
    it("auto 模式应返回对应难度值", () => {
      const easy = effectiveFaceCropMode({ difficulty: "easy", faceCropMode: "auto" });
      const normal = effectiveFaceCropMode({ difficulty: "normal", faceCropMode: "auto" });
      const hard = effectiveFaceCropMode({ difficulty: "hard", faceCropMode: "auto" });
      // 验证返回有效的裁剪模式
      expect(FACE_CROP_MODES).toContain(easy);
      expect(FACE_CROP_MODES).toContain(normal);
      expect(FACE_CROP_MODES).toContain(hard);
    });

    it("非 auto 模式应直接返回", () => {
      expect(effectiveFaceCropMode({ difficulty: "easy", faceCropMode: "prefer" })).toBe("prefer");
      expect(effectiveFaceCropMode({ difficulty: "hard", faceCropMode: "only" })).toBe("only");
    });
  });

  describe("roundConfigKey", () => {
    it("应生成包含难度信息的 key", () => {
      const key = roundConfigKey({ difficulty: "normal" });
      expect(key).toContain("normal");
    });

    it("不同配置应生成不同 key", () => {
      const key1 = roundConfigKey({ difficulty: "easy" });
      const key2 = roundConfigKey({ difficulty: "hard" });
      expect(key1).not.toBe(key2);
    });
  });

  describe("常量配置", () => {
    it("BAND_OPTIONS 应有 8 个乐队", () => {
      expect(BAND_OPTIONS).toHaveLength(8);
    });

    it("RARITY_OPTIONS 应有 5 个稀有度", () => {
      expect(RARITY_OPTIONS).toEqual([1, 2, 3, 4, 5]);
    });

    it("ATTRIBUTE_OPTIONS 应有 4 个属性", () => {
      expect(ATTRIBUTE_OPTIONS).toEqual(["cool", "happy", "powerful", "pure"]);
    });

    it("FACE_CROP_MODES 应有 5 个模式", () => {
      expect(FACE_CROP_MODES).toHaveLength(5);
    });

    it("DIFFICULTY_PRESETS 应有 3 个难度", () => {
      expect(Object.keys(DIFFICULTY_PRESETS)).toEqual(["easy", "normal", "hard"]);
    });
  });

  describe("MIME types", () => {
    it("应包含常见文件类型", () => {
      expect(MIME[".html"]).toContain("text/html");
      expect(MIME[".js"]).toContain("text/javascript");
      expect(MIME[".css"]).toContain("text/css");
      expect(MIME[".json"]).toContain("application/json");
      expect(MIME[".png"]).toContain("image/png");
      expect(MIME[".svg"]).toContain("image/svg+xml");
    });

    it("所有 MIME 都应包含 charset=utf-8 (除图片)", () => {
      for (const [ext, mime] of Object.entries(MIME)) {
        if (![".png", ".jpg", ".jpeg", ".webp", ".mp3", ".ico"].includes(ext)) {
          expect(mime).toContain("charset=utf-8");
        }
      }
    });
  });
});
