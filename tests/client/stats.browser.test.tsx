import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { api } from "../../src/client/lib/api";
import { StatsPage } from "../../src/client/pages/Stats";
import { colorMap } from "../../src/client/features/stats/worldMap";
import type { Stats } from "../../src/client/features/stats/model";

vi.mock("../../src/client/lib/api", () => ({ api: vi.fn() }));
const request = vi.mocked(api);
const map = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><path id="CN" name="China" d="M0 0h20v20z"/><path id="US" name="United States" d="M25 0h20v20z"/><path id="JP" name="Japan" d="M50 0h20v20z"/><path id="OTHER" d="M75 0h20v20z"/></svg>';
const data: Stats = { configured: true, pageviews: 1234, visitors: 25, countries: [{ code: "CN", name: "CN", count: 10 }, { code: "US", name: "US", count: 5 }], regions: [{ code: "CN-HN", name: "CN-HN", count: 8 }] };
let fetchMap: ReturnType<typeof vi.fn>;
beforeEach(() => {
  request.mockReset().mockResolvedValue(data);
  fetchMap = vi.fn().mockResolvedValue(new Response(map)); vi.stubGlobal("fetch", fetchMap);
});
afterEach(async () => { await cleanup(); vi.unstubAllGlobals(); });

test("statistics waits for its API, then renders translated geography and a proportional map", async () => {
  let finish!: (value: Stats) => void; request.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await render(<StatsPage />); await expect.element(page.getByText("正在加载访问统计…")).toBeVisible();
  expect(fetchMap).not.toHaveBeenCalled(); finish(data);
  await expect.element(page.getByText("1,234", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("cell", { name: "湖南", exact: true })).toBeVisible();
  await expect.element(page.getByRole("cell", { name: "中国", exact: true })).toBeVisible();
  const rendered = page.getByRole("img", { name: "访问来源国家分布图" });
  await expect.element(rendered).toBeVisible();
  expect(rendered.element().querySelector('#CN')?.getAttribute('fill')).toBe('hsl(341 89% 60%)');
  expect(rendered.element().querySelector('#US')?.getAttribute('fill')).toBe('hsl(341 89% 76%)');
  expect(rendered.element().querySelector('#JP')?.getAttribute('fill')).toBe('#e9edf3');
  expect(rendered.element().querySelector('#CN title')?.textContent).toBe('中国 · 10');
  expect(rendered.element().querySelector('#OTHER title')?.textContent).toBe('OTHER');
  expect(rendered.element().hasAttribute('width')).toBe(false);
});

test("unconfigured statistics explains the empty state and does not load a map", async () => {
  request.mockResolvedValueOnce({ ...data, configured: false }); await render(<StatsPage />);
  await expect.element(page.getByRole("heading", { name: "统计尚未开放" })).toBeVisible();
  expect(fetchMap).not.toHaveBeenCalled();
});

test("empty country and region lists remain readable", async () => {
  request.mockResolvedValueOnce({ ...data, countries: [], regions: [] }); await render(<StatsPage />);
  await expect.element(page.getByText("暂无国家与地区数据")).toBeVisible();
  await expect.element(page.getByText("暂无省份与州数据")).toBeVisible();
  await expect.element(page.getByRole("img", { name: "访问来源国家分布图" })).toBeVisible();
});

test("API failure is distinct from a map failure", async () => {
  request.mockRejectedValueOnce(new Error("统计服务不可用")); const view = await render(<StatsPage />);
  await expect.element(page.getByRole("alert")).toHaveTextContent("统计服务不可用");
  expect(fetchMap).not.toHaveBeenCalled(); await view.unmount();
  fetchMap.mockResolvedValueOnce(new Response("missing", { status: 404 })); await render(<StatsPage />);
  await expect.element(page.getByText("地图暂时无法显示。")).toBeVisible();
  await expect.element(page.getByText("1,234", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("cell", { name: "湖南", exact: true })).toBeVisible();
});

test("malformed SVG reports the map error without discarding usable statistics", async () => {
  fetchMap.mockResolvedValueOnce(new Response("<html>not an SVG</html>")); await render(<StatsPage />);
  await expect.element(page.getByText("地图资源无法解析。")).toBeVisible();
  await expect.element(page.getByText("1,234", { exact: true })).toBeVisible();
  expect(() => colorMap("broken", [])).toThrow("地图资源无法解析");
});

test("unmounting during statistics or map loading suppresses late state changes", async () => {
  let finishStats!: (value: Stats) => void; request.mockReturnValueOnce(new Promise(resolve => { finishStats = resolve; }));
  const initial = await render(<StatsPage />); await initial.unmount(); finishStats(data); await Promise.resolve();
  expect(fetchMap).not.toHaveBeenCalled();
  let finishMap!: (value: Response) => void; fetchMap.mockReturnValueOnce(new Promise(resolve => { finishMap = resolve; }));
  const mapped = await render(<StatsPage />); await expect.element(page.getByText("正在绘制地图…")).toBeVisible();
  await mapped.unmount(); finishMap(new Response(map)); await Promise.resolve();
  expect(document.body.textContent).not.toContain("1,234");
});
