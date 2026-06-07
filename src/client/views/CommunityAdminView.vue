<template>
  <main class="settings-shell">
    <section class="settings-panel linktree-admin-panel">
      <Topbar :game="game" :settings="settings" :connected="connected" :showCommunityLink="false" />
      
      <div class="community-admin-header">
        <p class="admin-eyebrow">BangDream backend</p>
        <h2>同好会内容后台</h2>
        <p>这里管理首页、媒体卡片和论坛入口内容。可视字段会同步到底部 JSONEditor；修改后统一点击「保存全部修改」。</p>
      </div>

      <section class="admin-guide-grid" aria-label="后台填写说明">
        <article class="admin-guide-card">
          <strong>首页资料</strong>
          <span>关于我们、成员、活动、社交链接和活动返图会直接显示在首页对应区块。</span>
        </article>
        <article class="admin-guide-card">
          <strong>媒体卡片</strong>
          <span>featureMediaCards 控制主推视频卡；secondaryMediaCards 控制次级视频卡。B 站视频填写 bvid，外链填写 href。</span>
        </article>
        <article class="admin-guide-card">
          <strong>论坛入口</strong>
          <span>forumSections 控制论坛版块；posts 是该版块下展示的帖子。兄弟页面若使用 newsPosts / forumThreads，也可在下方编辑。</span>
        </article>
      </section>

      <section class="admin-fieldset" aria-labelledby="video-admin-title">
        <div class="admin-fieldset-heading">
          <p class="admin-section-label">Home video</p>
          <h3 id="video-admin-title">首页 B 站播放器</h3>
          <p>BV 号用于首页嵌入播放；封面图用于移动端或无法直接嵌入时展示。</p>
        </div>

        <div class="bilibili-field">
          <label for="bilibiliBvid">B 站视频 BV 号</label>
          <input
            id="bilibiliBvid"
            v-model="bilibiliBvid"
            type="text"
            placeholder="BV1GJ411x7h7"
            autocomplete="off"
          />
        </div>
        <div class="bilibili-field">
          <label for="bilibiliCover">B 站封面图链接</label>
          <input
            id="bilibiliCover"
            v-model="bilibiliCover"
            type="text"
            placeholder="请输入封面图片链接（例如：https://你的域名/cover.jpg）"
            autocomplete="off"
          />
        </div>
      </section>

      <section class="admin-fieldset" aria-labelledby="json-admin-title">
        <div class="admin-fieldset-heading">
          <p class="admin-section-label">Structured content</p>
          <h3 id="json-admin-title">分组内容编辑器</h3>
          <p>每个表格行代表一张卡片、一个成员或一个帖子。删除行会从前台移除；新增后请填写 id / title 等识别字段。</p>
        </div>

        <div ref="editorContainer" class="json-editor-container"></div>
      </section>
      
      <div class="admin-actions">
        <div class="upload-group">
          <label class="btn secondary">
            上传照片墙图片...
            <input type="file" @change="uploadImage" accept="image/*" style="display: none;" />
          </label>
          <span class="upload-status">{{ uploadStatus }}</span>
        </div>
        
        <div class="save-group">
          <button @click="saveData" class="btn primary">
            保存全部修改
          </button>
          <span class="save-status">{{ saveStatus }}</span>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useGameStore } from '../stores/game';
import Topbar from '../components/game/Topbar.vue';
import { apiFetch } from '../api/http';
import { defaultForumSections, featureMediaCards, secondaryMediaCards } from '../data/homeMedia';

const router = useRouter();
const gameStore = useGameStore();
const { snapshot, connected } = storeToRefs(gameStore);

const game = computed(() => snapshot.value?.game);
const settings = computed(() => snapshot.value?.settings);

const editorContainer = ref<HTMLElement | null>(null);
const uploadStatus = ref('');
const saveStatus = ref('');
const bilibiliBvid = ref('');
const bilibiliCover = ref('');
let editorInstance: { getValue(): unknown; destroy(): void } | null = null;
let editorTextObserver: MutationObserver | null = null;

const mediaCardSchema = {
  type: "array",
  format: "normal",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", title: "ID" },
      title: { type: "string", title: "标题" },
      author: { type: "string", title: "作者 / 来源" },
      meta: { type: "string", title: "分类 / 元信息" },
      views: { type: "string", title: "浏览量" },
      comments: { type: "string", title: "评论数" },
      duration: { type: "string", title: "时长" },
      href: { type: "string", title: "跳转链接" },
      image: { type: "string", title: "封面图" },
      bvid: { type: "string", title: "B 站 BV 号（可选）" },
    }
  }
} as const;

const forumPostSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", title: "帖子标题" },
    author: { type: "string", title: "作者 / 来源" },
    date: { type: "string", title: "日期" },
    href: { type: "string", title: "跳转链接" },
    tag: { type: "string", title: "标签" },
  }
} as const;

const forumSectionSchema = {
  type: "array",
  format: "normal",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", title: "版块 ID" },
      title: { type: "string", title: "版块标题" },
      eyebrow: { type: "string", title: "眉标" },
      desc: { type: "string", title: "版块说明", format: "textarea" },
      href: { type: "string", title: "版块链接" },
      image: { type: "string", title: "版块图" },
      posts: {
        type: "array", title: "展示帖子", format: "table",
        items: forumPostSchema
      },
    }
  }
} as const;

onMounted(async () => {
  try {
    // 动态加载 JSON 编辑器，减少首页初始体积
    const { JSONEditor } = await import('@json-editor/json-editor');
    
    let initialData: Record<string, unknown> = { aboutUs: "", members: [], events: [], news: [], newsPosts: [], forumPosts: [], forumThreads: [], forumSections: [...defaultForumSections], socialLinks: [], photos: [], photoCaptions: [], bilibiliBvid: "", featureMediaCards: [...featureMediaCards], secondaryMediaCards: [...secondaryMediaCards] };
    const response = await fetch("/api/community", { cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && contentType.includes("application/json")) {
      initialData = { ...initialData, ...await response.json() };
    }
    const rawBvid = (initialData as { bilibiliBvid?: unknown }).bilibiliBvid;
    const rawCover = (initialData as { bilibiliCover?: unknown }).bilibiliCover;
    if (isRecord(initialData)) {
      initialData.photos = normalizePhotoEntries(initialData.photos, initialData.photoCaptions);
      delete (initialData as Record<string, unknown>).photoCaptions;
      delete (initialData as Record<string, unknown>).updatedAt;
      delete (initialData as Record<string, unknown>).bilibiliBvid;
      delete (initialData as Record<string, unknown>).bilibiliCover;
      delete (initialData as Record<string, unknown>).bilibiliCoverBvid;
    }
      if (!Array.isArray(initialData.featureMediaCards) && Array.isArray(initialData.mediaCards)) {
        initialData.featureMediaCards = initialData.mediaCards;
      }
      delete (initialData as Record<string, unknown>).mediaCards;
    bilibiliBvid.value = normalizeBvid(rawBvid);
    bilibiliCover.value = String(rawCover || "").trim();
    
    if (editorContainer.value) {
      editorInstance = new JSONEditor(editorContainer.value, {
        theme: "html",
        iconlib: null,
        disable_edit_json: true,
        disable_properties: true,
        disable_collapse: true,
        no_additional_properties: true,
        startval: initialData,
        schema: {
          type: "object",
          title: "主页配置",
          additionalProperties: false,
          properties: {
            aboutUs: { type: "string", title: "关于我们 (简介)", format: "textarea" },
            socialLinks: {
              type: "array", title: "其他社交平台链接", format: "table",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", title: "平台名称" },
                  url: { type: "string", title: "链接地址" }
                }
              }
            },
            members: {
              type: "array", title: "成员介绍", format: "normal",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", title: "昵称" },
                  desc: { type: "string", title: "头衔 / 描述" },
                  url: { type: "string", title: "B站主页或外链" },
                  avatar: { type: "string", title: "头像地址 (可选)" }
                }
              }
            },
            events: {
              type: "array", title: "近期活动", format: "table",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", title: "活动名称" },
                  date: { type: "string", title: "日期" },
                  location: { type: "string", title: "地点" },
                  desc: { type: "string", title: "简介", format: "textarea" }
                }
              }
            },
            news: {
              type: "array", title: "站务公告 / 新闻", format: "table",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", title: "标题" },
                  date: { type: "string", title: "日期" },
                  category: { type: "string", title: "分类" },
                  desc: { type: "string", title: "摘要", format: "textarea" },
                  url: { type: "string", title: "外链 (可选)" }
                }
              }
            },
            newsPosts: {
              type: "array", title: "站务公告 newsPosts", format: "table",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", title: "标题" },
                  date: { type: "string", title: "日期" },
                  category: { type: "string", title: "分类" },
                  desc: { type: "string", title: "摘要", format: "textarea" },
                  url: { type: "string", title: "外链 (可选)" }
                }
              }
            },
            forumPosts: {
              type: "array", title: "论坛 / 讨论串", format: "table",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", title: "标题" },
                  author: { type: "string", title: "作者 / 来源" },
                  tag: { type: "string", title: "标签" },
                  replies: { type: "string", title: "回复数 / 状态" },
                  excerpt: { type: "string", title: "摘要", format: "textarea" },
                  url: { type: "string", title: "外链 (可选)" }
                }
              }
            },
            forumThreads: {
              type: "array", title: "论坛讨论 forumThreads", format: "table",
              items: {
                type: "object",
                properties: {
                  title: { type: "string", title: "标题" },
                  author: { type: "string", title: "作者 / 来源" },
                  tag: { type: "string", title: "标签" },
                  replies: { type: "string", title: "回复数 / 状态" },
                  excerpt: { type: "string", title: "摘要", format: "textarea" },
                  url: { type: "string", title: "外链 (可选)" }
                }
              }
            },
            forumSections: {
              ...forumSectionSchema,
              title: "论坛版块 forumSections"
            },
            photos: {
              type: "array", title: "活动返图 URL 列表", format: "table",
              items: {
                type: "object",
                properties: {
                  url: { type: "string", title: "图片链接" },
                  caption: { type: "string", title: "图片文案", format: "textarea" }
                }
              }
            },
            featureMediaCards: {
              ...mediaCardSchema,
              title: "首页主媒体卡片 featureMediaCards"
            },
            secondaryMediaCards: {
              ...mediaCardSchema,
              title: "首页次级媒体卡片 secondaryMediaCards"
             }
          }
        }
      });
      refreshEditorUi(editorContainer.value);
      editorTextObserver = new MutationObserver(() => {
        if (editorContainer.value) refreshEditorUi(editorContainer.value);
      });
      editorTextObserver.observe(editorContainer.value, { childList: true, subtree: true });
    }
  } catch (e) {
    console.error(e);
  }
});

onUnmounted(() => {
  if (editorInstance) {
    editorInstance.destroy();
  }
  if (editorTextObserver) {
    editorTextObserver.disconnect();
    editorTextObserver = null;
  }
});

async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploadStatus.value = "上传中...";
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const response = await apiFetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: e.target?.result })
      });
      const data = await response.json();
      if (response.ok && data.url) {
        uploadStatus.value = "上传成功，链接已复制到剪贴板。";
        try {
          await navigator.clipboard.writeText(data.url);
        } catch {}
        setTimeout(() => { uploadStatus.value = ""; }, 3000);
      } else {
        uploadStatus.value = "上传失败: " + (data.error || "未知错误");
      }
    } catch {
      uploadStatus.value = "请求出错";
    }
  };
  reader.readAsDataURL(file);
}

async function saveData() {
  if (!editorInstance) return;
  const val = editorInstance.getValue();
  const payload = isRecord(val)
    ? { ...val, bilibiliBvid: normalizeBvid(bilibiliBvid.value), bilibiliCover: String(bilibiliCover.value || "").trim() }
    : val;
  if (isRecord(payload)) {
    payload.photos = normalizePhotoEntries(payload.photos, payload.photoCaptions);
    delete payload.photoCaptions;
    delete payload.updatedAt;
    if (!Array.isArray(payload.featureMediaCards) && Array.isArray(payload.mediaCards)) {
      payload.featureMediaCards = payload.mediaCards;
    }
    delete payload.mediaCards;
  }
  saveStatus.value = "保存中...";
  
  try {
    const res = await apiFetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      saveStatus.value = "已保存！";
      setTimeout(() => { saveStatus.value = ""; }, 3000);
    } else {
      if (res.status === 401) {
        saveStatus.value = "权限不足，请先登录主持账号。";
        setTimeout(() => { router.push("/login?next=/community-admin"); }, 1500);
      } else {
        const errorData = await res.json().catch(() => ({}));
        saveStatus.value = "保存失败: " + (errorData.error || "未知错误");
      }
    }
  } catch (e) {
    saveStatus.value = "请求出错";
  }
}

function normalizeBvid(value: unknown): string {
  const raw = String(value || "").trim().replace(/\s+/g, "");
  if (!raw) return "";
  const withPrefix = /^BV/i.test(raw) ? raw : `BV${raw}`;
  const normalized = withPrefix.slice(0, 12);
  return /^BV[0-9A-Za-z]{10}$/.test(normalized) ? normalized : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePhotoEntries(photosValue: unknown, captionsValue: unknown): Array<{ url: string; caption: string }> {
  const captions = Array.isArray(captionsValue) ? captionsValue : [];
  if (!Array.isArray(photosValue)) return [];
  return photosValue.map((item, index) => {
    if (isRecord(item)) {
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

function localizeEditorButtons(root: HTMLElement): void {
  const replacements: Record<string, string> = {
    "Delete Last row": "删除最后一行",
    "Delete All": "删除全部",
    "Add row": "新增一行",
    "Delete": "删除",
    "Move up": "上移",
    "Move down": "下移",
    "Delete item": "删除",
  };
  const nodes = root.querySelectorAll("button, .btn");
  for (const node of nodes) {
    const text = node.textContent?.trim();
    if (!text) continue;
    const mapped = replacements[text];
    if (mapped && node.textContent !== mapped) {
      node.textContent = mapped;
    }
  }
}

function removeLegacyBilibiliEditors(root: HTMLElement): void {
  const blockedNames = new Set(["bilibiliBvid", "bilibiliCover", "bilibiliCoverBvid"]);
  const labels = root.querySelectorAll("label, .control-label, h3, legend");
  for (const label of labels) {
    const text = label.textContent?.trim();
    if (!text || !blockedNames.has(text)) continue;
    const fieldNode = label.closest("[data-schemapath]") || label.parentElement;
    if (fieldNode && fieldNode instanceof HTMLElement) {
      fieldNode.style.display = "none";
    }
  }
}

function refreshEditorUi(root: HTMLElement): void {
  localizeEditorButtons(root);
  markCardEditorSections(root);
  removeLegacyBilibiliEditors(root);
}

function markCardEditorSections(root: HTMLElement): void {
  const sectionNames = ["members", "featureMediaCards", "secondaryMediaCards", "forumSections"];
  for (const name of sectionNames) {
    const section = root.querySelector(`[data-schemapath="root.${name}"]`);
    if (!(section instanceof HTMLElement)) continue;
    section.classList.add("admin-editor-array");

    const items = section.querySelectorAll(`[data-schemapath^="root.${name}."]`);
    for (const item of items) {
      if (!(item instanceof HTMLElement)) continue;
      const path = item.getAttribute("data-schemapath") || "";
      if (!new RegExp(`^root\\.${name}\\.\\d+$`).test(path)) continue;
      item.classList.add("admin-editor-item");
      const fieldGrid = item.querySelector(":scope > .je-indented-panel > div > div");
      if (fieldGrid instanceof HTMLElement) {
        fieldGrid.classList.add("admin-editor-fields");
        markWideEditorFields(fieldGrid);
      }
      const actionBar = item.querySelector(":scope > span:last-child");
      if (actionBar instanceof HTMLElement) actionBar.classList.add("admin-editor-actions");
    }
  }
}

function markWideEditorFields(root: HTMLElement): void {
  const wideSuffixes = ["desc", "url", "avatar", "href", "image", "posts"];
  const fields = root.querySelectorAll("[data-schemapath]");
  for (const field of fields) {
    if (!(field instanceof HTMLElement)) continue;
    const path = field.getAttribute("data-schemapath") || "";
    const key = path.split(".").pop() || "";
    if (wideSuffixes.includes(key)) field.closest(".row")?.classList.add("admin-editor-wide-field");
    if (key === "posts") field.classList.add("admin-editor-nested-posts");
  }
}
</script>

<style scoped>
.linktree-admin-panel {
  width: min(1180px, calc(100vw - 32px));
  max-width: none;
  box-sizing: border-box;
}

.community-admin-header {
  margin: 26px 0 22px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(197, 60, 84, 0.22), rgba(10, 10, 14, 0.86));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
}
.community-admin-header h2 {
  margin: 6px 0 10px;
  color: #fff;
  font-size: clamp(2rem, 5vw, 4.8rem);
  font-weight: 950;
  letter-spacing: -0.06em;
  line-height: 0.9;
  text-transform: uppercase;
}
.community-admin-header p {
  margin: 0;
  max-width: 760px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.98rem;
  line-height: 1.7;
}
.admin-eyebrow,
.admin-section-label {
  color: #ff7a96 !important;
  font-size: 0.78rem !important;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.admin-guide-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}
.admin-guide-card,
.admin-fieldset {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(12, 12, 16, 0.78);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(14px);
}
.admin-guide-card {
  display: grid;
  gap: 8px;
  min-height: 128px;
  padding: 18px;
  border-radius: 20px;
}
.admin-guide-card strong {
  color: #fff;
  font-size: 1rem;
}
.admin-guide-card span {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.9rem;
  line-height: 1.65;
}
.admin-fieldset {
  margin: 18px 0;
  padding: 20px;
  border-radius: 24px;
}
.admin-fieldset-heading {
  margin-bottom: 18px;
}
.admin-fieldset-heading h3 {
  margin: 4px 0 8px;
  color: #fff;
  font-size: 1.35rem;
}
.admin-fieldset-heading p {
  margin: 0;
  color: rgba(255, 255, 255, 0.66);
  line-height: 1.7;
}
.admin-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  background: rgba(8, 8, 12, 0.86);
}
.upload-group, .save-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.json-editor-container {
  max-width: 100%;
  overflow-x: hidden;
}
.bilibili-field {
  display: grid;
  gap: 8px;
  margin: 0 0 18px;
}
.bilibili-field label,
.json-editor-container :deep(label),
.json-editor-container :deep(.control-label),
.json-editor-container :deep(legend),
.json-editor-container :deep(h3) {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 800;
}
.bilibili-field input,
.json-editor-container :deep(input[type="text"]),
.json-editor-container :deep(input[type="url"]),
.json-editor-container :deep(input[type="search"]),
.json-editor-container :deep(input:not([type])),
.json-editor-container :deep(textarea),
.json-editor-container :deep(select) {
  width: 100%;
  min-height: 56px;
  padding: 14px 18px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font: inherit;
  line-height: 1.4;
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}
.bilibili-field input {
  max-width: 620px;
}
.json-editor-container :deep(textarea) {
  min-height: 120px;
  resize: vertical;
}
.bilibili-field input::placeholder,
.json-editor-container :deep(input::placeholder),
.json-editor-container :deep(textarea::placeholder) {
  color: rgba(255, 255, 255, 0.4);
}
.bilibili-field input:focus,
.json-editor-container :deep(input:focus),
.json-editor-container :deep(textarea:focus),
.json-editor-container :deep(select:focus) {
  outline: none;
  border-color: #ff6f91;
  box-shadow: 0 0 0 4px rgba(255, 61, 110, 0.18);
  background: rgba(255, 255, 255, 0.12);
}
.json-editor-container :deep(.well),
.json-editor-container :deep(.panel),
.json-editor-container :deep(fieldset) {
  margin-bottom: 16px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.045);
  padding: 16px;
}
.json-editor-container :deep(.je-indented-panel) {
  display: grid;
  min-width: 0;
  gap: 14px;
  margin: 12px 0 0;
  padding-left: 0;
  border-left: 0;
}
.json-editor-container :deep(.je-object__container) {
  display: grid;
  min-width: 0;
  gap: 12px;
}
.json-editor-container :deep(.je-object__title),
.json-editor-container :deep(.je-array__title) {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.35;
}
.json-editor-container :deep(.je-object__controls),
.json-editor-container :deep(.je-array__controls) {
  display: flex;
  flex-wrap: wrap;
  grid-row: 2;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  margin: 4px 0 8px;
}
.json-editor-container :deep(.row) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
  min-width: 0;
  margin: 0;
}
.json-editor-container :deep(.row > [class*="col"]),
.json-editor-container :deep(.row > div) {
  width: auto;
  max-width: none;
  min-width: 0;
  padding: 0;
}
.json-editor-container :deep([data-schemapath$=".members"] > .je-indented-panel > [data-schemapath]),
.json-editor-container :deep([data-schemapath$=".featureMediaCards"] > .je-indented-panel > [data-schemapath]),
.json-editor-container :deep([data-schemapath$=".secondaryMediaCards"] > .je-indented-panel > [data-schemapath]),
.json-editor-container :deep([data-schemapath$=".forumSections"] > .je-indented-panel > [data-schemapath]) {
  display: grid;
  min-width: 0;
  gap: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.045);
}
.json-editor-container :deep([data-schemapath$=".members"] > .je-indented-panel > [data-schemapath] > .je-header),
.json-editor-container :deep([data-schemapath$=".featureMediaCards"] > .je-indented-panel > [data-schemapath] > .je-header),
.json-editor-container :deep([data-schemapath$=".secondaryMediaCards"] > .je-indented-panel > [data-schemapath] > .je-header),
.json-editor-container :deep([data-schemapath$=".forumSections"] > .je-indented-panel > [data-schemapath] > .je-header) {
  display: grid;
  gap: 10px;
}
.json-editor-container :deep([data-schemapath$=".members"] .je-object__controls),
.json-editor-container :deep([data-schemapath$=".featureMediaCards"] .je-object__controls),
.json-editor-container :deep([data-schemapath$=".secondaryMediaCards"] .je-object__controls),
.json-editor-container :deep([data-schemapath$=".forumSections"] .je-object__controls) {
  grid-row: auto;
}
.json-editor-container :deep(.admin-editor-fields) {
  display: grid !important;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  min-width: 0;
}
.json-editor-container :deep(.admin-editor-fields > .row) {
  display: block !important;
  min-width: 0;
}
.json-editor-container :deep(.admin-editor-fields > .row > [data-schemapath]) {
  width: auto !important;
  max-width: none !important;
  min-width: 0;
}
.json-editor-container :deep(.admin-editor-wide-field) {
  grid-column: 1 / -1;
}
.json-editor-container :deep(.admin-editor-wide-field textarea) {
  min-height: 96px;
}
.json-editor-container :deep(.admin-editor-nested-posts > .je-indented-panel > div > div) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  min-width: 0;
}
.json-editor-container :deep(.admin-editor-nested-posts > .je-indented-panel .row) {
  display: block !important;
  min-width: 0;
}
.json-editor-container :deep(.admin-editor-actions) {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 8px;
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
}
.json-editor-container :deep(.admin-editor-actions button) {
  min-width: 86px;
}
.json-editor-container :deep(.help-block),
.json-editor-container :deep(.form-text),
.json-editor-container :deep(p) {
  color: rgba(255, 255, 255, 0.62);
}
.json-editor-container :deep(table) {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 12px;
}
.json-editor-container :deep(table > tbody > tr) {
  background: rgba(255, 255, 255, 0.06);
}
.json-editor-container :deep(table > tbody > tr > td),
.json-editor-container :deep(table > tbody > tr > th) {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 10px;
  color: rgba(255, 255, 255, 0.78);
  vertical-align: top;
}
.json-editor-container :deep(table > tbody > tr > td:first-child),
.json-editor-container :deep(table > tbody > tr > th:first-child) {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px 0 0 14px;
}
.json-editor-container :deep(table > tbody > tr > td:last-child),
.json-editor-container :deep(table > tbody > tr > th:last-child) {
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0 14px 14px 0;
}
.json-editor-container :deep(button),
.json-editor-container :deep(.btn),
.json-editor-container :deep(input[type="button"]),
.json-editor-container :deep(input[type="submit"]),
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.82);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}
.json-editor-container :deep(*) {
  box-sizing: border-box;
}
.json-editor-container :deep(button:hover),
.json-editor-container :deep(.btn:hover),
.json-editor-container :deep(input[type="button"]:hover),
.json-editor-container :deep(input[type="submit"]:hover),
.btn:hover {
  border-color: rgba(255, 122, 150, 0.54);
  background: rgba(197, 60, 84, 0.18);
}
.json-editor-container :deep(button[class*="delete"]),
.json-editor-container :deep(.btn[class*="delete"]),
.json-editor-container :deep(button[class*="danger"]),
.json-editor-container :deep(.btn[class*="danger"]) {
  border-color: rgba(255, 112, 145, 0.42);
  background: rgba(197, 60, 84, 0.14);
  color: #ff9aaf;
}
.json-editor-container :deep(button[class*="delete"]:hover),
.json-editor-container :deep(.btn[class*="delete"]:hover),
.json-editor-container :deep(button[class*="danger"]:hover),
.json-editor-container :deep(.btn[class*="danger"]:hover) {
  border-color: rgba(255, 112, 145, 0.7);
  background: rgba(197, 60, 84, 0.24);
}
.btn.primary {
  border-color: transparent;
  background: linear-gradient(135deg, #ff3d6e, #c53c54);
  color: white;
  box-shadow: 0 12px 30px rgba(197, 60, 84, 0.28);
}
.btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: rgba(255, 255, 255, 0.86);
}
.upload-status, .save-status {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.68);
}
@media (max-width: 820px) {
  .admin-guide-grid {
    grid-template-columns: 1fr;
  }
  .admin-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .upload-group,
  .save-group {
    width: 100%;
    justify-content: space-between;
  }
  .linktree-admin-panel,
  .admin-fieldset,
  .json-editor-container,
  .json-editor-container :deep(.je-object__container),
  .json-editor-container :deep(.je-indented-panel) {
    max-width: 100%;
    overflow-x: hidden;
  }

  .json-editor-container :deep(table),
  .json-editor-container :deep(tbody),
  .json-editor-container :deep(tr),
  .json-editor-container :deep(td),
  .json-editor-container :deep(th) {
    display: block;
    width: 100%;
    max-width: 100%;
  }

  .json-editor-container :deep(table > tbody > tr > td),
  .json-editor-container :deep(table > tbody > tr > th) {
    border-radius: 12px;
  }
}
</style>

