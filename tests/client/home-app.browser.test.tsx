import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../../src/client/App";
import { AuthProvider } from "../../src/client/lib/auth";
import { clearSession } from "../../src/client/lib/api";
import { JoinRoom } from "../../src/client/features/game/GameDirectory";
import type { Community } from "../../src/shared/types";

let community: Community;
let failCommunity = false;
let signedIn = false;
let failLogout = false;
beforeEach(async () => {
  await page.viewport(1280, 900);
  community = { aboutUs: "BanG Dream! 同好会", members: [], events: [], photos: [], socialLinks: [], bilibili: [] };
  failCommunity = false; signedIn = false; failLogout = false; clearSession();
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path === "/api/community") return failCommunity
      ? Response.json({ error: "社团暂不可用" }, { status: 503 }) : Response.json(community);
    if (path === "/api/auth/me") return Response.json({ csrfToken: "test", user: signedIn ? { id: "1", role: "super_admin", displayName: "管理员" } : null });
    if (path === "/api/auth/logout") {
      if (failLogout) return Response.json({ error: "退出暂不可用" }, { status: 503 });
      signedIn = false; return Response.json({ ok: true });
    }
    throw new Error(`Unexpected request: ${path}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="url">{location.pathname}{location.search}{location.hash}</output>;
}
const show = (path = "/") => render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /><LocationProbe /></AuthProvider></MemoryRouter>);

test("homepage switches theme, keeps URL/history state and links, and clears page effects on unmount", async () => {
  const originalTitle = document.title;
  const screen = await show();
  await page.getByRole("button", { name: "世界计划", exact: true }).click();
  await expect.element(page.getByTestId("url")).toHaveTextContent("/?theme=sekai");
  await expect.poll(() => document.documentElement.dataset.gameTheme).toBe("sekai");
  await expect.poll(() => document.title).toContain("世界计划");
  await expect.element(page.getByRole("link", { name: "开始音符射手" })).toHaveAttribute("href", "/note-shooter?theme=sekai");
  await expect.element(page.getByRole("button", { name: "播放社团视频" })).toBeDisabled();
  await page.getByRole("button", { name: "世界计划", exact: true }).click();
  await expect.element(page.getByTestId("url")).toHaveTextContent("/?theme=sekai");
  await page.getByRole("button", { name: "BanG Dream!", exact: true }).click();
  await expect.poll(() => document.documentElement.dataset.gameTheme).toBe("bangdream");
  await page.getByRole("button", { name: "蔚蓝档案", exact: true }).click();
  await expect.element(page.getByTestId("url")).toHaveTextContent("/?theme=bluearchive");
  await expect.poll(() => document.documentElement.dataset.gameTheme).toBe("bluearchive");
  await expect.poll(() => document.title).toContain("蔚蓝档案");
  await expect.element(page.getByRole("link", { name: "开始猜图", exact: true })).toHaveAttribute("href", "/games?theme=bluearchive");
  await expect.element(page.getByRole("link", { name: "开始音符射手" })).toHaveAttribute("href", "/note-shooter?theme=bluearchive");
  await expect.element(page.getByRole("link", { name: "加入同好会", exact: true })).toHaveAttribute("href", "https://qm.qq.com/q/2ZMcajVnaw");
  await expect.element(page.getByText("QQ 群：544353386")).toBeInTheDocument();
  await screen.unmount();
  expect(document.documentElement.dataset.gameTheme).toBeUndefined();
  expect(document.body.dataset.characterCursor).toBeUndefined();
  expect(document.title).toBe(originalTitle);
});

test("home community preview handles past events, missing avatars and literal untrusted text", async () => {
  community.members = [{ name: "小明", desc: "成员", url: "" }, { name: "小红", desc: "", url: "", image: "/uploads/avatar.webp" }];
  community.events = [{ title: "下次活动预告", date: "2020-01-01", location: "湘潭", desc: "<script>bad()</script>" }];
  community.photos = ["/uploads/group.webp"];
  await show("/?theme=sekai");
  await expect.element(page.getByText("往期活动", { exact: true })).toBeInTheDocument();
  await expect.element(page.getByText("原活动公告：<script>bad()</script>")).toBeInTheDocument();
  await expect.element(page.getByRole("img", { name: "小红 的头像" })).toHaveAttribute("src", "/uploads/avatar.webp");
  expect(document.querySelector("script:not([src])")?.textContent).not.toContain("bad()");
  await expect.element(page.getByText("QQ 群：1030720768")).toBeInTheDocument();
});

test("community load error stays visible while game links remain usable", async () => {
  failCommunity = true;
  await show();
  await expect.element(page.getByRole("alert")).toHaveTextContent("社团暂不可用");
  await expect.element(page.getByRole("link", { name: "开始华容道" })).toHaveAttribute("href", "/games/bang-klotski");
});

test("game directory preserves theme and normalizes a valid room code", async () => {
  await show("/games?theme=sekai");
  await expect.element(page.getByRole("heading", { name: "今天，来玩一局。" })).toBeVisible();
  await page.getByRole("textbox", { name: "房间码" }).fill("abc234");
  await expect.element(page.getByRole("textbox", { name: "房间码" })).toHaveValue("ABC234");
  // Assert the native form constraint before navigation would open a live socket.
  const input = page.getByRole("textbox", { name: "房间码" }).element() as HTMLInputElement;
  expect(input.checkValidity()).toBe(true);
  await page.getByRole("textbox", { name: "房间码" }).fill("abc");
  expect(input.checkValidity()).toBe(false);
  await page.getByRole("button", { name: "加入房间" }).click();
  await expect.element(page.getByTestId("url")).toHaveTextContent("/games?theme=sekai");
  await expect.element(page.getByRole("link", { name: "查看成绩榜" })).toHaveAttribute("href", "/scores?theme=sekai");
});

test("navigation menu closes on Escape and restores focus", async () => {
  await page.viewport(390, 844);
  await show("/does-not-exist?theme=sekai");
  await expect.element(page.getByRole("heading", { name: "这里还没有舞台。" })).toBeVisible();
  await page.getByRole("button", { name: "打开菜单" }).click();
  await expect.element(page.getByRole("button", { name: "关闭菜单" })).toHaveAttribute("aria-expanded", "true");
  page.getByRole("button", { name: "关闭菜单" }).element().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await expect.element(page.getByRole("button", { name: "打开菜单" })).toHaveFocus();
  await page.getByRole("link", { name: "回到首页" }).click();
  await expect.element(page.getByTestId("url")).toHaveTextContent("/?theme=sekai");
});

test("logout failure retains identity; successful retry returns to the themed home", async () => {
  signedIn = true;
  await show("/missing?theme=sekai");
  await expect.element(page.getByRole("link", { name: "管理员", exact: true })).toBeVisible();
  failLogout = true;
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("退出暂不可用");
  await expect.element(page.getByRole("button", { name: "退出登录" })).toBeVisible();
  failLogout = false;
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect.element(page.getByTestId("url")).toHaveTextContent("/?theme=sekai");
  await expect.element(page.getByRole("button", { name: "退出登录" })).not.toBeInTheDocument();
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
});

test.each([["/home?theme=sekai#games", "/?theme=sekai#games"], ["/home?theme=bluearchive#games", "/?theme=bluearchive#games"], ["/join?theme=bluearchive", "/games?theme=bluearchive"], ["/join", "/games"]])("legacy route %s resolves to %s", async (from, to) => {
  await show(from);
  await expect.element(page.getByTestId("url")).toHaveTextContent(to);
});

test("valid join submits the normalized room code and theme through the router", async () => {
  await render(<MemoryRouter initialEntries={["/games?theme=sekai"]}><JoinRoom /><LocationProbe /></MemoryRouter>);
  await page.getByRole("textbox", { name: "房间码" }).fill("abc234");
  await page.getByRole("button", { name: "加入房间" }).click();
  await expect.element(page.getByTestId("url")).toHaveTextContent("/player?room=ABC234&theme=sekai");
});
