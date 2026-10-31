import { test, expect } from "@playwright/test";

const widths = [320, 360, 390, 430, 741, 768, 800, 801, 980, 981, 990, 1024, 1100, 1101, 1150, 1151, 1280, 1440, 1920];
const user = { id: 1, username: "layout", displayName: "AReallyLongHostDisplayNameForLayoutChecks", role: "admin" };

for (const width of widths) {
  test(`L1：完整品牌、导航与登录状态布局 ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "显式视口矩阵只执行一次");
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let signedIn = false;
    await page.route("**/api/auth/me", route => route.fulfill({ json: { user: signedIn ? user : null, csrfToken: "layout-only" } }));
    for (const authenticated of [false, true]) {
      signedIn = authenticated;
      for (const route of ["/", "/games"]) {
        let geometry: number[][] | undefined;
        for (const theme of ["bangdream", "sekai", "bluearchive"]) {
          await page.goto(`${route}?theme=${theme}`);
          await expect(page.locator("main")).toBeVisible();
          await page.evaluate(() => document.fonts.ready);
          const result = await page.evaluate(() => {
            const issues: string[] = [];
            for (const brand of document.querySelectorAll<HTMLElement>(".brand")) {
              for (const text of brand.querySelectorAll<HTMLElement>("b, small")) {
                if (!text.checkVisibility()) continue;
                const lines = new Set<string>();
                const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
                while (walker.nextNode()) {
                  const node = walker.currentNode;
                  for (let i = 0; i < (node.textContent?.length || 0); i++) {
                    if (!node.textContent![i].trim()) continue;
                    const range = document.createRange();
                    range.setStart(node, i);
                    range.setEnd(node, i + 1);
                    const rect = range.getBoundingClientRect();
                    lines.add(rect.top.toFixed(1));
                    if (rect.left < brand.getBoundingClientRect().left - 1 || rect.right > brand.getBoundingClientRect().right + 1)
                      issues.push(`品牌文字超出容器：${text.textContent}`);
                  }
                }
                if (lines.size !== 1) issues.push(`品牌文字断行：${text.textContent}`);
              }
            }
            const header = document.querySelector("header")!.getBoundingClientRect();
            const children = [...document.querySelectorAll<HTMLElement>("header > .brand, header > nav, header > .header-actions, header > .home-theme-switch")]
              .filter(element => element.checkVisibility()).map(element => ({ name: element.className, rect: element.getBoundingClientRect() }));
            for (let i = 0; i < children.length; i++) {
              const a = children[i];
              if (a.rect.left < -1 || a.rect.right > innerWidth + 1 || a.rect.top < header.top - 1 || a.rect.bottom > header.bottom + 1)
                issues.push(`页头元素超出：${a.name}`);
              for (const b of children.slice(i + 1)) {
                if (Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left) > 1 && Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top) > 1)
                  issues.push(`页头重叠：${a.name} / ${b.name}`);
              }
            }
            if (document.documentElement.scrollWidth > innerWidth + 1) issues.push("页面横向溢出");
            return { issues, geometry: children.map(({ rect }) => [rect.x, rect.y, rect.width, rect.height].map(Math.round)) };
          });
          expect(result.issues, `${route} ${theme}, 登录=${authenticated}`).toEqual([]);
          if (route === "/") {
            if (geometry) expect(result.geometry).toEqual(geometry);
            geometry = result.geometry;
          }
        }
      }
    }
  });
}

test("L2：手机菜单提供可操作的退出登录入口", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "显式手机视口只执行一次");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route("**/api/auth/me", route => route.fulfill({ json: { user, csrfToken: "layout-only" } }));
  await page.route("**/api/auth/logout", route => route.fulfill({ json: { ok: true } }));
  await page.goto("/games?theme=sekai");
  await page.getByRole("button", { name: "打开菜单" }).click();
  const menu = page.getByRole("navigation", { name: "主要导航" });
  await expect(menu.getByRole("link", { name: "主持台", exact: true })).toBeVisible();
  await menu.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(url => url.pathname === "/" && url.searchParams.get("theme") === "sekai");
  await page.getByRole("button", { name: "打开菜单" }).click();
  await expect(menu.getByRole("link", { name: "主持登录", exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "退出登录" })).toHaveCount(0);
});
