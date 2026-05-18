export type ClientRole = 'player' | 'host' | 'settings' | 'solo' | 'self' | string;

export interface HelloMessage {
  type: 'hello';
  role: ClientRole;
}

export interface CommandMessage {
  type: 'command';
  command: string;
  payload?: unknown;
}

export interface AuthRequiredMessage {
  type: 'authRequired';
}

export interface ErrorMessage {
  type: 'error';
  message?: string;
}

export interface StateMessage {
  type: 'state';
  state: AppSnapshot;
}

export type ServerMessage = AuthRequiredMessage | ErrorMessage | StateMessage;

export interface GameSettings {
  [key: string]: unknown;
}

export interface CurrentCard {
  [key: string]: unknown;
}

export interface GameHistoryItem {
  [key: string]: unknown;
}

export interface GameState {
  status: 'idle' | 'playing' | 'revealed' | 'ended' | 'loading' | string;
  teams?: Record<string, { name: string; score: number }>;
  current?: Record<string, unknown> | null;
  history?: Record<string, unknown>[];
  recrops?: number;
  canUndo?: boolean;
  leftSeconds?: number;
  [key: string]: unknown;
}

export interface GameMeta {
  [key: string]: unknown;
}

export interface AppSnapshot {
  game?: GameState;
  settings?: GameSettings;
  meta?: GameMeta;
  health?: Record<string, unknown>;
  [key: string]: unknown;
}
