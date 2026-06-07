import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./config.js";
import { defaultForumSections, featureMediaCards, secondaryMediaCards } from "../client/data/homeMedia.js";

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
  news: [
    { title: "同好会主页改版上线", date: "2026-06-06", category: "站务", desc: "首页新增黑红编辑部风格的信息流，用于集中展示活动公告、攻略与摊位动态。" },
    { title: "招募摊位协力与摄影返图", date: "2026-06-01", category: "活动", desc: "欢迎湘潭本地 BanG Dream! 玩家加入线下摊位协力、返图整理和小游戏测试。" }
  ],
  forumPosts: [
    { title: "新人入坑与本地群指路", author: "湘潭同好会", tag: "Q&A", replies: "12", excerpt: "想找同城玩家、线下活动或卡面猜谜玩法，可以从交流群和首页快捷入口开始。" },
    { title: "摊位猜卡面玩法反馈集中帖", author: "Booth Staff", tag: "Feedback", replies: "8", excerpt: "记录现场玩家反馈、题库难度建议与下一次活动想玩的曲目/企划内容。" }
  ],
  photos: [
    { url: "https://i.imgs.ovh/2026/05/09/28ca42c7af547a45325868fe99db8834.jpg", caption: "东门小辣椒猴山聚会" },
    { url: "https://i.imgs.ovh/2026/05/09/2bad39889fe9eddb581cf19eac74ccee.jpg", caption: "湘大社团百团大战" },
    { url: "https://i.imgs.ovh/2026/05/13/782915b8902b6b51c204cde7d6926fb7.jpg", caption: "万楼联合漫展" },
    { url: "https://i.imgs.ovh/2026/05/13/c5d4b911735e8f86263282076e840e5c.jpg", caption: "万楼联合漫展" }
  ],
  photoCaptions: [],
  bilibiliBvid: "BV1boSqBCErV",
  bilibiliCover: "https://i.imgs.ovh/2026/05/18/4cfccccfbab0880ca4d9cfb8dd686968.jpg",
  featureMediaCards,
  secondaryMediaCards,
  forumSections: defaultForumSections,
  updatedAt: 0
};

let memoryCache: Record<string, unknown> | null = null;

export function readCommunityData() {
  if (!memoryCache) {
    try {
      memoryCache = JSON.parse(readFileSync(communityStorePath, "utf-8"));
    } catch {
      memoryCache = { ...defaultCommunityData };
    }
  }
  const cache = memoryCache as Record<string, unknown>;
  if (!Array.isArray(cache.featureMediaCards)) {
    cache.featureMediaCards = Array.isArray(cache.mediaCards) ? cache.mediaCards : featureMediaCards;
  }
  if (!Array.isArray(cache.secondaryMediaCards)) {
    cache.secondaryMediaCards = secondaryMediaCards;
  }
  if (!Array.isArray(cache.forumSections)) {
    cache.forumSections = defaultForumSections;
  }
  if (!Number.isFinite(Number(cache.updatedAt))) {
    cache.updatedAt = Date.now();
  }
  return cache;
}
export async function writeCommunityData(data: Record<string, unknown>) {
  const nextData: Record<string, unknown> = { ...data };
  if (!Array.isArray(nextData.featureMediaCards) && Array.isArray(nextData.mediaCards)) {
    nextData.featureMediaCards = nextData.mediaCards;
  }
  if (!Array.isArray(nextData.featureMediaCards)) {
    nextData.featureMediaCards = featureMediaCards;
  }
  if (!Array.isArray(nextData.secondaryMediaCards)) {
    nextData.secondaryMediaCards = secondaryMediaCards;
  }
  if (!Array.isArray(nextData.forumSections)) {
    nextData.forumSections = defaultForumSections;
  }
  delete nextData.mediaCards;
  memoryCache = { ...nextData, updatedAt: Date.now() };
  await mkdir(dataDir, { recursive: true });
  await writeFile(communityStorePath, JSON.stringify(memoryCache, null, 2));
}
