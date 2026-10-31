import { test, expect } from "@playwright/test";

test("长英文房间名在五种宽度中完整折行，主持操作保持可用", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "明确设置五种验收宽度，避免重复执行");
  test.skip(!process.env.E2E_ADMIN_PASSWORD, "需要隔离测试管理员密码");
  test.setTimeout(60000);
  expect((await page.request.get("/api/auth/me")).ok()).toBeTruthy();
  await page.goto("/login");
  async function write(path: string, method: string, data?: unknown) {
    const identity = await (await page.request.get("/api/auth/me")).json();
    const response = await page.request.fetch(path, {
      method, data,
      headers: { Origin: new URL(page.url()).origin, "X-CSRF-Token": identity.csrfToken },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response;
  }
  await write("/api/auth/login", "POST", { username: "admin", password: process.env.E2E_ADMIN_PASSWORD });
  const name = "长房名_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  const { room } = await (await write("/api/rooms", "POST", { name })).json();
  try {
    await page.goto("/host");
    const heading = page.getByRole("heading", { name, exact: true });
    const row = page.locator("article").filter({ has: heading });
    await expect(heading).toBeVisible();
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      const layout = await row.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const title = element.querySelector("h3")!.getBoundingClientRect();
        const controls = [...element.querySelectorAll("a,button")].map(control => control.getBoundingClientRect());
        return {
          titleContained: title.left >= bounds.left - 1 && title.right <= bounds.right + 1,
          controlsContained: controls.every(control => control.left >= bounds.left - 1 && control.right <= bounds.right + 1),
          pageWidth: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        };
      });
      expect(layout.titleContained, `${width}px 房间名不能撑出所在行`).toBe(true);
      expect(layout.controlsContained, `${width}px 主持操作不能被挤出所在行`).toBe(true);
      expect(layout.pageWidth, `${width}px 页面不能产生横向滚动`).toBeLessThanOrEqual(layout.viewport);
      await expect(row.getByRole("link", { name: "进入主持台" })).toBeVisible();
      await expect(row.getByRole("button", { name: "更名", exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "关闭", exact: true })).toBeVisible();
    }
  } finally {
    await write(`/api/rooms/${room.code}`, "DELETE");
  }
});
