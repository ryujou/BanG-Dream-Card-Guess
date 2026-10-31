import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

test.describe.configure({ mode: "serial" });

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("账号", { exact: true }).fill("admin");
  await page
    .locator('input[name="password"]')
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "进入主持台" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function write(
  page: Page,
  route: string,
  method: string,
  data?: unknown,
) {
  const identity = await (await page.request.get("/api/auth/me")).json();
  const response = await page.request.fetch(route, {
    method,
    data,
    headers: {
      Origin: new URL(page.url()).origin,
      "X-CSRF-Token": identity.csrfToken,
    },
  });
  expect(
    response.ok(),
    `${method} ${route}: ${await response.text()}`,
  ).toBeTruthy();
  return response;
}

test("公开页面展示真实空态，移动端无横向溢出", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [route, text] of [
    ["/shop", "把热爱带回家"],
    ["/cart", "清单还是空的"],
    ["/checkout", "先选一点喜欢的周边"],
    ["/shop/missing-product", "商品未找到"],
    ["/stats", "统计尚未开放"],
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: new RegExp(text) }),
    ).toBeVisible();
    await expect(page).toHaveTitle(/湘潭/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      route,
    ).toBeTruthy();
  }
  await page.goto("/shop");
  await page.getByRole("link", { name: /购物清单/ }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(
    page.getByRole("heading", { name: "清单还是空的" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("真实周边搜索分类、详情相册、清单持久化与扫码引导", async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto("/shop");
  const search = page.getByRole("searchbox");
  await search.fill("不存在的验收商品");
  await expect(
    page.getByRole("heading", { name: "没有找到相关周边" }),
  ).toBeVisible();
  await search.fill("湖南科技大学 普通款");
  await page.getByRole("combobox").selectOption("钥匙扣");
  await expect(
    page.getByRole("heading", { name: "镭射亚克力钥匙扣 湖南科技大学 普通款" }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "镭射亚克力钥匙扣 湖南科技大学 普通款" })
    .click();
  await expect(page).toHaveURL(/\/shop\/1$/);
  await page.getByRole("button", { name: "查看第 2 张图片" }).click();
  await expect(
    page.getByRole("button", { name: "查看第 2 张图片" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(
      () =>
        page
          .getByRole("img", {
            name: "镭射亚克力钥匙扣 湖南科技大学 普通款",
            exact: true,
          })
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      { timeout: 15_000 },
    )
    .toBeTruthy();
  await page.getByRole("button", { name: "加入购物清单 +" }).click();
  await page.getByRole("link", { name: "查看清单 →" }).click();
  await page
    .getByRole("button", {
      name: "增加 镭射亚克力钥匙扣 湖南科技大学 普通款 数量",
    })
    .click();
  await expect(page.getByText("¥10.42", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("¥10.42", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "前往小程序下单 ↗" }).click();
  await expect(
    page.getByRole("heading", { name: "扫码前往小程序" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "社团周边下单小程序码" }),
  ).toHaveAttribute("src", "/shop/checkout-qr.jpg");
  await expect
    .poll(
      () =>
        page
          .getByRole("img", { name: "社团周边下单小程序码" })
          .evaluate(
            (image: HTMLImageElement) =>
              image.complete && image.naturalWidth > 0,
          ),
      { timeout: 15_000 },
    )
    .toBeTruthy();
  await expect(
    page.getByText(
      "请在小程序中选择对应商品并完成下单。此清单不会自动同步到小程序。",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "← 返回购物清单" }).click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "清单还是空的" }),
  ).toBeVisible();
});

test("已配置统计的国家和省份数据绘制到本地地图", async ({ page }) => {
  await page.route("**/api/stats", (route) =>
    route.fulfill({
      json: {
        configured: true,
        pageviews: 123,
        visitors: 45,
        countries: [
          { code: "CN", name: "CN", count: 40 },
          { code: "JP", name: "JP", count: 5 },
        ],
        regions: [{ code: "CN-HN", name: "CN-HN", count: 30 }],
      },
    }),
  );
  await page.goto("/stats");
  await expect(
    page.getByRole("img", { name: "访问来源国家分布图" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "湖南", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "中国", exact: true }),
  ).toBeVisible();
  expect(await page.locator("svg #cn").getAttribute("fill")).toMatch(/^hsl/);
  expect(await page.locator("svg #jp").getAttribute("fill")).not.toBe(
    await page.locator("svg #cn").getAttribute("fill"),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBeTruthy();
});

test("社区字段录入、上传、排序、保存和公开展示", async ({ page }) => {
  test.skip(
    !process.env.E2E_ADMIN_PASSWORD,
    "设置 E2E_ADMIN_PASSWORD 后验证管理功能。",
  );
  await login(page);
  const original = await (await page.request.get("/api/community")).json();
  await page.route("https://player.bilibili.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>External video frame</p>",
    }),
  );
  const section = (title: string) =>
    page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  try {
    await write(page, "/api/community", "PUT", {
      aboutUs: "",
      members: [],
      events: [],
      photos: [],
      socialLinks: [],
      bilibili: [],
    });
    await page.goto("/community-admin");
    await page.getByLabel("社团简介").fill("自动验收临时内容：一起听音乐。");
    const members = section("成员介绍");
    await members.getByRole("button", { name: "+ 添加" }).click();
    await members.getByLabel("昵称").fill("临时成员一");
    await members.getByLabel("头衔 / 描述").fill("活动志愿者");
    await members.getByRole("button", { name: "+ 添加" }).click();
    await members.getByLabel("昵称").nth(1).fill("临时成员二");
    await members.getByRole("button", { name: "↑ 上移" }).nth(1).click();
    await expect(members.getByLabel("昵称").first()).toHaveValue("临时成员二");
    const events = section("近期活动");
    await events.getByRole("button", { name: "+ 添加" }).click();
    await events.getByLabel("活动名称").fill("验收临时活动");
    await events.getByLabel("日期 / 时间").fill("2030-01-01");
    await events.getByLabel("地点").fill("湘潭");
    await events.getByLabel("活动简介").fill("这条内容仅用于自动验收。");
    const photos = section("活动相册");
    await photos.getByRole("button", { name: "+ 添加" }).click();
    await photos
      .locator('input[type="file"]')
      .setInputFiles(path.resolve("public/icon5.png"));
    await expect(photos.getByRole("textbox", { name: "照片", exact: true })).toHaveValue(
      /^\/uploads\//,
    );
    await photos.getByLabel("照片标题").fill("验收临时返图");
    await photos.getByLabel("照片文案").fill("相聚时刻");
    const socials = section("社交平台");
    await socials.getByRole("button", { name: "+ 添加" }).click();
    await socials.getByLabel("平台名称").fill("验收链接");
    await socials.getByLabel("平台链接").fill("https://example.com/");
    const videos = section("Bilibili 视频");
    await videos.getByRole("button", { name: "+ 添加" }).click();
    await videos.getByLabel("视频 BV 号").fill("BV1GJ411x7h7");
    await videos.getByLabel("视频标题").fill("验收视频");
    await page.getByRole("button", { name: "保存全部修改 ↗" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "已保存，社区页面已更新。",
    );
    await page.getByRole("link", { name: "查看社区页面 ↗" }).click();
    await expect(
      page.getByRole("heading", { name: "临时成员二" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "验收临时活动" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "验收临时返图" })).toBeVisible();
    await expect(page.locator('iframe[title="验收视频"]')).toHaveAttribute(
      "src",
      /BV1GJ411x7h7/,
    );
    await page.goto("/");
    await page.getByRole("button", { name: "播放社团视频" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute(
      "src",
      /BV1GJ411x7h7/,
    );
    await page.getByRole("button", { name: "关闭视频" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  } finally {
    await write(page, "/api/community", "PUT", original);
  }
});

test("账号创建、停用、改密、删除，以及诊断刷新", async ({ page }, testInfo) => {
  test.skip(
    !process.env.E2E_ADMIN_PASSWORD,
    "设置 E2E_ADMIN_PASSWORD 后验证管理功能。",
  );
  await login(page);
  const username = `qa_${testInfo.project.name}_${Date.now().toString(36)}`;
  let id = "";
  try {
    await page.goto("/admin/users");
    await page.getByRole("button", { name: "创建账号 +" }).click();
    await page.getByLabel("登录用户名").fill(username);
    await page.getByLabel("显示名称").fill("验收临时主持");
    await page.getByLabel("初始密码").fill("Only-For-Test-2030!");
    await page.getByRole("button", { name: "保存账号 ↗" }).click();
    await expect(page.getByRole("status")).toHaveText("账号已创建。");
    const user = (
      await (await page.request.get("/api/admin/users")).json()
    ).users.find((item: { username: string }) => item.username === username);
    id = user.id;
    const row = page.getByRole("row").filter({ hasText: `@${username}` });
    expect(
      await row
        .getByRole("button", { name: "删除", exact: true })
        .evaluate(
          (button) => button.getBoundingClientRect().right <= innerWidth,
        ),
      "账号操作应在当前视口内可见",
    ).toBeTruthy();
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    await page.getByLabel("账号状态").selectOption("disabled");
    await page.getByRole("button", { name: "保存账号 ↗" }).click();
    await expect(row).toContainText("已停用");
    await row.getByRole("button", { name: "改密", exact: true }).click();
    await page.getByLabel("新密码").fill("Only-For-Test-2031!");
    await page.getByRole("button", { name: "确认重置密码" }).click();
    await expect(page.getByRole("status")).toContainText("已重置");
    await row.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(row).toHaveCount(0);
    id = "";
    await page.goto("/diagnostics");
    await expect(page.getByText("服务已响应", { exact: true })).toBeVisible();
    await expect(page.getByText("本地卡面", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "刷新状态 ↻" }).click();
    await expect(
      page.getByRole("button", { name: "刷新状态 ↻" }),
    ).toBeEnabled();
    await page.getByText("查看诊断 JSON", { exact: true }).click();
    await expect(page.locator("pre")).toContainText("publicOrigin");
    await page.getByRole("button", { name: "复制诊断信息" }).click();
    await expect(page.getByRole("status")).toHaveText("诊断信息已复制。");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBeTruthy();
  } finally {
    if (id) await write(page, `/api/admin/users/${id}`, "DELETE");
  }
});

test("成绩通过 SSE 出现，管理删除后实时刷新", async ({ page }, testInfo) => {
  test.setTimeout(60000);
  test.skip(
    !process.env.E2E_ADMIN_PASSWORD,
    "设置 E2E_ADMIN_PASSWORD 后验证管理功能。",
  );
  await login(page);
  const name = `验收玩家${testInfo.project.name}`;
  let scoreId = "";
  try {
    await page.goto("/scores");
    await expect(page.getByText("实时连接中", { exact: true })).toBeVisible();
    const { playerId, runId } = await (
      await write(page, "/note-shooter-api/startStat", "POST", {
        levels: 1,
        difficulty: "normal",
      })
    ).json();
    await new Promise((resolve) => setTimeout(resolve, 16000));
    await write(page, "/note-shooter-api/gameStat", "POST", {
      runId,
      playerId,
      playerName: name,
      finalScore: 7317,
      duration: 16,
      levels: 1,
      difficulty: "normal",
    });
    await page.getByRole("tab", { name: /最近挑战/ }).click();
    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("7,317");
    scoreId = (
      await (await page.request.get("/api/scores")).json()
    ).recent.find(
      (item: { playerId: string }) => item.playerId === playerId,
    ).id;
    await row.getByRole("button", { name: "删除", exact: true }).click();
    await page.getByRole("button", { name: "确认删除" }).click();
    await expect(row).toHaveCount(0);
    scoreId = "";
  } finally {
    if (scoreId) await write(page, `/api/scores/${scoreId}`, "DELETE");
  }
});
