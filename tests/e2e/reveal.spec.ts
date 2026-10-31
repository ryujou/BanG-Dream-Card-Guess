import { test, expect, type Page } from "@playwright/test";
import type { GameSnapshot } from "../../src/shared/types";

async function write(page: Page, route: string, method: string, data?: unknown) {
  const identity = await (await page.request.get("/api/auth/me")).json();
  const response = await page.request.fetch(route, {
    method, data,
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": identity.csrfToken },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response;
}

test("关闭判定后揭晓时玩家正文、历史和实时消息保密，显式揭晓与撤销同步", async ({ page, browser }, info) => {
  test.skip(!process.env.E2E_ADMIN_PASSWORD, "需要隔离测试管理员密码");
  test.setTimeout(60000);
  await page.request.get("/api/auth/me");
  await page.goto("/login");
  await write(page, "/api/auth/login", "POST", { username: "admin", password: process.env.E2E_ADMIN_PASSWORD });
  const { room } = await (await write(page, "/api/rooms", "POST", {
    name: "答案揭晓回归", settings: { revealAfterJudge: false, showTimer: false },
  })).json();
  const playerContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: info.project.use.viewport });
  const player = await playerContext.newPage();
  await player.emulateMedia({ reducedMotion: "reduce" });
  let latest: GameSnapshot | undefined;
  player.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
    const message = JSON.parse(String(payload));
    if (message.type === "state") latest = message.state;
  }));
  try {
    await page.goto(`/host?room=${room.code}`);
    await player.goto(`/player?room=${room.code}`);
    await expect(player.getByText("已连接", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "开始 / 下一题" }).click();
    const crop = player.getByAltText("本题卡面局部");
    await expect(crop).toBeVisible({ timeout: 20000 });
    const answer = await page.locator('[class*="hostAnswer"] h3').innerText();
    const image = await crop.getAttribute("src");
    await page.getByRole("button", { name: "答错", exact: true }).click();
    await expect(player.getByText("回答错误", { exact: true })).toBeVisible();
    await expect(crop).toHaveAttribute("src", image!);
    await expect(player.getByRole("heading", { name: answer, exact: true })).toHaveCount(0);
    await expect(player.getByText("答案未揭晓", { exact: true })).toBeVisible();
    await expect.poll(() => latest?.game.status).toBe("finished");
    expect(latest!.game.current).toMatchObject({ displayName: "", imageUrl: "", acceptedAnswers: [] });
    expect(latest!.game.history[0].name).toBe("");
    expect(JSON.stringify(latest)).not.toContain(answer);
    await player.screenshot({ path: info.outputPath("player-finished-hidden.png"), fullPage: true });
    await page.getByRole("button", { name: "揭晓", exact: true }).click();
    await expect(player.getByRole("heading", { name: answer, exact: true })).toBeVisible();
    await expect(player.getByRole("heading", { name: answer, exact: true })).toHaveCSS("opacity", "1");
    await expect.poll(() => player.getByAltText(answer, { exact: true }).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect.poll(() => latest?.game.history[0].name).toBe(answer);
    await player.screenshot({ path: info.outputPath("player-revealed.png"), fullPage: true });
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(crop).toBeVisible();
    await expect.poll(() => latest?.game.history.length).toBe(0);
    expect(latest!.game.current!.displayName).toBe("");
  } finally {
    await write(page, `/api/rooms/${room.code}`, "DELETE");
    await playerContext.close();
  }
});
