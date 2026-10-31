import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../../src/client/lib/auth";
import { clearSession } from "../../src/client/lib/api";
import { LoginPage } from "../../src/client/pages/Login";
import { ChangePassword } from "../../src/client/components/ChangePassword";

const user = { id: "1", username: "host", displayName: "主持人", role: "host", enabled: true };
let signedIn = false;
let failure = "";
let calls: { path: string; init?: RequestInit }[] = [];
beforeEach(() => {
  signedIn = false; failure = ""; calls = []; clearSession();
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    if (failure) return Response.json({ error: failure }, { status: 403 });
    if (path === "/api/auth/me") return Response.json({ user: signedIn ? user : null, csrfToken: "initial" });
    if (path === "/api/auth/login") {
      signedIn = true;
      return Response.json({ user, csrfToken: "signed-in" });
    }
    if (["/api/auth/logout", "/api/auth/change-password"].includes(path)) {
      signedIn = false;
      return Response.json({ ok: true });
    }
    throw new Error(`Unexpected request ${path}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

function Status() {
  const auth = useAuth();
  return <><output>{auth.loading ? "加载身份" : auth.user?.displayName || "匿名访客"}</output>
    {auth.error && <p role="alert">{auth.error}</p>}
    <button onClick={() => void auth.refresh()}>刷新身份</button>
    <button onClick={() => void auth.logout()}>注销</button></>;
}
async function loginView(entry = "/login", withPassword = false) {
  return render(<MemoryRouter initialEntries={[entry]}><AuthProvider><Status />
    {withPassword && <ChangePassword />}
    <Routes><Route path="/login" element={<LoginPage />} />
      <Route path="/host" element={<h1>主持控制台</h1>} />
      <Route path="/community-admin" element={<h1>编辑社区</h1>} />
    </Routes></AuthProvider></MemoryRouter>);
}
async function fillLogin() {
  await page.getByLabelText("账号", { exact: true }).fill("host");
  await page.getByLabelText("密码", { exact: true }).fill("test-password");
}

test("login updates the shared identity and preserves an internal next path", async () => {
  await loginView("/login?next=%2Fcommunity-admin");
  await expect.element(page.getByText("匿名访客")).toBeVisible();
  await fillLogin();
  await page.getByRole("button", { name: "显示密码" }).click();
  await expect.element(page.getByLabelText("密码", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "隐藏密码" }).click();
  await page.getByRole("button", { name: "进入主持台" }).click();
  await expect.element(page.getByRole("heading", { name: "编辑社区" })).toBeVisible();
  await expect.element(page.getByText("主持人", { exact: true })).toBeVisible();
  expect(calls.map(c => c.path)).toEqual(["/api/auth/me", "/api/auth/login"]);
  expect(JSON.parse(calls[1].init!.body as string)).toEqual({ username: "host", password: "test-password" });
  await page.getByRole("button", { name: "注销" }).click();
  await expect.element(page.getByText("匿名访客")).toBeVisible();
  expect(calls.at(-1)?.init?.headers).toMatchObject({ "X-CSRF-Token": "signed-in" });
});

test("login failure stays on the form, restores the button, and permits retry", async () => {
  await loginView();
  await expect.element(page.getByText("匿名访客")).toBeVisible();
  await fillLogin(); failure = "用户名或密码错误";
  await page.getByRole("button", { name: "进入主持台" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  await expect.element(page.getByRole("button", { name: "进入主持台" })).toBeEnabled();
  failure = "";
  await page.getByRole("button", { name: "进入主持台" }).click();
  await expect.element(page.getByRole("heading", { name: "主持控制台" })).toBeVisible();
});

test.each(["https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "/\t/example.com", "/\r/example.com"])("rejects external next: %s", async next => {
  signedIn = true;
  await loginView(`/login?next=${encodeURIComponent(next)}`);
  await expect.element(page.getByRole("heading", { name: "主持控制台" })).toBeVisible();
});

test("initial identity failure is visible and refresh recovers", async () => {
  failure = "暂时不可用";
  await loginView();
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  failure = "";
  await page.getByRole("button", { name: "刷新身份" }).click();
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  await expect.element(page.getByText("匿名访客")).toBeVisible();
});

test("password change errors preserve identity; success signs out and the next login initializes a fresh session", async () => {
  signedIn = true;
  await loginView("/host", true);
  await page.getByText("修改登录密码", { exact: true }).click();
  await page.getByLabelText("当前密码").fill("old-password");
  await page.getByLabelText("新密码").fill("new-password");
  failure = "当前密码错误";
  await page.getByRole("button", { name: "更新密码并重新登录" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent(failure);
  await expect.element(page.getByText("主持人", { exact: true })).toBeVisible();
  failure = "";
  await page.getByRole("button", { name: "更新密码并重新登录" }).click();
  await expect.element(page.getByText("匿名访客")).toBeVisible();
  await fillLogin();
  await page.getByRole("button", { name: "进入主持台" }).click();
  await expect.element(page.getByRole("heading", { name: "主持控制台" })).toBeVisible();
  expect(calls.slice(-2).map(c => c.path)).toEqual(["/api/auth/me", "/api/auth/login"]);
});
