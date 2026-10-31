import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("账号", { exact: true }).fill("admin");
  await page
    .locator('input[name="password"]')
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "进入主持台" }).click();
  await expect(page).toHaveURL(/\/host$/);
}

async function write(
  page: Page,
  route: string,
  method: string,
  data?: unknown,
) {
  const identity = await (await page.request.get("/api/auth/me")).json();
  const response = await page.request.fetch(route, {
    method,
    data,
    headers: {
      Origin: new URL(page.url()).origin,
      "X-CSRF-Token": identity.csrfToken,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response;
}

test("首页动画、游戏入口和减少动态效果", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /让热爱，\s*在湘潭相遇。/ }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".hero-scene img")).toBeVisible();
  await page.screenshot({
    path: `artifacts/screenshots/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
  await page.getByRole("link", { name: "开始猜卡", exact: true }).click();
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole("link", { name: /音符射手/ })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("img", { name: "户山香澄" })).toBeVisible();
  await expect(page.locator(".hero-scene")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("主持建房、设置、玩家同步、判分撤销、二维码及关闭反馈", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(!process.env.E2E_ADMIN_PASSWORD, "需要测试管理员密码");
  test.setTimeout(90000);
  await login(page);
  await page.getByLabel("房间名称").fill("浏览器验收舞台");
  await page.getByRole("button", { name: "创建房间", exact: true }).click();
  await expect(page).toHaveURL(/\/host\?room=/);
  const room = new URL(page.url()).searchParams.get("room")!;
  const playerContext = await browser.newContext({
    viewport: testInfo.project.use.viewport,
    baseURL: new URL(page.url()).origin,
  });
  const player = await playerContext.newPage();
  let closed = false;
  try {
    await page.getByRole("link", { name: "我的房间", exact: true }).click();
    const roomRow = page.locator("article").filter({ hasText: room });
    await roomRow.getByRole("button", { name: "更名", exact: true }).click();
    const renameDialog = page.getByRole("dialog", { name: "房间更名" });
    await renameDialog
      .getByLabel(`房间 ${room} 的名称`)
      .fill("浏览器验收 · 星光舞台");
    await renameDialog.getByRole("button", { name: "保存名称" }).click();
    await expect(renameDialog).toHaveCount(0);
    await expect(
      roomRow.getByRole("heading", { name: "浏览器验收 · 星光舞台" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      roomRow.getByRole("heading", { name: "浏览器验收 · 星光舞台" }),
    ).toBeVisible();
    await expect(page.getByText("修改登录密码", { exact: true })).toBeVisible();
    await roomRow.getByRole("link", { name: "进入主持台" }).click();
    await page.getByRole("link", { name: "房间设置" }).click();
    await page.getByLabel("计分模式").selectOption("versus");
    await page.getByLabel("A 队名称").fill("香澄队");
    await page.getByLabel("B 队名称").fill("有咲队");
    await page.getByLabel("每题秒数").fill("90");
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByRole("status")).toHaveText("设置已保存");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出当前设置" }).click();
    expect((await download).suggestedFilename()).toBe(`xtbang-${room}.json`);
    await page.getByLabel("导入设置 JSON").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"cardBands":true}'),
    });
    await expect(page.getByRole("alert")).toContainText("格式不正确");
    await page.getByLabel("导入设置 JSON").setInputFiles({
      name: "settings.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          settings: { roundSeconds: 120 },
          teams: { B: { name: "星星队" } },
        }),
      ),
    });
    await page.getByRole("button", { name: "保存设置" }).click();
    await expect(page.getByRole("status")).toHaveText("设置已保存");
    await page.getByRole("link", { name: "返回主持台" }).click();
    await player.goto(`/player?room=${room}`);
    await expect(player.getByText("已连接", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "开始 / 下一题" }).click();
    await expect(page.getByAltText("本题卡面局部")).toBeVisible({
      timeout: 20000,
    });
    await expect(player.getByAltText("本题卡面局部")).toBeVisible();
    await expect(player.getByText("主持专用 · 本题答案")).toHaveCount(0);
    await expect(player.getByRole("heading", { name: "星星队" })).toBeVisible();
    await expect(
      player
        .locator("strong")
        .filter({ hasText: /^0[12]:\d{2}$/ })
        .first(),
    ).toBeVisible();
    await player.screenshot({
      path: `artifacts/screenshots/game-${testInfo.project.name}.png`,
      fullPage: true,
    });
    expect(
      await player.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
    const crop = await player.getByAltText("本题卡面局部").getAttribute("src");
    await player.getByRole("button", { name: "换个局部" }).click();
    await expect(player.getByAltText("本题卡面局部")).not.toHaveAttribute(
      "src",
      crop!,
    );
    await page.getByRole("button", { name: "答对", exact: true }).click();
    await expect(player.getByText("回答正确", { exact: true })).toBeVisible();
    await expect(
      player.getByRole("button", { name: "换个局部" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "撤销", exact: true }).click();
    await expect(player.getByAltText("本题卡面局部")).toBeVisible();
    await expect(player.getByText("回答正确", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "邀请玩家" }).click();
    await expect(page.getByAltText("加入游戏二维码")).toBeVisible();
    await expect(page.locator('main a[href*="/player?room="]')).toHaveAttribute(
      "href",
      `${new URL(page.url()).origin}/player?room=${room}`,
    );
    await page.getByRole("button", { name: "复制链接", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "已复制", exact: true }),
    ).toBeVisible();
    await write(page, `/api/rooms/${room}`, "DELETE");
    closed = true;
    await expect(player.getByRole("alert")).toContainText("主持已关闭房间");
  } finally {
    if (!closed) await write(page, `/api/rooms/${room}`, "DELETE");
    await playerContext.close();
  }
});

test("匿名单人同会话共享、不同浏览器隔离", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(60000);
  await page.goto("/solo");
  await page.getByRole("button", { name: "开始挑战", exact: true }).click();
  await expect(page.getByAltText("本题卡面局部")).toBeVisible({
    timeout: 20000,
  });
  const sameSession = await context.newPage();
  const otherContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
  });
  const other = await otherContext.newPage();
  try {
    await sameSession.goto("/solo");
    await expect(sameSession.getByAltText("本题卡面局部")).toHaveAttribute(
      "src",
      (await page.getByAltText("本题卡面局部").getAttribute("src"))!,
    );
    await other.goto("/solo");
    await expect(
      other.getByRole("button", { name: "开始挑战", exact: true }),
    ).toBeEnabled();
    await other.getByRole("button", { name: "开始挑战", exact: true }).click();
    await expect(other.getByAltText("本题卡面局部")).toBeVisible({
      timeout: 20000,
    });
    await page.getByLabel("角色名字或昵称").fill("这不是角色名字");
    await page.getByRole("button", { name: "提交", exact: true }).click();
    await expect(
      sameSession.getByText("回答错误", { exact: true }),
    ).toBeVisible();
    await expect(other.getByLabel("角色名字或昵称")).toBeVisible();
    await expect(page.getByRole("button", { name: "换个局部" })).toBeDisabled();
    await page.getByRole("button", { name: "停止游戏", exact: true }).click();
    await expect(
      sameSession.getByText("游戏已停止", { exact: true }),
    ).toBeVisible();
    await expect(sameSession.getByAltText("本题卡面局部")).toHaveCount(0);
    await expect(other.getByLabel("角色名字或昵称")).toBeVisible();
    await page.getByRole("button", { name: "重置本局", exact: true }).click();
    const resetDialog = page.getByRole("dialog", { name: "重置单人挑战？" });
    await resetDialog
      .getByRole("button", { name: "取消", exact: true })
      .click();
    await expect(page.getByText("游戏已停止", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "重置本局", exact: true }).click();
    await resetDialog
      .getByRole("button", { name: "确认重置", exact: true })
      .click();
    await expect(
      sameSession.getByText("准备开始你的挑战", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("main ol li")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "开始挑战", exact: true }),
    ).toBeEnabled();
    await expect(other.getByLabel("角色名字或昵称")).toBeVisible();
  } finally {
    await sameSession.close();
    await otherContext.close();
  }
});
