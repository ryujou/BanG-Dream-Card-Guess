<template>
  <main class="linktree-shell forum-shell">
    <div class="gbc-home-layout forum-layout">
      <aside class="gbc-editorial-sidebar forum-sidebar" aria-label="论坛导航">
        <div class="gbc-sidebar-auth" aria-label="快捷入口">
          <router-link to="/">首页</router-link>
          <router-link to="/community-admin">后台</router-link>
        </div>

        <div class="gbc-brand" aria-label="BangDream 论坛">
          <p class="gbc-brand-kicker">Community Board</p>
          <strong>Forum</strong>
          <strong>Live</strong>
          <span class="gbc-brand-subtitle">BangDream / 湘潭同好会</span>
        </div>

        <p class="gbc-quote">活动公告、摊位反馈、新人问答与本地同好交流集中板。</p>

        <nav class="gbc-nav-stack" aria-label="论坛页面链接">
          <router-link class="gbc-nav-item" to="/">Home</router-link>
          <router-link class="gbc-nav-item" to="/forum">Forum</router-link>
          <router-link class="gbc-nav-item" to="/community-admin">Admin</router-link>
          <router-link class="gbc-nav-item" to="/shop">Shop</router-link>
        </nav>

        <div class="gbc-sidebar-actions" aria-label="社区链接">
          <a :href="COMMUNITY_URL" target="_blank" rel="noreferrer">加入官方交流群</a>
          <a href="https://enldm.cyou/bangmap" target="_blank" rel="noreferrer">BanG Map</a>
        </div>

        <p class="gbc-sidebar-footer">Forum sections are driven by /api/community forumSections.</p>
      </aside>

      <section class="gbc-content-stage forum-stage" aria-label="论坛版块">
        <div class="gbc-version-strip forum-version-strip">
          <span>FORUM</span>
          <strong>{{ boardStatusText }}</strong>
        </div>

        <div class="linktree-container gbc-hero-card forum-board">
          <header class="linktree-header forum-board-header">
            <p class="gbc-section-label">BangDream Editorial Board</p>
            <h1 class="linktree-title">同好会论坛</h1>
            <p class="linktree-bio">查看同好会公告、活动反馈、Q&amp;A 与本地交流主题。内容可在后台通过 forumSections 配置。</p>
            <div class="forum-header-actions" aria-label="论坛操作">
              <router-link class="home-forum-admin-link" to="/">返回首页</router-link>
              <router-link class="home-forum-admin-link" to="/community-admin">编辑论坛</router-link>
            </div>
          </header>

          <section v-if="forumSections.length" class="forum-section-grid" aria-label="论坛版块列表">
            <article v-for="section in forumSections" :key="section.id" class="forum-section-card">
              <a class="forum-section-cover" :href="resolveForumHref(section.href)" :target="isExternalHref(resolveForumHref(section.href)) ? '_blank' : undefined" :rel="isExternalHref(resolveForumHref(section.href)) ? 'noreferrer' : undefined">
                <img v-if="section.image" :src="section.image" :alt="section.title" loading="lazy" />
                <span v-else>{{ section.eyebrow || 'BOARD' }}</span>
              </a>

              <div class="forum-section-body">
                <p class="gbc-section-label">{{ section.eyebrow || 'Forum Section' }}</p>
                <div class="forum-section-title-row">
                  <h2>{{ section.title }}</h2>
                  <a :href="resolveForumHref(section.href)" :target="isExternalHref(resolveForumHref(section.href)) ? '_blank' : undefined" :rel="isExternalHref(resolveForumHref(section.href)) ? 'noreferrer' : undefined">进入</a>
                </div>
                <p>{{ section.desc }}</p>

                <div v-if="section.posts.length" class="forum-post-list" aria-label="帖子列表">
                  <a v-for="post in section.posts" :key="`${section.id}-${post.title}`" class="forum-post-row" :href="resolveForumHref(post.href)" :target="isExternalHref(resolveForumHref(post.href)) ? '_blank' : undefined" :rel="isExternalHref(resolveForumHref(post.href)) ? 'noreferrer' : undefined">
                    <span>{{ post.tag || 'DISCUSS' }}</span>
                    <strong>{{ post.title }}</strong>
                    <small>{{ post.author || '湘潭同好会' }} · {{ post.date || '待更新' }}</small>
                  </a>
                </div>

                <div v-else class="forum-empty-state">
                  <strong>暂无展示帖</strong>
                  <p>可在社区后台为该版块添加 posts。</p>
                </div>
              </div>
            </article>
          </section>

          <section v-else class="forum-empty-state forum-empty-board" aria-label="论坛空状态">
            <strong>论坛版块待配置</strong>
            <p>/api/community 暂未提供 forumSections。请在后台添加版块，或等待默认数据加载。</p>
            <router-link class="home-forum-admin-link" to="/community-admin">前往后台</router-link>
          </section>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { safeUrl } from '../utils/image';

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";
const DEFAULT_SECTION_IMAGE = "/cards/res034015_rip/card_normal.png";

interface ForumPost {
  title: string;
  author: string;
  date: string;
  href: string;
  tag: string;
}

interface ForumSection {
  id: string;
  title: string;
  eyebrow: string;
  desc: string;
  href: string;
  image: string;
  posts: ForumPost[];
}

interface LegacyForumPost {
  title?: string;
  author?: string;
  tag?: string;
  replies?: string | number;
  excerpt?: string;
  url?: string;
  href?: string;
  date?: string;
}

interface CommunityForumData {
  forumSections?: unknown;
  forumPosts?: unknown;
  forumThreads?: unknown;
  updatedAt?: number;
}

const defaultForumSections: ForumSection[] = [
  {
    id: "announcements",
    title: "站务公告",
    eyebrow: "Newsroom",
    desc: "同好会主页、摊位活动、招募与版本更新集中发布。",
    href: COMMUNITY_URL,
    image: DEFAULT_SECTION_IMAGE,
    posts: [
      { title: "同好会主页改版上线", author: "湘潭同好会", date: "2026-06-06", href: COMMUNITY_URL, tag: "站务" },
      { title: "招募摊位协力与摄影返图", author: "Booth Staff", date: "2026-06-01", href: COMMUNITY_URL, tag: "活动" },
    ],
  },
  {
    id: "discussion",
    title: "讨论与问答",
    eyebrow: "Q&A / Feedback",
    desc: "新人入坑、本地群指路、猜卡面玩法反馈与曲目企划建议。",
    href: COMMUNITY_URL,
    image: "",
    posts: [
      { title: "新人入坑与本地群指路", author: "湘潭同好会", date: "长期有效", href: COMMUNITY_URL, tag: "Q&A" },
      { title: "摊位猜卡面玩法反馈集中帖", author: "Booth Staff", date: "持续收集", href: COMMUNITY_URL, tag: "Feedback" },
    ],
  },
];

const communityData = ref<CommunityForumData>({ forumSections: defaultForumSections });
const forumSections = computed(() => normalizeForumSections(communityData.value));
const boardStatusText = computed(() => {
  const count = forumSections.value.reduce((total, section) => total + section.posts.length, 0);
  return `${forumSections.value.length} 个版块 / ${count} 个展示帖 · 湘潭 BanG Dream! 同好会`;
});

onMounted(async () => {
  try {
    const response = await fetch("/api/community", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/json")) {
      communityData.value = await response.json();
    }
  } catch (e) {
    console.error("Failed to load forum data", e);
  }
});

function normalizeForumSections(value: CommunityForumData): ForumSection[] {
  if (Array.isArray(value.forumSections)) {
    return normalizeSectionArray(value.forumSections);
  }

  const legacyPosts = normalizeLegacyPosts(value.forumThreads).concat(normalizeLegacyPosts(value.forumPosts));
  if (legacyPosts.length) {
    return [
      {
        id: "community-discussion",
        title: "同好会讨论",
        eyebrow: "Forum Threads",
        desc: "来自 /api/community forumPosts / forumThreads 的讨论串。",
        href: COMMUNITY_URL,
        image: DEFAULT_SECTION_IMAGE,
        posts: legacyPosts,
      },
    ];
  }

  return defaultForumSections;
}

function normalizeSectionArray(value: unknown): ForumSection[] {
  if (!Array.isArray(value)) return [];
  const sections: ForumSection[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const title = String(record.title || "").trim();
    if (!title) return;
    const posts = normalizePosts(record.posts);
    sections.push({
      id: String(record.id || `section-${index + 1}`).trim(),
      title,
      eyebrow: String(record.eyebrow || "").trim(),
      desc: String(record.desc || "").trim(),
      href: String(record.href || "").trim(),
      image: String(record.image || "").trim(),
      posts,
    });
  });
  return sections;
}

function normalizePosts(value: unknown): ForumPost[] {
  if (!Array.isArray(value)) return [];
  const posts: ForumPost[] = [];
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const title = String(record.title || "").trim();
    if (!title) return;
    posts.push({
      title,
      author: String(record.author || "").trim(),
      date: String(record.date || "").trim(),
      href: String(record.href || "").trim(),
      tag: String(record.tag || "").trim(),
    });
  });
  return posts;
}

function normalizeLegacyPosts(value: unknown): ForumPost[] {
  if (!Array.isArray(value)) return [];
  const posts: ForumPost[] = [];
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as LegacyForumPost;
    const title = String(record.title || "").trim();
    if (!title) return;
    posts.push({
      title,
      author: String(record.author || "").trim(),
      date: String(record.date || record.replies || "").trim(),
      href: String(record.href || record.url || "").trim(),
      tag: String(record.tag || "DISCUSS").trim(),
    });
  });
  return posts;
}

function resolveForumHref(raw: string | undefined): string {
  const normalized = String(raw || "").trim();
  if (!normalized) return COMMUNITY_URL;
  if (normalized.startsWith("/") || normalized.startsWith("#")) return normalized;
  return safeUrl(normalized);
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
</script>
