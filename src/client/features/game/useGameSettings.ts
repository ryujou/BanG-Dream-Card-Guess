import { useEffect, useState } from "react";
import type { GameMeta, GameSettings, GameTheme } from "../../../shared/types";
import { api, errorText } from "../../lib/api";
import { readSettingsFile, settingsFile, withDifficulty, type Teams } from "./settings-rules";

export function useGameSettings(code: string | null, userId?: string) {
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [meta, setMeta] = useState<GameMeta | null>(null);
  const [roomTheme, setRoomTheme] = useState<GameTheme>();
  const [teams, setTeams] = useState<Teams>({ A: { name: "A 队", score: 0 }, B: { name: "B 队", score: 0 } });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setSettings(null);
    setMeta(null);
    setRoomTheme(undefined);
    setError("");
    setNotice("");
    if (!userId) return;
    async function load() {
      const result: { settings: GameSettings; teams: Teams; meta: GameMeta; room?: { theme: GameTheme } } = code
        ? await api<{ settings: GameSettings; teams: Teams; meta: GameMeta; room: { theme: GameTheme } }>(`/api/rooms/${code}`)
        : await Promise.all([api<GameSettings>("/api/settings"), api<GameMeta>("/api/settings/meta")])
            .then(([settings, meta]) => ({ settings, meta, teams: { A: { name: "A 队", score: 0 }, B: { name: "B 队", score: 0 } } }));
      if (active) {
        setSettings(result.settings);
        setMeta(result.meta);
        setTeams(result.teams);
        if (result.room) setRoomTheme(result.room.theme);
      }
    }
    void load().catch(error => { if (active) setError(errorText(error)); });
    return () => { active = false; };
  }, [code, userId]);

  function change(key: string, value: unknown) {
    setSettings(current => current ? { ...current, [key]: value } : current);
    setNotice("");
  }
  function changeDifficulty(difficulty: GameSettings["difficulty"]) {
    if (meta) setSettings(current => current ? withDifficulty(current, difficulty, meta) : current);
    setNotice("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const body = code ? { ...settings, teamAName: teams.A.name, teamBName: teams.B.name } : settings;
      const result = await api<GameSettings | { settings: GameSettings }>(code ? `/api/rooms/${code}/settings` : "/api/settings", {
        method: code ? "PATCH" : "PUT", body,
      });
      setSettings(("settings" in result ? result.settings : result) as GameSettings);
      setNotice("设置已保存");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  function exportSettings() {
    if (!settings) return;
    const url = URL.createObjectURL(new Blob([settingsFile(settings, teams, !!code)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `xtbang-${code || "defaults"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function importSettings(file?: File) {
    if (!file || !settings) return;
    setError("");
    setNotice("");
    try {
      const imported = readSettingsFile(await file.text(), settings, teams, !!code);
      setSettings(imported.settings);
      setTeams(imported.teams);
      setNotice("已读入文件，点击保存后应用");
    } catch (error) {
      setError(`导入失败：${errorText(error)}`);
    }
  }
  return { settings, meta, roomTheme, teams, setTeams, error, notice, busy, change, changeDifficulty, save, importSettings, exportSettings };
}
