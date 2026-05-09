// 常量、默认配置、配置工具函数
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
export const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, "data");
export const settingsStorePath = path.join(dataDir, "settings.json");
export const faceBoxesStorePath = path.join(dataDir, "face-boxes.json");

export const BESTDORI_ORIGIN = "https://bestdori.com";
export const BESTDORI_BASE = `${BESTDORI_ORIGIN}/assets/jp/characters/resourceset`;

export const BAND_OPTIONS = [
  { id: "poppin-party", name: "Poppin'Party", characters: [1, 2, 3, 4, 5] },
  { id: "afterglow", name: "Afterglow", characters: [6, 7, 8, 9, 10] },
  { id: "hello-happy-world", name: "Hello, Happy World!", characters: [11, 12, 13, 14, 15] },
  { id: "pastel-palettes", name: "Pastel*Palettes", characters: [16, 17, 18, 19, 20] },
  { id: "roselia", name: "Roselia", characters: [21, 22, 23, 24, 25] },
  { id: "morfonica", name: "Morfonica", characters: [26, 27, 28, 29, 30] },
  { id: "raise-a-suilen", name: "RAISE A SUILEN", characters: [31, 32, 33, 34, 35] },
  { id: "mygo", name: "MyGO!!!!!", characters: [36, 37, 38, 39, 40] },
];
export const BAND_BY_CHARACTER = new Map(BAND_OPTIONS.flatMap((band) => band.characters.map((id) => [id, band.id])));
export const RARITY_OPTIONS = [1, 2, 3, 4, 5];
export const ATTRIBUTE_OPTIONS = ["cool", "happy", "powerful", "pure"];
export const DIFFICULTY_PRESETS = {
  easy: { cropSize: 230, candidateCount: 90 },
  normal: { cropSize: 180, candidateCount: 120 },
  hard: { cropSize: 130, candidateCount: 170 },
};
export const FACE_CROP_MODES = ["auto", "none", "avoid", "prefer", "only"];
export const CARD_CHARACTER_LIMITS = ["single", "multiple"];
export const CARD_VARIANTS = ["normal", "trained"];
export const FACE_LABELS_BY_CLASS = { 0: "eyes", 1: "face", 2: "mouth" };

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
};

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function arraySetting(value, fallback, allowed = null) {
  const items = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === ""
      ? []
      : String(value).split(",");
  const normalized = items.map((item) => String(item).trim()).filter(Boolean);
  const filtered = allowed ? normalized.filter((item) => allowed.includes(item)) : normalized;
  return filtered.length ? unique(filtered) : [...fallback];
}

export function numberArraySetting(value, fallback, allowed) {
  const items = arraySetting(value, fallback.map(String), allowed.map(String));
  return items.map(Number).filter((item) => Number.isFinite(item));
}

export const defaultSettings = {
  mode: "single",
  difficulty: "normal",
  faceCropMode: "auto",
  cardCharacterLimits: CARD_CHARACTER_LIMITS,
  cardVariants: CARD_VARIANTS,
  roundSeconds: 60,
  questionsPerPlayer: 3,
  allowRecrop: true,
  showPlayerRecrop: true,
  soundEnabled: true,
  maxRecrops: 3,
  cropSize: 180,
  candidateCount: 120,
  avoidRecentCards: 20,
  avoidRecentCharacters: 8,
  cardBands: BAND_OPTIONS.map((band) => band.id),
  cardRarities: RARITY_OPTIONS,
  cardAttributes: ATTRIBUTE_OPTIONS,
  correctPoints: 1,
  wrongPenalty: 0,
  streakBonus: false,
  showTimer: true,
  revealAfterJudge: true,
  autoNext: false,
  autoNextDelay: 1800,
  currentTeam: "A",
};

export function readPersistedConfig() {
  try {
    return JSON.parse(readFileSync(settingsStorePath, "utf-8"));
  } catch {
    return {};
  }
}

let persistTimer = null;
export function savePersistentConfigSoon() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(settingsStorePath, JSON.stringify({}, null, 2));
    } catch {
      // ignore save failures
    }
  }, 800);
}

export function readFaceBoxStore() {
  try {
    return JSON.parse(readFileSync(faceBoxesStorePath, "utf-8"));
  } catch {
    return { images: {} };
  }
}

export function persistedTeamName(team, fallback) {
  try {
    const config = readPersistedConfig();
    const teams = config?.teams || {};
    return String(teams[team]?.name || fallback);
  } catch {
    return fallback;
  }
}

export function roundConfigKey(settings) {
  return JSON.stringify({
    cropSize: settings.cropSize,
    candidateCount: settings.candidateCount,
    difficulty: settings.difficulty,
    cardBands: settings.cardBands,
    cardRarities: settings.cardRarities,
    cardAttributes: settings.cardAttributes,
    cardImageVariant: settings.cardImageVariant,
    faceCropMode: settings.faceCropMode,
    avoidRecentCards: settings.avoidRecentCards,
    avoidRecentCharacters: settings.avoidRecentCharacters,
  });
}

export function effectiveFaceCropMode(settings) {
  if (FACE_CROP_MODES.includes(settings.faceCropMode) && settings.faceCropMode !== "auto") return settings.faceCropMode;
  if (settings.difficulty === "easy") return "prefer";
  if (settings.difficulty === "hard") return "avoid";
  return "none";
}
