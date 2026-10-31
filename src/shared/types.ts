export type UserRole = "super_admin" | "host";
export type GameTheme = "bangdream" | "sekai" | "bluearchive";
export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface AuthState {
  user: User | null;
  csrfToken: string;
}
export interface GameSettings extends Record<string, unknown> {
  mode: "single" | "versus";
  difficulty: "easy" | "normal" | "hard";
  faceCropMode: "auto" | "none" | "avoid" | "prefer" | "only";
  cardCharacterLimits: string[];
  cardVariants: string[];
  roundSeconds: number;
  questionsPerPlayer: number;
  allowRecrop: boolean;
  showPlayerRecrop: boolean;
  soundEnabled: boolean;
  maxRecrops: number;
  cropSize: number;
  candidateCount: number;
  avoidRecentCards: number;
  avoidRecentCharacters: number;
  cardBands: string[];
  cardRarities: number[];
  cardAttributes: string[];
  correctPoints: number;
  wrongPenalty: number;
  streakBonus: boolean;
  showTimer: boolean;
  revealAfterJudge: boolean;
  autoNext: boolean;
  autoNextDelay: number;
  currentTeam: "A" | "B";
  stopwatchTargetSeconds: number;
  stopwatchToleranceSeconds: number;
}
export type GameStatus =
  | "idle"
  | "loading"
  | "playing"
  | "revealed"
  | "finished"
  | "stopped";
export interface RoomSummary {
  theme?: GameTheme;
  id: string;
  code: string;
  name: string;
  ownerId: string;
  status: GameStatus;
  players: number;
  hosts: number;
  createdAt: number;
  updatedAt: number;
  lastHostSeenAt: number;
}
export interface Crop {
  x: number;
  y: number;
  width?: number;
  height?: number;
  image: string;
  [key: string]: unknown;
}
export interface PublicCard {
  displayName: string;
  acceptedAnswers: string[];
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  crop: Crop;
}
export interface GameMeta {
  bands: { id: string; name: string; characters: number[] }[];
  rarities: number[];
  attributes: string[];
  difficultyPresets: Record<
    string,
    { cropSize: number; candidateCount: number }
  >;
  faceCropModes: string[];
  cardCharacterLimits: string[];
  cardVariants: string[];
  numericRanges: Record<string, [number, number]>;
  faceBoxImages: number;
}
export interface GameSnapshot {
  appMode: "booth" | "solo";
  room: RoomSummary;
  settings: GameSettings;
  meta: GameMeta;
  health: {
    clients: number;
    roleCounts: { player: number; host: number; self: number };
    preloaded: boolean;
  };
  game: {
    status: GameStatus;
    leftSeconds: number;
    loading: boolean;
    score: number;
    streak: number;
    total: number;
    recrops: number;
    current: PublicCard | null;
    history: { result: string; name: string; team: string; at: number }[];
    teams: Record<"A" | "B", { name: string; score: number }>;
    message: string;
    canUndo: boolean;
  };
}
export type GameCommand =
  | "start"
  | "next"
  | "recrop"
  | "reveal"
  | "hideAnswer"
  | "correct"
  | "wrong"
  | "skip"
  | "undo"
  | "stop"
  | "reset"
  | "settings"
  | "importSettings"
  | "team"
  | "selfGuess";
export type ClientMessage =
  | { type: "hello"; role: "host" | "player" | "self" | "settings" }
  | {
      type: "command";
      command: GameCommand;
      payload?: Record<string, unknown>;
    };
export type ServerMessage =
  | { type: "state"; state: GameSnapshot }
  | {
      type:
        | "error"
        | "authRequired"
        | "forbidden"
        | "roomNotFound"
        | "roomClosed";
      message: string;
    };
export interface Community {
  aboutUs: string;
  socialLinks: { title: string; url: string }[];
  members: { name: string; desc: string; url: string; image?: string }[];
  events: {
    title: string;
    date: string;
    location: string;
    desc: string;
    image?: string;
    url?: string;
  }[];
  photos: (string | { url: string; thumbnail?: string; album?: string; title?: string; desc?: string })[];
  bilibili?: { bvid: string; title?: string; cover?: string }[];
}
export interface ScoreItem {
  id: string;
  username: string;
  playerId?: string;
  score: number;
  duration: number;
  at: number;
  max_combo?: number;
  full_combo?: number;
  rank?: string;
  level?: number;
  difficulty?: string;
}
export interface ScoreState {
  total: number;
  leaderboard: ScoreItem[];
  top: ScoreItem[];
  recent: ScoreItem[];
}
