import { test, expect, type APIRequestContext } from "@playwright/test";

async function authenticatedWrite(
  request: APIRequestContext,
  origin: string,
  route: string,
  method: string,
  data?: unknown,
) {
  const session = await (await request.get("/api/auth/me")).json();
  const result = await request.fetch(route, {
    method,
    data,
    headers: { Origin: origin, "X-CSRF-Token": session.csrfToken },
  });
  expect(
    result.ok(),
    `${method} ${route}: ${await result.text()}`,
  ).toBeTruthy();
  return result;
}

test("主持修改自己的密码后，旧密码失效且新密码可登录", async ({
  page,
  request,
  baseURL,
}, testInfo) => {
  test.skip(
    !process.env.E2E_ADMIN_PASSWORD,
    "设置 E2E_ADMIN_PASSWORD 后创建临时主持账号。",
  );
  const origin = new URL(baseURL!).origin;
  const username = `qa_pwd_${testInfo.project.name}_${Date.now().toString(36)}`;
  const oldPassword = "Verify-Old-2030!";
  const newPassword = "Verify-New-2030!";
  let id = "";
  await authenticatedWrite(request, origin, "/api/auth/login", "POST", {
    username: "admin",
    password: process.env.E2E_ADMIN_PASSWORD,
  });
  try {
    const created = await authenticatedWrite(
      request,
      origin,
      "/api/admin/users",
      "POST",
      {
        username,
        displayName: "改密验收临时主持",
        role: "host",
        password: oldPassword,
      },
    );
    id = (await created.json()).user.id;
    await page.goto("/login");
    await page.getByLabel("账号", { exact: true }).fill(username);
    await page.locator('input[name="password"]').fill(oldPassword);
    await page.getByRole("button", { name: "进入主持台" }).click();
    await expect(page).toHaveURL(/\/host$/);
    await page.getByText("修改登录密码", { exact: true }).click();
    await page.getByLabel("当前密码", { exact: true }).fill(oldPassword);
    await page.getByLabel("新密码", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "更新密码并重新登录" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login" && ["", "/host"].includes(url.searchParams.get("next") || ""));
    await page.getByLabel("账号", { exact: true }).fill(username);
    await page.locator('input[name="password"]').fill(oldPassword);
    await page.getByRole("button", { name: "进入主持台" }).click();
    await expect(page.getByRole("alert")).toContainText("用户名或密码错误");
    await expect(page).toHaveURL((url) => url.pathname === "/login" && ["", "/host"].includes(url.searchParams.get("next") || ""));
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole("button", { name: "进入主持台" }).click();
    await expect(page).toHaveURL(/\/host$/);
    await expect(page.getByText("修改登录密码", { exact: true })).toBeVisible();
  } finally {
    if (id)
      await authenticatedWrite(
        request,
        origin,
        `/api/admin/users/${id}`,
        "DELETE",
      );
  }
});
