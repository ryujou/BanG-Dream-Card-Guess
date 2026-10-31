import { test, expect, type Page } from "@playwright/test";
import { HOME_CONTENT, HOME_THEME_CASES as themes, sharedHomeCopy, stubHomeContent } from "./home-fixture";
const art = '[class*="heroArt"]';
const switcher = (page: Page) => page.getByRole("group", { name: "首页主题" });

test.beforeEach(async ({ page }) => {
  await stubHomeContent(page);
  // Keep theme/layout snapshots deterministic; hero-rotation.spec.ts exercises real storage and rotation.
  await page.addInitScript(() => {
    Math.random = () => 0;
    const read = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) { return key.startsWith("xtbang:hero:") ? null : read.call(this, key); };
  });
});

test("E01 E02 E04 E07：品牌、角色、配色、历史和正文", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByText("同好音乐聚会", { exact: true })).toBeVisible();
  const original = await sharedHomeCopy(page);
  await expect(switcher(page).getByRole("button")).toHaveCount(3);
  for (const theme of [themes[1], themes[2], themes[0]]) {
    await switcher(page).getByRole("button", { name: theme.label, exact: true }).click();
    await expect(page.locator("main")).toHaveAttribute("data-home-theme", theme.id);
    await expect(page.locator(`${art} img`)).toHaveAttribute("src", theme.hero);
    await expect(page.locator("header .brand em")).toHaveText(theme.brand);
    await expect(page.locator("main .brand em")).toHaveText(theme.brand);
    await expect(page).toHaveTitle(`湘潭 ${theme.brand} 同好会`);
    await expect(switcher(page).getByRole("button", { name: theme.label, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(switcher(page).locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByRole("link", { name: theme.id === "bluearchive" ? "开始猜图" : "开始猜卡", exact: true })).toHaveCSS("background-color", theme.color);
    expect(await sharedHomeCopy(page)).toBe(original);
    const history = await page.evaluate(() => window.history.length);
    await switcher(page).getByRole("button", { name: theme.label, exact: true }).click();
    expect(await page.evaluate(() => window.history.length)).toBe(history);
  }
  await page.goBack();
  await expect(page.locator("main")).toHaveAttribute("data-home-theme", "bluearchive");
  await page.reload();
  await expect(page.locator(`${art} img`)).toHaveAttribute("src", themes[2].hero);
  await page.goForward();
  await expect(page.locator("main")).toHaveAttribute("data-home-theme", "bangdream");
});

test("E03 E05：输入、滚动、参数、hash、别名和弹窗状态", async ({ page }) => {
  await page.goto("/home?theme=sekai&from=%E9%9F%B3%E4%B9%90#games");
  await expect(page).toHaveURL(/\/\?theme=sekai&from=%E9%9F%B3%E4%B9%90#games$/);
  const input = page.getByRole("textbox", { name: "房间码" });
  await input.fill("ABC234");
  const y = await page.evaluate(() => scrollY);
  await page.locator('[data-theme="bangdream"]').evaluate((element: HTMLButtonElement) => element.click());
  await expect(input).toHaveValue("ABC234");
  expect(Math.abs(await page.evaluate(() => scrollY) - y)).toBeLessThanOrEqual(1);
  expect(new URL(page.url()).searchParams.get("from")).toBe("音乐");
  expect(new URL(page.url()).searchParams.has("theme")).toBe(false);
  expect(new URL(page.url()).hash).toBe("#games");
  await page.getByRole("button", { name: "播放社团视频" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator('[data-theme="sekai"]').evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(input).toHaveValue("ABC234");
  await page.getByRole("button", { name: "关闭视频" }).click();
  await page.goto("/?theme=invalid");
  await expect(page.locator("main")).toHaveAttribute("data-home-theme", "bangdream");
});

test("E06 E15 E18：实际交互色、可见焦点和触控面积", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of themes) {
    await page.goto(theme.url);
    const primary = page.getByRole("link", { name: theme.id === "bluearchive" ? "开始猜图" : "开始猜卡", exact: true });
    await expect(primary).toHaveCSS("background-color", theme.color);
    await expect(primary).toHaveCSS("color", "rgb(255, 255, 255)");
    if (info.project.name === "desktop") {
      await primary.hover();
      await expect(primary).toHaveCSS("background-color", theme.hover);
      await page.mouse.down();
      await expect(primary).toHaveCSS("background-color", theme.pressed);
      await page.mouse.move(2, 2);
      await page.mouse.up();
    }
    const chosen = switcher(page).getByRole("button", { name: theme.label, exact: true });
    await chosen.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(chosen).toBeFocused();
    await expect(chosen).toHaveCSS("outline-color", theme.color);
    await expect(chosen.locator("svg")).toHaveCSS("visibility", "visible");
    const ratios = await page.evaluate(() => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const ratio = (a: string, b: string) => { const l1 = luminance(a), l2 = luminance(b); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); };
      const selectors = ['main .button.pink', 'main .button.outline', '.home-theme-switch button[aria-pressed="true"]', '.home-theme-switch button[aria-pressed="false"]'];
      return selectors.map(selector => { const css = getComputedStyle(document.querySelector(selector)!); return ratio(css.color, css.backgroundColor); });
    });
    expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
    for (const button of await switcher(page).getByRole("button").all()) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      const offset = await button.evaluate(element => {
        const text = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE)!;
        const range = document.createRange();
        range.selectNodeContents(text);
        const label = range.getBoundingClientRect(), control = element.getBoundingClientRect();
        return Math.abs(label.x + label.width / 2 - control.x - control.width / 2);
      });
      expect(offset).toBeLessThanOrEqual(1);
    }
    const other = switcher(page).getByRole("button", { name: themes[(themes.indexOf(theme) + 1) % themes.length].label, exact: true });
    await other.focus();
    await page.keyboard.press("Space");
    await expect(other).toHaveAttribute("aria-pressed", "true");
  }
});

test("E09：懒加载占位使用当前角色，加载结束画框不变", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/assets/HeroScene-*.js", async route => { await gate; await route.continue(); });
  try {
    await page.goto("/?theme=bluearchive", { waitUntil: "domcontentloaded" });
    const fallback = page.locator(`${art} [data-hero-character] > img`);
    await expect(fallback).toHaveAttribute("src", themes[2].hero);
    const before = await page.locator(art).boundingBox();
    await switcher(page).getByRole("button", { name: "BanG Dream!", exact: true }).click();
    await expect(fallback).toHaveAttribute("src", themes[0].hero);
    release();
    await expect(page.locator(".hero-scene img")).toHaveAttribute("src", themes[0].hero);
    expect(await page.locator(art).boundingBox()).toEqual(before);
  } finally { release(); }
});

test("E08 E10 E11：运行中换主题、静态偏好与动画生命周期", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { particleColors: Set<string> };
    state.particleColors = new Set();
    const fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function (...args: Parameters<typeof fill>) {
      if (this.canvas.parentElement?.tagName === "SECTION" && this.canvas.classList.contains("stage-particles")) state.particleColors.add(String(this.fillStyle).toLowerCase());
      return fill.apply(this, args);
    };
  });
  await page.goto("/");
  for (const theme of [themes[1], themes[2], themes[0], themes[2]]) {
    await switcher(page).getByRole("button", { name: theme.label, exact: true }).click();
    await expect(page.locator(".hero-scene img")).toHaveAttribute("src", theme.hero);
    await expect(page.locator(".hero-scene")).toHaveCount(1);
    await expect(page.locator("canvas.stage-particles")).toHaveCount(2);
    await expect(page.locator("body")).toHaveAttribute("data-character-cursor", theme.id);
    await page.evaluate(() => (window as unknown as { particleColors: Set<string> }).particleColors.clear());
    await page.waitForTimeout(100);
    const colors = await page.evaluate(() => [...(window as unknown as { particleColors: Set<string> }).particleColors]);
    expect(colors).toContain(theme.accent);
    for (const other of themes.filter(other => other.id !== theme.id)) expect(colors).not.toContain(other.accent);
  }
  const hero = page.locator(".hero-scene img");
  const transform = await hero.evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(250);
  expect(await hero.evaluate(element => getComputedStyle(element).transform)).not.toBe(transform);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".hero-scene")).toHaveCount(0);
  await expect(page.locator("canvas.stage-particles")).toHaveCount(0);
  await expect(page.locator(`${art} img`)).toHaveAttribute("src", themes[2].hero);
  await switcher(page).getByRole("button", { name: "BanG Dream!", exact: true }).click();
  await expect(page.locator(`${art} img`)).toHaveAttribute("src", themes[0].hero);
  await expect(page.locator("canvas.stage-particles")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".hero-scene img")).toHaveAttribute("src", themes[0].hero);
  await expect(page.locator("canvas.stage-particles")).toHaveCount(2);
});

test("E14：游戏保留蓝色主题，鼠标仅在首页，返回恢复蓝色", async ({ page }) => {
  await page.goto("/?theme=sekai");
  await page.getByRole("link", { name: "开始猜卡", exact: true }).click();
  await expect(page).toHaveURL(url=>url.pathname==="/games" && url.searchParams.get("theme")==="sekai");
  await expect(page.locator("[data-home-theme]")).toHaveCount(0);
  await expect(page.locator("header .brand em")).toHaveCSS("color", "rgb(0, 65, 144)");
  await expect(page.locator("[data-character-layer]")).toHaveCount(0);
  await page.goBack();
  await expect(page.locator("main")).toHaveAttribute("data-home-theme", "sekai");
  await expect(page.locator("body")).toHaveAttribute("data-character-cursor", "sekai");
});

test("E13：登录页头的断点布局（模拟身份，仅验证布局）", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "明确宽度矩阵只检查一次");
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user: { id: 1, username: "layout", displayName: "主持入口布局验证", role: "admin" }, csrfToken: "layout-only" } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 990, 980, 960, 951, 820, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?theme=sekai");
    if (width <= 800) await page.getByRole("button", { name: "打开菜单" }).click();
    await expect(page.getByRole("button", { name: "退出登录" })).toBeVisible();
    if (width <= 800) await page.getByRole("button", { name: "关闭菜单" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const header = await page.locator("header").boundingBox();
    const control = await switcher(page).boundingBox();
    expect(control!.y + control!.height).toBeLessThanOrEqual(header!.y + header!.height + 1);
  }
});

test("E16：真实 API 与三套本地资源可用", async ({ page, request }) => {
  await page.unroute("**/api/community");
  const response = await request.get("/api/community");
  expect(response.ok()).toBe(true);
  const community = await response.json();
  const failures: string[] = [], errors: string[] = [];
  page.on("response", response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(page.url()).origin) failures.push(response.url()); });
  page.on("pageerror", error => errors.push(error.message));
  for (const theme of themes) {
    const data = page.waitForResponse("**/api/community");
    await page.goto(theme.url);
    expect(await (await data).json()).toEqual(community);
    await expect(page.locator(`${art} img`)).toHaveAttribute("src", theme.hero);
    await expect.poll(() => page.locator(`${art} img`).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    for (const path of [theme.cursor, theme.pointer, theme.hoverPointer, theme.mascot]) {
      expect((await request.get(path)).ok()).toBe(true);
    }
  }
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});

test("E17：等待、空态和失败的三版语义一致", async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/community", async route => { await waiting; await route.fulfill({ json: HOME_CONTENT }); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "播放社团视频" })).toBeDisabled();
  await switcher(page).getByRole("button", { name: "世界计划", exact: true }).click();
  await expect(page.getByRole("button", { name: "播放社团视频" })).toBeDisabled();
  release();
  await expect(page.getByRole("button", { name: "播放社团视频" })).toBeEnabled();
  await page.route("**/api/community", route => route.fulfill({ json: { ...HOME_CONTENT, members: [], events: [], photos: [], bilibili: [] } }));
  for (const theme of themes) {
    await page.goto(theme.url);
    await expect(page.getByRole("button", { name: "播放社团视频" })).toBeDisabled();
    await expect(page.getByText("正在筹备。", { exact: true })).toBeVisible();
  }
  await page.route("**/api/community", route => route.fulfill({ status: 503, json: { error: "测试服务暂不可用" } }));
  for (const theme of themes) {
    await page.goto(theme.url);
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("社团内容暂时无法加载");
    await expect(alert).toHaveCSS("color", "rgb(180, 35, 24)");
    await expect(alert).toHaveCSS("background-color", "rgb(254, 243, 242)");
  }
});

for (const width of [1440, 990, 390, 360, 320]) {
  test(`V：三版公共布局与截图 ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "指定宽度的静态矩阵只执行一次");
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let baseline: { gamesHeight: number; cards: number[][]; boxes: { box: number[]; gameBand: boolean; afterGames: boolean }[] } | undefined;
    for (const theme of themes) {
      await page.goto(theme.url);
      await page.evaluate(() => document.fonts.ready);
      for (let y = 0; y < await page.locator("body").evaluate(element => element.scrollHeight); y += 600) {
        await page.evaluate(y => scrollTo(0, y), y);
        await page.waitForTimeout(30);
      }
      await expect.poll(() => page.locator("main img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
      await page.evaluate(() => scrollTo(0, 0));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const orphans = await page.locator("main h3, main p, main small").evaluateAll(elements => elements.flatMap(element => {
        if (element.children.length || !element.checkVisibility()) return [];
        for (let parent: Element | null = element; parent; parent = parent.parentElement) {
          const transform = getComputedStyle(parent).transform;
          if (transform !== "none") {
            const matrix = new DOMMatrixReadOnly(transform);
            if (matrix.b || matrix.c) return [];
          }
        }
        const lines = new Map<string, string>();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          for (let i = 0; i < (node.textContent?.length || 0); i++) {
            const range = document.createRange();
            range.setStart(node, i); range.setEnd(node, i + 1);
            const top = range.getBoundingClientRect().top.toFixed(1);
            lines.set(top, (lines.get(top) || "") + node.textContent![i]);
          }
        }
        const last = [...lines.values()].at(-1)?.trim() || "";
        return lines.size > 1 && /^[\p{Script=Han}][\p{Punctuation}\s]*$/u.test(last)
          ? [{ text: element.textContent, lastLine: last }] : [];
      }));
      expect(orphans, "卡片标题、短文和页脚不能留下单个汉字末行").toEqual([]);
      const geometry = await page.locator(`header > .brand, header > nav, main > section, main > div, ${art}, .home-theme-switch, [class*="communityTiles"] > *`).evaluateAll(elements => {
        const games = document.querySelector("#games")!.parentElement!;
        const gamesBox = games.getBoundingClientRect();
        const cards = [...document.querySelectorAll('[class*="homeGames"] > div')].map(element => {
          const box = element.getBoundingClientRect();
          return [box.x, box.y, box.width, box.height].map(Math.round);
        });
        return { gamesHeight: gamesBox.height, cards, boxes: elements.map(element => {
          const box = element.getBoundingClientRect();
          return { box: [box.x, box.y, box.width, box.height], gameBand: element === games, afterGames: box.y >= gamesBox.bottom - 1 };
        }) };
      });
      if (baseline) {
        const delta = theme.id === "bluearchive" ? geometry.gamesHeight - baseline.gamesHeight : 0;
        const normalized = geometry.boxes.map(({ box, gameBand, afterGames }) => [box[0], box[1] - (afterGames ? delta : 0), box[2], box[3] - (gameBand ? delta : 0)].map(Math.round));
        expect(normalized).toEqual(baseline.boxes.map(({ box }) => box.map(Math.round)));
        if (theme.id !== "bluearchive") expect(geometry.cards).toEqual(baseline.cards);
      }
      else baseline = geometry;
      await page.screenshot({ path: `artifacts/screenshots/home-${theme.id}-${width}.png`, fullPage: true });
      await expect(page).toHaveScreenshot(`home-${theme.id}-${width}.png`, { fullPage: true });
    }
  });
}
