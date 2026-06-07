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
    <div class="gbc-home-layout">
      <aside class="gbc-editorial-sidebar" aria-label="首页导航">
        <div class="gbc-sidebar-auth" aria-label="快捷入口">
          <router-link to="/login">登录</router-link>
          <router-link to="/shop">商城</router-link>
        </div>

        <div class="gbc-brand" aria-label="湘潭 BanG Dream! 同好站">
          <p class="gbc-brand-kicker">湘潭同好站</p>
          <strong>BanG</strong>
          <strong>Dream!</strong>
          <span class="gbc-brand-subtitle">Card Guess / Booth Game</span>
        </div>

        <p class="gbc-quote">“キラキラドキドキを、全部ぶちこめ。”</p>

        <nav class="gbc-nav-stack" aria-label="主要页面">
          <router-link class="gbc-nav-item" to="/">主页</router-link>
          <router-link class="gbc-nav-item" to="/feed">动态</router-link>
          <router-link class="gbc-nav-item gbc-nav-item-forum" to="/forum">广场</router-link>
          <router-link class="gbc-nav-item" to="/music">音乐</router-link>
          <router-link class="gbc-nav-item" to="/player">猜卡游戏</router-link>
          <router-link class="gbc-nav-item" to="/shop">社团商城</router-link>
          <router-link class="gbc-nav-item" to="/stats">访问地图</router-link>
        </nav>

        <div class="gbc-sidebar-actions" aria-label="社区链接">
          <a :href="COMMUNITY_URL" target="_blank" rel="noreferrer">加入官方交流群</a>
          <a href="https://enldm.cyou/bangmap" target="_blank" rel="noreferrer">BanG Map 同好会地图</a>
        </div>

        <p class="gbc-sidebar-footer">Fan project for 湘潭 BanG Dream! 同好会。</p>
      </aside>

      <section class="gbc-content-stage" aria-label="湘潭 BanG Dream! 同好会内容">
        <div class="gbc-version-strip">
          <span>版本更新</span>
          <strong>线下摊位互动 / 同好聚会 / 小游戏入口持续开放</strong>
        </div>

        <div class="linktree-container gbc-hero-card">
          <header class="linktree-header">
            <div class="home-school-logos" aria-label="参与高校">
              <figure>
                <img src="/icon5.png" alt="湘潭大学 logo" />
                <figcaption>湘潭大学</figcaption>
              </figure>
              <figure>
                <img src="/icon4.png" alt="湖南科技大学 logo" />
                <figcaption>湖南科技大学</figcaption>
              </figure>
              <figure>
                <img src="/icon3.png" alt="湖南工程学院 logo" />
                <figcaption>湖南工程学院</figcaption>
              </figure>
            </div>
            <p class="gbc-section-label">Community Portal</p>
            <h1 class="linktree-title">湘潭 BanG Dream! 同好会</h1>
            <p v-if="data.aboutUs" class="linktree-bio">{{ data.aboutUs }}</p>
            <p v-else class="linktree-bio">线下摊位互动、同好聚会与游戏现场。</p>
          </header>

          <section class="linktree-links linktree-hero-links" aria-label="快捷入口">
            <router-link class="linktree-pill primary-pill cta-main" to="/player">
              <span class="pill-text">进入猜卡游戏（玩家页）</span>
            </router-link>
            <a class="linktree-pill highlight-pill cta-join" :href="COMMUNITY_URL" target="_blank" rel="noreferrer">
              <span class="pill-text">点击加入官方交流群</span>
            </a>
            <router-link class="linktree-pill highlight-pill forum-pill" to="/forum">
              <span class="pill-text">进入论坛广场</span>
            </router-link>
            <router-link class="linktree-pill" to="/host">
              <span class="pill-text">游戏控制台（主持页）</span>
            </router-link>
            <router-link class="linktree-pill" to="/note-shooter">
              <span class="pill-text">打发时间：音符射手</span>
            </router-link>
            <router-link class="linktree-pill" to="/games/stopwatch-challenge">
              <span class="pill-text">秒表挑战</span>
            </router-link>
            <router-link class="linktree-pill" to="/games/bang-klotski">
              <span class="pill-text">华容道小游戏</span>
            </router-link>
            <a class="linktree-pill" href="https://enldm.cyou/bangmap" target="_blank" rel="noreferrer">
              <span class="pill-text">BanG Map 同好会地图</span>
            </a>
            <router-link class="linktree-pill highlight-pill" to="/shop">
              <span class="pill-text">社团周边商城</span>
            </router-link>
            <router-link class="linktree-pill" to="/stats">
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

          <section v-if="newsItems.length || forumPreviewSections.length || forumPosts.length" class="linktree-section home-forum-section">
            <div class="home-forum-header">
              <div>
                <p class="gbc-section-label">News / Forum</p>
                <h2>站务公告与论坛广场</h2>
              </div>
              <div class="home-forum-actions">
                <router-link class="home-forum-admin-link home-forum-entry-link" to="/forum">进入论坛</router-link>
                <router-link class="home-forum-admin-link" to="/community-admin">编辑内容</router-link>
              </div>
            </div>

            <div v-if="newsItems.length" class="home-news-list" aria-label="站务公告">
              <a v-for="(item, i) in newsItems" :key="`news-${i}`" class="home-news-card" :href="resolveSurfaceHref(item.url)" :target="isExternalHref(resolveSurfaceHref(item.url)) ? '_blank' : undefined" :rel="isExternalHref(resolveSurfaceHref(item.url)) ? 'noreferrer' : undefined">
                <span>{{ item.category || 'NEWS' }}</span>
                <strong>{{ item.title }}</strong>
                <p>{{ item.desc }}</p>
                <small>{{ item.date }}</small>
              </a>
            </div>

            <div v-if="forumPreviewSections.length" class="home-forum-section-grid" aria-label="论坛版块预览">
              <router-link v-for="section in forumPreviewSections" :key="section.id" class="home-forum-section-card" :to="resolveInternalForumHref(section.href)">
                <div class="home-forum-section-copy">
                  <span>{{ section.eyebrow || 'FORUM' }}</span>
                  <strong>{{ section.title }}</strong>
                  <p>{{ section.desc }}</p>
                </div>
                <div v-if="section.posts.length" class="home-forum-thread-list">
                  <article v-for="post in section.posts" :key="`${section.id}-${post.title}`">
                    <small>{{ post.tag || section.eyebrow || 'DISCUSS' }}</small>
                    <b>{{ post.title }}</b>
                    <em>{{ post.author }} · {{ post.date }}</em>
                  </article>
                </div>
              </router-link>
            </div>

            <div v-else-if="forumPosts.length" class="home-forum-list" aria-label="讨论串">
              <a v-for="(post, i) in forumPosts" :key="`forum-${i}`" class="home-forum-card" :href="resolveSurfaceHref(post.url || post.href, '/forum')" :target="isExternalHref(resolveSurfaceHref(post.url || post.href, '/forum')) ? '_blank' : undefined" :rel="isExternalHref(resolveSurfaceHref(post.url || post.href, '/forum')) ? 'noreferrer' : undefined">
                <div class="home-forum-card-meta">
                  <span>{{ post.tag || 'DISCUSS' }}</span>
                  <small>{{ post.replies || '0' }} 回复</small>
                </div>
                <strong>{{ post.title }}</strong>
                <p>{{ post.excerpt }}</p>
                <small>{{ post.author }}</small>
              </a>
            </div>
          </section>

          <section class="linktree-section home-media-section">
            <div class="home-media-tabs" aria-label="内容分类">
              <button type="button" :class="{ 'is-active': activeMediaTab === 'video' }" @click="activeMediaTab = 'video'">视频</button>
              <button type="button" :class="{ 'is-active': activeMediaTab === 'guide' }" @click="activeMediaTab = 'guide'">攻略</button>
              <button type="button" :class="{ 'is-active': activeMediaTab === 'qa' }" @click="activeMediaTab = 'qa'">Q&amp;A</button>
              <button type="button" :class="{ 'is-active': activeMediaTab === 'activity' }" @click="activeMediaTab = 'activity'">活动</button>
              <router-link class="home-media-tab-link" to="/forum">论坛</router-link>
            </div>

            <div class="home-feature-grid">
              <article class="home-hero-banner">
                <template v-if="versionedPhotos.length">
                  <div class="linktree-gallery-track" :style="trackStyle">
                    <img v-for="(p, i) in versionedPhotos" :key="`${p}-${i}`" :src="p" alt="活动照片" loading="lazy" />
                  </div>
                  <div class="home-hero-overlay">
                    <span>活动</span>
                    <h4>{{ activePhotoCaption || '湘潭 BanG Dream! 同好会活动回顾' }}</h4>
                    <p>{{ versionedPhotos.length }} 张返图 · BanG Dream! booth memory</p>
                  </div>
                  <div v-if="versionedPhotos.length > 1" class="linktree-gallery-controls">
                    <button type="button" aria-label="上一张" @click="goNext">‹</button>
                    <button type="button" aria-label="下一张" @click="goNext">›</button>
                  </div>
                </template>
                <template v-else>
                  <img :src="fallbackHeroImage" alt="湘潭 BanG Dream! 同好会活动视觉" loading="lazy" />
                  <div class="home-hero-overlay">
                    <span>活动</span>
                    <h4>湘潭 BanG Dream! 同好会</h4>
                    <p>线下摊位互动 / 猜卡游戏 / 同好聚会</p>
                  </div>
                </template>
              </article>

              <div class="home-feature-video-grid">
                <a v-for="item in displayedFeatureMediaCards" :key="item.id" class="home-video-card" :href="item.href" :target="isExternalHref(item.href) ? '_blank' : undefined" :rel="isExternalHref(item.href) ? 'noreferrer' : undefined">
                  <div class="home-video-thumb">
                    <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
                    <span v-else>NO COVER</span>
                    <b>{{ item.duration }}</b>
                  </div>
                  <div class="home-video-info">
                    <h4>{{ item.title }}</h4>
                    <p>{{ item.author }} · {{ item.meta }}</p>
                    <small>{{ item.views }}　{{ item.comments }}</small>
                  </div>
                </a>
              </div>
            </div>

            <div v-if="bilibiliPlayerUrl" class="home-video-player">
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
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowfullscreen
                  referrerpolicy="no-referrer"
                  loading="eager"
                  scrolling="no"
                />
              </template>
            </div>

            <div class="home-video-grid">
              <a v-for="item in displayedSecondaryMediaCards" :key="item.id" class="home-video-card" :href="item.href" :target="isExternalHref(item.href) ? '_blank' : undefined" :rel="isExternalHref(item.href) ? 'noreferrer' : undefined">
                <div class="home-video-thumb">
                  <img v-if="item.image" :src="item.image" :alt="item.title" loading="lazy" />
                  <span v-else>NO COVER</span>
                  <b>{{ item.duration }}</b>
                </div>
                <div class="home-video-info">
                  <h4>{{ item.title }}</h4>
                  <p>{{ item.author }} · {{ item.meta }}</p>
                  <small>{{ item.views }}　{{ item.comments }}</small>
                </div>
              </a>
            </div>
          </section>

          <footer class="linktree-footer">
            <p>BanG Dream! Card Guess</p>
          </footer>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { safeUrl } from '../utils/image';
import { buildBilibiliEmbedUrl, buildBilibiliVideoUrl, isMobileBrowser } from '../utils/bilibili';
import { PUBLIC_ACTIVITY_PHOTOS, defaultForumSections, featureMediaCards as defaultFeatureMediaCards, secondaryMediaCards as defaultSecondaryMediaCards, type HomeMediaCard } from '../data/homeMedia';

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";
const STANDEES_JSON_URL = "/standees/standees.json";

const fallbackHeroImage = PUBLIC_ACTIVITY_PHOTOS[0]?.url || "/cards/res034015_rip/card_normal.png";

interface SurfaceNewsItem {
  title?: string;
  date?: string;
  category?: string;
  desc?: string;
  url?: string;
}

interface SurfaceForumPost {
  title?: string;
  author?: string;
  tag?: string;
  replies?: string | number;
  excerpt?: string;
  url?: string;
  href?: string;
}

interface SurfaceForumSectionPost {
  title: string;
  author: string;
  date: string;
  href: string;
  tag: string;
}

interface SurfaceForumSection {
  id: string;
  title: string;
  eyebrow: string;
  desc: string;
  href: string;
  image: string;
  posts: SurfaceForumSectionPost[];
}

interface CommunityHomeData {
  aboutUs: string;
  members: Array<{ name?: string; desc?: string; url?: string; avatar?: string }>;
  events: Array<{ title?: string; date?: string; location?: string; desc?: string }>;
  news?: SurfaceNewsItem[];
  forumPosts?: SurfaceForumPost[];
  forumSections?: SurfaceForumSection[];
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
  mediaCards?: HomeMediaCard[];
  featureMediaCards?: HomeMediaCard[];
  secondaryMediaCards?: HomeMediaCard[];
  updatedAt?: number;
}

const data = ref<CommunityHomeData>({ aboutUs: "", members: [], events: [], news: [], forumPosts: [], forumSections: [...defaultForumSections], socialLinks: [], photos: [...PUBLIC_ACTIVITY_PHOTOS], bilibiliBvid: "BV1boSqBCErV", bilibiliCover: "https://i.imgs.ovh/2026/05/18/4cfccccfbab0880ca4d9cfb8dd686968.jpg", featureMediaCards: [...defaultFeatureMediaCards], secondaryMediaCards: [...defaultSecondaryMediaCards] });
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
type MediaTab = "video" | "guide" | "qa" | "activity";

const activeMediaTab = ref<MediaTab>("video");
const photoIndex = ref(0);
const featureMediaCards = computed(() => normalizeMediaCards(data.value.featureMediaCards ?? data.value.mediaCards, defaultFeatureMediaCards));
const secondaryMediaCards = computed(() => normalizeMediaCards(data.value.secondaryMediaCards, defaultSecondaryMediaCards));
const displayedFeatureMediaCards = computed(() => filterMediaCards(featureMediaCards.value, activeMediaTab.value, true));
const displayedSecondaryMediaCards = computed(() => filterMediaCards(secondaryMediaCards.value, activeMediaTab.value, false));
const newsItems = computed(() => normalizeNewsItems(data.value.news));
const forumPosts = computed(() => normalizeForumPosts(data.value.forumPosts));
const forumPreviewSections = computed(() => normalizeForumSections(data.value.forumSections, defaultForumSections));
let photoTimer: number | null = null;

onMounted(async () => {
  isMobileClient.value = isMobileBrowser();
  void loadRandomStandees();
  try {
    const response = await fetch("/api/community", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/json")) {
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

function normalizeMediaCards(value: unknown, fallback: HomeMediaCard[]): HomeMediaCard[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => normalizeMediaCard(item)).filter((item): item is HomeMediaCard => !!item);
}

function normalizeMediaCard(value: unknown): HomeMediaCard | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Record<keyof HomeMediaCard, unknown>>;
  const id = String(item.id || "").trim();
  const title = String(item.title || "").trim();
  const href = String(item.href || "").trim();
  if (!id || !title || !href) return null;
  const card: HomeMediaCard = {
    id,
    title,
    author: String(item.author || "").trim(),
    meta: String(item.meta || "").trim(),
    views: String(item.views || "").trim(),
    comments: String(item.comments || "").trim(),
    duration: String(item.duration || "").trim(),
    href,
    image: String(item.image || "").trim(),
  };
  const bvid = String(item.bvid || "").trim();
  if (bvid) card.bvid = bvid;
  return card;
}

function filterMediaCards(cards: HomeMediaCard[], tab: MediaTab, isFeatureGroup: boolean): HomeMediaCard[] {
  if (tab === "video") return cards;
  const filtered = cards.filter((card) => mediaCardMatchesTab(card, tab));
  if (filtered.length) return filtered;
  return isFeatureGroup ? cards.slice(0, Math.min(cards.length, 2)) : cards;
}

function mediaCardMatchesTab(card: HomeMediaCard, tab: MediaTab): boolean {
  const text = `${card.id} ${card.title} ${card.author} ${card.meta} ${card.href}`.toLowerCase();
  if (tab === "guide") return /攻略|教程|guide|玩法|小游戏|game|stats|地图|map|challenge|klotski/.test(text);
  if (tab === "qa") return /q&a|qa|问答|新人|入坑|群|community|反馈|feedback|论坛|forum/.test(text);
  return /活动|返图|摊位|漫展|activity|event|public|xtbang|qq/.test(text);
}

function normalizeNewsItems(value: unknown): SurfaceNewsItem[] {
  if (!Array.isArray(value)) return [];
  const items: SurfaceNewsItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = String(record.title || "").trim();
    if (!title) continue;
    items.push({
      title,
      date: String(record.date || "").trim(),
      category: String(record.category || "").trim(),
      desc: String(record.desc || record.excerpt || "").trim(),
      url: String(record.url || "").trim(),
    });
  }
  return items;
}

function normalizeForumPosts(value: unknown): SurfaceForumPost[] {
  if (!Array.isArray(value)) return [];
  const items: SurfaceForumPost[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = String(record.title || "").trim();
    if (!title) continue;
    items.push({
      title,
      author: String(record.author || "").trim(),
      tag: String(record.tag || record.category || "").trim(),
      replies: String(record.replies || "").trim(),
      excerpt: String(record.excerpt || record.desc || "").trim(),
      url: String(record.url || record.href || "").trim(),
    });
  }
  return items;
}

function normalizeForumSections(value: unknown, fallback: unknown = []): SurfaceForumSection[] {
  const source = Array.isArray(value) ? value : fallback;
  const sections: SurfaceForumSection[] = [];
  if (!Array.isArray(source)) return [];
  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = String(record.title || "").trim();
    const id = String(record.id || title).trim();
    if (!id || !title) continue;
    sections.push({
      id,
      title,
      eyebrow: String(record.eyebrow || "").trim(),
      desc: String(record.desc || record.excerpt || "").trim(),
      href: String(record.href || record.url || "/forum").trim(),
      image: String(record.image || "").trim(),
      posts: normalizeForumSectionPosts(record.posts).slice(0, 2),
    });
  }
  return sections.slice(0, 3);
}

function normalizeForumSectionPosts(value: unknown): SurfaceForumSectionPost[] {
  if (!Array.isArray(value)) return [];
  const posts: SurfaceForumSectionPost[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const title = String(record.title || "").trim();
    if (!title) continue;
    posts.push({
      title,
      author: String(record.author || "").trim(),
      date: String(record.date || "").trim(),
      href: String(record.href || record.url || "").trim(),
      tag: String(record.tag || record.category || "").trim(),
    });
  }
  return posts;
}

function resolveSurfaceHref(raw: string | undefined, fallback = COMMUNITY_URL): string {
  const normalized = String(raw || "").trim();
  return normalized ? safeUrl(normalized) : fallback;
}

function resolveInternalForumHref(raw: string | undefined): string {
  const normalized = String(raw || "").trim();
  if (!normalized || isExternalHref(normalized)) return "/forum";
  return normalized.startsWith("/") ? normalized : `/forum/${normalized}`;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
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

