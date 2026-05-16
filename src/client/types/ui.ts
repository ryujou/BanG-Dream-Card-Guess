import type { AppSnapshot, GameSettings, GameState } from "../../shared/types/websocket";
import type { NoteShooterScoreState } from "../../shared/types/scores";
import type { DiagnosticsSnapshot, HealthSnapshot } from "../../shared/types/diagnostics";

export type ClientGameState = GameState;
export type ClientGameSettings = GameSettings;
export type ClientSnapshot = AppSnapshot;
export type ClientHealth = Partial<HealthSnapshot>;
export interface ClientDiagnostics extends Partial<Omit<DiagnosticsSnapshot, "health">> {
  health?: ClientHealth;
}
export type ScoresSnapshot = NoteShooterScoreState;

export interface NetworkPages {
  player: string;
  noteShooter: string;
  queue: string;
  login: string;
  settings: string;
  solo: string;
  qr: string;
}

export interface NetworkEntry {
  origin: string;
  local?: boolean;
  pages?: Partial<NetworkPages>;
  [key: string]: unknown;
}

export interface NetworkInfo {
  appMode?: string;
  currentOrigin?: string;
  pages?: Partial<NetworkPages>;
  entries?: NetworkEntry[];
}

export interface ScoreDeletePayload {
  id?: string;
  playerId?: string;
  scope?: string;
}

export interface BandOption {
  id: string | number;
  name: string;
}

export interface ClientCrop {
  x: number;
  y: number;
  size: number;
  image: string;
}

export interface ClientCurrentCard {
  imageUrl?: string;
  displayName?: string;
  imageWidth?: number;
  imageHeight?: number;
  crop?: ClientCrop;
}

export type GameWithCurrent = Omit<GameState, "current"> & {
  status?: string;
  current?: ClientCurrentCard | null;
};
