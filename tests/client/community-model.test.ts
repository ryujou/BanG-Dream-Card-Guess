import { describe, expect, it } from "vitest";
import { communityError, communityThumbnail, isPastEvent, moveCommunityItem, normalizeCommunity, safeCommunityLink } from "../../src/client/features/community/model";
import { countryName, regionName } from "../../src/client/features/stats/model";

describe("community content rules", () => {
  it("accepts legacy photo strings without mutating editor input", () => {
    const original = { aboutUs: "同好会", members: [], events: [], socialLinks: [], photos: ["/legacy.jpg", { url: "/photo.jpg", title: "原标题" }] };
    const value = normalizeCommunity(original);
    expect(value.photos).toEqual([{ url: "/legacy.jpg", title: "", desc: "" }, { url: "/photo.jpg", title: "原标题" }]);
    expect(value.bilibili).toEqual([]);
    value.photos[1].title = "编辑后的标题";
    expect(original.photos[1]).toEqual({ url: "/photo.jpg", title: "原标题" });
  });
  it("moves only the selected member and preserves the original collection", () => {
    const original = ["香澄", "有咲", "沙绫"];
    expect(moveCommunityItem(original, 2, -1)).toEqual(["香澄", "沙绫", "有咲"]);
    expect(moveCommunityItem(original, 0, 1)).toEqual(["有咲", "香澄", "沙绫"]);
    expect(original).toEqual(["香澄", "有咲", "沙绫"]);
  });
  it.each(["javascript:alert(1)", "data:text/html,content", "file:///secret", "ftp://example.test", "http://[", " "])("does not expose an unsafe or empty link: %s", value => {
    expect(safeCommunityLink(value, "https://site.test")).toBe("");
  });
  it("resolves local images and HTTPS links for the current origin", () => {
    expect(safeCommunityLink("/uploads/photo.png", "https://site.test")).toBe("https://site.test/uploads/photo.png");
    expect(safeCommunityLink("https://other.test/event", "https://site.test")).toBe("https://other.test/event");
  });
  it("uses the Shanghai calendar date when deciding whether an event is past", () => {
    const now = new Date("2026-10-30T16:05:00Z");
    expect(isPastEvent("2026-10-30", now)).toBe(true);
    expect(isPastEvent("2026-10-31", now)).toBe(false);
    expect(isPastEvent("2026-11-1", now)).toBe(false);
    expect(isPastEvent("待定", now)).toBe(false);
  });
  it("uses existing thumbnails only for the bundled community images", () => {
    expect(communityThumbnail("/community/photos/photo-2.jpg")).toBe("/community/photos/photo-2-thumb.webp");
    expect(communityThumbnail("/community/bilibili-cover.jpg")).toBe("/community/bilibili-cover-thumb.webp");
    expect(communityThumbnail("/uploads/new.jpg")).toBe("/uploads/new.jpg");
    expect(communityError(new Error("保存失败"))).toBe("保存失败");
    expect(communityError(null)).toBe("请求失败，请稍后再试。");
  });
});

describe("statistics geography labels", () => {
  it("keeps server labels and translates ISO country/province codes", () => {
    expect(countryName({ code: "cn", name: "cn", count: 2 })).toBe("中国");
    expect(countryName({ code: "US", name: "美国访客", count: 2 })).toBe("美国访客");
    expect(countryName({ code: "?", name: "", count: 1 })).toBe("?");
    expect(regionName({ code: "CN-HN", name: "CN-HN", count: 5 })).toBe("湖南");
    expect(regionName({ code: "US-CA", name: "", count: 3 })).toBe("美国 · CA");
    expect(regionName({ code: "CN-HN", name: "湖南省", count: 5 })).toBe("湖南省");
    expect(regionName({ code: "unlisted", name: "", count: 1 })).toBe("unlisted");
  });
});
