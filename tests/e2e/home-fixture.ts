import type { Page } from "@playwright/test";

export const HOME_THEME_CASES = [
  { id: "bangdream", url: "/", label: "BanG Dream!", brand: "BanG Dream!", color: "rgb(159, 25, 30)", accent: "#9f191e", hover: "rgb(133, 21, 25)", pressed: "rgb(107, 17, 20)", hero: "/brand/kasumi.png", cursor: "/brand/cursor/kasumi.webp", mascot: "/brand/cursor/michelle.webp", pointer: "/brand/cursor/kasumi-pointer.png", hoverPointer: "/brand/cursor/kasumi-pointer-hover.png", groupUrl: "https://qm.qq.com/q/6ytGE7qIWQ" },
  { id: "sekai", url: "/?theme=sekai", label: "世界计划", brand: "世界计划", color: "rgb(0, 65, 144)", accent: "#004190", hover: "rgb(0, 53, 118)", pressed: "rgb(0, 41, 92)", hero: "/brand/miku-sekai.webp", cursor: "/brand/cursor/miku.webp", mascot: "/brand/cursor/tofu.webp", pointer: "/brand/cursor/miku-pointer.png", hoverPointer: "/brand/cursor/miku-pointer-hover.png", groupUrl: "https://qm.qq.com/q/EF4FxmYc6W" },
  { id: "bluearchive", url: "/?theme=bluearchive", label: "蔚蓝档案", brand: "蔚蓝档案", color: "rgb(29, 102, 237)", accent: "#1d66ed", hover: "rgb(21, 84, 200)", pressed: "rgb(16, 69, 166)", hero: "/brand/hero/bluearchive/shiroko.webp", cursor: "/brand/bluearchive/minichara.png", mascot: "/brand/bluearchive/fish.png", pointer: "/brand/bluearchive/mouse-icon.webp", hoverPointer: "/brand/bluearchive/mouse-icon_hover.png", groupUrl: "https://qm.qq.com/q/2ZMcajVnaw" },
] as const;

export const normalizeHomeCopy = (text: string) => text
  .replaceAll("一起聊剧情、玩游戏", "一起聊音乐、玩游戏")
  .replaceAll("故事让我们相遇！", "音乐让我们相遇！")
  .replaceAll("故事，连接着我们。", "音乐，连接着我们。")
  .replaceAll("在这里，我们聊剧情、玩游戏、分享喜欢的一切，也期待与你在湘潭相遇。", "在这里，我们聊音乐、玩游戏、分享喜欢的一切，也期待与你在湘潭相遇。")
  .replaceAll("在这里，我们聊剧情、玩游戏、分享基沃托斯的故事，也期待与你在湘潭相遇。", "在这里，我们聊音乐、玩游戏、分享喜欢的一切，也期待与你在湘潭相遇。")
  .replaceAll("OUR STORIES CONNECT US", "MUSIC CONNECTS PEOPLE")
  .replaceAll("Stories for", "Music for")
  .replaceAll("在基沃托斯相遇，开启更多有趣的挑战。", "音乐不止于聆听，还有更多有趣的玩法。")
  .replaceAll("PLAY\nSTORIES\nTOGETHER", "PLAY\nMUSIC\nTOGETHER")
  .replaceAll("因为热爱，让湘潭的我们相遇。", "因为音乐，让湘潭的我们相遇。")
  .replaceAll("白子的战术训练", "跟随节奏，击中音符")
  .replaceAll("阿洛娜的计时课堂", "考验你的反应速度")
  .replaceAll("帮助学生解开谜题", "移动方块，解开谜题")
  .replaceAll("白子陪你挑战高分！", "用节奏，击穿高分！")
  .replaceAll("老师，抓住这一刻！", "极限一秒，挑战自我！")
  .replaceAll("星野陪你找到出口！", "开动脑筋，完成挑战！")
  .replace(/^BLUE\n/, "LIVE\n")
  .replaceAll("邦邦猜卡", "品牌猜图").replaceAll("世界计划猜卡", "品牌猜图").replaceAll("BA 猜图", "品牌猜图").replaceAll("开始猜图", "开始猜卡")
  .replaceAll("邦邦人", "品牌同好").replaceAll("世界计划同好", "品牌同好").replaceAll("蔚蓝档案同好", "品牌同好")
  .replaceAll("QQ 群：1030720768", "一起聊音乐、一起玩").replaceAll("QQ 群：544353386", "一起聊音乐、一起玩")
  .replaceAll("BanG Dream!", "品牌").replaceAll("BANG DREAM!", "品牌").replaceAll("PROJECT SEKAI", "品牌").replaceAll("BLUE ARCHIVE", "品牌")
  .replaceAll("世界计划", "品牌").replaceAll("蔚蓝档案", "品牌");

export async function sharedHomeCopy(page: Page) {
  let text = await page.locator("main").innerText();
  const mooncake = page.locator('[class*="homeGames"] > div').filter({ has: page.locator('a[href^="/games/ba-mooncake"]') });
  // The BA-only card has its own content and layout assertions.
  if (await mooncake.count()) text = text.replace(await mooncake.innerText(), "");
  return normalizeHomeCopy(text).replace(/\n{2,}/g, "\n");
}

export const HOME_CONTENT = {
  aboutUs: "在这里，我们聊音乐、玩游戏、分享喜欢的一切，也期待与你在湘潭相遇。",
  socialLinks: [],
  members: [{ name: "小星", desc: "一起聊音乐", url: "" }, { name: "小音", desc: "一起玩游戏", url: "" }],
  events: [{ title: "同好音乐聚会", date: "2026-01-01", location: "湘潭", desc: "音乐让我们相遇。" }],
  photos: [{ url: "/brand/film-live-stage.jpg", title: "演出回忆" }],
  bilibili: [{ bvid: "BV1HP4y1R73q", title: "CiRCLE THANKS MUSiC♪", cover: "/brand/film-live-stage.jpg" }],
};

export async function stubHomeContent(page: Page) {
  await page.route("**/api/community", route => route.fulfill({ json: HOME_CONTENT }));
  await page.route("https://player.bilibili.com/**", route => route.fulfill({ contentType: "text/html", body: "Video player fixture" }));
}
