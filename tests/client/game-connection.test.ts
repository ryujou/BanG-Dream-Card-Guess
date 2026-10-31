import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "../../src/client/lib/api";
import { connectGame } from "../../src/client/features/game/connection";
import { snapshot } from "./game-fixtures";
vi.mock("../../src/client/lib/api", () => ({ api: vi.fn(), errorText: (error: Error) => error.message }));

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: ((event: object) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: object) => void) | null = null;
  onerror: ((event: object) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.({}); });
  constructor(readonly url: string) { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.({}); }
  message(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
}
const callbacks = () => ({ state: vi.fn(), connected: vi.fn(), error: vi.fn() });
beforeEach(() => {
  vi.useFakeTimers(); Socket.instances = []; vi.mocked(api).mockReset().mockResolvedValue({ id: "solo id" });
  vi.stubGlobal("WebSocket", Socket); vi.stubGlobal("location", { protocol: "https:", host: "game.test" });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("initializes the session, identifies its role, receives state and sends an exact command", async () => {
  const events = callbacks(), connection = connectGame("host", "A B", "bangdream", events);
  connection.command("start"); expect(events.error).toHaveBeenCalledWith("连接尚未就绪");
  await vi.runAllTimersAsync(); const ws = Socket.instances[0];
  expect(ws.url).toBe("wss://game.test/ws?room=A%20B"); ws.open();
  expect(ws.send).toHaveBeenCalledWith('{"type":"hello","role":"host"}');
  const state = snapshot(); ws.message({ type: "state", state }); expect(events.state).toHaveBeenCalledWith(state);
  connection.command("team", { team: "B" });
  expect(JSON.parse(ws.send.mock.lastCall![0])).toEqual({ type: "command", command: "team", payload: { team: "B" } });
  ws.message({ type: "error", message: "不能执行" }); expect(events.error).toHaveBeenLastCalledWith("不能执行");
  ws.onerror?.({}); expect(events.error).toHaveBeenLastCalledWith("暂时无法连接服务器");
  connection.dispose(); expect(ws.close).toHaveBeenCalledOnce(); expect(ws.onmessage).toBeNull();
});

test.each(["bangdream", "sekai", "bluearchive"] as const)("creates the %s solo theme and uses ws on a local HTTP origin", async theme => {
  vi.stubGlobal("location", { protocol: "http:", host: "localhost:5173" });
  const connection = connectGame("self", "", theme, callbacks()); await vi.runAllTimersAsync();
  expect(api).toHaveBeenCalledWith("/api/solo", { method: "POST", body: { theme } });
  expect(Socket.instances[0].url).toBe("ws://localhost:5173/ws?solo=solo%20id"); connection.dispose();
});

test("reconnects at 1500ms and stops after three failed retries", async () => {
  const events = callbacks(), connection = connectGame("player", "ROOM", "bangdream", events);
  await vi.runAllTimersAsync();
  for (let attempt = 0; attempt < 4; attempt++) {
    Socket.instances[attempt].close();
    await vi.advanceTimersByTimeAsync(1499); expect(Socket.instances).toHaveLength(attempt + 1);
    await vi.advanceTimersByTimeAsync(1);
  }
  expect(Socket.instances).toHaveLength(4);
  expect(events.error).toHaveBeenLastCalledWith("无法连接对局，请检查房间码或重新登录"); connection.dispose();
});

test.each(["roomClosed", "authRequired", "roomNotFound", "forbidden"])("terminal %s closes and never retries", async type => {
  const events = callbacks(), connection = connectGame("player", "ROOM", "bangdream", events);
  await vi.runAllTimersAsync(); Socket.instances[0].open(); Socket.instances[0].message({ type, message: "对局已终止" });
  await vi.runAllTimersAsync(); expect(Socket.instances).toHaveLength(1); expect(events.connected).toHaveBeenLastCalledWith(false);
  expect(events.error).toHaveBeenLastCalledWith("对局已终止"); connection.dispose();
});

test("a successful state resets retries and disposal cancels a scheduled reconnect", async () => {
  const connection = connectGame("player", "ROOM", "bangdream", callbacks()); await vi.runAllTimersAsync();
  for (let i = 0; i < 3; i++) { Socket.instances.at(-1)!.close(); await vi.advanceTimersByTimeAsync(1500); }
  Socket.instances.at(-1)!.message({ type: "state", state: snapshot() }); Socket.instances.at(-1)!.close();
  await vi.advanceTimersByTimeAsync(1500); expect(Socket.instances).toHaveLength(5);
  Socket.instances.at(-1)!.close(); connection.dispose(); await vi.runAllTimersAsync(); expect(Socket.instances).toHaveLength(5);
});

test("unmount during initialization does not create a solo or open a stale socket", async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(api).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const events = callbacks(), connection = connectGame("self", "", "sekai", events);
  connection.dispose(); resolve({}); await vi.runAllTimersAsync();
  expect(api).toHaveBeenCalledTimes(1); expect(Socket.instances).toHaveLength(0); expect(events.error).not.toHaveBeenCalled();
});

test("API initialization errors are visible, and a missing room makes no request", async () => {
  const events = callbacks(); vi.mocked(api).mockRejectedValueOnce(new Error("会话失败"));
  const connection = connectGame("host", "ROOM", "bangdream", events); await vi.runAllTimersAsync();
  expect(events.error).toHaveBeenCalledWith("会话失败"); connection.dispose(); vi.mocked(api).mockClear();
  connectGame("player", "", "bangdream", callbacks()).dispose(); expect(api).not.toHaveBeenCalled();
});
