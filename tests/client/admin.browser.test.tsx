import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter } from "react-router-dom";
import type { User } from "../../src/shared/types";
import { AuthProvider } from "../../src/client/lib/auth";
import { clearSession } from "../../src/client/lib/api";
import { AdminUsersPage } from "../../src/client/pages/Admin";

const administrator: User = { id: "admin", username: "admin", displayName: "站点管理员", role: "super_admin", enabled: true, createdAt: 1, updatedAt: 1 };
const host: User = { id: "helper", username: "helper", displayName: "活动主持人", role: "host", enabled: true, createdAt: 1, updatedAt: 1 };
let viewer: User | null;
let users: User[];
let listFailure: string;
let mutationFailure: string;
let calls: { path: string; method: string; body?: Record<string, unknown>; headers?: HeadersInit }[];

beforeEach(() => {
  viewer = { ...administrator }; users = [{ ...administrator }, { ...host }];
  listFailure = ""; mutationFailure = ""; calls = []; clearSession();
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method, body, headers: init?.headers });
    if (path === "/api/auth/me") return Response.json({ user: viewer, csrfToken: "admin-session" });
    if (path === "/api/admin/users" && method === "GET") return listFailure ? Response.json({ error: listFailure }, { status: 503 }) : Response.json({ users });
    if (mutationFailure) return Response.json({ error: mutationFailure }, { status: 400 });
    if (path === "/api/admin/users" && method === "POST") {
      const user = { ...body, id: "new-host", createdAt: 2, updatedAt: 2 } as User;
      users.push(user); return Response.json({ user });
    }
    const match = path.match(/^\/api\/admin\/users\/([^/]+)(\/reset-password)?$/);
    if (!match) throw new Error(`Unexpected request ${method} ${path}`);
    const id = decodeURIComponent(match[1]);
    if (match[2] && method === "POST") {
      if (id === viewer?.id) viewer = null;
      return Response.json({ ok: true });
    }
    if (method === "PATCH") {
      users = users.map(user => user.id === id ? { ...user, ...body, updatedAt: user.updatedAt + 1 } : user);
      const user = users.find(user => user.id === id)!;
      if (user.id === viewer?.id) viewer = user;
      return Response.json({ user });
    }
    if (method === "DELETE") { users = users.filter(user => user.id !== id); return Response.json({ ok: true }); }
    throw new Error(`Unexpected method ${method}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function view() { return render(<MemoryRouter><AuthProvider><AdminUsersPage /></AuthProvider></MemoryRouter>); }
const row = (username: string) => page.getByRole("row", { name: new RegExp(`@${username}`) });
async function fillCreate() {
  await page.getByLabelText(/登录用户名/).fill("new_host");
  await page.getByLabelText("显示名称").fill("新主持人");
  await page.getByLabelText(/初始密码/).fill("temporary-password");
}

test("list failures are visible and do not falsely claim there are no accounts", async () => {
  listFailure = "账号列表暂时不可用";
  await view();
  await expect.element(page.getByRole("alert")).toHaveTextContent(listFailure);
  await expect.element(page.getByText("暂无账号。")).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "创建账号 +" })).toBeEnabled();
});

test("loading and saving disable competing actions until their requests complete", async () => {
  const originalFetch = globalThis.fetch;
  let resolveList!: (response: Response) => void;
  let resolveSave!: (response: Response) => void;
  const listResponse = new Promise<Response>(resolve => { resolveList = resolve; });
  const saveResponse = new Promise<Response>(resolve => { resolveSave = resolve; });
  const waitingFetch = vi.fn((path: RequestInfo | URL, init?: RequestInit) => {
    if (path === "/api/admin/users" && init?.method === "GET") return listResponse;
    if (init?.method === "PATCH") return saveResponse;
    return originalFetch(path, init);
  });
  vi.stubGlobal("fetch", waitingFetch);
  await view();
  await expect.element(page.getByText("正在加载账号…")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "创建账号 +" })).toBeDisabled();
  resolveList(Response.json({ users }));
  await row("helper").getByRole("button", { name: "编辑" }).click();
  await page.getByLabelText("显示名称").fill("保存后的名称");
  await page.getByRole("button", { name: "保存账号 ↗" }).click();
  await expect.element(page.getByRole("button", { name: "正在保存…" })).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "取消", exact: true })).toBeDisabled();
  await expect.element(row("helper").getByRole("button", { name: "编辑" })).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "创建账号 +" })).toBeDisabled();
  resolveSave(Response.json({ user: { ...host, displayName: "保存后的名称" } }));
  await expect.element(row("helper")).toHaveTextContent("保存后的名称");
  await expect.element(page.getByRole("button", { name: "创建账号 +" })).toBeEnabled();
  expect(waitingFetch.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
});

test.each(["anonymous", "host"])("%s viewers never request or expose the administrator user list", async role => {
  viewer = role === "anonymous" ? null : { ...host };
  await view();
  await expect.element(page.getByRole("heading", { name: "此页面仅限管理员" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "创建账号 +" })).not.toBeInTheDocument();
  expect(calls.map(call => call.path)).toEqual(["/api/auth/me"]);
  await expect.element(page.getByRole("link")).toHaveAttribute("href", role === "anonymous" ? "/login?next=/admin/users" : "/host");
});

test("administrators create, edit, disable, reset and delete accounts with the correct requests", async () => {
  await view();
  await expect.element(row("admin").getByRole("button", { name: "删除" })).toBeDisabled();
  await page.getByRole("button", { name: "创建账号 +" }).click();
  await fillCreate();
  await page.getByRole("button", { name: "保存账号 ↗" }).click();
  await expect.element(row("new_host")).toHaveTextContent("新主持人");
  expect(calls.find(call => call.method === "POST")?.body).toEqual({ username: "new_host", displayName: "新主持人", password: "temporary-password", role: "host", enabled: true });
  await row("new_host").getByRole("button", { name: "编辑" }).click();
  await expect.element(page.getByLabelText(/登录用户名/)).toHaveAttribute("readonly");
  await page.getByLabelText("显示名称").fill("更名主持人");
  await page.getByLabelText(/^角色/).selectOptions("super_admin");
  await page.getByLabelText("账号状态").selectOptions("disabled");
  await page.getByRole("button", { name: "保存账号 ↗" }).click();
  await expect.element(row("new_host")).toHaveTextContent("更名主持人");
  await expect.element(row("new_host")).toHaveTextContent("已停用");
  expect(calls.find(call => call.method === "PATCH")?.body).toEqual({ displayName: "更名主持人", role: "super_admin", enabled: false });
  await row("new_host").getByRole("button", { name: "改密" }).click();
  await page.getByLabelText(/新密码/).fill("replacement-password");
  await page.getByRole("button", { name: "确认重置密码" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("已重置 更名主持人 的密码。");
  expect(calls.find(call => call.path.endsWith("/reset-password"))?.body).toEqual({ password: "replacement-password" });
  await row("new_host").getByRole("button", { name: "删除" }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect.element(row("new_host")).not.toBeInTheDocument();
  await expect.element(page.getByRole("status")).toHaveTextContent("账号已删除。");
  expect(calls.at(-1)).toMatchObject({ path: "/api/admin/users/new-host", method: "DELETE" });
  expect(calls.filter(call => call.method !== "GET").every(call => (call.headers as Record<string, string>)["X-CSRF-Token"] === "admin-session")).toBe(true);
});

test("failed create, edit, reset and delete keep inputs and account rows available for correction", async () => {
  await view();
  await page.getByRole("button", { name: "创建账号 +" }).click();
  await fillCreate(); mutationFailure = "账号创建失败";
  await page.getByRole("button", { name: "保存账号 ↗" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(mutationFailure);
  await expect.element(page.getByLabelText("显示名称")).toHaveValue("新主持人");
  await expect.element(page.getByRole("button", { name: "保存账号 ↗" })).toBeEnabled();
  await page.getByRole("button", { name: "取消", exact: true }).click();

  await row("helper").getByRole("button", { name: "编辑" }).click();
  await page.getByLabelText("显示名称").fill("尚未保存"); mutationFailure = "账号更新失败";
  await page.getByRole("button", { name: "保存账号 ↗" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(mutationFailure);
  await expect.element(row("helper")).toHaveTextContent("活动主持人");
  await expect.element(page.getByLabelText("显示名称")).toHaveValue("尚未保存");
  await page.getByRole("button", { name: "取消", exact: true }).click();

  await row("helper").getByRole("button", { name: "改密" }).click();
  await page.getByLabelText(/新密码/).fill("replacement-password"); mutationFailure = "密码重置失败";
  await page.getByRole("button", { name: "确认重置密码" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(mutationFailure);
  await expect.element(page.getByLabelText(/新密码/)).toHaveValue("replacement-password");
  await expect.element(page.getByRole("button", { name: "确认重置密码" })).toBeEnabled();
  await page.getByRole("button", { name: "取消", exact: true }).click();

  await row("helper").getByRole("button", { name: "删除" }).click(); mutationFailure = "账号删除失败";
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(mutationFailure);
  await expect.element(row("helper")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "确认删除", exact: true })).toBeEnabled();
  mutationFailure = "";
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect.element(row("helper")).not.toBeInTheDocument();
});

test("editing the current account refreshes identity, and resetting its password returns to the login boundary", async () => {
  await view();
  await row("admin").getByRole("button", { name: "编辑" }).click();
  await page.getByLabelText("显示名称").fill("新的管理名称");
  await page.getByRole("button", { name: "保存账号 ↗" }).click();
  await expect.element(row("admin")).toHaveTextContent("新的管理名称");
  expect(calls.filter(call => call.path === "/api/auth/me")).toHaveLength(2);
  await row("admin").getByRole("button", { name: "改密" }).click();
  await page.getByLabelText(/新密码/).fill("replacement-password");
  await page.getByRole("button", { name: "确认重置密码" }).click();
  await expect.element(page.getByRole("heading", { name: "此页面仅限管理员" })).toBeVisible();
  await expect.element(page.getByRole("table")).not.toBeInTheDocument();
  expect(calls.filter(call => call.path === "/api/auth/me")).toHaveLength(3);
});
