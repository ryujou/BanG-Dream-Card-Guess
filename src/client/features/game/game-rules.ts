import type { GameCommand, GameSnapshot, GameStatus } from "../../../shared/types";

export const statusLabels: Record<GameStatus, string> = {
  idle: "等待开始", loading: "正在准备卡面", playing: "正在作答",
  revealed: "答案揭晓", finished: "本轮结束", stopped: "已停止",
};

export function gameView(snapshot: GameSnapshot | null) {
  const game = snapshot?.game, settings = snapshot?.settings;
  const seconds = Math.max(0, game?.leftSeconds ?? 0);
  const canPlay = game?.status === "playing";
  return {
    timerText: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    canPlay,
    canRecrop: canPlay && !!game?.current && !!settings?.allowRecrop && game.recrops < settings.maxRecrops,
    revealed: game?.status === "revealed",
  };
}

export function hostShortcut(event: KeyboardEvent): GameCommand | undefined {
  const target = event.target;
  if ((target instanceof HTMLElement && (target.closest("input,textarea,select,button") || target.isContentEditable)) ||
      event.ctrlKey || event.altKey || event.metaKey) return;
  const keys: Record<string, GameCommand> = {
    " ": "next", r: "recrop", v: "reveal", Enter: "correct", Backspace: "wrong", s: "skip", u: "undo", Escape: "stop",
  };
  return keys[event.key];
}

export function gameSoundNotes(before: GameSnapshot, snapshot: GameSnapshot): number[] {
  if (!snapshot.settings.soundEnabled) return [];
  const game = snapshot.game, old = before.game;
  if (game.total > old.total) return game.history[0]?.result === "correct" ? [523, 659, 784] : [294, 220];
  if (game.status === "playing" && old.status !== "playing") return [440, 659];
  if (game.status === "revealed" && old.status !== "revealed") return [659, 784];
  if (game.status === "playing" && game.leftSeconds <= 5 && game.leftSeconds !== old.leftSeconds) return [880];
  return [];
}
