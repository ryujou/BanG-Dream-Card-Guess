import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_OPTIONS,
  BAND_OPTIONS,
  CARD_CHARACTER_LIMITS,
  CARD_VARIANTS,
  DIFFICULTY_PRESETS,
  FACE_CROP_MODES,
  RARITY_OPTIONS,
  arraySetting,
  defaultSettings as serverDefaultSettings,
  numberArraySetting,
} from "../../../src/server/config";
import { defaultSettings, exportSettings, importSettings, mergeSettings, sanitizeSettings } from "../../../src/server/game/settings";

const deps = {
  defaultSettings: serverDefaultSettings,
  difficultyPresets: DIFFICULTY_PRESETS,
  faceCropModes: FACE_CROP_MODES,
  bandIds: BAND_OPTIONS.map((band) => band.id),
  rarities: RARITY_OPTIONS,
  attributes: ATTRIBUTE_OPTIONS,
  cardCharacterLimits: CARD_CHARACTER_LIMITS,
  cardVariants: CARD_VARIANTS,
  arraySetting,
  numberArraySetting,
};

describe("game settings", () => {
  it("keeps the default settings structure aligned with server config", () => {
    expect(Object.keys(defaultSettings).sort()).toEqual(Object.keys(serverDefaultSettings).sort());
    expect(defaultSettings.roundSeconds).toBe(serverDefaultSettings.roundSeconds);
    expect(defaultSettings.currentTeam).toBe(serverDefaultSettings.currentTeam);
  });

  it("mergeSettings preserves old fields and overrides supplied values", () => {
    const merged = mergeSettings(serverDefaultSettings, { roundSeconds: 42, customLegacyField: true });
    expect(merged.roundSeconds).toBe(42);
    expect(merged.correctPoints).toBe(serverDefaultSettings.correctPoints);
    expect(merged.customLegacyField).toBe(true);
  });

  it("sanitizeSettings rejects invalid enum values and clamps numeric values", () => {
    const settings = mergeSettings(serverDefaultSettings);
    sanitizeSettings(settings, {
      mode: "bad",
      difficulty: "bad",
      faceCropMode: "bad",
      roundSeconds: -1,
      cropSize: 999,
      currentTeam: "Z",
      stopwatchTargetSeconds: 0,
      stopwatchToleranceSeconds: 999,
    }, deps);

    expect(settings.mode).toBe(serverDefaultSettings.mode);
    expect(settings.difficulty).toBe(serverDefaultSettings.difficulty);
    expect(settings.faceCropMode).toBe(serverDefaultSettings.faceCropMode);
    expect(settings.roundSeconds).toBe(5);
    expect(settings.cropSize).toBe(260);
    expect(settings.currentTeam).toBe("A");
    expect(settings.stopwatchTargetSeconds).toBe(1);
    expect(settings.stopwatchToleranceSeconds).toBe(1);
  });

  it("imports legacy settings JSON through the same sanitizer", () => {
    const settings = mergeSettings(serverDefaultSettings);
    const result = importSettings(settings, {
      mode: "versus",
      currentTeam: "B",
      cardRarities: ["5", "bad"],
      allowRecrop: 0,
    }, deps);

    expect(result.settings.mode).toBe("versus");
    expect(result.settings.currentTeam).toBe("B");
    expect(result.settings.cardRarities).toEqual([5]);
    expect(result.settings.allowRecrop).toBe(false);
  });

  it("exports settings with team names without changing the payload shape", () => {
    const payload = exportSettings({ mode: "single" }, { A: { name: "Team A" }, B: { name: "Team B" } });
    expect(payload).toEqual({ settings: { mode: "single" }, teams: { A: { name: "Team A" }, B: { name: "Team B" } } });
  });
});
