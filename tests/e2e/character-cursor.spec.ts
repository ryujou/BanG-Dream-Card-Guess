import { test, expect, type Page } from "@playwright/test";
import { sharedHomeCopy } from "./home-fixture";

const layer = "[data-character-layer]";
const bursts = "[data-character-bursts] img";
let errors: string[];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /让热爱，\s*在湘潭相遇。/ })).toBeVisible();
  await expect(page.locator(layer)).toHaveCount(1);
});

test.afterEach(() => expect(errors).toEqual([]));

async function openChoices(page: Page) {
  const menu = page.getByRole("button", { name: "打开菜单" });
  if (await menu.isVisible()) await menu.click();
}

test("三主题双角色素材、选择状态和首页正文保持一致", async ({ page }, info) => {
  const before = await sharedHomeCopy(page);
  await openChoices(page);
  const bang = page.getByRole("button", { name: "BanG Dream!", exact: true });
  const sekai = page.getByRole("button", { name: "世界计划", exact: true });
  await expect(bang).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-character-follow="main"] img')).toHaveAttribute("src", /kasumi.webp$/);
  await expect(page.locator('[data-character-follow="mascot"] img')).toHaveAttribute("src", /michelle.webp$/);
  await sekai.click();
  await expect(sekai).toHaveAttribute("aria-pressed", "true");
  await expect(bang).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).toHaveAttribute("data-character-cursor", "sekai");
  await expect(page.locator('[data-character-follow="main"] img')).toHaveAttribute("src", /miku.webp$/);
  await expect(page.locator('[data-character-follow="mascot"] img')).toHaveAttribute("src", /tofu.webp$/);
  await expect.poll(() => page.locator(`${layer} img`).evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await sharedHomeCopy(page)).toBe(before);
  if (info.project.name === "desktop") {
    await page.mouse.move(550, 300);
    await page.waitForTimeout(450);
    await page.screenshot({ path: info.outputPath("sekai-follow.png") });
  }
  const bluearchive = page.getByRole("button", { name: "蔚蓝档案", exact: true });
  await bluearchive.click();
  await expect(bluearchive).toHaveAttribute("aria-pressed", "true");
  await expect(sekai).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).toHaveAttribute("data-character-cursor", "bluearchive");
  await expect(page.locator('[data-character-follow="main"] img')).toHaveAttribute("src", "/brand/bluearchive/minichara.png");
  await expect(page.locator('[data-character-follow="mascot"] img')).toHaveAttribute("src", "/brand/bluearchive/fish.png");
  await expect.poll(() => page.locator(`${layer} img`).evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await sharedHomeCopy(page)).toBe(before);
  await bang.focus();
  await page.keyboard.press("Enter");
  await expect(bang).toHaveAttribute("aria-pressed", "true");
});

test("桌面原生光标、不同延迟跟随和离开窗口停止", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "桌面精细指针行为");
  await expect(page.locator(layer)).toHaveAttribute("data-mode", "follow");
  await expect(page.locator("body")).toHaveCSS("cursor", /kasumi-pointer.png.*4 5/);
  const button = page.getByRole("button", { name: "世界计划", exact: true });
  await expect(button).toHaveCSS("cursor", /kasumi-pointer-hover.png/);
  await expect(page.getByRole("textbox", { name: "房间码" })).toHaveCSS("cursor", "text");
  await expect(page.locator(layer)).toHaveCSS("pointer-events", "none");
  await page.mouse.move(100, 100);
  await page.waitForTimeout(150);
  await page.mouse.move(700, 350);
  await page.waitForTimeout(100);
  const positions = await page.locator("[data-character-follow]").evaluateAll(elements => elements.map(element => new DOMMatrix(getComputedStyle(element).transform).m41));
  expect(positions[0]).toBeGreaterThan(positions[1]);
  expect(positions[1]).toBeGreaterThan(100);
  expect(positions[0]).toBeLessThan(700);
  await expect.poll(() => page.locator('[data-character-follow="mascot"]').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).m41)).toBeGreaterThan(699);
  await page.screenshot({ path: info.outputPath("bangdream-follow.png") });
  await page.locator("html").dispatchEvent("pointerleave");
  await expect(page.locator(layer)).not.toHaveAttribute("data-active", "true");
  const stopped = await page.locator('[data-character-follow="main"]').getAttribute("style");
  await page.waitForTimeout(100);
  expect(await page.locator('[data-character-follow="main"]').getAttribute("style")).toBe(stopped);
  await page.mouse.move(200, 200);
  await expect(page.locator(layer)).toHaveAttribute("data-active", "true");
  await button.click();
  await expect(page.locator("body")).toHaveCSS("cursor", /miku-pointer.png.*5 5/);
  await expect(button).toHaveCSS("cursor", /miku-pointer-hover.png/);
  await page.getByRole("button", { name: "蔚蓝档案", exact: true }).click();
  await expect(page.locator("body")).toHaveCSS("cursor", /mouse-icon.webp.*8 7/);
  await expect(button).toHaveCSS("cursor", /mouse-icon_hover.png.*8 7/);
});

test("小屏点击成对散开、上限八个、动画结束清理", async ({ page }, info) => {
  if (info.project.name === "desktop") await page.setViewportSize({ width: 600, height: 900 });
  await expect(page.locator(layer)).toHaveAttribute("data-mode", "burst");
  if (info.project.name === "mobile") await page.touchscreen.tap(20, 350);
  else await page.mouse.click(20, 350);
  await expect(page.locator(bursts)).toHaveCount(2);
  await expect(page.locator(bursts).nth(0)).toHaveAttribute("src", /kasumi.webp$/);
  await expect(page.locator(bursts).nth(1)).toHaveAttribute("src", /michelle.webp$/);
  const offsets = await page.locator(bursts).evaluateAll(elements => elements.map(element => [parseFloat((element as HTMLElement).style.getPropertyValue("--dx")), parseFloat((element as HTMLElement).style.getPropertyValue("--dy"))]));
  expect(offsets[0][0] + offsets[1][0]).toBeCloseTo(0);
  expect(offsets[0][1] + offsets[1][1]).toBeCloseTo(0);
  await page.screenshot({ path: info.outputPath("click-burst.png") });
  await expect(page.locator(bursts)).toHaveCount(0);
  await page.evaluate(() => {
    for (let i = 0; i < 12; i++) window.dispatchEvent(new MouseEvent("click", { clientX: 80, clientY: 100, detail: 1 }));
  });
  await expect(page.locator(bursts)).toHaveCount(8);
  await expect(page.locator(bursts)).toHaveCount(0);
  await openChoices(page);
  await page.getByRole("button", { name: "世界计划", exact: true }).click();
  await page.locator("html").dispatchEvent("pointerleave");
  await page.evaluate(() => window.dispatchEvent(new MouseEvent("click", { clientX: 80, clientY: 100, detail: 0 })));
  await expect(page.locator(bursts)).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent("click", { clientX: 80, clientY: 100, detail: 1 })));
  await expect(page.locator(bursts).nth(0)).toHaveAttribute("src", /miku.webp$/);
  await expect(page.locator(bursts).nth(1)).toHaveAttribute("src", /tofu.webp$/);
  await page.getByRole("button", { name: "蔚蓝档案", exact: true }).click();
  const closeMenu = page.getByRole("button", { name: "关闭菜单" });
  if (await closeMenu.isVisible()) await closeMenu.click();
  await expect(page.locator(bursts)).toHaveCount(0);
  const hero = page.locator("main > section").first();
  if (info.project.name === "mobile") await hero.tap({ position: { x: 12, y: 80 } });
  else await hero.click({ position: { x: 12, y: 80 } });
  await expect(page.locator(bursts).nth(0)).toHaveAttribute("src", "/brand/bluearchive/minichara.png");
  await expect(page.locator(bursts).nth(1)).toHaveAttribute("src", "/brand/bluearchive/fish.png");
});

test("减少动态效果实时生效，关闭后恢复", async ({ page }, info) => {
  await page.getByRole("button", { name: "蔚蓝档案", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(layer)).toHaveAttribute("data-mode", "off");
  await expect(page.locator(layer)).toBeHidden();
  await page.mouse.move(500, 350);
  await page.mouse.click(20, 350);
  await expect(page.locator(bursts)).toHaveCount(0);
  await page.reload();
  await expect(page.locator(layer)).toHaveAttribute("data-mode", "off");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(layer)).toHaveAttribute("data-mode", info.project.name === "desktop" ? "follow" : "burst");
});

test("路由切换清理装饰层，返回首页只挂载一次", async ({ page }) => {
  for (let i = 0; i < 2; i++) {
    await openChoices(page);
    await page.locator("header").getByRole("link", { name: "游戏", exact: true }).click();
    await expect(page).toHaveURL(/\/games$/);
    await expect(page.locator(layer)).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveAttribute("data-character-cursor");
    await page.goBack();
    await expect(page.locator(layer)).toHaveCount(1);
  }
});

test("首页导航在桌面和窄屏保持可用", async ({ page }, info) => {
  const widths = info.project.name === "desktop" ? [1440, 990, 820] : [393, 360, 320];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await openChoices(page);
    const choices = page.getByRole("group", { name: "首页主题" });
    await expect(choices).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: "访问地图", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(choices.getByRole("button")).toHaveCount(3);
    const boxes = await choices.getByRole("button").evaluateAll(buttons => buttons.map(button => { const r = button.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height }; }));
    for (const box of boxes) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width); }
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].right);
  }
});
