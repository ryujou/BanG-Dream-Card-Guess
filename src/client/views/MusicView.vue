<template>
  <main class="linktree-shell forum-shell music-shell">
    <div class="gbc-home-layout forum-layout">
      <aside class="gbc-editorial-sidebar forum-sidebar" aria-label="音乐导航">
        <div class="gbc-sidebar-auth" aria-label="快捷入口">
          <router-link to="/">首页</router-link>
          <router-link to="/community-admin">后台</router-link>
        </div>

        <div class="gbc-brand" aria-label="BangDream 音乐">
          <p class="gbc-brand-kicker">Music Room</p>
          <strong>Band</strong>
          <strong>Live</strong>
          <span class="gbc-brand-subtitle">Videos / Live / Covers</span>
        </div>

        <p class="gbc-quote">视频、翻唱、Live 回顾和活动影像集中入口。</p>

        <nav class="gbc-nav-stack" aria-label="音乐页面链接">
          <router-link class="gbc-nav-item" to="/">Home</router-link>
          <router-link class="gbc-nav-item" to="/feed">动态</router-link>
          <router-link class="gbc-nav-item" to="/forum">广场</router-link>
          <router-link class="gbc-nav-item" to="/music">音乐</router-link>
        </nav>

        <div class="gbc-sidebar-actions" aria-label="社区链接">
          <a :href="COMMUNITY_URL" target="_blank" rel="noreferrer">加入官方交流群</a>
          <a href="https://space.bilibili.com/478241946" target="_blank" rel="noreferrer">B 站空间</a>
        </div>
      </aside>

      <section class="gbc-content-stage forum-stage" aria-label="音乐与视频内容">
        <div class="gbc-version-strip forum-version-strip">
          <span>MUSIC</span>
          <strong>{{ cards.length }} 条媒体内容 · Bilibili / 活动 / 小游戏</strong>
        </div>

        <div class="linktree-container gbc-hero-card forum-board music-board">
          <header class="linktree-header forum-board-header">
            <p class="gbc-section-label">BangDream Media Library</p>
            <h1 class="linktree-title">音乐与视频</h1>
            <p class="linktree-bio">复刻参考站“音乐”入口的媒体库，用后台 featureMediaCards / secondaryMediaCards 驱动，B 站视频进入站内播放页。</p>
            <div class="forum-header-actions" aria-label="音乐操作">
              <router-link class="home-forum-admin-link" to="/">返回首页</router-link>
              <router-link class="home-forum-admin-link" to="/community-admin">编辑媒体</router-link>
            </div>
          </header>

          <section class="music-feature-grid" aria-label="媒体卡片">
            <a v-for="card in cards" :key="card.id" class="home-video-card music-video-card" :href="card.href" :target="isExternalHref(card.href) ? '_blank' : undefined" :rel="isExternalHref(card.href) ? 'noreferrer' : undefined">
              <div class="home-video-thumb">
                <img v-if="card.image" :src="card.image" :alt="card.title" loading="lazy" />
                <span v-else>NO COVER</span>
                <b>{{ card.duration }}</b>
              </div>
              <div class="home-video-info">
                <h4>{{ card.title }}</h4>
                <p>{{ card.author }} · {{ card.meta }}</p>
                <small>{{ card.views }}　{{ card.comments }}</small>
              </div>
            </a>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { featureMediaCards, secondaryMediaCards, type HomeMediaCard } from '../data/homeMedia';

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";
const communityCards = ref<HomeMediaCard[]>([]);
const cards = computed(() => communityCards.value.length ? communityCards.value : [...featureMediaCards, ...secondaryMediaCards]);

onMounted(async () => {
  try {
    const response = await fetch("/api/community", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return;
    const payload = await response.json();
    communityCards.value = [
      ...normalizeCards(payload.featureMediaCards),
      ...normalizeCards(payload.secondaryMediaCards),
      ...normalizeCards(payload.mediaCards),
    ];
  } catch {
    communityCards.value = [];
  }
});

function normalizeCards(value: unknown): HomeMediaCard[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeCard(item)).filter((item): item is HomeMediaCard => !!item);
}

function normalizeCard(value: unknown): HomeMediaCard | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Record<keyof HomeMediaCard, unknown>>;
  const id = String(record.id || "").trim();
  const title = String(record.title || "").trim();
  const href = String(record.href || "").trim();
  if (!id || !title || !href) return null;
  const card: HomeMediaCard = {
    id,
    title,
    author: String(record.author || "").trim(),
    meta: String(record.meta || "").trim(),
    views: String(record.views || "").trim(),
    comments: String(record.comments || "").trim(),
    duration: String(record.duration || "").trim(),
    href,
    image: String(record.image || "").trim(),
  };
  const bvid = String(record.bvid || "").trim();
  if (bvid) card.bvid = bvid;
  return card;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
</script>
