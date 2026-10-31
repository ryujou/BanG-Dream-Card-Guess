import { readFileSync } from "node:fs";
import { expect, test, type Frame, type Locator, type Page, type TestInfo } from "@playwright/test";
import { stubHomeContent } from "./home-fixture";

const routePath = "/games/ba-mooncake";
const title = "泡泡月饼大作战";
const productionCsp = readFileSync("deploy/frontend.nginx.conf", "utf8")
  .match(/add_header Content-Security-Policy "([^"]+)"/)![1];

async function monitor(page: Page) {
  const evidence = { policy: productionCsp, errors: [] as string[], cspConsole: [] as string[], savedCspEvents: [] as unknown[], http: [] as string[], network: [] as string[], cancelled: [] as string[], external: [] as string[], requests: [] as string[] };
  await page.addInitScript(() => {
    (window as any).__cspEvents = [];
    document.addEventListener("securitypolicyviolation", event => (window as any).__cspEvents.push({ directive: event.violatedDirective, blockedURI: event.blockedURI }));
  });
  await page.route("**/*", async route => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": productionCsp } });
  });
  page.on("pageerror", error => evidence.errors.push(error.message));
  page.on("console", message => { if (/content security policy|violat.*(?:script-src|style-src)|refused to (?:execute|load|connect)/i.test(message.text())) evidence.cspConsole.push(message.text()); });
  page.on("request", request => {
    evidence.requests.push(request.url());
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(page.url() === "about:blank" ? request.url() : page.url()).origin) evidence.external.push(request.url());
  });
  page.on("response", response => { if (response.status() >= 400) evidence.http.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", request => {
    const reason = request.failure()?.errorText || "unknown";
    (reason === "net::ERR_ABORTED" ? evidence.cancelled : evidence.network).push(`${reason} ${request.url()}`);
  });
  return evidence;
}

async function assertHealthy(page: Page, evidence: Awaited<ReturnType<typeof monitor>>, info: TestInfo) {
  const cspEvents = await Promise.all(page.frames().map(frame => frame.evaluate(() => (window as any).__cspEvents || [])));
  await info.attach("mooncake-browser-evidence.json", { body: JSON.stringify({ ...evidence, cspEvents }, null, 2), contentType: "application/json" });
  expect(evidence.errors).toEqual([]);
  expect(evidence.cspConsole).toEqual([]);
  expect(evidence.http).toEqual([]);
  expect(evidence.network).toEqual([]);
  expect(evidence.external).toEqual([]);
  expect([...evidence.savedCspEvents, ...cspEvents.flat()]).toEqual([]);
}

async function nativeFrame(page: Page) {
  const iframe = page.getByTitle(title, { exact: true });
  await expect(iframe).toHaveAttribute("src", `${routePath}/index.html?theme=bluearchive`);
  const frame = await (await iframe.elementHandle())!.contentFrame();
  if (!frame) throw new Error("Mooncake iframe has no browsing context");
  await frame.waitForFunction(() => {
    const scene = (window as any).__moonGame?.scene.getScene("MainScene");
    const find = (items: any[]): boolean => items.some(item => item.texture?.key === "start-btn" || find(item.list || []));
    return scene?.scene.isActive() && find(scene.children.list);
  }, undefined, { timeout: 60000 });
  await expect(frame.getByRole("button", { name: "自动游玩：关闭", exact: true })).toBeVisible();
  return frame;
}

async function clickPoint(page: Page, frame: Frame, point: { x: number; y: number }, touch: boolean) {
  const canvas = frame.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const size = await frame.evaluate(() => {
    const game = (window as any).__moonGame;
    return { width: game.scale.gameSize.width, height: game.scale.gameSize.height };
  });
  await frame.waitForFunction(({ point, size }) => {
    const canvas = document.querySelector("canvas")!;
    const box = canvas.getBoundingClientRect();
    return document.elementFromPoint(box.x + point.x / size.width * box.width, box.y + point.y / size.height * box.height) === canvas;
  }, { point, size }, { timeout: 10000 });
  const box = (await canvas.boundingBox())!;
  const x = box.x + point.x / size.width * box.width, y = box.y + point.y / size.height * box.height;
  expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(page.viewportSize()!.width);
  expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThan(page.viewportSize()!.height);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function clickTexture(page: Page, frame: Frame, sceneKey: string, key: string, touch: boolean) {
  const handle = await frame.waitForFunction(({ sceneKey, key }) => {
    const scene = (window as any).__moonGame.scene.getScene(sceneKey);
    if (!scene?.scene.isActive()) return false;
    const find = (items: any[]): any => { for (const item of items) { if (item.texture?.key === key && item.visible && item.input?.enabled) return item; const child = find(item.list || []); if (child) return child; } };
    const target = find(scene.children.list);
    if (!target) return false;
    const box = target.getBounds();
    return { x: box.centerX, y: box.centerY };
  }, { sceneKey, key }, { timeout: 15000 });
  const point = await handle.jsonValue() as { x: number; y: number };
  await handle.dispose();
  await clickPoint(page, frame, point, touch);
}

async function state(frame: Frame) {
  return frame.evaluate(() => {
    const store = (window as any).__moonStore.getState();
    const scene = (window as any).__moonGame.scene.getScene("PlayingScene");
    return { phase: store.gamePhase, popup: store.popup, resultScore: store.score, score: scene?._score, displayScore: scene?._topBar?._scoreText?.text, shots: scene?._shots, cleared: scene?._clearedMooncakes, bullets: scene?._shooter?.bullets.length || 0, projectiles: scene?._shooter?.bullets.map((bullet: any) => ({ x: bullet.image.x, y: bullet.image.y, key: bullet.key })) || [], locked: !!scene?._shootLocked, remaining: scene?._previewOverlay?._remaining, balls: scene?._allBalls().filter((cell: any) => cell.hasball && !cell.isPreview).map((cell: any) => `${cell.row}:${cell.col}:${cell.key}`).sort() };
  });
}

async function shoot(page: Page, frame: Frame, touch: boolean, longFlight = false) {
  const point = await frame.evaluate(longFlight => {
    const scene = (window as any).__moonGame.scene.getScene("PlayingScene");
    return scene._frameContainer.getWorldTransformMatrix().transformPoint(scene._shooter._sx - (longFlight ? 250 : 0), scene._shooter._sy - (longFlight ? 65 : 250));
  }, longFlight);
  await clickPoint(page, frame, point, touch);
}

const popupImage = (frame: Frame, label: string) => frame.locator(`img[src*="${encodeURIComponent(label)}-"], img[src*="${label}-"]`);
const activate = (control: Locator, touch: boolean) => touch ? control.tap() : control.click();

test("月饼仅在BA首页和目录出现，五种宽度入口完整且不预加载游戏引擎", async ({ page }, info) => {
  test.setTimeout(120000);
  const evidence = await monitor(page);
  await stubHomeContent(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["bangdream", "sekai", "bluearchive"]) {
    for (const pathname of ["/", "/games"]) {
      await page.goto(`${pathname}?theme=${theme}`);
      await expect(page.locator(`main a[href="${routePath}?theme=bluearchive"]`)).toHaveCount(theme === "bluearchive" ? 1 : 0);
    }
  }
  const layouts = [];
  for (const width of info.project.name === "desktop" ? [320, 390, 768, 1024, 1440] : [393]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const pathname of ["/", "/games"]) {
      await page.goto(`${pathname}?theme=bluearchive`);
      const link = page.locator(`main a[href="${routePath}?theme=bluearchive"]`);
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      const image = page.locator('main img[src="/games/ba-mooncake/preview.webp"]');
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const box = (await link.boundingBox())!;
      expect(box.height, `${pathname} ${width}px 月饼入口高度`).toBeGreaterThanOrEqual(44);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: info.outputPath(`mooncake-${pathname === "/" ? "home" : "directory"}-${width}.png`), fullPage: true });
      layouts.push({ pathname, width, link: box });
    }
  }
  expect(evidence.requests.filter(url => /\/(?:phaser\.min|spine-phaser-v3)\.js(?:\?|$)/.test(url))).toEqual([]);
  await info.attach("mooncake-entry-layouts.json", { body: JSON.stringify(layouts, null, 2), contentType: "application/json" });
  await assertHealthy(page, evidence, info);
});

test("月饼真实手动发射、自动启停、暂停、计分结算和重开在生产CSP下可用", async ({ page }, info) => {
  test.setTimeout(240000);
  const evidence = await monitor(page);
  const touch = !!info.project.use.hasTouch;
  await page.goto(routePath);
  await expect(page).toHaveURL(`${routePath}?theme=bluearchive`);
  const frame = await nativeFrame(page);
  const full = page.getByRole("button", { name: /全屏游玩/ });
  const fullBox = (await full.boundingBox())!;
  expect(fullBox.height).toBeGreaterThanOrEqual(44);
  await activate(full, touch);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe("IFRAME");
  if (touch) {
    await expect(frame.locator("#horizontal-wrapper")).toBeVisible();
    await page.screenshot({ path: info.outputPath("mooncake-fullscreen-portrait.png") });
    await page.setViewportSize({ width: 844, height: 390 });
  }
  await expect(frame.locator("#horizontal-wrapper")).toBeHidden();
  await page.screenshot({ path: info.outputPath("mooncake-main-landscape.png") });
  await clickTexture(page, frame, "MainScene", "start-btn", touch);
  await expect.poll(async () => (await state(frame)).phase, { timeout: 20000 }).toBe("playing");
  const initial = await state(frame);
  expect(initial.score).toBe(0); expect(initial.shots).toBe(0);
  await shoot(page, frame, touch);
  await expect.poll(async () => (await state(frame)).shots).toBe(1);
  await expect.poll(async () => (await state(frame)).balls).not.toEqual(initial.balls);
  await activate(frame.getByRole("button", { name: "自动游玩：关闭", exact: true }), touch);
  await expect(frame.getByRole("button", { name: "自动游玩：开启", exact: true })).toBeVisible();
  await expect.poll(async () => (await state(frame)).score, { timeout: 25000 }).toBeGreaterThan(0);
  await expect.poll(async () => (await state(frame)).shots).toBeGreaterThan(1);
  await activate(frame.getByRole("button", { name: "自动游玩：开启", exact: true }), touch);
  await expect.poll(async () => { const current = await state(frame); return current.bullets === 0 && !current.locked; }).toBe(true);
  await shoot(page, frame, touch, true);
  await expect.poll(async () => (await state(frame)).bullets, { intervals: [10] }).toBeGreaterThan(0);
  await clickTexture(page, frame, "PlayingScene", "hud-pause", touch);
  await expect.poll(async () => (await state(frame)).phase).toBe("paused");
  const paused = await state(frame);
  expect(paused.bullets, "暂停时确实存在飞行中的月饼").toBeGreaterThan(0);
  await activate(frame.getByRole("button", { name: "自动游玩：关闭", exact: true }), touch);
  await page.waitForTimeout(1300);
  const stillPaused = await state(frame);
  expect({ shots: stillPaused.shots, remaining: stillPaused.remaining, balls: stillPaused.balls, projectiles: stillPaused.projectiles }).toEqual({ shots: paused.shots, remaining: paused.remaining, balls: paused.balls, projectiles: paused.projectiles });
  await activate(popupImage(frame, "返回游戏"), touch);
  await expect.poll(async () => (await state(frame)).shots).toBeGreaterThan(paused.shots);
  await activate(frame.getByRole("button", { name: "自动游玩：开启", exact: true }), touch);
  await expect.poll(async () => { const current = await state(frame); return current.bullets === 0 && !current.locked; }).toBe(true);
  const stopped = await state(frame);
  expect(stopped.displayScore).toBe(String(stopped.score));
  await page.waitForTimeout(1300);
  expect((await state(frame)).shots).toBe(stopped.shots);
  await page.screenshot({ path: info.outputPath("mooncake-real-scoring.png") });
  for (let shot = 0; shot < 70; shot++) {
    const current = await state(frame);
    if (current.popup === "over") break;
    await expect.poll(async () => { const next = await state(frame); return next.popup === "over" || next.bullets === 0 && !next.locked; }, { timeout: 12000 }).toBe(true);
    if ((await state(frame)).popup === "over") break;
    await shoot(page, frame, touch);
    await expect.poll(async () => { const next = await state(frame); return next.shots > current.shots || next.popup === "over"; }, { timeout: 12000 }).toBe(true);
  }
  await expect.poll(async () => (await state(frame)).popup, { timeout: 15000 }).toBe("over");
  const ended = await state(frame);
  expect(ended.resultScore).toBe(Math.floor(ended.score));
  expect(ended.resultScore).toBeGreaterThan(0);
  await expect(frame.getByText(String(ended.resultScore), { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("mooncake-real-result.png") });
  await activate(popupImage(frame, "再试一次"), touch);
  await expect.poll(async () => (await state(frame)).phase, { timeout: 20000 }).toBe("playing");
  expect((await state(frame)).score).toBe(0);
  expect((await state(frame)).shots).toBe(0);
  await clickTexture(page, frame, "PlayingScene", "hud-pause", touch);
  await activate(popupImage(frame, "重新开始"), touch);
  await expect.poll(async () => (await state(frame)).phase, { timeout: 20000 }).toBe("playing");
  expect((await state(frame)).score).toBe(0);
  expect((await state(frame)).shots).toBe(0);
  await clickTexture(page, frame, "PlayingScene", "hud-pause", touch);
  await activate(popupImage(frame, "返回主页"), touch);
  await frame.waitForFunction(() => (window as any).__moonGame.scene.isActive("MainScene"));
  evidence.savedCspEvents.push(...await frame.evaluate(() => (window as any).__cspEvents));
  await clickTexture(page, frame, "MainScene", "hud-close", touch);
  await expect(page).toHaveURL(/\/games\?theme=bluearchive$/);
  await expect(page.getByTitle(title, { exact: true })).toHaveCount(0);
  await info.attach("mooncake-real-gameplay.json", { body: JSON.stringify({ input: touch ? "touch" : "mouse", initial, paused, stopped, ended }, null, 2), contentType: "application/json" });
  await assertHealthy(page, evidence, info);
});
