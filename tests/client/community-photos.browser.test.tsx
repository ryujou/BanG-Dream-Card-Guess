import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { CommunityPhotos } from "../../src/client/features/community/CommunityPhotos";
import type { CommunityPhoto } from "../../src/client/features/community/model";

const photos: CommunityPhoto[] = Array.from({ length: 8 }, (_, index) => ({
  album: "百团参展", title: `现场 ${index + 1}`, desc: `活动文案 ${index + 1}`,
  url: `/brand/kasumi.png?full=${index}`, thumbnail: `/brand/kasumi.png?thumb=${index}`,
}));
const other: CommunityPhoto = { album: "湘潭邦O", title: "应援现场", url: "/brand/kasumi.png" };
afterEach(async () => { await cleanup(); });

test("album covers load separately; opening an album and loading more never repeats photos", async () => {
  await render(<CommunityPhotos photos={[...photos, other]} />);
  expect(document.querySelectorAll('img')).toHaveLength(2);
  expect([...document.querySelectorAll('img')].some(img => img.src.includes('full='))).toBe(false);
  await page.getByRole("button", { name: /百团参展.*8 张照片/ }).click();
  expect(document.querySelectorAll('figure')).toHaveLength(6);
  expect([...document.querySelectorAll('figure img')].every(img => img.loading === "lazy")).toBe(true);
  await page.getByRole("button", { name: "加载更多照片（6 / 8）" }).click();
  expect(document.querySelectorAll('figure')).toHaveLength(8);
  expect(new Set([...document.querySelectorAll('figure img')].map(img => img.getAttribute('src'))).size).toBe(8);
  await expect.element(page.getByRole("button", { name: /加载更多/ })).not.toBeInTheDocument();
  await page.getByRole("button", { name: "返回相册" }).click();
  await page.getByRole("button", { name: /湘潭邦O.*1 张照片/ }).click();
  await expect.element(page.getByRole("heading", { name: "湘潭邦O" })).toBeVisible();
  expect(document.querySelectorAll('figure')).toHaveLength(1);
});

test("preview uses the full image, supports navigation, Escape and restores scrolling", async () => {
  await render(<CommunityPhotos photos={photos} />);
  await page.getByRole("button", { name: /百团参展/ }).click();
  await page.getByRole("button", { name: "放大查看：现场 1" }).click();
  const dialog = page.getByRole("dialog");
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByRole("img", { name: "现场 1", exact: true })).toHaveAttribute("src", expect.stringContaining("full=0"));
  expect(document.body.style.overflow).toBe("hidden");
  await expect.element(dialog.getByRole("button", { name: "上一张照片" })).toBeDisabled();
  await dialog.getByRole("button", { name: "下一张照片" }).click();
  await expect.element(dialog.getByRole("heading")).toHaveTextContent("现场 2");
  dialog.element().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  await expect.element(dialog.getByRole("heading")).toHaveTextContent("现场 1");
  dialog.element().dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  await expect.element(dialog.getByRole("heading")).toHaveTextContent("现场 2");
  await userEvent.keyboard("{Escape}");
  await expect.element(dialog).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("");
  await page.getByRole("button", { name: "放大查看：现场 6" }).click();
  await dialog.getByRole("button", { name: "下一张照片" }).click();
  await dialog.getByRole("button", { name: "下一张照片" }).click();
  await expect.element(dialog.getByRole("button", { name: "下一张照片" })).toBeDisabled();
  await dialog.getByRole("button", { name: "关闭图片预览" }).click();
  await expect.element(dialog).not.toBeInTheDocument();
});

test("legacy photos remain visible, failed images show a status, and empty albums are handled", async () => {
  const view = await render(<CommunityPhotos photos={[{ url: "/brand/kasumi.png" }]} />);
  await expect.element(page.getByRole("button", { name: "放大查看：活动返图 1" })).toBeVisible();
  const img = page.getByRole("img").element();
  await expect.poll(() => (img as HTMLImageElement).style.opacity).toBe("1");
  img.dispatchEvent(new Event("error"));
  await expect.element(page.getByRole("status")).toHaveTextContent("图片暂时无法加载");
  img.dispatchEvent(new Event("load"));
  await expect.element(page.getByRole("status")).not.toBeInTheDocument();
  await view.unmount();
  await render(<CommunityPhotos photos={[]} />);
  await expect.element(page.getByText("回忆，正在积累中。")).toBeVisible();
});

test("ungrouped photos get an album alongside named albums and preview cleanup restores the document", async () => {
  const view = await render(<CommunityPhotos photos={[other, { url: "/brand/kasumi.png" }]} />);
  await page.getByRole("button", { name: /活动返图.*1 张照片/ }).click();
  await page.getByRole("button", { name: "放大查看：活动返图 1" }).click();
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await view.unmount();
  expect(document.body.style.overflow).toBe("");
});
