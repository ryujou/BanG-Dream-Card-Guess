import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./config.js";

export const communityStorePath = path.join(dataDir, "community.json");

const defaultCommunityData = {
  aboutUs: "欢迎来到湘潭 BanG Dream! 同好会！我们是一群热爱 BanG Dream! 的玩家。这里是我们线下摊位活动和聚会的集合地。一起组卡、打歌、享受企划的魅力吧！",
  socialLinks: [
    { title: "B站官方账号", url: "https://space.bilibili.com/3546647883680530" },
    { title: "QQ群聊 (点击加入)", url: "https://jq.qq.com/?_wv=1027&k=YOUR_KEY" }
  ],
  members: [
    { name: "核心成员 A", desc: "主策划", url: "https://space.bilibili.com/478241946" },
    { name: "核心成员 B", desc: "技术支持", url: "https://space.bilibili.com/176287550" }
  ],
  events: [
    { title: "下次活动预告", date: "2026-10-01", location: "湘潭某漫展", desc: "届时我们将开设猜卡面摊位，欢迎大家来玩！" }
  ],
  photos: [],
  photoCaptions: [],
  bilibiliBvid: "",
  bilibiliCover: "",
  updatedAt: 0
};

let memoryCache: Record<string, unknown> | null = null;

export function readCommunityData() {
  if (memoryCache) return memoryCache;
  try {
    memoryCache = JSON.parse(readFileSync(communityStorePath, "utf-8"));
  } catch {
    memoryCache = { ...defaultCommunityData };
  }
  const cache = memoryCache as Record<string, unknown>;
  if (!Number.isFinite(Number(cache.updatedAt))) {
    cache.updatedAt = Date.now();
  }
  return cache;
}

export async function writeCommunityData(data: Record<string, unknown>) {
  memoryCache = { ...data, updatedAt: Date.now() };
  await mkdir(dataDir, { recursive: true });
  await writeFile(communityStorePath, JSON.stringify(memoryCache, null, 2));
}
