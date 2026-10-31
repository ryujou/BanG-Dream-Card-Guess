import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter } from "react-router-dom";
import { DiagnosticsPage } from "../../src/client/pages/Diagnostics";
import { api } from "../../src/client/lib/api";
import { useAuth } from "../../src/client/lib/auth";
import { copyText } from "../../src/client/lib/clipboard";

vi.mock("../../src/client/lib/api", { spy: true });
vi.mock("../../src/client/lib/auth", { spy: true });
vi.mock("../../src/client/lib/clipboard", { spy: true });
const diagnostics = { uptime: 3661, rooms: 2, soloGames: 3, clients: 4, users: 1, scores: 20,
  cardCount: 3064, publicOrigin: "https://xtbang.top", memory: { systemAllocated: 1048576, heapUsed: 524288 }, errors: [] };
beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ loading: false, user: { role: "super_admin" } } as ReturnType<typeof useAuth>);
  vi.mocked(api).mockResolvedValue(diagnostics);
  vi.mocked(copyText).mockResolvedValue();
});
afterEach(() => vi.resetAllMocks());
const show = () => render(<MemoryRouter><DiagnosticsPage /></MemoryRouter>);
test.each([null, { role: "host" }])("does not request privileged data for %j", async user => {
  vi.mocked(useAuth).mockReturnValue({ loading: false, user } as ReturnType<typeof useAuth>);
  await show();
  await expect.element(page.getByRole("heading", { name: "此页面仅限管理员" })).toBeVisible();
  expect(api).not.toHaveBeenCalled();
  await expect.element(page.getByRole("link")).toHaveAttribute("href", user ? "/host" : "/login?next=/diagnostics");
});
test("shows server values, copies JSON, and reports copy failure", async () => {
  await show();
  await expect.element(page.getByText("1 小时 1 分钟")).toBeVisible();
  await expect.element(page.getByText("当前没有报告的问题。")).toBeVisible();
  await page.getByRole("button", { name: "复制诊断信息" }).click();
  expect(copyText).toHaveBeenCalledWith(JSON.stringify(diagnostics, null, 2));
  await expect.element(page.getByRole("status")).toHaveTextContent("诊断信息已复制");
  vi.mocked(copyText).mockRejectedValue(new Error("denied"));
  await page.getByRole("button", { name: "复制诊断信息" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("浏览器未允许复制");
  await page.getByText("查看诊断 JSON").click();
  await expect.element(page.getByText('"cardCount": 3064', { exact: false })).toBeVisible();
});
test("failed load can be retried and mixed diagnostic errors are rendered as text", async () => {
  vi.mocked(api).mockRejectedValueOnce(new Error("服务暂时不可用"));
  await show();
  await expect.element(page.getByRole("alert")).toHaveTextContent("服务暂时不可用");
  vi.mocked(api).mockResolvedValue({ ...diagnostics, publicOrigin: "", errors: ["<img src=x onerror=alert(1)>", { message: "卡面读取失败", at: 1700000000000 }, { message: "无时间错误" }] });
  await page.getByRole("button", { name: /刷新状态/ }).click();
  await expect.element(page.getByText("未配置")).toBeVisible();
  await expect.element(page.getByText("<img src=x onerror=alert(1)>", { exact: true })).toBeVisible();
  await expect.element(page.getByText("无时间错误", { exact: true })).toBeVisible();
  expect(document.querySelector('img[src="x"]')).toBeNull();
});

