import { act as reactAct } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render, renderHook } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter, useLocation } from "react-router-dom";
import { api } from "../../src/client/lib/api";
import { useGame } from "../../src/client/features/game/useGame";
import { useGameSound } from "../../src/client/features/game/useGameSound";
import { KlotskiPage, MooncakePage, NoteShooterPage, StopwatchPage } from "../../src/client/pages/MiniGames";
import type { GameTheme } from "../../src/shared/types";
import { snapshot } from "./game-fixtures";
vi.mock("../../src/client/lib/api", () => ({ api: vi.fn(), errorText: (error: Error) => error.message }));

beforeEach(() => {
  vi.mocked(api).mockReset().mockImplementation(async path => path === "/api/stopwatch-settings" ? { targetSeconds: 2.5, toleranceSeconds: 0.02 } : { id: "solo" });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function act(callback: () => void) {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  try { await reactAct(callback); }
  finally { environment.IS_REACT_ACT_ENVIRONMENT = previous; }
}

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn(); close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  constructor(readonly url: string) { Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
}

test("the connection hook updates React state, replaces sockets on route changes and cleans manual reconnects", async () => {
  Socket.instances = []; vi.stubGlobal("WebSocket", Socket);
  const hook = await renderHook(({ code, theme }) => useGame("player", code, theme), { initialProps: { code: "FIRST", theme: "bangdream" as GameTheme } });
  await expect.poll(() => Socket.instances.length).toBe(1);
  await hook.act(() => { Socket.instances[0].open(); Socket.instances[0].onmessage?.({ data: JSON.stringify({ type: "state", state: snapshot() }) }); });
  expect(hook.result.current.connected).toBe(true); expect(hook.result.current.state?.game.status).toBe("playing");
  await hook.act(() => hook.result.current.command("recrop"));
  expect(Socket.instances[0].send).toHaveBeenLastCalledWith('{"type":"command","command":"recrop","payload":{}}');
  await hook.rerender({ code: "SECOND", theme: "sekai" });
  await expect.poll(() => Socket.instances.length).toBe(2);
  expect(Socket.instances[0].close).toHaveBeenCalledOnce(); expect(Socket.instances[0].onmessage).toBeNull();
  expect(hook.result.current.state).toBeNull(); expect(hook.result.current.connected).toBe(false);
  await hook.act(() => hook.result.current.reconnect()); await expect.poll(() => Socket.instances.length).toBe(3);
  expect(Socket.instances[1].close).toHaveBeenCalledOnce();
  await hook.act(() => { Socket.instances[2].open(); Socket.instances[2].onmessage?.({ data: JSON.stringify({ type: "state", state: snapshot() }) }); });
  const requests = vi.mocked(api).mock.calls.length;
  await hook.rerender({ code: "", theme: "sekai" });
  expect(hook.result.current.state).toBeNull(); expect(hook.result.current.connected).toBe(false); expect(hook.result.current.error).toBe("");
  expect(api).toHaveBeenCalledTimes(requests); expect(Socket.instances).toHaveLength(3);
  await hook.unmount(); expect(Socket.instances[2].close).toHaveBeenCalledOnce();
});

test("the hook exposes initialization errors and a manual retry recovers", async () => {
  Socket.instances = []; vi.stubGlobal("WebSocket", Socket); vi.mocked(api).mockRejectedValueOnce(new Error("会话超时"));
  const hook = await renderHook(() => useGame("self", "", "sekai"));
  await expect.poll(() => hook.result.current.error).toBe("会话超时");
  await hook.act(() => hook.result.current.reconnect()); await expect.poll(() => Socket.instances.length).toBe(1);
  await hook.act(() => Socket.instances[0].open()); expect(hook.result.current.error).toBe(""); expect(hook.result.current.connected).toBe(true);
});

test("sound waits for a gesture, schedules score notes, respects mute and closes its audio context", async () => {
  const oscillators: { frequency: { value: number }; type: string; connect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const close = vi.fn(), resume = vi.fn();
  class Audio {
    state = "running"; currentTime = 5; destination = {}; close = close; resume = resume;
    createOscillator() { const oscillator = { frequency: { value: 0 }, type: "", connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; oscillators.push(oscillator); return oscillator; }
    createGain() { return { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }; }
  }
  vi.stubGlobal("AudioContext", Audio);
  const hook = await renderHook(({ state }) => useGameSound(state), { initialProps: { state: snapshot({ status: "idle" }) } });
  await hook.rerender({ state: snapshot() }); expect(oscillators).toHaveLength(0);
  window.dispatchEvent(new PointerEvent("pointerdown")); expect(resume).toHaveBeenCalledOnce();
  await hook.rerender({ state: snapshot({ total: 1, history: [{ result: "correct", name: "香澄", team: "A", at: 1 }] }) });
  expect(oscillators.map(item => item.frequency.value)).toEqual([523, 659, 784]);
  expect(oscillators[0].start).toHaveBeenCalledWith(5); expect(oscillators[2].stop.mock.calls[0][0]).toBeCloseTo(5.36, 10);
  await hook.rerender({ state: snapshot({ status: "revealed", total: 1 }, { soundEnabled: false }) }); expect(oscillators).toHaveLength(3);
  await hook.unmount(); expect(close).toHaveBeenCalledOnce(); window.dispatchEvent(new KeyboardEvent("keydown")); expect(resume).toHaveBeenCalledOnce();
});

function stopwatch(theme = "sekai") { return <MemoryRouter initialEntries={[`/games/stopwatch-challenge?theme=${theme}`]}><StopwatchPage /></MemoryRouter>; }
function controlledClock() {
  let now = 1000, next = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frames.set(++next, callback); return next; });
  const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id); });
  return { set: (time: number) => { now = time; }, tick: () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); }, frames, request, cancel };
}

test("stopwatch holds and releases at the configured lower boundary, updates the display, and resets", async () => {
  const clock = controlledClock(); await render(stopwatch());
  const button = page.getByRole("button", { name: "按住开始计时，松开结束" }); await expect.element(button).toBeEnabled();
  const pad = button.element();
  await act(() => { pad.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true })); });
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
  clock.set(2000); clock.tick(); await expect.element(page.getByLabelText("当前计时秒数")).toHaveTextContent("1.00");
  clock.set(3480); await act(() => { pad.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true })); });
  await expect.element(page.getByText("精准命中。安可！")).toBeVisible();
  await expect.element(page.getByLabelText("当前计时秒数")).toHaveTextContent("2.48"); expect(clock.frames.size).toBe(0);
  await page.getByRole("button", { name: /重置计时/ }).click();
  await expect.element(page.getByLabelText("当前计时秒数")).toHaveTextContent("0.00");
});

test("stopwatch ignores other inputs and mismatched pointers, stops on focus loss, and removes listeners and RAF on unmount", async () => {
  const clock = controlledClock(); const view = await render(stopwatch());
  const button = page.getByRole("button", { name: "按住开始计时，松开结束" }); await expect.element(button).toBeEnabled();
  const pad = button.element() as HTMLButtonElement; vi.spyOn(pad, "setPointerCapture").mockImplementation(() => {});
  const input = document.createElement("input"); document.body.append(input);
  input.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })); expect(clock.request).not.toHaveBeenCalled(); input.remove();
  await act(() => { pad.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, button: 2, bubbles: true })); }); expect(clock.request).not.toHaveBeenCalled();
  await act(() => { pad.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, button: 0, bubbles: true })); });
  clock.set(4000); await act(() => { pad.dispatchEvent(new PointerEvent("pointerup", { pointerId: 8, bubbles: true })); });
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
  await act(() => { window.dispatchEvent(new Event("blur")); });
  await expect.element(page.getByText("慢了一点，再来一次。")).toBeVisible(); expect(clock.frames.size).toBe(0);
  await act(() => { pad.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter", bubbles: true })); });
  await expect.element(button).toHaveAttribute("aria-pressed", "true");
  await view.unmount(); expect(clock.frames.size).toBe(0); const calls = clock.request.mock.calls.length;
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })); expect(clock.request).toHaveBeenCalledTimes(calls);
});

test("BA stopwatch retains the baseline stage height through holding, a win and a failed attempt", async () => {
  const clock = controlledClock(); await render(stopwatch("bluearchive"));
  const button = page.getByRole("button", { name: "按住开始计时，松开结束" }); await expect.element(button).toBeEnabled();
  const stage = page.getByRole("region", { name: "秒表挑战舞台" }).element();
  const stageHeight = stage.getBoundingClientRect().height;
  expect(stage.querySelectorAll("img")).toHaveLength(0);
  const pad = button.element();
  await act(() => { pad.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })); });
  await expect.element(page.getByText("和伙伴一起数拍，松开时定格。")).toBeVisible();
  clock.set(3500); await act(() => { pad.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true })); });
  await expect.element(page.getByText("计时任务完成，老师！")).toBeVisible();
  expect(stage.getBoundingClientRect().height).toBe(stageHeight);
  await page.getByRole("button", { name: /重置计时/ }).click();
  await act(() => { pad.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })); });
  clock.set(4000); await act(() => { pad.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", bubbles: true })); });
  await expect.element(page.getByText("稍早了一点，老师再试一次。")).toBeVisible();
  expect(stage.getBoundingClientRect().height).toBe(stageHeight);
  expect(clock.frames.size).toBe(0);
});

test("stopwatch uses the declared fallback on API failure and pauses when the document becomes hidden", async () => {
  const clock = controlledClock(); vi.mocked(api).mockRejectedValueOnce(new Error("offline"));
  await render(stopwatch()); const button = page.getByRole("button", { name: "按住开始计时，松开结束" }); await expect.element(button).toBeEnabled();
  await expect.element(page.getByRole("status").filter({ hasText: "默认目标" })).toHaveTextContent("10.00 秒");
  await act(() => { button.element().dispatchEvent(new KeyboardEvent("keydown", { code: "Space", bubbles: true })); });
  clock.set(1100); vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  await act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  await expect.element(page.getByText("快了一点，再来一次。")).toBeVisible(); expect(clock.frames.size).toBe(0);
});

test("pointer release, cancellation and lost capture each finish a stopwatch round exactly once", async () => {
  const clock = controlledClock(); await render(stopwatch());
  const button = page.getByRole("button", { name: "按住开始计时，松开结束" }); await expect.element(button).toBeEnabled();
  const pad = button.element() as HTMLButtonElement; vi.spyOn(pad, "setPointerCapture").mockImplementation(() => {});
  let start = 1000;
  for (const ending of ["pointerup", "pointercancel", "lostpointercapture"]) {
    clock.set(start);
    await act(() => { pad.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 7, button: 0, bubbles: true })); });
    clock.set(start + 2500);
    await act(() => { pad.dispatchEvent(new PointerEvent(ending, { pointerId: 7, bubbles: true })); });
    await expect.element(button).toHaveAttribute("aria-pressed", "false");
    await expect.element(page.getByText("精准命中。安可！")).toBeVisible(); expect(clock.frames.size).toBe(0);
    start += 5000;
  }
  const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); pad.dispatchEvent(menu); expect(menu.defaultPrevented).toBe(true);
});

test.each(["sekai", "bluearchive"] as const)("arcade entry frames and links preserve %s and fullscreen failure is visible", async theme => {
  const fullscreen = vi.spyOn(HTMLElement.prototype, "requestFullscreen").mockRejectedValueOnce(new Error("denied")).mockResolvedValue(undefined);
  const view = await render(<MemoryRouter initialEntries={[`/note-shooter?theme=${theme}`]}><NoteShooterPage /></MemoryRouter>);
  await expect.element(page.getByTitle("音符射手")).toHaveAttribute("src", `/note-shooter/bangdream.html?v=parity-20261031&theme=${theme}`);
  await expect.element(page.getByRole("link", { name: theme === "bluearchive" ? "查看训练成绩 ↗" : "看看大家的成绩 ↗" })).toHaveAttribute("href", `/scores?theme=${theme}`);
  await expect.element(page.getByRole("link", { name: "返回首页 ↗" })).toHaveAttribute("href", `/?theme=${theme}`);
  const mooncake = page.getByRole("link", { name: "04 / 泡泡月饼大作战 ↗" });
  if (theme === "bluearchive") await expect.element(mooncake).toHaveAttribute("href", "/games/ba-mooncake?theme=bluearchive");
  else await expect.element(mooncake).not.toBeInTheDocument();
  await page.getByRole("button", { name: /全屏游玩/ }).click(); await expect.element(page.getByRole("status")).toHaveTextContent("当前浏览器不支持全屏");
  await page.getByRole("button", { name: /全屏游玩/ }).click(); expect(fullscreen).toHaveBeenCalledTimes(2);
  await expect.element(page.getByRole("status")).not.toBeInTheDocument();
  await view.rerender(<MemoryRouter><KlotskiPage /></MemoryRouter>);
  await expect.element(page.getByTitle("华容道")).toHaveAttribute("src", `/games/bang-klotski/game.html?v=parity-20261031&theme=${theme}`);
  await expect.element(page.getByText(theme === "sekai" ? /一起帮天马司找到出口/ : /一起帮星野找到出口/)).toBeVisible();
});

test.each(["", "?theme=sekai&from=directory#play"])("mooncake canonicalizes its BA theme and preserves route context %s", async suffix => {
  function Location() { const location = useLocation(); return <output aria-label="当前路径">{location.pathname}{location.search}{location.hash}</output>; }
  await render(<MemoryRouter initialEntries={[`/games/ba-mooncake${suffix}`]}><MooncakePage /><Location /></MemoryRouter>);
  await expect.element(page.getByTitle("泡泡月饼大作战")).toHaveAttribute("src", "/games/ba-mooncake/index.html?theme=bluearchive");
  await expect.element(page.getByTitle("泡泡月饼大作战")).toHaveAttribute("allowfullscreen", "");
  await expect.element(page.getByRole("heading", { name: "泡泡月饼大作战。" })).toBeVisible();
  await expect.element(page.getByLabelText("当前路径")).toHaveTextContent(suffix ? "/games/ba-mooncake?theme=bluearchive&from=directory#play" : "/games/ba-mooncake?theme=bluearchive");
  await expect.element(page.getByRole("link", { name: "返回首页 ↗" })).toHaveAttribute("href", "/?theme=bluearchive");
});
