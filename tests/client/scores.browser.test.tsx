import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter } from "react-router-dom";
import type { ScoreItem, ScoreState } from "../../src/shared/types";
import { api } from "../../src/client/lib/api";
import { useAuth } from "../../src/client/lib/auth";
import { ScoresPage } from "../../src/client/pages/Scores";

vi.mock("../../src/client/lib/api", () => ({ api: vi.fn() }));
vi.mock("../../src/client/lib/auth", () => ({ useAuth: vi.fn() }));
const request = vi.mocked(api), identity = vi.mocked(useAuth);
const score: ScoreItem = { id: "score/a", username: "香澄", score: 1200, duration: 18.5, at: 1793400000000, level: 1, difficulty: "hard" };
const state = (entries: ScoreItem[] = [score]): ScoreState => ({ total: entries.length, leaderboard: entries, top: entries, recent: [...entries].reverse() });
const user = { id: "host", username: "host", role: "host", displayName: "主持", enabled: true, createdAt: 1, updatedAt: 1 } as const;
const auth = (signedIn = false, admin = false) => ({ user: signedIn ? { ...user, role: admin ? "super_admin" as const : "host" as const } : null, loading: false, error: "", refresh: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() });

class TestStream extends EventTarget {
  static instances: TestStream[] = [];
  onopen: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();
  namedListeners = new Set<string>();
  constructor(readonly url: string) { super(); TestStream.instances.push(this); }
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) { this.namedListeners.add(type); super.addEventListener(type, listener); }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) { this.namedListeners.delete(type); super.removeEventListener(type, listener); }
  open() { this.onopen?.(new Event("open")); }
  disconnect() { this.onerror?.(new Event("error")); }
  send(value: ScoreState, named = true) { this.raw(JSON.stringify(value), named); }
  raw(data: string, named = true) { const event = new MessageEvent(named ? "scores" : "message", { data }); if (named) this.dispatchEvent(event); else this.onmessage?.(event); }
}
const mount = () => render(<MemoryRouter initialEntries={["/scores?theme=sekai"]}><ScoresPage /></MemoryRouter>);

beforeEach(() => {
  request.mockReset().mockResolvedValue(state());
  identity.mockReset().mockReturnValue(auth());
  TestStream.instances = []; vi.stubGlobal("EventSource", TestStream);
});
afterEach(async () => { await cleanup(); vi.unstubAllGlobals(); });

test("leaderboard renders score details, switches recent results and preserves theme links", async () => {
  const second = { ...score, id: "second", username: "<img onerror=alert(1)>", score: 900, level: 2, difficulty: "custom" };
  request.mockResolvedValueOnce(state([score, second]));
  await mount();
  await expect.element(page.getByText("2 条成绩记录")).toBeVisible();
  await expect.element(page.getByText("曲目 1 · 困难")).toBeVisible();
  await expect.element(page.getByText("曲目 2 · custom")).toBeVisible();
  await expect.element(page.getByRole("link", { name: "去挑战" })).toHaveAttribute("href", "/note-shooter?theme=sekai");
  await expect.element(page.getByRole("columnheader", { name: "操作" })).not.toBeInTheDocument();
  expect(document.querySelector('img[onerror]')).toBeNull();
  await page.getByRole("tab", { name: "最近挑战" }).click();
  await expect.element(page.getByRole("tab", { name: "最近挑战" })).toHaveAttribute("aria-selected", "true");
  expect(document.querySelector("thead th")?.textContent).toBe("序号");
  expect(document.querySelector('tbody tr strong')?.textContent).toBe(second.username);
  await page.getByRole("tab", { name: "最佳成绩" }).click();
  expect(document.querySelector('tbody tr strong')?.textContent).toBe("香澄");
});

test("SSE replaces snapshots, reports disconnect and malformed data, recovers, then closes on unmount", async () => {
  const view = await mount(); const stream = TestStream.instances[0];
  expect(stream.url).toBe("/api/scores/events"); stream.open();
  await expect.element(page.getByText("实时连接中", { exact: true })).toBeVisible();
  stream.disconnect(); await expect.element(page.getByText("实时连接中断，正在重连")).toBeVisible();
  stream.raw("not-json"); await expect.element(page.getByRole("alert")).toHaveTextContent("收到的成绩数据无法读取");
  stream.open(); stream.send(state([{ ...score, username: "更新的玩家", level: undefined }]), false);
  await expect.element(page.getByText("更新的玩家")).toBeVisible();
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  stream.send(state([])); await expect.element(page.getByRole("heading", { name: "第一名，等你来写" })).toBeVisible();
  await view.unmount();
  expect(stream.close).toHaveBeenCalledOnce(); expect(stream.namedListeners.size).toBe(0);
  expect(stream.onmessage).toBeNull(); expect(stream.onopen).toBeNull(); expect(stream.onerror).toBeNull();
  stream.send(state([{ ...score, username: "迟到推送" }]));
  expect(document.body.textContent).not.toContain("迟到推送");
});

test("a late initial GET cannot overwrite the newer SSE snapshot", async () => {
  let finish!: (value: ScoreState) => void;
  request.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await mount(); await expect.element(page.getByText("正在加载成绩…")).toBeVisible();
  TestStream.instances[0].send(state([{ ...score, username: "最新成绩" }]));
  await expect.element(page.getByText("最新成绩")).toBeVisible();
  finish(state([{ ...score, username: "旧快照" }])); await Promise.resolve();
  await expect.element(page.getByText("最新成绩")).toBeVisible();
  await expect.element(page.getByText("旧快照")).not.toBeInTheDocument();
});

test("initial request failure is visible and a valid stream snapshot recovers", async () => {
  request.mockRejectedValueOnce(new Error("读取服务失败")); await mount();
  await expect.element(page.getByRole("alert")).toHaveTextContent("读取服务失败");
  await expect.element(page.getByText("成绩暂时无法显示。")).toBeVisible();
  TestStream.instances[0].send(state());
  await expect.element(page.getByText("香澄", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
});

test("hosts cancel a deletion, see a failed deletion, then delete the encoded record id", async () => {
  identity.mockReturnValue(auth(true)); let fail = true, current = state();
  request.mockImplementation(async (_, options) => {
    if (options?.method === "DELETE") { if (fail) throw new Error("删除失败，请重试"); current = state([]); return { ok: true }; }
    return current;
  });
  await mount(); await expect.element(page.getByRole("button", { name: "清空全部记录" })).not.toBeInTheDocument();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(request.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("删除失败，请重试");
  await expect.element(page.getByRole("button", { name: "确认删除" })).toBeEnabled();
  fail = false; await page.getByRole("button", { name: "确认删除" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("成绩已删除。");
  await expect.element(page.getByRole("heading", { name: "第一名，等你来写" })).toBeVisible();
  expect(request.mock.calls).toContainEqual(["/api/scores/score%2Fa", { method: "DELETE" }]);
});

test("administrator clear-all waits for completion and refreshes the list", async () => {
  identity.mockReturnValue(auth(true, true));
  let finish!: (value: unknown) => void;
  request.mockResolvedValueOnce(state()).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce(state([]));
  await mount(); await page.getByRole("button", { name: "清空全部记录" }).click();
  await expect.element(page.getByRole("heading", { name: "清空全部成绩记录？" })).toBeVisible();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect.element(page.getByRole("button", { name: "正在删除" })).toBeDisabled();
  finish({ ok: true }); await expect.element(page.getByRole("status")).toHaveTextContent("成绩已删除。");
  expect(request.mock.calls[1]).toEqual(["/api/scores", { method: "DELETE" }]);
});
