import type { GameMeta, GameSettings, GameSnapshot, RoomSummary } from "../../src/shared/types";

export const gameSettings: GameSettings = {
  mode: "single", difficulty: "normal", faceCropMode: "auto", cardCharacterLimits: ["single", "multiple"], cardVariants: ["normal", "trained"],
  roundSeconds: 60, questionsPerPlayer: 5, allowRecrop: true, showPlayerRecrop: false, soundEnabled: true,
  maxRecrops: 2, cropSize: 80, candidateCount: 20, avoidRecentCards: 5, avoidRecentCharacters: 2,
  cardBands: ["1", "2"], cardRarities: [3, 4], cardAttributes: ["cool", "happy"], correctPoints: 10,
  wrongPenalty: 2, streakBonus: true, showTimer: true, revealAfterJudge: false, autoNext: false, autoNextDelay: 1000,
  currentTeam: "A", stopwatchTargetSeconds: 2.5, stopwatchToleranceSeconds: 0.02,
};
export const gameMeta: GameMeta = {
  bands: [{ id: "1", name: "Poppin'Party", characters: [1] }, { id: "2", name: "Roselia", characters: [2] }],
  rarities: [3, 4], attributes: ["cool", "happy"], difficultyPresets: { easy: { cropSize: 120, candidateCount: 10 }, normal: { cropSize: 80, candidateCount: 20 }, hard: { cropSize: 40, candidateCount: 40 } },
  faceCropModes: ["auto", "none", "avoid", "prefer", "only"], cardCharacterLimits: ["single", "multiple"], cardVariants: ["normal", "trained"], faceBoxImages: 10,
  numericRanges: Object.fromEntries(["roundSeconds", "questionsPerPlayer", "correctPoints", "wrongPenalty", "maxRecrops", "cropSize", "candidateCount", "autoNextDelay", "avoidRecentCards", "avoidRecentCharacters", "stopwatchTargetSeconds", "stopwatchToleranceSeconds"].map(key => [key, [0, 10000]])),
};
export const room: RoomSummary = { id: "R", code: "ABC123", name: "周末猜卡", ownerId: "host", status: "idle", theme: "bangdream", players: 2, hosts: 1, createdAt: 1, updatedAt: 1, lastHostSeenAt: 1 };
export const cropImage = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="pink"/></svg>';
export const fullImage = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="blue"/></svg>';
export function snapshot(game: Partial<GameSnapshot["game"]> = {}, settings: Partial<GameSettings> = {}): GameSnapshot {
  return {
    appMode: "booth", room: { ...room }, settings: { ...gameSettings, ...settings }, meta: gameMeta,
    health: { clients: 2, roleCounts: { player: 1, host: 1, self: 0 }, preloaded: false },
    game: { status: "playing", leftSeconds: 60, loading: false, score: 0, streak: 0, total: 0, recrops: 0,
      current: { displayName: "户山香澄", acceptedAnswers: ["香澄", "kasumi"], imageUrl: fullImage, imageWidth: 40, imageHeight: 20, crop: { x: 0, y: 0, image: cropImage } },
      history: [], teams: { A: { name: "红队", score: 10 }, B: { name: "蓝队", score: 5 } }, message: "答题中", canUndo: false, ...game },
  };
}
