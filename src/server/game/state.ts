export type TeamKey = "A" | "B";

export interface TeamState {
  name: string;
  score: number;
}

export interface GameTeams {
  A: TeamState;
  B: TeamState;
}

export interface GameState {
  status: string;
  leftSeconds: number;
  loading: boolean;
  score: number;
  streak: number;
  total: number;
  recrops: number;
  cropHistory: Array<Record<string, any>>;
  recentCards: Array<string>;
  recentCharacters: Array<number>;
  undoStack: Array<Record<string, any>>;
  current: any;
  history: Array<Record<string, any>>;
  teams: GameTeams;
  roundKey: string;
  message?: string;
  [key: string]: any;
}

export interface TeamNames {
  A: string;
  B: string;
}

export function createInitialTeams(teamNames: TeamNames): GameTeams {
  return {
    A: { name: teamNames.A, score: 0 },
    B: { name: teamNames.B, score: 0 },
  };
}

export function createInitialGameState(settings: Record<string, any>, teamNames: TeamNames): GameState {
  return {
    status: "idle",
    leftSeconds: settings.roundSeconds,
    loading: false,
    score: 0,
    streak: 0,
    total: 0,
    recrops: 0,
    cropHistory: [],
    recentCards: [],
    recentCharacters: [],
    undoStack: [],
    current: null,
    history: [],
    teams: createInitialTeams(teamNames),
    roundKey: "",
  };
}

export function createInitialAppState(settings: Record<string, any>, teamNames: TeamNames): { game: GameState; settings: Record<string, any> } {
  return {
    game: createInitialGameState(settings, teamNames),
    settings,
  };
}

export function resetGameState(game: GameState, settings: Record<string, any>, teamNames: TeamNames, message: string): GameState {
  Object.assign(game, {
    status: "idle",
    leftSeconds: settings.roundSeconds,
    loading: false,
    score: 0,
    streak: 0,
    total: 0,
    current: null,
    history: [],
    undoStack: [],
    recrops: 0,
    cropHistory: [],
    recentCards: [],
    recentCharacters: [],
    teams: createInitialTeams(teamNames),
    message,
  });
  return game;
}

export function markRoundLoading(game: GameState, settings: Record<string, any>, message: string): GameState {
  Object.assign(game, {
    status: "loading",
    loading: true,
    leftSeconds: settings.roundSeconds,
    recrops: 0,
    cropHistory: [],
    current: null,
    message,
  });
  return game;
}

export function markRoundLoadFailed(game: GameState, message: string): GameState {
  Object.assign(game, {
    status: "idle",
    loading: false,
    message,
  });
  return game;
}

export function markRoundPlaying(game: GameState, settings: Record<string, any>, round: any, message: string): GameState {
  Object.assign(game, {
    current: round,
    status: "playing",
    loading: false,
    leftSeconds: settings.roundSeconds,
    message,
  });
  return game;
}

export function stopGameState(game: GameState, message: string): GameState {
  Object.assign(game, {
    status: "stopped",
    message,
    current: null,
  });
  return game;
}

