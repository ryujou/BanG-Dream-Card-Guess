<template>
  <main class="linktree-shell home-video-detail-page">
    <div class="home-video-detail-shell">
      <router-link class="home-video-back" to="/">← 返回首页</router-link>

      <template v-if="video && playerUrl">
        <h1 class="home-video-detail-title">{{ video.title }}</h1>
        <div class="home-video-detail-meta">
          <span>{{ video.author }}</span>
          <span>·</span>
          <span>{{ video.bvid }}</span>
          <span>·</span>
          <span>{{ video.meta }}</span>
        </div>

        <div class="home-video-action-row">
          <a class="home-video-action" :href="openUrl" target="_blank" rel="noreferrer">在 B 站打开</a>
          <span class="home-video-action is-muted">{{ video.views }}</span>
          <span class="home-video-action is-muted">{{ video.comments }}</span>
        </div>

        <div class="home-video-player-wrap">
          <iframe
            :src="playerUrl"
            :title="video.title || 'Bilibili Video'"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            referrerpolicy="no-referrer"
            loading="eager"
          />
        </div>
      </template>

      <section v-else class="home-video-missing">
        <h1>视频不存在或尚未公开</h1>
        <p>请从首页视频卡片重新进入。</p>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { allHomeMediaCards, type HomeMediaCard } from '../data/homeMedia';
import { buildBilibiliEmbedUrl, buildBilibiliVideoUrl, normalizeBvid } from '../utils/bilibili';

const route = useRoute();
const communityMediaCards = ref<HomeMediaCard[]>([]);
const routeId = computed(() => String(route.params.id || '').trim().toLowerCase());
const video = computed(() => {
  return [...communityMediaCards.value, ...allHomeMediaCards].find((item) => {
    if (!item.bvid) return false;
    return item.id.toLowerCase() === routeId.value || normalizeBvid(item.bvid).toLowerCase() === routeId.value;
  }) || null;
});

onMounted(async () => {
  try {
    const response = await fetch("/api/community", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return;
    const payload = await response.json();
    communityMediaCards.value = normalizeCommunityMediaCards(payload);
  } catch {
    communityMediaCards.value = [];
  }
});

function normalizeCommunityMediaCards(payload: unknown): HomeMediaCard[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as { featureMediaCards?: unknown; secondaryMediaCards?: unknown; mediaCards?: unknown };
  return [
    ...normalizeMediaCards(data.featureMediaCards),
    ...normalizeMediaCards(data.secondaryMediaCards),
    ...normalizeMediaCards(data.mediaCards),
  ];
}

function normalizeMediaCards(value: unknown): HomeMediaCard[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeMediaCard(item)).filter((item): item is HomeMediaCard => !!item);
}

function normalizeMediaCard(value: unknown): HomeMediaCard | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Record<keyof HomeMediaCard, unknown>>;
  const id = String(item.id || "").trim();
  const title = String(item.title || "").trim();
  const href = String(item.href || "").trim();
  const bvid = String(item.bvid || "").trim();
  if (!id || !title || !href || !bvid) return null;
  return {
    id,
    title,
    author: String(item.author || "").trim(),
    meta: String(item.meta || "").trim(),
    views: String(item.views || "").trim(),
    comments: String(item.comments || "").trim(),
    duration: String(item.duration || "").trim(),
    href,
    image: String(item.image || "").trim(),
    bvid,
  };
}
const playerUrl = computed(() => {
  if (!video.value?.bvid) return '';
  return buildBilibiliEmbedUrl({ bvid: video.value.bvid, autoplay: false, danmaku: false, highQuality: true });
});
const openUrl = computed(() => buildBilibiliVideoUrl({ bvid: video.value?.bvid }));
</script>
