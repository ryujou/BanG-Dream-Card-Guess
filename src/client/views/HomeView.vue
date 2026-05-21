<template>
  <main class="linktree-shell">
    <img
      v-if="leftStandeeUrl"
      class="side-standee side-standee-left"
      :src="leftStandeeUrl"
      alt=""
      loading="eager"
      decoding="async"
    />
    <img
      v-if="rightStandeeUrl"
      class="side-standee side-standee-right"
      :src="rightStandeeUrl"
      alt=""
      loading="eager"
      decoding="async"
    />
    <div class="linktree-container">
      <header class="linktree-header">
        <div class="linktree-icon-grid">
          <img class="linktree-avatar" src="/icon5.png" alt="湘江 BanG Dream! 同好会" />
          <img class="linktree-avatar" src="/icon4.png" alt="湘江 BanG Dream! 同好会图标" />
          <img class="linktree-avatar" src="/icon3.png" alt="湘江 BanG Dream! 同好会图标" />
        </div>
        <h1 class="linktree-title">湘江 BanG Dream! 同好会</h1>
        <p v-if="data.aboutUs" class="linktree-bio">{{ data.aboutUs }}</p>
        <p v-else class="linktree-bio">线下摊位互动、同好聚会与游戏现场。</p>
      </header>

      <section class="linktree-links linktree-hero-links">
        <router-link class="linktree-pill primary-pill cta-main" to="/player">
          <span class="pill-icon">🎮</span>
          <span class="pill-text">进入猜卡游戏（玩家页）</span>
        </router-link>
        <a class="linktree-pill highlight-pill cta-join" :href="COMMUNITY_URL" target="_blank" rel="noreferrer">
          <span class="pill-icon">💬</span>
          <span class="pill-text">点击加入官方交流群</span>
        </a>
        <router-link class="linktree-pill" to="/host">
          <span class="pill-icon">🧑‍💼</span>
          <span class="pill-text">游戏控制台（主持页）</span>
        </router-link>
        <router-link class="linktree-pill" to="/note-shooter">
          <span class="pill-icon">🎵</span>
          <span class="pill-text">打发时间：音符射手</span>
        </router-link>
        <router-link class="linktree-pill" to="/games/stopwatch-challenge">
          <span class="pill-icon">⏱️</span>
          <span class="pill-text">秒表挑战</span>
        </router-link>
        <router-link class="linktree-pill" to="/games/bang-klotski">
          <span class="pill-icon">🧩</span>
          <span class="pill-text">华容道小游戏</span>
        </router-link>
        <a class="linktree-pill" href="https://enldm.cyou/bangmap" target="_blank" rel="noreferrer">
          <span class="pill-icon">🗺️</span>
          <span class="pill-text">BanG Map 同好会地图</span>
        </a>
        <router-link class="linktree-pill" to="/stats">
          <span class="pill-icon">🗺️</span>
          <span class="pill-text">查看访问来源地图</span>
        </router-link>
      </section>

      <section v-if="data.socialLinks && data.socialLinks.length" class="linktree-section">
        <h2>更多平台</h2>
        <div class="linktree-links">
          <a v-for="(link, i) in data.socialLinks" :key="i" class="linktree-pill" :href="safeUrl(link.url)" target="_blank" rel="noreferrer">
            <span class="pill-text">{{ link.title }}</span>
          </a>
        </div>
      </section>

      <section v-if="data.members && data.members.length" class="linktree-section">
        <h2>成员介绍</h2>
        <div class="linktree-members">
          <a v-for="(m, i) in data.members" :key="i" class="member-pill" :href="safeUrl(m.url)" target="_blank" rel="noreferrer">
            <img v-if="m.avatar" class="member-avatar" :src="versionedUrl(m.avatar)" :alt="`${m.name || '成员'} 头像`" loading="lazy" />
            <strong>{{ m.name }}</strong>
            <span>{{ m.desc }}</span>
          </a>
        </div>
      </section>

      <section v-if="data.events && data.events.length" class="linktree-section">
        <h2>近期活动</h2>
        <div class="linktree-events">
          <div v-for="(e, i) in data.events" :key="i" class="event-box">
            <div class="event-box-header">
              <span class="event-date">{{ e.date }}</span>
              <span class="event-location">{{ e.location }}</span>
            </div>
            <strong>{{ e.title }}</strong>
            <p>{{ e.desc }}</p>
          </div>
        </div>
      </section>

      <section v-if="(data.photos && data.photos.length) || bilibiliPlayerUrl" class="linktree-section">
        <h2>活动回顾</h2>
        <div v-if="versionedPhotos.length" class="linktree-gallery-carousel">
          <div class="linktree-gallery-track" :style="trackStyle">
            <img v-for="(p, i) in versionedPhotos" :key="`${p}-${i}`" :src="p" alt="活动照片" loading="lazy" />
          </div>
          <div class="linktree-gallery-overlay">
            <p v-if="activePhotoCaption" class="linktree-gallery-caption">{{ activePhotoCaption }}</p>
            <div v-if="versionedPhotos.length > 1" class="linktree-gallery-dots">
              <button
                v-for="(_, i) in versionedPhotos"
                :key="i"
                type="button"
                :class="['dot', { active: i === photoIndex }]"
                :aria-label="`查看第 ${i + 1} 张活动照片`"
                @click="photoIndex = i"
              />
            </div>
            <div v-if="versionedPhotos.length > 1" class="linktree-gallery-controls">
              <button type="button" aria-label="上一张" @click="goNext">‹</button>
              <button type="button" aria-label="下一张" @click="goNext">›</button>
            </div>
          </div>
        </div>
        <div v-if="bilibiliPlayerUrl" class="linktree-video-wrap">
          <template v-if="shouldShowMobileFallback">
            <div class="linktree-video-cover">
              <img v-if="bilibiliCoverUrl && bilibiliCoverUrl !== '#'" :src="bilibiliCoverUrl" :alt="bilibiliTitle || 'Bilibili 视频封面'" loading="lazy" />
              <a v-if="bilibiliVideoUrl" class="linktree-video-open-button" :href="bilibiliVideoUrl" target="_blank" rel="noopener noreferrer">在 B 站打开</a>
              <p v-if="bilibiliTitle" class="linktree-video-cover-title">{{ bilibiliTitle }}</p>
            </div>
          </template>
          <template v-else>
            <iframe
              class="linktree-video-frame"
              :src="bilibiliPlayerUrl"
              title="Bilibili Video Player"
              frameborder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowfullscreen
              scrolling="no"
            />
          </template>
        </div>
      </section>

      <footer class="linktree-footer">
        <p>BanG Dream! Card Guess</p>
      </footer>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { safeUrl } from '../utils/image';
import { buildBilibiliEmbedUrl, buildBilibiliVideoUrl, isMobileBrowser } from '../utils/bilibili';

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";
const STANDEES_JSON_URL = "/standees/standees.json";

interface CommunityHomeData {
  aboutUs: string;
  members: Array<{ name?: string; desc?: string; url?: string; avatar?: string }>;
  events: Array<{ title?: string; date?: string; location?: string; desc?: string }>;
  socialLinks: Array<{ title?: string; url?: string }>;
  photos: Array<string | { url?: string; caption?: string }>;
  photoCaptions?: string[];
  bilibiliBvid?: string;
  bilibiliAid?: string | number;
  bilibiliCid?: string | number;
  bilibiliPage?: string | number;
  bilibiliAutoplay?: boolean;
  bilibiliDanmaku?: boolean;
  bilibiliHighQuality?: boolean;
  bilibiliCover?: string;
  cover?: string;
  poster?: string;
  thumbnail?: string;
  pic?: string;
  bilibiliTitle?: string;
  mobileFallbackMode?: "cover" | "iframe-first";
  bilibiliMinimalMode?: boolean;
  updatedAt?: number;
}

const data = ref<CommunityHomeData>({ aboutUs: "", members: [], events: [], socialLinks: [], photos: [], bilibiliBvid: "" });
const isMobileClient = ref(false);
const leftStandeeUrl = ref("");
const rightStandeeUrl = ref("");
const bilibiliPlayerUrl = computed(() => buildBilibiliPlayerUrl(data.value));
const bilibiliVideoUrl = computed(() => buildBilibiliOpenUrl(data.value));
const bilibiliCoverUrl = computed(() => {
  return versionedUrl(String(data.value.bilibiliCover || "").trim());
});
const bilibiliTitle = computed(() => String(data.value.bilibiliTitle || "").trim());
const mobileFallbackMode = computed(() => data.value.mobileFallbackMode || "cover");
const shouldShowMobileFallback = computed(() => isMobileClient.value && mobileFallbackMode.value === "cover");
const normalizedPhotos = computed(() => normalizePhotoEntries(data.value.photos, data.value.photoCaptions));
const versionedPhotos = computed(() => normalizedPhotos.value.map((p) => versionedUrl(p.url)).filter(Boolean));
const trackStyle = computed(() => ({
  transform: `translateX(-${photoIndex.value * 100}%)`,
}));
const activePhotoCaption = computed(() => {
  return String(normalizedPhotos.value[photoIndex.value]?.caption || "").trim();
});
const photoIndex = ref(0);
let photoTimer: number | null = null;

onMounted(async () => {
  isMobileClient.value = isMobileBrowser();
  void loadRandomStandees();
  try {
    const response = await fetch("/api/community", { cache: "no-store" });
    if (response.ok) {
      data.value = await response.json();
      startPhotoCarousel();
    }
  } catch (e) {
    console.error("Failed to load community data", e);
  }
});

onBeforeUnmount(() => {
  stopPhotoCarousel();
});

watch(versionedPhotos, () => {
  if (photoIndex.value >= versionedPhotos.value.length) {
    photoIndex.value = 0;
  }
  startPhotoCarousel();
});

function buildBilibiliPlayerUrl(value: CommunityHomeData): string {
  return versionedUrl(buildBilibiliEmbedUrl({
    bvid: value.bilibiliBvid,
    aid: value.bilibiliAid,
    cid: value.bilibiliCid,
    page: value.bilibiliPage,
    autoplay: value.bilibiliAutoplay ?? false,
    danmaku: value.bilibiliDanmaku ?? false,
    highQuality: value.bilibiliHighQuality,
    minimalMode: value.bilibiliMinimalMode,
  }));
}

function buildBilibiliOpenUrl(value: CommunityHomeData): string {
  return buildBilibiliVideoUrl({
    bvid: value.bilibiliBvid,
    aid: value.bilibiliAid,
  });
}

function versionedUrl(raw: string | undefined): string {
  const base = safeUrl(raw);
  if (!base || base === "#") return "";
  const token = Number(data.value.updatedAt || 0);
  if (!Number.isFinite(token) || token <= 0) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}v=${token}`;
}

function startPhotoCarousel(): void {
  stopPhotoCarousel();
  if (versionedPhotos.value.length <= 1) return;
  photoTimer = window.setInterval(() => {
    goNext();
  }, 10000);
}

function stopPhotoCarousel(): void {
  if (photoTimer !== null) {
    window.clearInterval(photoTimer);
    photoTimer = null;
  }
}

function goNext(): void {
  if (!versionedPhotos.value.length) return;
  photoIndex.value = (photoIndex.value + 1) % versionedPhotos.value.length;
}

function normalizePhotoEntries(
  photosValue: Array<string | { url?: string; caption?: string }> | undefined,
  captionsValue: string[] | undefined,
): Array<{ url: string; caption: string }> {
  const photos = Array.isArray(photosValue) ? photosValue : [];
  const captions = Array.isArray(captionsValue) ? captionsValue : [];
  return photos.map((item, index) => {
    if (item && typeof item === "object") {
      return {
        url: String(item.url || "").trim(),
        caption: String(item.caption || "").trim(),
      };
    }
    return {
      url: String(item || "").trim(),
      caption: String(captions[index] || "").trim(),
    };
  }).filter((item) => item.url);
}

function pickTwoDifferent(list: string[]): [string, string] {
  const safeList = list.filter(Boolean);
  if (safeList.length === 0) return ["", ""];
  if (safeList.length === 1) return [safeList[0], safeList[0]];
  const firstIndex = Math.floor(Math.random() * safeList.length);
  let secondIndex = Math.floor(Math.random() * safeList.length);
  while (secondIndex === firstIndex) {
    secondIndex = Math.floor(Math.random() * safeList.length);
  }
  return [safeList[firstIndex], safeList[secondIndex]];
}

function parseStandeeUrls(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (payload && typeof payload === "object") {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) {
      return items
        .map((item) => {
          if (item && typeof item === "object") {
            return String((item as { url?: unknown }).url || "").trim();
          }
          return "";
        })
        .filter(Boolean);
    }
  }
  return [];
}

async function loadRandomStandees(): Promise<void> {
  leftStandeeUrl.value = "";
  rightStandeeUrl.value = "";

  try {
    const response = await fetch(STANDEES_JSON_URL, { cache: "force-cache" });
    if (!response.ok) return;
    const payload = await response.json();
    const urls = parseStandeeUrls(payload);
    if (!urls.length) return;
    const [left, right] = pickTwoDifferent(urls);
    leftStandeeUrl.value = left;
    rightStandeeUrl.value = right;
  } catch {
    // keep empty when local standee list is unavailable
  }
}
</script>

