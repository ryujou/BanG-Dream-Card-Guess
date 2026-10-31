import type { GameMeta, GameSettings } from "../../../shared/types";

export type Teams = Record<"A" | "B", { name: string; score: number }>;

export function withDifficulty(settings: GameSettings, difficulty: GameSettings["difficulty"], meta: GameMeta): GameSettings {
  return { ...settings, difficulty, ...meta.difficultyPresets[difficulty] };
}

export function readSettingsFile(text: string, settings: GameSettings, teams: Teams, room: boolean) {
  const value = JSON.parse(text);
  const imported = value?.settings ?? value;
  if (!imported || typeof imported !== "object" || Array.isArray(imported)) throw new Error("请选择游戏设置 JSON 文件");
  for (const [key, current] of Object.entries(settings)) {
    const next = imported[key];
    if (next === undefined) continue;
    const valid = Array.isArray(current)
      ? Array.isArray(next) && next.length > 0 && next.every(item => typeof item === typeof current[0])
      : typeof next === typeof current;
    if (!valid) throw new Error(`设置字段 ${key} 的格式不正确`);
  }
  return {
    settings: Object.fromEntries(Object.entries(settings).map(([key, old]) => [key, imported[key] ?? old])) as GameSettings,
    teams: room ? {
      A: { ...teams.A, name: String(value.teams?.A?.name ?? imported.teamAName ?? teams.A.name).slice(0, 20) },
      B: { ...teams.B, name: String(value.teams?.B?.name ?? imported.teamBName ?? teams.B.name).slice(0, 20) },
    } : teams,
  };
}

export function settingsFile(settings: GameSettings, teams: Teams, room: boolean) {
  return JSON.stringify({ settings, ...(room ? { teams } : {}) }, null, 2);
}
