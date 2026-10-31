import { useCallback, useEffect, useRef, useState } from "react";
import type { GameCommand, GameSnapshot, GameTheme } from "../../../shared/types";
import { connectGame, type GameRole } from "./connection";
import { hostShortcut } from "./game-rules";

export function useGame(role: GameRole, code: string, theme: GameTheme = "bangdream") {
  const [attempt, setAttempt] = useState(0);
  const identity = `${role}:${code}:${theme}:${attempt}`;
  const [view, setView] = useState<{
    identity: string;
    state: GameSnapshot | null;
    connected: boolean;
    error: string;
  }>({ identity, state: null, connected: false, error: "" });
  const connection = useRef<ReturnType<typeof connectGame> | null>(null);
  useEffect(() => {
    setView({ identity, state: null, connected: false, error: "" });
    const current = connectGame(role, code, theme, {
      state: state => setView(previous => ({ ...previous, state })),
      connected: connected => setView(previous => ({ ...previous, connected })),
      error: error => setView(previous => ({ ...previous, error })),
    });
    connection.current = current;
    return () => {
      current.dispose();
      connection.current = null;
    };
  }, [role, code, theme, identity]);
  const command = useCallback((command: GameCommand, payload: Record<string, unknown> = {}) => {
    connection.current?.command(command, payload);
  }, []);
  const current = view.identity === identity ? view : { state: null, connected: false, error: "" };
  return {
    state: current.state,
    connected: current.connected,
    error: current.error,
    command,
    reconnect: () => setAttempt(value => value + 1),
  };
}

export function useHostShortcuts(enabled: boolean, command: (command: GameCommand) => void) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent) => {
      const action = hostShortcut(event);
      if (action) {
        event.preventDefault();
        command(action);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, command]);
}
