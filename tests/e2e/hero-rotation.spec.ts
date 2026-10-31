import { test, expect } from "@playwright/test";
import characters from "../../src/client/data/hero-characters.json" with { type: "json" };
import { stubHomeContent } from "./home-fixture";

test.beforeEach(async ({ page }) => {
  await stubHomeContent(page);
  await page.route("**/umami/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
});
for (const [theme, pool] of Object.entries(characters)) {
  test(`${theme}: 仅显示立绘，自动轮换和刷新避重`, async ({ page }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`/?theme=${theme}`);
    const art = page.locator("[data-hero-character]");
    await expect(art).toHaveAttribute("data-hero-ready", "true");
    await art.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(art.locator("button")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "首页角色轮换" })).toHaveCount(0);
    expect(await art.innerText()).toBe("");
    const initial = await art.getAttribute("data-hero-character");
    await expect(art).not.toHaveAttribute("data-hero-character", initial!, { timeout: 10000 });
    const automatic = await art.getAttribute("data-hero-character");
    expect(pool.some(character => character.src === automatic)).toBe(true);
    await page.reload();
    await expect(art).toHaveAttribute("data-hero-ready", "true");
    await expect(art).not.toHaveAttribute("data-hero-character", automatic!);
    for (let reload = 0; reload < 3; reload++) {
      const previous = await art.getAttribute("data-hero-character");
      await page.reload();
      await expect(art).toHaveAttribute("data-hero-ready", "true");
      await expect(art).not.toHaveAttribute("data-hero-character", previous!);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${theme}-without-controls.png`) });
    expect(errors).toEqual([]);
  });
}

test("hidden pages pause rotation, and rapid theme changes discard pending images", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?theme=bluearchive");
  const art = page.locator("[data-hero-character]");
  await expect(art).toHaveAttribute("data-hero-ready", "true");
  await art.evaluate(element => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const initial = await art.getAttribute("data-hero-character");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(6400);
  await expect(art).toHaveAttribute("data-hero-character", initial!);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(art).not.toHaveAttribute("data-hero-character", initial!, { timeout: 10000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const theme of ["sekai", "bangdream", "bluearchive", "sekai"]) await page.locator(`[data-theme="${theme}"]`).click();
  await expect(page.locator("main")).toHaveAttribute("data-home-theme", "sekai");
  await expect(art).toHaveAttribute("data-hero-ready", "true");
  const current = await art.getAttribute("data-hero-character");
  expect(characters.sekai.some(character => character.src === current)).toBe(true);
});
