import type { GameState, TeamKey } from "./state.js";
import { appendHistory, pushUndoState, type RoundResult } from "./history.js";

export interface RoundMessages {
  correct: string;
  wrong: string;
  timeout: string;
  skip: string;
}

export function calculateStreakBonus(game: GameState, settings: Record<string, any>): number {
  return settings.streakBonus ? game.streak : 0;
}

export function updateTeamScore(game: GameState, team: TeamKey, points: number): GameState {
  game.teams[team].score += points;
  return game;
}

export function applyCorrect(game: GameState, settings: Record<string, any>): number {
  const points = Number(settings.correctPoints || 0) + calculateStreakBonus(game, settings);
  game.score += points;
  game.streak += 1;
  if (settings.mode === "versus" && (settings.currentTeam === "A" || settings.currentTeam === "B")) {
    updateTeamScore(game, settings.currentTeam, points);
  }
  return points;
}

export function applyWrong(game: GameState, settings: Record<string, any>): GameState {
  game.score = Math.max(0, game.score - Number(settings.wrongPenalty || 0));
  game.streak = 0;
  return game;
}

export function applySkip(game: GameState, settings: Record<string, any>): GameState {
  return applyWrong(game, settings);
}

export function applyTimeout(game: GameState, settings: Record<string, any>): GameState {
  return applyWrong(game, settings);
}

export function applyRoundResult(
  game: GameState,
  settings: Record<string, any>,
  result: RoundResult,
  now: number,
  messages: RoundMessages
): GameState {
  if (!game.current || game.status !== "playing") return game;
  pushUndoState(game);
  game.total += 1;
  game.status = settings.revealAfterJudge ? "revealed" : "finished";
  if (result === "correct") {
    applyCorrect(game, settings);
    game.message = messages.correct;
  } else {
    if (result === "skip") applySkip(game, settings);
    else if (result === "timeout") applyTimeout(game, settings);
    else applyWrong(game, settings);
    game.message = result === "wrong" ? messages.wrong : result === "timeout" ? messages.timeout : messages.skip;
  }
  appendHistory(game, result, settings.currentTeam, now);
  return game;
}

