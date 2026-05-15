import type { GameState } from "./state.js";
import { resetGameState, stopGameState, type TeamNames } from "./state.js";
import { applyRoundResult, type RoundMessages } from "./scoring.js";

export interface ReducerMessages extends RoundMessages {
  loading: string;
  recropDone: string;
  reveal: string;
  hideAnswer: string;
  reset: string;
  stop: string;
  emptyGuess: string;
}

export function applyGameCommand(
  game: GameState,
  settings: Record<string, unknown>,
  command: string,
  payload: Record<string, unknown> = {},
  context: { appMode: string; now: number; teamNames: TeamNames; messages: ReducerMessages }
): { handled: boolean; result?: string } {
  switch (command) {
    case "start":
    case "next":
      game.status = "loading";
      game.loading = true;
      game.leftSeconds = Number(settings.roundSeconds) || 60;
      game.recrops = 0;
      game.cropHistory = [];
      game.current = null;
      game.message = context.messages.loading;
      return { handled: true };
    case "recrop":
      if (!game.current || game.status !== "playing" || game.loading || !settings.allowRecrop || game.recrops >= (Number(settings.maxRecrops) || 0)) {
        return { handled: true };
      }
      game.recrops += 1;
      game.message = context.messages.recropDone;
      return { handled: true };
    case "correct":
    case "wrong":
    case "skip":
      applyRoundResult(game, settings, command, context.now, context.messages);
      return { handled: true, result: command };
    case "reveal":
      game.status = "revealed";
      game.message = context.messages.reveal;
      return { handled: true };
    case "hideAnswer":
      if (game.status === "revealed") game.status = "playing";
      game.message = context.messages.hideAnswer;
      return { handled: true };
    case "stop":
      stopGameState(game, context.messages.stop);
      return { handled: true };
    case "reset":
      resetGameState(game, settings, context.teamNames, context.messages.reset);
      return { handled: true };
    case "selfGuess":
      return applySelfGuess(game, settings, payload.guess, context);
    default:
      return { handled: false };
  }
}

export function applySelfGuess(
  game: GameState,
  settings: Record<string, unknown>,
  guess: unknown,
  context: { appMode: string; now: number; messages: ReducerMessages }
): { handled: boolean; result?: string } {
  if (context.appMode !== "solo" || !game.current || game.status !== "playing") return { handled: true };
  const answer = normalizeAnswer(guess);
  if (!answer) {
    game.message = context.messages.emptyGuess;
    return { handled: true };
  }
  const accepted = Array.isArray(game.current.acceptedAnswers) ? game.current.acceptedAnswers : [];
  const match = accepted.some((acc: unknown) => typeof acc === 'string' && acc.toLowerCase() === answer.toLowerCase());
  const result = match ? "correct" : "wrong";
  applyRoundResult(game, settings, result, context.now, context.messages);
  return { handled: true, result };
}

export function normalizeAnswer(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}
