export const HOST_COMMANDS = [
  "start",
  "next",
  "recrop",
  "correct",
  "wrong",
  "skip",
  "undo",
  "stop",
  "reveal",
  "selfGuess",
  "hideAnswer",
  "reset",
  "settings",
  "importSettings",
] as const;

export type GameCommand = typeof HOST_COMMANDS[number] | string;

export function validateCommandPayload(command: GameCommand, payload: unknown = {}): unknown {
  if (command === "selfGuess") return { guess: (payload as Record<string, unknown>)?.guess };
  return payload || {};
}

export function isSoloAllowedCommand(command: GameCommand): boolean {
  return ["start", "next", "recrop", "reveal", "stop", "reset", "selfGuess"].includes(command);
}

export function isPlayerAllowedCommand(command: GameCommand): boolean {
  return command === "recrop";
}

