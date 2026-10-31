import { test, expect, type Page } from "@playwright/test";
import type { GameSnapshot } from "../../src/shared/types";

function observeGame(page: Page) {
  const errors: string[] = [];
  let latest: GameSnapshot | undefined;
  page.on("pageerror", error => errors.push(error.message));
  page.on("websocket", socket => {
    if (new URL(socket.url()).pathname !== "/ws") return;
    socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "state") latest = message.state;
    });
  });
  return { state: () => latest, errors };
}

async function write(page: Page, route: string, method: string, data?: unknown) {
  const identity = await (await page.request.get("/api/auth/me")).json();
  const response = await page.request.fetch(route, {
    method, data,
    headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": identity.csrfToken },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response;
}

async function expectMemorial(page: Page, state: () => GameSnapshot | undefined) {
  await expect.poll(() => state()?.game.current?.imageUrl).toMatch(/^\/cards\/bluearchive\/[\d-]+_rip\/memorial\.jpg$/);
  const card = state()!.game.current!;
  await expect(page.getByRole("heading", { name: card.displayName, exact: true }).first()).toBeVisible();
  const image = page.getByAltText(card.displayName, { exact: true });
  await expect(image).toHaveAttribute("src", card.imageUrl);
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth >= 1280 && element.naturalWidth > element.naturalHeight)).toBe(true);
  expect(await image.evaluate((element: HTMLImageElement) => ({ width: element.naturalWidth, height: element.naturalHeight })))
    .toEqual({ width: card.imageWidth, height: card.imageHeight });
  expect(card.imageWidth).toBeLessThanOrEqual(1920);
}

test("蔚蓝档案真实单人猜图、错误判定与整幅揭晓，三个主题会话互相独立", async ({ page, context }, info) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const memorial = observeGame(page);
  const bangdreamPage = await context.newPage();
  const sekaiPage = await context.newPage();
  const bangdream = observeGame(bangdreamPage);
  const sekai = observeGame(sekaiPage);
  try {
    await page.goto("/solo?theme=bluearchive");
    await expect(page.getByRole("button", { name: "开始挑战", exact: true })).toBeEnabled();
    await bangdreamPage.goto("/solo");
    await sekaiPage.goto("/solo?theme=sekai");
    await expect.poll(() => [memorial.state()?.room.theme, bangdream.state()?.room.theme, sekai.state()?.room.theme])
      .toEqual(["bluearchive", "bangdream", "sekai"]);
    const ids = [memorial.state()!.room.id, bangdream.state()!.room.id, sekai.state()!.room.id];
    expect(new Set(ids).size).toBe(3);

    await page.getByRole("button", { name: "开始挑战", exact: true }).click();
    const crop = page.getByAltText("本题记忆大厅局部", { exact: true });
    await expect(crop).toBeVisible({ timeout: 20000 });
    await expect.poll(() => crop.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(memorial.state()!.game.current).toMatchObject({ displayName: "", imageUrl: "", acceptedAnswers: [], imageWidth: 0, imageHeight: 0 });
    expect(bangdream.state()!.game.status).toBe("idle");
    expect(sekai.state()!.game.status).toBe("idle");
    await page.getByLabel("角色名字或昵称").fill("这不是任何学生的名字");
    await page.getByRole("button", { name: "提交", exact: true }).click();
    await expect(page.getByText("回答错误", { exact: true })).toBeVisible();
    await expect.poll(() => memorial.state()?.game.total).toBe(1);
    expect(memorial.state()!.game.history[0].result).toBe("wrong");
    expect(memorial.state()!.game.score).toBe(0);
    await expectMemorial(page, memorial.state);
    expect(bangdream.state()!.game.total).toBe(0);
    expect(sekai.state()!.game.total).toBe(0);

    await page.getByRole("button", { name: "下一题", exact: true }).click();
    await expect(crop).toBeVisible({ timeout: 20000 });
    await expect.poll(() => memorial.state()?.game.status).toBe("playing");
    expect(memorial.state()!.game.current).toMatchObject({ imageUrl: "", imageWidth: 0, imageHeight: 0 });
    await page.getByRole("button", { name: "揭晓", exact: true }).click();
    await expect.poll(() => memorial.state()?.game.status).toBe("revealed");
    await expectMemorial(page, memorial.state);
    const revealedURL = memorial.state()!.game.current!.imageUrl;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath("bluearchive-solo-revealed.png"), fullPage: true });
    await page.reload();
    await expect(page.getByAltText(memorial.state()!.game.current!.displayName, { exact: true })).toHaveAttribute("src", revealedURL);
    await expect.poll(() => memorial.state()?.room.id).toBe(ids[0]);
    await expect(bangdreamPage.getByRole("button", { name: "开始挑战", exact: true })).toBeEnabled();
    await expect(sekaiPage.getByRole("button", { name: "开始挑战", exact: true })).toBeEnabled();
    expect([...memorial.errors, ...bangdream.errors, ...sekai.errors]).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally {
    await write(page, "/api/auth/logout", "POST");
    await bangdreamPage.close();
    await sekaiPage.close();
  }
});

test("蔚蓝档案房间学院设置、主持控制与玩家揭晓保护，直达设置保持真实主题", async ({ page, browser }, info) => {
  test.skip(!process.env.E2E_ADMIN_PASSWORD, "需要隔离测试管理员密码");
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const host = observeGame(page);
  await page.goto(`/login?theme=bluearchive&next=${encodeURIComponent("/host?theme=bluearchive")}`);
  await page.getByLabel("账号", { exact: true }).fill("admin");
  await page.locator('input[name="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "进入主持台" }).click();
  await expect(page).toHaveURL(/\/host\?theme=bluearchive$/);
  await page.getByLabel("房间名称").fill(`BA 浏览器验收 ${info.project.name}`);
  const created = page.waitForResponse(response => response.url().endsWith("/api/rooms") && response.request().method() === "POST");
  await page.getByRole("button", { name: "创建房间", exact: true }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const { room } = await response.json();
  const playerContext = await browser.newContext({ baseURL: new URL(page.url()).origin, ...info.project.use });
  const player = await playerContext.newPage();
  const audience = observeGame(player);
  await player.emulateMedia({ reducedMotion: "reduce" });
  try {
    expect(room.theme).toBe("bluearchive");
    await page.getByRole("link", { name: "房间设置", exact: true }).click();
    await expect(page.getByRole("heading", { name: "记忆大厅筛选", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "学院", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "图片类型", exact: true })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "记忆大厅", exact: true })).toBeChecked();
    await expect(page.getByLabel("人脸裁剪", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /特训|单人卡面|多人卡面/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^(乐队|稀有度|属性|卡面阶段)$/ })).toHaveCount(0);
    const schools = page.locator('[class*="filterGroup"]').filter({ has: page.getByRole("heading", { name: "学院", exact: true }) });
    for (const checkbox of await schools.getByRole("checkbox").all()) {
      if ((await checkbox.locator("..").innerText()).trim() !== "阿拜多斯高级中学") await checkbox.uncheck();
    }
    await page.getByLabel("每题秒数", { exact: true }).fill("120");
    await page.getByRole("checkbox", { name: "判定后揭晓", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "显示倒计时", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "游戏提示音", exact: true }).uncheck();
    await page.getByRole("button", { name: "保存设置", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("设置已保存");
    const saved = await (await page.request.get(`/api/rooms/${room.code}`)).json();
    expect(saved.settings).toMatchObject({ cardBands: ["abydos"], cardVariants: ["normal"], cardRarities: [], cardAttributes: [], faceCropMode: "none", revealAfterJudge: false });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: info.outputPath("bluearchive-room-settings.png"), fullPage: true });
    await page.getByRole("link", { name: "返回主持台", exact: true }).click();
    await player.goto(`/player?room=${room.code}&theme=sekai`);
    await expect(player).toHaveURL(new RegExp(`/player\\?room=${room.code}&theme=bluearchive$`));
    await expect(player.getByText("已连接", { exact: true })).toBeVisible();
    expect([401, 403]).toContain((await player.request.get(`/api/rooms/${room.code}`)).status());
    await expect(player.getByRole("button", { name: "开始 / 下一题", exact: true })).toHaveCount(0);
    await expect(player.getByText("主持专用 · 本题答案", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "开始 / 下一题", exact: true }).click();
    const crop = player.getByAltText("本题记忆大厅局部", { exact: true });
    await expect(crop).toBeVisible({ timeout: 20000 });
    const answer = await page.locator('[class*="hostAnswer"] h3').innerText();
    const original = host.state()!.game.current!.imageUrl;
    const studentID = Number(original.match(/\/([\d]+)(?:-2)?_rip\//)![1]);
    expect(saved.meta.bands.find((band: { id: string }) => band.id === "abydos").characters).toContain(studentID);
    expect(audience.state()!.room.theme).toBe("bluearchive");
    expect(host.state()!.game.current!.imageWidth).toBeGreaterThanOrEqual(1280);
    expect(audience.state()!.game.current).toMatchObject({ displayName: "", imageUrl: "", acceptedAnswers: [], imageWidth: 0, imageHeight: 0 });
    await page.getByRole("button", { name: "答错", exact: true }).click();
    await expect(player.getByText("回答错误", { exact: true })).toBeVisible();
    await expect(player.getByText("答案未揭晓", { exact: true })).toBeVisible();
    await expect(player.getByRole("heading", { name: answer, exact: true })).toHaveCount(0);
    expect(audience.state()!.game.current).toMatchObject({ displayName: "", imageUrl: "", acceptedAnswers: [], imageWidth: 0, imageHeight: 0 });
    expect(audience.state()!.game.history[0].name).toBe("");
    expect(JSON.stringify(audience.state())).not.toContain(answer);
    await player.evaluate(() => window.scrollTo(0, 0));
    await player.screenshot({ path: info.outputPath("bluearchive-player-hidden.png"), fullPage: true });
    await page.getByRole("button", { name: "揭晓", exact: true }).click();
    await expectMemorial(player, audience.state);
    expect(audience.state()!.game.current!.imageUrl).toBe(original);
    expect(audience.state()!.game.history[0].name).toBe(answer);
    await player.evaluate(() => window.scrollTo(0, 0));
    await player.screenshot({ path: info.outputPath("bluearchive-player-revealed.png"), fullPage: true });
    expect(await player.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

    await page.goto(`/settings?room=${room.code}`);
    await expect(page.getByRole("heading", { name: "记忆大厅筛选", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "学院", exact: true })).toBeVisible();
    await expect(page.getByLabel("人脸裁剪", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /特训/ })).toHaveCount(0);
    expect([...host.errors, ...audience.errors]).toEqual([]);
  } finally {
    await write(page, `/api/rooms/${room.code}`, "DELETE");
    await playerContext.close();
    await write(page, "/api/auth/logout", "POST");
  }
});
