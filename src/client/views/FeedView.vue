<template>
  <main class="linktree-shell forum-shell feed-shell">
    <div class="gbc-home-layout forum-layout">
      <aside class="gbc-editorial-sidebar forum-sidebar" aria-label="动态导航">
        <div class="gbc-sidebar-auth" aria-label="快捷入口">
          <router-link to="/">首页</router-link>
          <router-link to="/community-admin">后台</router-link>
        </div>

        <div class="gbc-brand" aria-label="BangDream 动态">
          <p class="gbc-brand-kicker">Community Feed</p>
          <strong>News</strong>
          <strong>Live</strong>
          <span class="gbc-brand-subtitle">BangDream / 湘潭同好会</span>
        </div>

        <p class="gbc-quote">公告、返图、活动预告和内容更新集中显示。</p>

        <nav class="gbc-nav-stack" aria-label="动态页面链接">
          <router-link class="gbc-nav-item" to="/">Home</router-link>
          <router-link class="gbc-nav-item" to="/feed">动态</router-link>
          <router-link class="gbc-nav-item" to="/forum">广场</router-link>
          <router-link class="gbc-nav-item" to="/music">音乐</router-link>
        </nav>

        <div class="gbc-sidebar-actions" aria-label="社区链接">
          <a :href="COMMUNITY_URL" target="_blank" rel="noreferrer">加入官方交流群</a>
          <router-link to="/community-admin">编辑动态</router-link>
        </div>
      </aside>

      <section class="gbc-content-stage forum-stage" aria-label="同好会动态">
        <div class="gbc-version-strip forum-version-strip">
          <span>FEED</span>
          <strong>{{ feedStatus }}</strong>
        </div>

        <div class="linktree-container gbc-hero-card forum-board feed-board">
          <header class="linktree-header forum-board-header">
            <p class="gbc-section-label">BangDream Activity Timeline</p>
            <h1 class="linktree-title">同好会动态</h1>
            <p class="linktree-bio">像参考站“动态”一样聚合同好会公告、近期活动和返图。内容来自后台 /api/community。</p>
            <div class="forum-header-actions" aria-label="动态操作">
              <router-link class="home-forum-admin-link" to="/">返回首页</router-link>
              <router-link class="home-forum-admin-link" to="/forum">进入广场</router-link>
            </div>
          </header>

          <section class="feed-timeline" aria-label="动态列表">
            <article v-for="item in feedItems" :key="item.id" class="feed-item-card">
              <div class="feed-item-marker">{{ item.type }}</div>
              <div class="feed-item-body">
                <div class="feed-item-meta">
                  <span>{{ item.category }}</span>
                  <small>{{ item.date }}</small>
                </div>
                <h2>{{ item.title }}</h2>
                <p>{{ item.desc }}</p>
                <a v-if="item.href" :href="resolveHref(item.href)" :target="isExternalHref(resolveHref(item.href)) ? '_blank' : undefined" :rel="isExternalHref(resolveHref(item.href)) ? 'noreferrer' : undefined">查看详情</a>
              </div>
              <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
            </article>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { PUBLIC_ACTIVITY_PHOTOS } from '../data/homeMedia';
import { safeUrl } from '../utils/image';

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";

interface FeedItem {
  id: string;
  type: string;
  category: string;
  title: string;
  date: string;
  desc: string;
  href: string;
  image: string;
}

const communityData = ref<Record<string, unknown>>({});
const feedItems = computed(() => buildFeedItems(communityData.value));
const feedStatus = computed(() => `${feedItems.value.length} 条动态 · 湘潭 BanG Dream! 同好会`);

onMounted(async () => {
  try {
    const response = await fetch("/api/community", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/json")) {
      communityData.value = await response.json();
    }
  } catch {
    communityData.value = {};
  }
});

function buildFeedItems(data: Record<string, unknown>): FeedItem[] {
  const items: FeedItem[] = [];
  normalizeNews(data.news).forEach((item, index) => {
    items.push({ id: `news-${index}`, type: "NEWS", ...item });
  });
  normalizeEvents(data.events).forEach((item, index) => {
    items.push({ id: `event-${index}`, type: "EVENT", ...item });
  });
  normalizePhotos(data.photos).forEach((item, index) => {
    items.push({
      id: `photo-${index}`,
      type: "PHOTO",
      category: "返图",
      title: item.caption || "湘潭 BanG Dream! 同好会活动返图",
      date: "最近活动",
      desc: "来自公开活动相册，可在后台继续添加和排序。",
      href: item.url,
      image: item.url,
    });
  });
  if (items.length) return items;
  return [
    {
      id: "fallback-news",
      type: "NEWS",
      category: "站务",
      title: "同好会主页改版上线",
      date: "2026-06-06",
      desc: "首页、广场、动态和音乐入口已切换到黑红编辑部风格。",
      href: "/forum",
      image: PUBLIC_ACTIVITY_PHOTOS[0]?.url || "",
    },
  ];
}

function normalizeNews(value: unknown): Omit<FeedItem, "id" | "type">[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    const title = String(record.title || "").trim();
    if (!title) return null;
    return {
      category: String(record.category || "NEWS").trim(),
      title,
      date: String(record.date || "待更新").trim(),
      desc: String(record.desc || record.excerpt || "").trim(),
      href: String(record.url || record.href || "/forum").trim(),
      image: String(record.image || "").trim(),
    };
  }).filter((item): item is Omit<FeedItem, "id" | "type"> => !!item);
}

function normalizeEvents(value: unknown): Omit<FeedItem, "id" | "type">[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = asRecord(item);
    const title = String(record.title || "").trim();
    if (!title) return null;
    return {
      category: "活动",
      title,
      date: String(record.date || "待更新").trim(),
      desc: String(record.desc || "").trim(),
      href: COMMUNITY_URL,
      image: "",
    };
  }).filter((item): item is Omit<FeedItem, "id" | "type"> => !!item);
}

function normalizePhotos(value: unknown): Array<{ url: string; caption: string }> {
  const source = Array.isArray(value) && value.length ? value : PUBLIC_ACTIVITY_PHOTOS;
  return source.map((item) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      return { url: String(record.url || "").trim(), caption: String(record.caption || "").trim() };
    }
    return { url: String(item || "").trim(), caption: "" };
  }).filter((item) => item.url);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function resolveHref(raw: string): string {
  const value = raw.trim();
  if (!value) return COMMUNITY_URL;
  if (value.startsWith("/") || value.startsWith("#")) return value;
  return safeUrl(value);
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
</script>
