import { describe, expect, it } from "vitest";
import { buildBilibiliEmbedUrl, buildBilibiliVideoUrl, isMobileBrowser, normalizeBvid, pickBilibiliCover } from "../../../src/client/utils/bilibili";

describe("Bilibili utils", () => {
  it("uses classic desktop player by default and keeps bvid priority", () => {
    const url = buildBilibiliEmbedUrl({
      bvid: "BV1GJ411x7h7",
      aid: "123456",
      autoplay: false,
      danmaku: false,
    });
    expect(url.startsWith("https://player.bilibili.com/player.html?")).toBe(true);
    expect(url).toContain("bvid=BV1GJ411x7h7");
    expect(url).not.toContain("aid=123456");
  });

  it("does not include cid/page undefined and encodes boolean flags", () => {
    const url = buildBilibiliEmbedUrl({
      bvid: "BV1GJ411x7h7",
      autoplay: false,
      danmaku: false,
    });
    expect(url).not.toContain("cid=undefined");
    expect(url).not.toContain("page=undefined");
    expect(url).toContain("autoplay=0");
    expect(url).toContain("danmaku=0");
  });

  it("builds bvid and aid open links", () => {
    expect(buildBilibiliVideoUrl({ bvid: "BV1GJ411x7h7" })).toBe("https://www.bilibili.com/video/BV1GJ411x7h7");
    expect(buildBilibiliVideoUrl({ aid: "12345" })).toBe("https://www.bilibili.com/video/av12345");
  });

  it("detects mobile UA and does not require window/navigator", () => {
    expect(isMobileBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(false);
    expect(() => isMobileBrowser(undefined)).not.toThrow();
  });

  it("picks cover in priority order", () => {
    expect(pickBilibiliCover({ poster: "poster.jpg", cover: "cover.jpg" })).toBe("cover.jpg");
    expect(pickBilibiliCover({ thumbnail: "thumb.jpg", pic: "pic.jpg" })).toBe("thumb.jpg");
    expect(pickBilibiliCover({})).toBe("");
  });

  it("normalizes bvid safely", () => {
    expect(normalizeBvid("1GJ411x7h7")).toBe("BV1GJ411x7h7");
    expect(normalizeBvid("invalid")).toBe("");
  });

  it("can switch to minimalist player url when minimal mode is enabled", () => {
    const url = buildBilibiliEmbedUrl({ bvid: "BV1GJ411x7h7", minimalMode: true });
    expect(url.startsWith("https://www.bilibili.com/blackboard/html5mobileplayer.html?")).toBe(true);
    expect(url).toContain("hideCoverInfo=1");
  });
});
