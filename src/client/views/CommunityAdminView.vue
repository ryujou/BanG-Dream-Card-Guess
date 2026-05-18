<template>
  <main class="settings-shell">
    <section class="settings-panel linktree-admin-panel">
      <Topbar :game="game" :settings="settings" :connected="connected" :showCommunityLink="false" />
      
      <div class="community-admin-header">
        <h2>主页可视化编辑</h2>
        <p>在此处修改主页的各项信息，修改完成后记得点击底部的保存按钮。</p>
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
          placeholder="https://your-cdn.example.com/cover.jpg"
          autocomplete="off"
        />
      </div>

      <div ref="editorContainer" class="json-editor-container"></div>
      
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

onMounted(async () => {
  try {
    // dynamically import the JSON editor to avoid heavy initial load
    const { JSONEditor } = await import('@json-editor/json-editor');
    
    let initialData: Record<string, unknown> = { aboutUs: "", members: [], events: [], socialLinks: [], photos: [], photoCaptions: [], bilibiliBvid: "" };
    const response = await fetch("/api/community", { cache: "no-store" });
    if (response.ok) {
      initialData = await response.json();
    }
    if (isRecord(initialData)) {
      initialData.photos = normalizePhotoEntries(initialData.photos, initialData.photoCaptions);
      delete (initialData as Record<string, unknown>).photoCaptions;
      delete (initialData as Record<string, unknown>).updatedAt;
    }
    bilibiliBvid.value = normalizeBvid((initialData as { bilibiliBvid?: unknown }).bilibiliBvid);
    bilibiliCover.value = String((initialData as { bilibiliCover?: unknown }).bilibiliCover || "").trim();
    
    if (editorContainer.value) {
      editorInstance = new JSONEditor(editorContainer.value, {
        theme: "html",
        iconlib: null,
        disable_edit_json: true,
        disable_properties: true,
        disable_collapse: true,
        startval: initialData,
        schema: {
          type: "object",
          title: "主页配置",
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
              type: "array", title: "成员介绍", format: "table",
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
            photos: {
              type: "array", title: "活动返图 URL 列表", format: "table",
              items: {
                type: "object",
                properties: {
                  url: { type: "string", title: "图片链接" },
                  caption: { type: "string", title: "图片文案", format: "textarea" }
                }
              }
            }
          }
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
});

onUnmounted(() => {
  if (editorInstance) {
    editorInstance.destroy();
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
</script>

<style scoped>
.community-admin-header {
  margin-bottom: 20px;
}
.community-admin-header h2 {
  margin: 0 0 8px;
}
.community-admin-header p {
  margin: 0;
  color: #6c757d;
  font-size: 0.9em;
}
.admin-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e9ecef;
}
.upload-group, .save-group {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bilibili-field {
  display: grid;
  gap: 8px;
  margin: 0 0 24px;
}
.bilibili-field label {
  font-weight: 700;
}
.bilibili-field input {
  width: min(360px, 100%);
  padding: 10px 12px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  font: inherit;
}
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  border: none;
}
.btn.primary {
  background: #ff3d6e;
  color: white;
}
.btn.secondary {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #212529;
}
.upload-status, .save-status {
  font-size: 0.9em;
  color: #6c757d;
}
</style>

