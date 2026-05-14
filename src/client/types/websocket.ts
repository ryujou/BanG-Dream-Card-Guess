export type ClientRole = 'player' | 'host' | 'settings' | 'solo' | 'self' | string;

export interface HelloMessage {
  type: 'hello';
  role: ClientRole;
}

export interface CommandMessage {
  type: 'command';
  command: string;
  payload?: any;
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
  [key: string]: any;
}

export interface CurrentCard {
  [key: string]: any;
}

export interface GameHistoryItem {
  [key: string]: any;
}

export interface GameState {
  status: 'idle' | 'playing' | 'revealed' | 'ended' | 'loading' | string;
  [key: string]: any;
}

export interface GameMeta {
  [key: string]: any;
}

export interface AppSnapshot {
  game?: GameState;
  settings?: GameSettings;
  meta?: GameMeta;
  [key: string]: any;
}
