import { useCallback, useEffect, useRef, useState } from "react";
import type { GameTheme, RoomSummary } from "../../../shared/types";
import { api, errorText } from "../../lib/api";

export function useRooms() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [error, setError] = useState("");
  const [renameError, setRenameError] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const reload = useCallback(async () => {
    try {
      const data = await api<{ rooms: RoomSummary[] }>("/api/rooms");
      if (active.current) {
        setRooms(data.rooms);
        setError("");
      }
    } catch (error) {
      if (active.current) setError(errorText(error));
    }
  }, []);
  useEffect(() => {
    active.current = true;
    void reload();
    return () => { active.current = false; };
  }, [reload]);
  async function create(name: string, theme: GameTheme) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ room: RoomSummary }>("/api/rooms", { method: "POST", body: { name, theme } });
      return result.room;
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function close(code: string) {
    try {
      await api(`/api/rooms/${code}`, { method: "DELETE" });
      await reload();
      return true;
    } catch (error) {
      setError(errorText(error));
      return false;
    }
  }
  async function rename(code: string, name: string) {
    setBusy(true);
    setRenameError("");
    try {
      await api(`/api/rooms/${code}`, { method: "PATCH", body: { name: name.trim() } });
      await reload();
      return true;
    } catch (error) {
      setRenameError(errorText(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { rooms, error, renameError, setRenameError, busy, reload, create, close, rename };
}
