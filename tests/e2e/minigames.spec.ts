import { expect, test } from "@playwright/test";

test("秒表按空格命中实际设置，指针提前松开失败，重置正常", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const settings = await (
    await page.request.get("/api/stopwatch-settings")
  ).json();
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/games/stopwatch-challenge");
  const pad = page.getByRole("button", { name: "按住开始计时，松开结束" });
  await expect(pad).toBeEnabled();
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  await pad.focus();
  await page.keyboard.down("Space");
  await expect(pad).toHaveAttribute("aria-pressed", "true");
  await page.clock.runFor(settings.targetSeconds * 1000);
  await page.keyboard.up("Space");
  await expect(page.getByText("精准命中。安可！")).toBeVisible();
  await expect(page.getByLabel("当前计时秒数")).toHaveText(
    settings.targetSeconds.toFixed(2),
  );
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(100);
  await page.mouse.up();
  await expect(page.getByText("快了一点，再来一次。")).toBeVisible();
  await page.getByRole("button", { name: "重置计时" }).click();
  await expect(page.getByLabel("当前计时秒数")).toHaveText("0.00");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("华容道移动、刷新保存、连续提示和重新开始", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/games/bang-klotski");
  const frame = page.frameLocator('iframe[title="华容道"]');
  await expect(frame.locator(".block")).toHaveCount(10);
  await frame.locator("#block-otae").focus();
  await page.keyboard.press("ArrowRight");
  await expect(frame.locator("#step-display")).toHaveText("1");
  await page.reload();
  await expect(frame.locator("#step-display")).toHaveText("1");
  await frame.locator("#btn-hint").click();
  await expect(frame.locator("#step-display")).toHaveText("2");
  await frame.locator("#btn-hint").click();
  await expect(frame.locator("#step-display")).toHaveText("3");
  await page.reload();
  await expect(frame.locator("#step-display")).toHaveText("3");
  await frame.locator("#btn-voice").click();
  await expect(frame.locator("#btn-voice")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await frame.locator("#btn-reset").click();
  await expect(frame.locator("#step-display")).toHaveText("0");
  expect(
    await frame
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("音符射手真实结算提交、SSE通知、关卡难度榜单读取", async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/note-shooter");
  const frame = page.frameLocator('iframe[title="音符射手"]');
  await expect(frame.locator("#start-button")).toBeEnabled();
  await expect(frame.locator("#leaderboard-button")).toBeVisible();
  await expect(frame.locator("#connection-status")).toContainText("成绩已连接");
  const nickname = `E2E-${Date.now().toString(36)}`;
  await frame.locator("#player-name-input").fill(nickname);
  await frame.locator('.difficulty-btn[data-text="easy"]').click();
  await frame.locator("#level-selector").selectOption("1");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const state = window as unknown as {
          arcadeEvents: EventSource;
          arcadeNames: string[];
        };
        state.arcadeNames = [];
        state.arcadeEvents = new EventSource("/api/note-shooter-scores/events");
        state.arcadeEvents.addEventListener("scores", (event) => {
          const data = JSON.parse((event as MessageEvent).data);
          state.arcadeNames = data.recent.map(
            (item: { username: string }) => item.username,
          );
          resolve();
        });
        state.arcadeEvents.onerror = () =>
          reject(new Error("成绩 SSE 连接失败"));
      }),
  );
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
  const registered = page.waitForResponse((response) =>
    response.url().endsWith("/note-shooter-api/startStat") && response.request().method() === "POST",
  );
  await frame.locator("#start-button").click();
  expect((await registered).status()).toBe(200);
  await expect(frame.locator("#pause-button")).toBeVisible();
  await page.clock.fastForward(16000);
  await frame.locator("#pause-button").click();
  await expect(frame.locator("#pause-menu")).toBeVisible();
  // 浏览器时钟用于固定游戏画面；服务端时长必须真实经过，不能用前端快进替代。
  await new Promise((resolve) => setTimeout(resolve, 16000));
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/note-shooter-api/gameStat") &&
      response.request().method() === "POST",
  );
  await frame.locator("#submit-score-button").click();
  const response = await submitted;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    levels: 1,
    difficulty: "easy",
    playerName: nickname,
  });
  await expect(frame.locator("#score-status")).toHaveText("成绩已收录到排行榜");
  await expect
    .poll(() =>
      page.evaluate(
        (name) =>
          (window as unknown as { arcadeNames: string[] }).arcadeNames.includes(
            name,
          ),
        nickname,
      ),
    )
    .toBe(true);
  await page.clock.resume();
  await frame.locator("#home-button").click();
  await frame.locator("#leaderboard-button").click();
  await frame.locator("#lb-show").selectOption("myRecent");
  await expect(
    frame.locator(".leaderboard-name").filter({ hasText: nickname }).first(),
  ).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { arcadeEvents: EventSource }).arcadeEvents.close(),
  );
  expect(errors).toEqual([]);
});
