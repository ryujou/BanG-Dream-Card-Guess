import type { GameState } from "./state.js";

export function createPublicSnapshot(input: {
  appMode: string;
  role: string;
  game: GameState;
  settings: Record<string, unknown>;
  meta: Record<string, unknown>;
  health: Record<string, unknown>;
}): Record<string, unknown> {
  const { appMode, role, game, settings, meta, health } = input;
  const current = createPublicCurrent(game, role);
  return {
    appMode,
    settings,
    meta,
    health,
    game: {
      ...game,
      current,
      cropHistory: undefined,
      recentCards: undefined,
      recentCharacters: undefined,
      undoStack: undefined,
      canUndo: game.undoStack.length > 0,
      loading: game.loading,
    },
  };
}

export function createRoleSnapshot(input: Parameters<typeof createPublicSnapshot>[0]): Record<string, unknown> {
  return createPublicSnapshot(input);
}

export function createPublicCurrent(game: GameState, role: string): Record<string, unknown> | null {
  if (!game.current) return null;
  return {
    displayName: ["player", "self"].includes(role) && game.status === "playing" ? "" : game.current.displayName,
    acceptedAnswers: role === "host" ? game.current.acceptedAnswers : [],
    imageUrl: game.current.imageUrl,
    imageWidth: game.current.imageWidth,
    imageHeight: game.current.imageHeight,
    crop: game.current.crop,
  };
}

