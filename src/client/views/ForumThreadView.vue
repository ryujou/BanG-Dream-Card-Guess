<template>
  <main class="linktree-shell forum-shell forum-thread-shell">
    <div class="gbc-home-layout forum-layout">
      <aside class="gbc-editorial-sidebar forum-sidebar" aria-label="帖子导航">
        <div class="gbc-sidebar-auth" aria-label="快捷入口">
          <router-link to="/">首页</router-link>
          <router-link to="/community-admin">后台</router-link>
        </div>

        <div class="gbc-brand" aria-label="论坛帖子">
          <p class="gbc-brand-kicker">Forum Thread</p>
          <strong>Talk</strong>
          <strong>Live</strong>
          <span class="gbc-brand-subtitle">BangDream / 湘潭同好会</span>
        </div>

        <nav class="gbc-nav-stack" aria-label="帖子页面链接">
          <router-link class="gbc-nav-item" to="/">Home</router-link>
          <router-link class="gbc-nav-item" to="/feed">动态</router-link>
          <router-link class="gbc-nav-item" to="/forum">广场</router-link>
          <router-link class="gbc-nav-item" to="/music">音乐</router-link>
        </nav>
      </aside>

      <section class="gbc-content-stage forum-stage" aria-label="论坛帖子内容">
        <div class="gbc-version-strip forum-version-strip">
          <span>FORUM</span>
          <strong>{{ statusText }}</strong>
        </div>

        <article class="linktree-container gbc-hero-card forum-board forum-thread-board">
          <header class="linktree-header forum-board-header">
            <p class="gbc-section-label">{{ section?.eyebrow || "Community Board" }}</p>
            <h1 class="linktree-title">{{ pageTitle }}</h1>
            <p class="linktree-bio">{{ pageDesc }}</p>
            <div class="forum-header-actions" aria-label="帖子操作">
              <router-link class="home-forum-admin-link" to="/forum">返回广场</router-link>
              <router-link class="home-forum-admin-link" to="/community-admin">编辑论坛</router-link>
            </div>
          </header>

          <section v-if="section" class="forum-thread-content" aria-label="帖子内容">
            <img v-if="section.image" :src="section.image" :alt="section.title" loading="lazy" />
            <div class="forum-thread-copy">
              <div class="home-forum-card-meta">
                <span>{{ thread?.tag || section.eyebrow || "论坛" }}</span>
                <span>{{ thread?.date || "持续更新" }}</span>
                <span>{{ thread?.author || section.title }}</span>
              </div>
              <h2>{{ thread?.title || section.title }}</h2>
              <p>{{ detailCopy }}</p>
              <ul>
                <li v-for="post in section.posts" :key="post.href || post.title">
                  <a :href="post.href || section.href">{{ post.title }}</a>
                  <small>{{ post.tag }} · {{ post.date }}</small>
                </li>
              </ul>
            </div>
          </section>

          <section v-else class="forum-empty-state forum-empty-board">
            <strong>没有找到这个论坛内容</strong>
            <p>请回到广场选择已有版块，或在后台 forumSections 里添加对应 id / href。</p>
          </section>
        </article>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

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

const fallbackForumSections: ForumSection[] = [
  {
    id: "booth-news",
    title: "湘潭摊位情报站",
    eyebrow: "Booth / Event",
    desc: "集中整理湘潭 BanG Dream! 同好会线下摊位、漫展出摊、返图征集与协力招募信息。",
    href: "/community/forum/booth-news",
    image: "https://i.imgs.ovh/2026/05/13/782915b8902b6b51c204cde7d6926fb7.jpg",
    posts: [
      { title: "下一次猜卡面摊位筹备记录", author: "湘潭同好会", date: "2026-06-06", href: "/community/forum/booth-news/booth-card-guess", tag: "活动" },
      { title: "万楼联合漫展返图与摊位复盘", author: "摄影协力", date: "2026-05-13", href: "/community/forum/booth-news/wanlou-report", tag: "返图" },
    ],
  },
];

const route = useRoute();
const sections = ref<ForumSection[]>(fallbackForumSections);

const routeParts = computed(() => Array.isArray(route.params.slug) ? route.params.slug.map(String) : []);
const section = computed(() => findSection(routeParts.value));
const thread = computed(() => findThread(section.value, routeParts.value));
const pageTitle = computed(() => thread.value?.title || section.value?.title || "论坛内容");
const pageDesc = computed(() => section.value?.desc || "这个页面读取后台 forumSections，展示广场版块与帖子详情。");
const statusText = computed(() => section.value ? `${section.value.title} · ${section.value.posts.length} 条展示帖` : "内容未找到");
const detailCopy = computed(() => thread.value
  ? `${thread.value.author} 发布于 ${thread.value.date}。此页用于承接广场帖子链接，后续可在后台为该帖子补充完整正文。`
  : "当前展示该论坛版块的说明与帖子列表。内容由 /api/community 的 forumSections 字段统一配置。"
);

onMounted(async () => {
  try {
    const response = await fetch("/api/community", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("application/json")) return;
    const payload = await response.json();
    const nextSections = normalizeSections(payload.forumSections);
    if (nextSections.length) sections.value = nextSections;
  } catch {
    sections.value = fallbackForumSections;
  }
});

function findSection(parts: string[]): ForumSection | undefined {
  const sectionId = parts[0] || "";
  return sections.value.find((item) => item.id === sectionId || normalizeHref(item.href).endsWith(`/community/forum/${sectionId}`));
}

function findThread(currentSection: ForumSection | undefined, parts: string[]): ForumPost | undefined {
  if (!currentSection || parts.length < 2) return undefined;
  const threadId = parts[1];
  return currentSection.posts.find((post) => normalizeHref(post.href).endsWith(`/${threadId}`));
}

function normalizeSections(value: unknown): ForumSection[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeSection(item)).filter((item): item is ForumSection => !!item);
}

function normalizeSection(value: unknown): ForumSection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = String(record.id || "").trim();
  const title = String(record.title || "").trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    eyebrow: String(record.eyebrow || "Forum").trim(),
    desc: String(record.desc || "").trim(),
    href: String(record.href || `/community/forum/${id}`).trim(),
    image: String(record.image || "").trim(),
    posts: normalizePosts(record.posts),
  };
}

function normalizePosts(value: unknown): ForumPost[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const title = String(record.title || "").trim();
    if (!title) return null;
    return {
      title,
      author: String(record.author || "同好会").trim(),
      date: String(record.date || "持续更新").trim(),
      href: String(record.href || "").trim(),
      tag: String(record.tag || "论坛").trim(),
    };
  }).filter((item): item is ForumPost => !!item);
}

function normalizeHref(href: string): string {
  return href.split("?")[0].replace(/\/$/, "");
}
</script>
