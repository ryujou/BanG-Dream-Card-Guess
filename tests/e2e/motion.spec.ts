import { test, expect } from "@playwright/test";

for (const theme of ["bangdream", "sekai", "bluearchive"]) test(`城市SVG与Canvas实际运动，离屏暂停，减少动态效果时静止 ${theme}`, async ({
  page,
}, info) => {
  await page.goto(theme === "bangdream" ? "/" : `/?theme=${theme}`);
  await expect(page.locator(".site-header")).toHaveAttribute("data-home-theme", theme);
  const heroCanvas = page.locator("canvas.stage-particles").first();
  await expect(heroCanvas).toHaveAttribute("data-running", "true");
  const canvas = heroCanvas;
  const before = await canvas.evaluate((c) =>
    Array.from(c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data),
  );
  await page.waitForTimeout(250);
  const changed = await canvas.evaluate((c, previous) => {
    const current = c
      .getContext("2d")!
      .getImageData(0, 0, c.width, c.height).data;
    return current.some((value, index) => value !== previous[index]);
  }, before);
  expect(changed).toBe(true);
  const city = page.locator('[class*="cityDecoration"]');
  await city.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await expect(heroCanvas).toHaveAttribute("data-running", "false");
  const rotor = city.locator('g[class*="rotor"]');
  const angle = await rotor.evaluate((g) => getComputedStyle(g).transform);
  await page.waitForTimeout(250);
  expect(await rotor.evaluate((g) => getComputedStyle(g).transform)).not.toBe(
    angle,
  );
  expect(
    await city
      .getByText("万楼", { exact: true })
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Ma Shan Zheng");
  await city.screenshot({
    path: `artifacts/screenshots/city-motion-${theme}-${info.project.name}.png`,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(heroCanvas).toHaveAttribute("data-running", "true");
  expect(
    await rotor.evaluate((g) => getComputedStyle(g).animationPlayState),
  ).toBe("paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("canvas.stage-particles")).toHaveCount(0);
  await city.scrollIntoViewIfNeeded();
  expect(await rotor.evaluate((g) => getComputedStyle(g).animationName)).toBe(
    "none",
  );
  await page.goto(`/community?theme=${theme}`);
  await expect(
    page.getByRole("img", { name: "湘潭江畔：万楼、湘潭眼、湘江一桥和湘莲" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
