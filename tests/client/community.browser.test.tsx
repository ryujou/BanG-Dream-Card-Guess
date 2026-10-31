import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter } from "react-router-dom";
import type { Community, User } from "../../src/shared/types";
import { api } from "../../src/client/lib/api";
import { useAuth } from "../../src/client/lib/auth";
import { CommunityPage } from "../../src/client/pages/Community";
import { CommunityAdminPage } from "../../src/client/pages/CommunityAdmin";
import { ImageField } from "../../src/client/features/community/EditorFields";

vi.mock("../../src/client/lib/api", () => ({ api: vi.fn() }));
vi.mock("../../src/client/lib/auth", () => ({ useAuth: vi.fn() }));
const request = vi.mocked(api), identity = vi.mocked(useAuth);
const admin = { id: "admin", username: "admin", displayName: "管理员", role: "super_admin", enabled: true, createdAt: 1, updatedAt: 1 } as User;
const empty = (): Community => ({ aboutUs: "", members: [], events: [], photos: [], socialLinks: [], bilibili: [] });
const auth = (user: User | null = admin, loading = false, error = "") => ({ user, loading, error, refresh: vi.fn(), login: vi.fn(), logout: vi.fn(), changePassword: vi.fn() });
const mount = (adminPage = false, entry = "/community") => render(<MemoryRouter initialEntries={[entry]}>{adminPage ? <CommunityAdminPage /> : <CommunityPage />}</MemoryRouter>);
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

beforeEach(() => {
  request.mockReset().mockResolvedValue(empty());
  identity.mockReset().mockReturnValue(auth());
});
afterEach(async () => { await cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test("public community shows loading, empty content, and server errors", async () => {
  const pending = deferred<Community>(); request.mockReturnValueOnce(pending.promise);
  const view = await mount();
  await expect.element(page.getByText("正在加载同好会内容…")).toBeVisible();
  pending.resolve(empty());
  await expect.element(page.getByRole("heading", { name: "一起，把故事写下去。" })).toBeVisible();
  await expect.element(page.getByText("新的相聚，正在筹备。")).toBeVisible();
  await view.unmount();
  request.mockRejectedValueOnce(new Error("社区服务暂时不可用"));
  await mount();
  await expect.element(page.getByRole("alert")).toHaveTextContent("社区服务暂时不可用");
});

test("public view normalizes photos, labels past events, and rejects executable links", async () => {
  const value: Community = {
    aboutUs: "<img onerror=alert(1)>一起听歌", members: [
      { name: "香澄", desc: "主唱", url: "javascript:alert(1)", image: "" },
      { name: "", desc: "同好", url: "https://example.test/member", image: "/brand/kasumi.png" },
    ], events: [
      { title: "下次活动预告", date: "2000-1-1", location: "湘潭", desc: "一起合奏", url: "https://example.test/event", image: "/brand/kasumi.png" },
      { title: "下一场", date: "", location: "", desc: "敬请期待", url: "javascript:alert(1)" },
    ], photos: ["/brand/kasumi.png", { url: "/brand/kasumi.png", title: "返图", desc: "活动回忆" }],
    bilibili: [{ bvid: "BV1test", title: "活动视频" }],
    socialLinks: [{ title: "错误入口", url: "data:text/html,bad" }, { title: "官网", url: "https://example.test" }],
  };
  request.mockResolvedValueOnce(value);
  const scrolled = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  await mount(false, "/community?theme=sekai#members");
  await expect.element(page.getByRole("heading", { name: "往期活动", exact: true })).toBeVisible();
  await expect.element(page.getByText("原活动公告：一起合奏")).toBeVisible();
  await expect.element(page.getByText("日期待公布")).toBeVisible();
  await expect.element(page.getByText("<img onerror=alert(1)>一起听歌")).toBeVisible();
  expect(document.querySelector('img[onerror]')).toBeNull();
  await expect.element(page.getByRole("link", { name: "错误入口" })).not.toBeInTheDocument();
  expect(document.querySelectorAll('a[href^="javascript:"]')).toHaveLength(0);
  expect(document.querySelector('iframe')?.getAttribute('src')).toContain('bvid=BV1test&autoplay=0');
  await expect.element(page.getByRole("link", { name: "在 B 站打开" })).toHaveAttribute("href", "https://www.bilibili.com/video/BV1test");
  await expect.poll(() => scrolled.mock.calls.length).toBe(1);
});

test("unmounted community ignores its late response", async () => {
  const pending = deferred<Community>(); request.mockReturnValueOnce(pending.promise);
  const view = await mount(); await view.unmount(); pending.resolve({ ...empty(), aboutUs: "迟到内容" });
  await Promise.resolve();
  expect(document.body.textContent).not.toContain("迟到内容");
});

test.each([null, { ...admin, role: "host" } as User])("editor checks authorization before loading its data: %s", async user => {
  identity.mockReturnValue(auth(user)); await mount(true);
  await expect.element(page.getByRole("heading", { name: "此页面仅限管理员" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "保存全部修改" })).not.toBeInTheDocument();
  expect(request).not.toHaveBeenCalled();
  await expect.element(page.getByRole("link", { name: user ? "回到主持控制台" : "登录" })).toBeVisible();
});

test("editor waits for identity, then reports a content failure", async () => {
  identity.mockReturnValue(auth(null, true)); const view = await mount(true);
  await expect.element(page.getByText("正在加载…")).toBeVisible(); expect(request).not.toHaveBeenCalled();
  identity.mockReturnValue(auth()); request.mockRejectedValueOnce(new Error("读取失败"));
  await view.rerender(<MemoryRouter><CommunityAdminPage /></MemoryRouter>);
  await expect.element(page.getByRole("alert")).toHaveTextContent("读取失败");
  await expect.element(page.getByText("内容加载失败。")).toBeVisible();
});

test("editor creates, edits, sorts and deletes each content collection before saving the complete document", async () => {
  const saved = deferred<Community>();
  request.mockImplementation(async (url, options) => options?.method === "PUT" ? saved.promise : empty());
  await mount(true);
  await page.getByLabelText("社团简介").fill("周末一起合奏");
  const collections = [
    { name: "成员介绍", label: "昵称 *", first: "香澄", second: "有咲" },
    { name: "近期活动", label: "活动名称 *", first: "周末合奏", second: "返场" },
    { name: "活动相册", label: "照片标题", first: "合影", second: "后台" },
    { name: "社交平台", label: "平台名称 *", first: "社群", second: "视频" },
    { name: "Bilibili 视频", label: "视频 BV 号 *", first: "BV1first", second: "BV1second" },
  ];
  for (const collection of collections) {
    const region = page.getByRole("region", { name: collection.name });
    await region.getByRole("button", { name: "+ 添加", exact: true }).click();
    await region.getByLabelText(collection.label, { exact: true }).fill(collection.first);
    await expect.element(region.getByRole("button", { name: "↑ 上移" })).toBeDisabled();
    await region.getByRole("button", { name: "+ 添加", exact: true }).click();
    await region.getByLabelText(collection.label, { exact: true }).nth(1).fill(collection.second);
    await region.getByRole("button", { name: "↓ 下移" }).nth(0).click();
    await expect.element(region.getByLabelText(collection.label, { exact: true }).nth(0)).toHaveValue(collection.second);
    await region.getByRole("button", { name: "↑ 上移" }).nth(1).click();
    await expect.element(region.getByLabelText(collection.label, { exact: true }).nth(0)).toHaveValue(collection.first);
    await region.getByRole("button", { name: "删除", exact: true }).nth(1).click();
    await expect.element(region.getByRole("button", { name: "↓ 下移" })).toBeDisabled();
  }
  const values: Record<string, string> = {
    "头衔 / 描述": "主唱", "个人主页链接": "https://example.test/member", "成员头像": "/brand/kasumi.png",
    "日期 / 时间": "2026-12-01", "地点": "湘潭", "活动详情链接": "https://example.test/event", "活动简介": "欢迎参加", "活动图片": "/brand/kasumi.png",
    "照片": "/brand/kasumi.png", "所属相册": "湘潭邦O", "照片文案": "共同回忆", "平台链接 *": "https://example.test/community", "视频标题": "合奏现场", "视频封面": "/brand/kasumi.png",
  };
  for (const [label, value] of Object.entries(values)) await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await expect.element(page.getByRole("status")).toHaveTextContent("有修改尚未保存");
  await page.getByRole("button", { name: "保存全部修改" }).click();
  await expect.element(page.getByRole("button", { name: "正在保存" })).toBeDisabled();
  const submitted = request.mock.calls.find(([, options]) => options?.method === "PUT")?.[1]?.body as Community;
  expect(submitted.photos[0]).toMatchObject({ album: "湘潭邦O", thumbnail: "" });
  expect(submitted).toMatchObject({ aboutUs: "周末一起合奏", members: [{ name: "香澄", desc: "主唱" }], events: [{ title: "周末合奏", date: "2026-12-01", location: "湘潭" }], photos: [{ title: "合影", desc: "共同回忆" }], socialLinks: [{ title: "社群" }], bilibili: [{ bvid: "BV1first", title: "合奏现场" }] });
  saved.resolve(submitted);
  await expect.element(page.getByRole("status")).toHaveTextContent("已保存，社区页面已更新。");
  await expect.element(page.getByRole("button", { name: "保存全部修改" })).toBeEnabled();
});

test("save failure preserves edits and permits a successful retry", async () => {
  let fail = true;
  request.mockImplementation(async (_, options) => {
    if (options?.method === "PUT") { if (fail) throw new Error("保存被拒绝"); return options.body; }
    return empty();
  });
  await mount(true); await page.getByLabelText("社团简介").fill("待保存内容");
  await page.getByRole("button", { name: "保存全部修改" }).click();
  await expect.element(page.getByRole("alert")).toHaveTextContent("保存被拒绝");
  await expect.element(page.getByLabelText("社团简介")).toHaveValue("待保存内容");
  fail = false; await page.getByRole("button", { name: "保存全部修改" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("已保存");
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
});

test("image upload enforces size, reports server errors, then supplies the uploaded URL", async () => {
  const changed = vi.fn(); await render(<ImageField label="测试照片" value="" onChange={changed} />);
  const input = page.getByLabelText("上传图片", { exact: true });
  await input.upload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" }));
  await expect.element(page.getByRole("alert")).toHaveTextContent("图片不能超过 5 MB。");
  expect(request).not.toHaveBeenCalled();
  await expect.element(input).toBeEnabled();
  request.mockRejectedValueOnce(new Error("上传失败"));
  const photo = new File(["photo-bytes"], "photo.png", { type: "image/png" });
  await input.upload(photo); await expect.element(page.getByRole("alert")).toHaveTextContent("上传失败");
  await expect.element(input).toBeEnabled();
  request.mockResolvedValueOnce({ url: "/uploads/new.png" });
  await input.upload(photo);
  await expect.poll(() => changed.mock.calls).toEqual([["/uploads/new.png"]]);
  expect(request.mock.calls.at(-1)).toEqual(["/api/uploads", { method: "POST", body: { image: "data:image/png;base64,cGhvdG8tYnl0ZXM=" } }]);
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  await expect.element(input).toBeEnabled();
  await expect.element(input).toHaveValue("");
});

test("pending uploads pause edits and ordering so the resolved image cannot overwrite a newer draft", async () => {
  const upload = deferred<{ url: string }>();
  request.mockImplementation(async (url, options) => {
    if (url === "/api/uploads") return upload.promise;
    if (options?.method === "PUT") return options.body;
    return { ...empty(), members: [{ name: "香澄", desc: "", url: "" }, { name: "有咲", desc: "", url: "" }] };
  });
  await mount(true);
  const members = page.getByRole("region", { name: "成员介绍" });
  await members.getByLabelText("上传图片", { exact: true }).nth(0).upload(new File(["photo"], "photo.png", { type: "image/png" }));
  await expect.element(page.getByRole("status")).toHaveTextContent("正在上传图片，请稍候。");
  await expect.element(members.getByRole("textbox", { name: "昵称 *", exact: true }).nth(0)).toBeDisabled();
  await expect.element(members.getByRole("button", { name: "↓ 下移" }).nth(0)).toBeDisabled();
  await expect.element(members.getByRole("button", { name: "删除", exact: true }).nth(0)).toBeDisabled();
  await expect.element(page.getByRole("button", { name: "保存全部修改" })).toBeDisabled();
  upload.resolve({ url: "/brand/kasumi.png" });
  await expect.element(members.getByRole("textbox", { name: "昵称 *", exact: true }).nth(0)).toBeEnabled();
  await members.getByRole("textbox", { name: "昵称 *", exact: true }).nth(0).fill("修改后的香澄");
  await members.getByRole("button", { name: "↓ 下移" }).nth(0).click();
  await page.getByRole("button", { name: "保存全部修改" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("已保存");
  const submitted = request.mock.calls.find(([, options]) => options?.method === "PUT")?.[1]?.body as Community;
  expect(submitted.members.map(member => [member.name, member.image])).toEqual([["有咲", undefined], ["修改后的香澄", "/brand/kasumi.png"]]);
});

test("a local file read failure releases upload state and does not contact the server", async () => {
  class FailedReader {
    onerror?: () => void;
    readAsDataURL() { queueMicrotask(() => this.onerror?.()); }
  }
  vi.stubGlobal("FileReader", FailedReader);
  const changed = vi.fn(), uploading = vi.fn();
  await render(<ImageField label="测试照片" value="" onChange={changed} onUploadingChange={uploading} />);
  const input = page.getByLabelText("上传图片", { exact: true });
  await input.upload([]); expect(uploading).not.toHaveBeenCalled();
  const selection = new DataTransfer();
  selection.items.add(new File(["photo"], "photo.png", { type: "image/png" }));
  (input.element() as HTMLInputElement).files = selection.files;
  input.element().dispatchEvent(new Event("change", { bubbles: true }));
  await expect.element(page.getByRole("alert")).toHaveTextContent("无法读取这张图片。");
  expect(uploading.mock.calls).toEqual([[true], [false]]);
  expect(changed).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  await expect.element(input).toBeEnabled();
});
