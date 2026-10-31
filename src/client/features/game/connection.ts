import type { GameCommand, GameSnapshot, GameTheme, ServerMessage } from "../../../shared/types";
import { api, errorText } from "../../lib/api";

export type GameRole = "host" | "player" | "self" | "settings";

export function connectGame(role: GameRole, code: string, theme: GameTheme, callbacks: {
  state: (snapshot: GameSnapshot) => void;
  connected: (connected: boolean) => void;
  error: (message: string) => void;
}) {
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false, terminal = false, retries = 0;

  async function connect() {
    try {
      await api("/api/auth/me");
      if (disposed) return;
      const query = role === "self"
        ? `solo=${encodeURIComponent((await api<{ id: string }>("/api/solo", { method: "POST", body: { theme } })).id)}`
        : `room=${encodeURIComponent(code)}`;
      if (disposed) return;
      const ws = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws?${query}`);
      socket = ws;
      ws.onopen = () => {
        if (disposed) return;
        callbacks.connected(true);
        callbacks.error("");
        ws.send(JSON.stringify({ type: "hello", role }));
      };
      ws.onmessage = event => {
        if (disposed) return;
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === "state") {
          retries = 0;
          callbacks.state(message.state);
        } else {
          callbacks.error(message.message);
          if (["roomClosed", "authRequired", "roomNotFound", "forbidden"].includes(message.type)) {
            terminal = true;
            ws.close();
          }
        }
      };
      ws.onclose = () => {
        if (disposed) return;
        callbacks.connected(false);
        if (terminal) return;
        if (retries++ < 3) {
          callbacks.error("连接中断，正在重新连接…");
          timer = setTimeout(() => void connect(), 1500);
        } else callbacks.error("无法连接对局，请检查房间码或重新登录");
      };
      ws.onerror = () => {
        if (!disposed) callbacks.error("暂时无法连接服务器");
      };
    } catch (error) {
      if (!disposed) callbacks.error(errorText(error));
    }
  }

  if (role === "self" || code) void connect();
  return {
    command(command: GameCommand, payload: Record<string, unknown> = {}) {
      if (socket?.readyState !== WebSocket.OPEN) {
        callbacks.error("连接尚未就绪");
        return;
      }
      callbacks.error("");
      socket.send(JSON.stringify({ type: "command", command, payload }));
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      if (socket) {
        socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
        socket.close();
        socket = null;
      }
    },
  };
}
