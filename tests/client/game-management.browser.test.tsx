import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HostPage } from "../../src/client/pages/Host";
import { SettingsPage } from "../../src/client/pages/Settings";
import { QrPage } from "../../src/client/pages/Qr";
import { api } from "../../src/client/lib/api";
import { copyText } from "../../src/client/lib/clipboard";
import { gameMeta, gameSettings, room, snapshot } from "./game-fixtures";
const auth = vi.hoisted(() => ({ user: { id: "host", role: "super_admin", displayName: "主持人" } as { id: string; role: string; displayName: string } | null, loading: false }));
vi.mock("../../src/client/lib/auth", () => ({ useAuth: () => auth }));
vi.mock("../../src/client/lib/api", () => ({ api: vi.fn(), errorText: (error: Error) => error.message }));
vi.mock("../../src/client/lib/clipboard", () => ({ copyText: vi.fn() }));
vi.mock("../../src/client/features/game/useGameSound", () => ({ useGameSound: vi.fn() }));
vi.mock("../../src/client/features/game/useGame", () => ({ useGame: () => ({ state: null, connected: false, error: "", command: vi.fn(), reconnect: vi.fn() }), useHostShortcuts: vi.fn() }));
let rooms = [{ ...room }], failure = "";
beforeEach(() => {
  rooms = [{ ...room }]; failure = ""; auth.user = { id: "host", role: "super_admin", displayName: "主持人" }; auth.loading = false;
  vi.mocked(copyText).mockReset().mockResolvedValue(undefined);
  vi.mocked(api).mockReset().mockImplementation(async (path, options) => {
    if (failure) throw new Error(failure);
    if (path === "/api/rooms" && options?.method === "POST") return { room: { ...room, code: "NEW123", theme: (options.body as Record<string, string>).theme } };
    if (path === "/api/rooms") return { rooms };
    if (path === "/api/rooms/ABC123" && options?.method === "PATCH") { rooms = [{ ...room, name: (options.body as { name: string }).name }]; return { room: rooms[0] }; }
    if (path === "/api/rooms/ABC123" && options?.method === "DELETE") { rooms = []; return { ok: true }; }
    if (path === "/api/rooms/ABC123") return { settings: { ...gameSettings }, teams: snapshot().game.teams, meta: gameMeta };
    if (path === "/api/settings/meta") return gameMeta;
    if (path === "/api/settings" && options?.method === "PUT") return { ...gameSettings, ...(options.body as object), roundSeconds: 90 };
    if (path === "/api/rooms/ABC123/settings") return { settings: { ...gameSettings, ...(options!.body as object) } };
    if (path === "/api/settings") return { ...gameSettings };
    if (path === "/api/network") return { publicOrigin: "https://public.example" };
    throw new Error(`Unexpected API ${path}`);
  });
});
afterEach(() => vi.restoreAllMocks());
function management(entry: string) {
  return <MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/host" element={<HostPage />} /><Route path="/settings" element={<SettingsPage />} />
    <Route path="/qr" element={<QrPage />} /><Route path="/login" element={<h1>请登录</h1>} />
  </Routes></MemoryRouter>;
}

test("host identity guard waits and redirects anonymous visitors", async () => {
  auth.loading = true; const view = await render(management("/host"));
  await expect.element(page.getByText("正在确认登录状态…")).toBeVisible(); expect(api).not.toHaveBeenCalled();
  auth.loading = false; auth.user = null; await view.rerender(management("/host"));
  await expect.element(page.getByRole("heading", { name: "请登录" })).toBeVisible();
});

test("room loading failures recover, create preserves theme and opens the new room", async () => {
  failure = "房间读取失败"; await render(management("/host?theme=sekai"));
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  failure = ""; await page.getByRole("button", { name: "刷新", exact: true }).click();
  await expect.element(page.getByRole("heading", { name: "周末猜卡" })).toBeVisible();
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  await page.getByLabelText("房间名称").fill("蓝色舞台");
  failure = "创建失败"; await page.getByRole("button", { name: "创建房间" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  await expect.element(page.getByRole("button", { name: "创建房间" })).toBeEnabled();
  failure = ""; await page.getByRole("button", { name: "创建房间" }).click();
  await expect.element(page.getByText("NEW123", { exact: true })).toBeVisible();
  expect(api).toHaveBeenCalledWith("/api/rooms", { method: "POST", body: { name: "蓝色舞台", theme: "sekai" } });
});

test("rename trims the room name, preserves errors for retry, and delete requires confirmation", async () => {
  await render(management("/host")); await expect.element(page.getByRole("heading", { name: "周末猜卡" })).toBeVisible();
  await page.getByRole("button", { name: "更名", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "更名", exact: true }).click();
  await page.getByLabelText("房间 ABC123 的名称").fill("  新舞台  ");
  failure = "名称保存失败"; await page.getByRole("button", { name: "保存名称" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  failure = ""; await page.getByRole("button", { name: "保存名称" }).click();
  await expect.element(page.getByRole("heading", { name: "新舞台" })).toBeVisible();
  expect(api).toHaveBeenCalledWith("/api/rooms/ABC123", { method: "PATCH", body: { name: "新舞台" } });
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(api).not.toHaveBeenCalledWith("/api/rooms/ABC123", { method: "DELETE" });
  await page.getByRole("button", { name: "关闭", exact: true }).click(); failure = "关闭失败";
  await page.getByRole("button", { name: "关闭房间", exact: true }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  failure = ""; await page.getByRole("button", { name: "关闭房间", exact: true }).click();
  await expect.element(page.getByRole("heading", { name: "舞台还空着，等你开场。" })).toBeVisible();
});

test("default settings are read-only for a host; anonymous settings redirect", async () => {
  auth.user!.role = "host"; const view = await render(management("/settings"));
  await expect.element(page.getByLabelText("每题秒数")).toHaveValue(60);
  await expect.element(page.getByRole("button", { name: "保存设置" })).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "导出当前设置" })).toBeEnabled();
  auth.user = null; await view.rerender(management("/settings"));
  await expect.element(page.getByRole("heading", { name: "请登录" })).toBeVisible();
});

test("settings apply difficulty, prevent an empty filter, surface save failure, and accept server normalization", async () => {
  await render(management("/settings")); await expect.element(page.getByLabelText("每题秒数")).toHaveValue(60);
  await page.getByRole("combobox", { name: /^难度/ }).selectOptions("hard");
  await page.getByRole("combobox", { name: /^计分模式/ }).selectOptions("versus");
  await page.getByRole("combobox", { name: /^人脸裁剪/ }).selectOptions("avoid");
  await expect.element(page.getByLabelText("裁剪大小")).toHaveValue(40);
  await expect.element(page.getByLabelText("裁剪候选数")).toHaveValue(40);
  await page.getByLabelText("3 星", { exact: true }).click();
  await expect.element(page.getByLabelText("4 星", { exact: true })).toBeDisabled();
  await page.getByLabelText("允许重切", { exact: true }).click();
  await page.getByLabelText("每题秒数").fill("120");
  failure = "保存被拒绝"; await page.getByRole("button", { name: "保存设置" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  await expect.element(page.getByRole("button", { name: "保存设置" })).toBeEnabled();
  failure = ""; await page.getByRole("button", { name: "保存设置" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("设置已保存");
  await expect.element(page.getByLabelText("每题秒数")).toHaveValue(90);
  expect(api).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ method: "PUT", body: expect.objectContaining({ difficulty: "hard", mode: "versus", faceCropMode: "avoid", cropSize: 40, cardRarities: [4], allowRecrop: false, roundSeconds: 120 }) }));
});

test("room settings use room metadata, import validated fields and team names, then save through PATCH", async () => {
  auth.user!.role = "host"; await render(management("/settings?room=ABC123&theme=sekai"));
  await expect.element(page.getByLabelText("A 队名称")).toHaveValue("红队");
  expect(api).not.toHaveBeenCalledWith("/api/settings/meta");
  await expect.element(page.getByRole("heading", { name: "组合" })).toBeVisible();
  await expect.element(page.getByLabelText("目标秒数")).not.toBeInTheDocument();
  await page.getByLabelText("导入设置 JSON").upload(new File(['{"settings":{"roundSeconds":"bad"}}'], "invalid.json", { type: "application/json" }));
  await expect.element(page.getByRole("alert")).toHaveTextContent("导入失败");
  await expect.element(page.getByLabelText("每题秒数")).toHaveValue(60);
  await page.getByLabelText("导入设置 JSON").upload(new File(['{"settings":{"roundSeconds":75},"teams":{"A":{"name":"节奏队"}}}'], "room.json", { type: "application/json" }));
  await expect.element(page.getByRole("status")).toHaveTextContent("点击保存后应用");
  await expect.element(page.getByLabelText("A 队名称")).toHaveValue("节奏队");
  await page.getByLabelText("B 队名称").fill("旋律队");
  await page.getByRole("button", { name: "保存设置" }).click();
  expect(api).toHaveBeenCalledWith("/api/rooms/ABC123/settings", { method: "PATCH", body: expect.objectContaining({ roundSeconds: 75, teamAName: "节奏队", teamBName: "旋律队" }) });
});

test("settings load failure is visible, and exported JSON uses a revoked temporary URL", async () => {
  failure = "设置读取失败"; const failed = await render(management("/settings"));
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure); await failed.unmount();
  failure = ""; await render(management("/settings")); await expect.element(page.getByLabelText("每题秒数")).toHaveValue(60);
  const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-settings");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await page.getByRole("button", { name: "导出当前设置" }).click();
  const exported = JSON.parse(await (create.mock.calls[0][0] as Blob).text());
  expect(exported.settings.roundSeconds).toBe(60); expect(exported).not.toHaveProperty("teams");
  expect(click).toHaveBeenCalledOnce(); expect(revoke).toHaveBeenCalledWith("blob:test-settings");
});

test("QR invitation uses the public origin and theme, and clipboard errors provide a manual alternative", async () => {
  await render(management("/qr?room=ABC123&theme=sekai"));
  const invite = "https://public.example/player?room=ABC123&theme=sekai";
  await expect.element(page.getByRole("img", { name: "加入游戏二维码" })).toHaveAttribute("src", `/api/qr?text=${encodeURIComponent(invite)}`);
  vi.mocked(copyText).mockRejectedValueOnce(new Error("denied"));
  await page.getByRole("button", { name: "复制链接" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("手动复制");
  await page.getByRole("button", { name: "复制链接" }).click();
  await expect.element(page.getByRole("button", { name: "已复制" })).toBeVisible(); expect(copyText).toHaveBeenCalledWith(invite);
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
});

test("a generic invitation links to the themed games directory and network failure disables copying", async () => {
  const view = await render(management("/qr?theme=sekai"));
  await expect.element(page.getByRole("link", { name: "https://public.example/games?theme=sekai" })).toBeVisible(); await view.unmount();
  failure = "公网地址不可用"; await render(management("/qr"));
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  await expect.element(page.getByRole("button", { name: "复制链接" })).toBeDisabled();
});
