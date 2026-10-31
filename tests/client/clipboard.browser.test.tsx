import { afterEach, expect, test, vi } from "vitest";
import { copyText } from "../../src/client/lib/clipboard";
afterEach(() => vi.restoreAllMocks());

test("uses the clipboard API and propagates permission failures", async () => {
  const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  await copyText("房间邀请");
  expect(write).toHaveBeenCalledWith("房间邀请");
  write.mockRejectedValue(new Error("denied"));
  await expect(copyText("secret")).rejects.toThrow("denied");
});
test.each([true, false])("legacy clipboard result %s restores focus and removes temporary input", async success => {
  vi.spyOn(navigator, "clipboard", "get").mockReturnValue(undefined as unknown as Clipboard);
  const exec = vi.spyOn(document, "execCommand").mockReturnValue(success);
  const input = document.createElement("input");
  document.body.append(input); input.focus();
  try {
    if (success) await copyText("test");
    else await expect(copyText("test")).rejects.toThrow("复制失败");
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.activeElement).toBe(input);
    expect(document.querySelector("textarea")).toBeNull();
  } finally { input.remove(); }
});
