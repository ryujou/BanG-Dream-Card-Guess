import { expect, test, type Page, type TestInfo } from "@playwright/test";

const themes = ["bangdream", "sekai", "bluearchive"] as const;
const colors = { bangdream: "rgb(244, 63, 120)", sekai: "rgb(0, 65, 144)", bluearchive: "rgb(29, 102, 237)" };

async function screenshot(page: Page, info: TestInfo, name: string) {
  const scroll = await page.evaluate(() => ({ left: scrollX, top: scrollY }));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  try {
    await page.screenshot({ path: info.outputPath(name), fullPage: true });
  } finally {
    await page.evaluate(position => window.scrollTo({ ...position, behavior: "instant" }), scroll);
  }
}

test("三主题华容道沿用同一棋盘、移动动画、提示解法和结算流程", async ({ page }, info) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let baseline: { width: number; height: number; steps: number } | undefined;
  for (const theme of themes) {
    await page.goto(`/games/bang-klotski?theme=${theme}`);
    const frame = page.frameLocator('iframe[title="华容道"]');
    await expect(frame.locator(".block")).toHaveCount(10);
    await expect.poll(() => frame.locator(".block img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await expect(frame.locator("#step-display")).toHaveText("0");
    const board = (await frame.locator("#board").boundingBox())!;
    if (baseline) expect({ width: board.width, height: board.height }).toEqual({ width: baseline.width, height: baseline.height });
    const moving = frame.locator("#block-otae");
    const initialLeft = await moving.evaluate(element => {
      const samples: number[] = [];
      (window as unknown as { parityMovement: number[] }).parityMovement = samples;
      element.addEventListener("transitionrun", () => {
        const began = performance.now();
        const tick = () => {
          samples.push(parseFloat(getComputedStyle(element).left));
          if (performance.now() - began < 200) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { once: true });
      return parseFloat(getComputedStyle(element).left);
    });
    await moving.focus();
    await page.keyboard.press("ArrowRight");
    await expect(frame.locator("#step-display")).toHaveText("1");
    const finalLeft = await moving.evaluate(element => parseFloat((element as HTMLElement).style.left));
    await expect.poll(() => frame.locator("html").evaluate((_, [from, to]) => (window as unknown as { parityMovement: number[] }).parityMovement.some(left => left > from && left < to), [initialLeft, finalLeft])).toBe(true);
    await expect(moving).toHaveCSS("transition-duration", "0.15s, 0.15s");
    await moving.scrollIntoViewIfNeeded();
    const moved = (await moving.boundingBox())!;
    const origin = { x: moved.x + moved.width / 2, y: moved.y + moved.height / 2 };
    if (info.project.use.hasTouch) {
      const touch = await page.context().newCDPSession(page);
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...origin, id: 1 }] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: origin.x - board.width / 4, y: origin.y, id: 1 }] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await touch.detach();
    } else {
      await page.mouse.move(origin.x, origin.y);
      await page.mouse.down();
      await page.mouse.move(origin.x - board.width / 4, origin.y);
      await page.mouse.up();
    }
    await expect(frame.locator("#step-display")).toHaveText("2");
    await expect(moving).not.toHaveClass(/dragging/);
    await page.reload();
    await expect(frame.locator("#step-display")).toHaveText("2");
    await frame.locator("#btn-reset").click();
    await expect(frame.locator("#step-display")).toHaveText("0");
    await frame.locator("#btn-voice").click();
    await expect(frame.locator("#btn-voice")).toHaveAttribute("aria-pressed", "false");
    await screenshot(page, info, `klotski-${theme}-initial.png`);
    for (let step = 1; step <= 200; step++) {
      await frame.locator("#btn-hint").click();
      await expect(frame.locator("#step-display")).toHaveText(String(step));
      const goal = await frame.locator("html").evaluate((_, currentTheme) => {
        const prefix = currentTheme === "bangdream" ? "bangdream:bang-klotski:" : `${currentTheme}:klotski:`;
        const progress = JSON.parse(localStorage.getItem(prefix + "progress")!);
        const block = progress.blocks.find((piece: { id: string }) => piece.id === "michelle");
        return block.x === 1 && block.y === 3;
      }, theme);
      if (goal) break;
    }
    await expect(frame.getByRole("dialog", { name: "通关成功" })).toBeVisible();
    const steps = Number(await frame.locator("#victory-steps").innerText());
    expect(steps).toBeGreaterThan(0);
    if (baseline) expect(steps).toBe(baseline.steps);
    else baseline = { width: board.width, height: board.height, steps };
    const goalImage = await frame.locator("#block-michelle img").getAttribute("src");
    await expect(frame.locator("#victory-box img")).toHaveAttribute("src", goalImage!);
    await screenshot(page, info, `klotski-${theme}-victory.png`);
    await frame.getByRole("button", { name: "再来一局 ↗" }).click();
    await expect(frame.getByRole("dialog", { name: "通关成功" })).toBeHidden();
    await expect(frame.locator("#step-display")).toHaveText("0");
    expect(await frame.locator("html").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("三主题秒表保持基线操作位置、真实按压反馈与相同胜负重置流程", async ({ page }, info) => {
  const settings = await (await page.request.get("/api/stopwatch-settings")).json();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let baseline: { height: number; padOffset: number } | undefined;
  await page.clock.install();
  for (const theme of themes) {
    await page.goto(`/games/stopwatch-challenge?theme=${theme}`);
    const stage = page.getByRole("region", { name: "秒表挑战舞台" });
    const pad = page.getByRole("button", { name: "按住开始计时，松开结束" });
    await expect(pad).toBeEnabled();
    const stageBox = (await stage.boundingBox())!, padBox = (await pad.boundingBox())!;
    const dimensions = { height: stageBox.height, padOffset: padBox.y - stageBox.y };
    if (baseline) expect(dimensions).toEqual(baseline); else baseline = dimensions;
    await expect(stage.getByRole("img")).toHaveCount(0);
    await pad.focus();
    await page.keyboard.down("Space");
    await expect(stage).toHaveAttribute("data-mode", "holding");
    await expect(pad).toHaveCSS("transform", "matrix(0.96, 0, 0, 0.96, 0, 0)");
    await expect(page.getByLabel("当前计时秒数")).not.toHaveText("0.00");
    await page.keyboard.up("Space");
    await expect(stage).toHaveAttribute("data-mode", "lose");
    await page.getByRole("button", { name: /重置计时/ }).click();
    await expect(page.getByLabel("当前计时秒数")).toHaveText("0.00");
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
    await pad.focus();
    await page.keyboard.down("Space");
    await page.clock.runFor(settings.targetSeconds * 1000);
    await page.keyboard.up("Space");
    await expect(stage).toHaveAttribute("data-mode", "win");
    await expect(page.getByLabel("当前计时秒数")).toHaveText(settings.targetSeconds.toFixed(2));
    expect((await stage.boundingBox())!.height).toBe(baseline.height);
    await screenshot(page, info, `stopwatch-${theme}-win.png`);
    await page.clock.resume();
    await page.getByRole("button", { name: /重置计时/ }).click();
    await expect(stage).toHaveAttribute("data-mode", "idle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("三主题猜图沿用出题、换局部、判错、揭晓动画与下一题流程", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    for (const theme of themes) {
      await page.goto(`/solo?theme=${theme}`);
      await page.getByRole("button", { name: "开始挑战", exact: true }).click();
      const crop = page.getByAltText(theme === "bluearchive" ? "本题记忆大厅局部" : "本题卡面局部", { exact: true });
      await expect(crop).toBeVisible({ timeout: 20000 });
      const firstCrop = await crop.getAttribute("src");
      await page.getByRole("button", { name: "换个局部", exact: true }).click();
      await expect(crop).not.toHaveAttribute("src", firstCrop!);
      await page.getByLabel("角色名字或昵称").fill("不可能匹配的测试角色名称");
      await page.getByRole("button", { name: "提交", exact: true }).click();
      await expect(page.getByText("回答错误", { exact: true })).toBeVisible();
      await expect(page.locator(".reveal-scene")).toBeVisible();
      const animation = await page.locator(".reveal-scene").evaluate(async scene => {
        const frames = [];
        for (let index = 0; index < 8; index++) {
          await new Promise(requestAnimationFrame);
          const panel = scene.querySelector('[style*="skewX"]')!;
          if (panel) frames.push({ transform: getComputedStyle(panel).transform, color: getComputedStyle(panel).backgroundColor });
        }
        return frames;
      });
      expect(animation.length).toBeGreaterThan(1);
      expect(new Set(animation.map(frame => frame.transform)).size).toBeGreaterThan(1);
      expect(animation.every(frame => frame.color === colors[theme])).toBe(true);
      await expect.poll(() => page.locator(".reveal-scene").evaluate(scene => {
        const bottom = scene.getBoundingClientRect().bottom;
        return [...scene.querySelectorAll('[style*="skewX"]')].every(panel => panel.getBoundingClientRect().top >= bottom);
      })).toBe(true);
      await expect(page.locator('img[class*="cardImage"]')).not.toHaveAttribute("src", /^data:/);
      await expect.poll(() => page.locator('img[class*="cardImage"]').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await screenshot(page, info, `guess-${theme}-revealed.png`);
      await page.getByRole("button", { name: "下一题", exact: true }).click();
      await expect(crop).toBeVisible({ timeout: 20000 });
      await page.getByRole("button", { name: "揭晓", exact: true }).click();
      await expect(crop).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(errors).toEqual([]);
  } finally {
    const identity = await (await page.request.get("/api/auth/me")).json();
    await page.request.post("/api/auth/logout", { headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": identity.csrfToken } });
  }
});
