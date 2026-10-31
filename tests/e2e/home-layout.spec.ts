import { test, expect } from "@playwright/test";
import { HOME_THEME_CASES, stubHomeContent } from "./home-fixture";

for (const { id: theme, url: homeUrl, groupUrl } of HOME_THEME_CASES) for (const width of [1440, 990, 390, 360, 320]) {
  const query = theme === "bangdream" ? "" : `?theme=${theme}`;
  test(`首页参考图布局与入口 ${theme} ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "此项使用明确的验收宽度");
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await stubHomeContent(page);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(homeUrl);
    await expect(page.getByRole("heading", { name: /让热爱，\s*在湘潭相遇。/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".hero-scene img")).toBeVisible();
    for (let y = 0; y < await page.locator("body").evaluate(e => e.scrollHeight); y += 500) {
      await page.evaluate(y => scrollTo(0, y), y);
      await page.waitForTimeout(180);
    }
    await expect.poll(() => page.locator("img").evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const cards = page.locator('[class*="homeGames"] > div');
    await expect(cards).toHaveCount(theme === "bluearchive" ? 5 : 4);
    const positions = await cards.evaluateAll(es => es.map(e => ({ top: e.getBoundingClientRect().top, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })));
    const regularCards = theme === "bluearchive" && width <= 1100 ? positions.slice(0, 4) : positions;
    expect(Math.max(...regularCards.map(p => p.width)) - Math.min(...regularCards.map(p => p.width))).toBeLessThan(1);
    expect(new Set(positions.map(p => Math.round(p.top))).size).toBe(theme === "bluearchive" ? width > 1100 ? 1 : 3 : width > 850 ? 1 : 2);
    for (const top of new Set(positions.map(p => Math.round(p.top)))) {
      const row = positions.filter(p => Math.round(p.top) === top);
      expect(Math.max(...row.map(p => p.height)) - Math.min(...row.map(p => p.height))).toBeLessThan(1);
    }
    if (theme === "bluearchive" && width <= 1100) {
      const gridWidth = await page.locator('[class*="homeGames"]').evaluate(element => element.getBoundingClientRect().width);
      expect(positions[4].width).toBeCloseTo(gridWidth, 0);
      expect(positions[4].top).toBeGreaterThan(positions[3].top);
    }
    await page.screenshot({ path: `artifacts/screenshots/home-final-${theme}-${width}.png`, fullPage: true });
    await page.screenshot({ path: `artifacts/screenshots/home-first-screen-${theme}-${width}.png` });
    await page.locator("#games").screenshot({ path: `artifacts/screenshots/home-games-${theme}-${width}.png` });
    const video = page.locator('[class*="videoPreview"]');
    await video.screenshot({ path: `artifacts/screenshots/home-video-${theme}-${width}.png` });
    const play = await video.locator('button > svg').boundingBox();
    const title = await video.locator('p').boundingBox();
    expect(play!.y + play!.height + 8).toBeLessThan(title!.y);
    if (width <= 390) {
      for (const selector of ['[class*="homeGame"] p', '[class*="communityTitle"] p', '[class*="emptyTile"] p']) {
        expect(await page.locator(selector).evaluateAll(es => es.every(e => parseFloat(getComputedStyle(e).fontSize) >= 13))).toBe(true);
      }
      const field = page.getByRole("textbox", { name: "房间码" });
      expect(await field.evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
      for (const control of [field, page.getByRole("button", { name: "加入房间" }), page.getByRole("link", { name: /单人挑战/ }), page.getByRole("link", { name: "开始音符射手" })]) {
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
    }
    const join = page.getByRole("link", { name: "加入同好会", exact: true }).first();
    await expect(join).toHaveAttribute("href", groupUrl);
    await page.context().route("https://qm.qq.com/**", route => route.fulfill({ contentType: "text/html", body: "QQ link test" }));
    const popupPromise = page.waitForEvent("popup");
    await join.click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    expect(popup.url()).toBe(groupUrl);
    await popup.close();
    await expect(page.getByRole("link", { name: /单人挑战/ })).toHaveAttribute("href", "/solo"+query);
    for (const [label, path] of [[theme === "bluearchive" ? "开始猜图" : "开始猜卡", "/games"], ["开始音符射手", "/note-shooter"], ["开始秒表挑战", "/games/stopwatch-challenge"], ["开始华容道", "/games/bang-klotski"]]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url=>url.pathname===path && url.search===query);
      await page.goto(homeUrl);
    }
    if (theme === "bluearchive") await expect(page.getByRole("link", { name: "开始泡泡月饼大作战", exact: true })).toHaveAttribute("href", "/games/ba-mooncake?theme=bluearchive");
    for (const [label, path] of [["游戏", "/games"], ["活动", "/community"], ["周边", "/shop"], ["访问地图", "/stats"], ["主持登录", "/login"]]) {
      if (width < 800) {
        await page.getByRole("button", { name: "打开菜单" }).click();
        await expect(page.getByRole("button", { name: "关闭菜单" })).toHaveAttribute("aria-expanded", "true");
      }
      await page.locator("header").getByRole("link", { name: label, exact: true }).filter({ visible: true }).click();
      await expect(page).toHaveURL(url=>url.pathname===path && (path==="/login" ? url.searchParams.get("next")==="/host"+query && url.searchParams.get("theme")===(theme==="bangdream"?null:theme) : url.search===query));
      await page.goto(homeUrl);
    }
    const input = page.getByRole("textbox", { name: "房间码" });
    await input.fill("ABC");
    await page.getByRole("button", { name: "加入房间" }).click();
    await expect(page).toHaveURL(new URL(homeUrl, page.url()).toString());
    expect(await input.evaluate((i: HTMLInputElement) => i.validity.valid)).toBe(false);
    await input.fill("abcdef");
    await page.getByRole("button", { name: "加入房间" }).click();
    await expect(page).toHaveURL(url=>url.pathname==="/player" && url.searchParams.get("room")==="ABCDEF" && url.searchParams.get("theme")===(theme==="bangdream"?null:theme));
    await page.goto(homeUrl);
    await page.getByRole("button", { name: "播放社团视频" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("dialog iframe")).toHaveAttribute("src", /player.bilibili.com/);
    await page.getByRole("button", { name: "关闭视频" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

