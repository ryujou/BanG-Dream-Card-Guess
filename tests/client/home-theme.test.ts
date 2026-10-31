import { describe, expect, it } from "vitest";
import path from "node:path";
import sharp from "sharp";
import { HERO_CHARACTERS, HOME_THEMES, buildHomeThemeSearch, communityThemeIntro, homeThemeStyle, resolveHomeTheme, staticCharacterStyle, themeHref } from "../../src/client/lib/home-theme";

describe("首页地址约定", () => {
  it("游戏链接保留房间、锚点和主题，加群链接各自独立", () => {
    expect(themeHref("/solo", "sekai")).toBe("/solo?theme=sekai");
    expect(themeHref("/host?room=ABC123#settings", "sekai")).toBe("/host?room=ABC123&theme=sekai#settings");
    expect(themeHref("/games?theme=sekai", "bangdream")).toBe("/games");
    expect(HOME_THEMES.sekai.communityUrl).toBe("https://qm.qq.com/q/EF4FxmYc6W");
    expect(HOME_THEMES.bangdream.communityUrl).toBe("https://qm.qq.com/q/6ytGE7qIWQ");
    expect(HOME_THEMES.bluearchive.communityUrl).toBe("https://qm.qq.com/q/2ZMcajVnaw");
    expect(HOME_THEMES.bluearchive.communityGroup).toBe("544353386");
    expect(themeHref("/host?room=ABC123&theme=sekai#settings", "bluearchive")).toBe("/host?room=ABC123&theme=bluearchive#settings");
    expect(themeHref("/games?theme=bluearchive", "bangdream")).toBe("/games");
  });
  it.each(["", "?room=ABC123", "?theme=", "?theme=unknown", "?theme=bangdream"])("默认红色 %s", search => {
    expect(resolveHomeTheme(search)).toBe("bangdream");
  });
  it.each(["?theme=sekai", "?room=ABC123&theme=sekai", "?theme=sekai&room=ABC123"])("识别蓝色 %s", search => {
    expect(resolveHomeTheme(search)).toBe("sekai");
  });
  it.each(["?theme=bluearchive", "?room=ABC123&theme=bluearchive", "?theme=bluearchive&room=ABC123"])("识别蔚蓝档案 %s", search => {
    expect(resolveHomeTheme(search)).toBe("bluearchive");
  });
  it("设置、更新和删除主题，不丢失其他参数", () => {
    expect(buildHomeThemeSearch("", "sekai")).toBe("?theme=sekai");
    expect(buildHomeThemeSearch("?theme=invalid", "sekai")).toBe("?theme=sekai");
    expect(buildHomeThemeSearch("?theme=sekai", "bangdream")).toBe("");
    expect(buildHomeThemeSearch("", "bangdream")).toBe("");
    expect(buildHomeThemeSearch("?room=ABC123&theme=sekai", "bangdream")).toBe("?room=ABC123");
    expect(buildHomeThemeSearch("?room=ABC123", "sekai")).toBe("?room=ABC123&theme=sekai");
    expect(buildHomeThemeSearch("?theme=sekai&theme=sekai", "bangdream")).toBe("");
    expect(buildHomeThemeSearch("?room=ABC123&theme=sekai&theme=bluearchive", "bluearchive")).toBe("?room=ABC123&theme=bluearchive");
    expect(buildHomeThemeSearch("?theme=bluearchive", "sekai")).toBe("?theme=sekai");
  });
  it("中文、空格、加号和重复参数往返保持值", () => {
    const original = "?q=%E5%88%9D%E9%9F%B3+%2B+live&tag=one&tag=two";
    const blue = buildHomeThemeSearch(original, "sekai");
    const archive = buildHomeThemeSearch(blue, "bluearchive");
    const red = buildHomeThemeSearch(archive, "bangdream");
    expect(new URLSearchParams(red).get("q")).toBe("初音 + live");
    expect(new URLSearchParams(red).getAll("tag")).toEqual(["one", "two"]);
  });
});

describe("已确认的主题与素材", () => {
  it("70 位不同角色均有可解码的透明游戏立绘", async () => {
    expect(Object.values(HERO_CHARACTERS).map(characters => characters.length)).toEqual([20, 26, 24]);
    for (const characters of Object.values(HERO_CHARACTERS)) {
      expect(new Set(characters.map(character => character.alt)).size).toBe(characters.length);
      expect(new Set(characters.map(character => character.src)).size).toBe(characters.length);
      for (const character of characters) {
        const meta = await sharp(path.join(process.cwd(), "public", character.src)).metadata();
        expect(meta.hasAlpha, character.alt).toBe(true);
        expect(meta.height, character.alt).toBeGreaterThan(700);
        expect(character.left + character.width / 2).toBeGreaterThan(300);
        expect(character.left + character.width / 2).toBeLessThan(400);
      }
    }
  });
  it("共用社团介绍按主题展示，保留原始内容和其他文字", () => {
    const original = "欢迎来到湘潭 BanG Dream! 同好会！一起聊 BanG Dream!，遇见邦邦人，参加邦邦聚会。";
    expect(communityThemeIntro(original, "sekai")).toBe("欢迎来到湘潭 世界计划 同好会！一起聊 世界计划，遇见世界计划同好，参加世界计划聚会。");
    expect(communityThemeIntro(original, "bangdream")).toBe(original);
    expect(communityThemeIntro(original, "bluearchive")).toBe("欢迎来到湘潭 蔚蓝档案 同好会！一起聊 蔚蓝档案，遇见蔚蓝档案同好，参加蔚蓝档案聚会。");
  });
  it("校色、鼠标伙伴及静态构图来自同一配置", () => {
    expect(HOME_THEMES.bangdream.colors.accent).toBe("#9F191E");
    expect(HOME_THEMES.sekai.colors.accent).toBe("#004190");
    expect(HOME_THEMES.bluearchive.colors.accent).toBe("#1D66ED");
    expect(HOME_THEMES.bluearchive.wordmark).toBe("BLUE ARCHIVE");
    expect(HOME_THEMES.bangdream.cursor).toEqual({ main: "/brand/cursor/kasumi.webp", mascot: "/brand/cursor/michelle.webp" });
    expect(HOME_THEMES.sekai.cursor).toEqual({ main: "/brand/cursor/miku.webp", mascot: "/brand/cursor/tofu.webp" });
    expect(HOME_THEMES.bluearchive.cursor).toEqual({ main: "/brand/bluearchive/minichara.png", mascot: "/brand/bluearchive/fish.png" });
    expect(new Set(Object.values(HOME_THEMES).map(theme => theme.character.src)).size).toBe(3);
    for (const theme of Object.values(HOME_THEMES)) {
      expect(homeThemeStyle(theme)).toHaveProperty("--home-accent", theme.colors.accent);
      expect(theme.particles).toContain(theme.colors.accent);
      const style = staticCharacterStyle(theme.character);
      expect(parseFloat(String(style.width)) / 100 * 700).toBeCloseTo(theme.character.width);
      expect(parseFloat(String(style.height)) / 100 * 650).toBeCloseTo(theme.character.height);
      expect(parseFloat(String(style.left)) / 100 * 700).toBeCloseTo(theme.character.left);
      expect(parseFloat(String(style.top)) / 100 * 650).toBeCloseTo(theme.character.top);
    }
  });
  it("人物与鼠标资源真实可解码，保留透明背景", async () => {
    const pointers = {
      bangdream: ["/brand/cursor/kasumi-pointer.png", "/brand/cursor/kasumi-pointer-hover.png"],
      sekai: ["/brand/cursor/miku-pointer.png", "/brand/cursor/miku-pointer-hover.png"],
      bluearchive: ["/brand/bluearchive/mouse-icon.webp", "/brand/bluearchive/mouse-icon_hover.png"],
    };
    for (const id of Object.keys(HOME_THEMES) as (keyof typeof HOME_THEMES)[]) {
      const theme = HOME_THEMES[id];
      const files = [theme.character.src, theme.cursor.main, theme.cursor.mascot, ...pointers[id]];
      for (const file of files) {
        const image = sharp(path.join(process.cwd(), "public", file));
        const meta = await image.metadata();
        expect(meta.width).toBeGreaterThan(0);
        expect(meta.hasAlpha).toBe(true);
        const stats = await image.stats();
        expect(stats.isOpaque).toBe(false);
      }
    }
  });
});
