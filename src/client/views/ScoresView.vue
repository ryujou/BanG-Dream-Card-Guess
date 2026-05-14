<template>
  <main class="queue-shell scores-shell">
    <section class="queue-panel scores-panel">
      <div class="queue-head scores-head">
        <div>
          <p class="eyebrow">Live Scores</p>
          <h1>成绩榜</h1>
        </div>
        <div class="qr-actions">
          <router-link to="/note-shooter">音符射手</router-link>
          <router-link to="/qr">二维码</router-link>
          <router-link to="/player">玩家页</router-link>
        </div>
      </div>

      <div class="score-live-meta">
        <strong>{{ queueScoresLoading ? "同步中" : "实时同步" }}</strong>
        <span>最后更新 {{ updatedText }}</span>
        <span>总记录 {{ Number(queueScores?.total) || 0 }}</span>
      </div>
      <div v-if="queueScoreError" class="login-error">{{ queueScoreError }}</div>

      <div class="scores-layout">
        <section class="score-main-board">
          <div class="queue-board-head">
            <strong>排行榜</strong>
            <button id="refreshQueueScores" type="button" @click="loadQueueScores(true)">刷新</button>
          </div>
          <div v-if="queueScoresLoading && !leaderboard.length" class="muted">读取中...</div>
          <div v-else-if="!leaderboard.length" class="muted">暂无成绩</div>
          <ol v-else class="score-rank-list">
            <li v-for="(item, index) in (leaderboard as any[])" :key="item.id" :class="{ 'is-top': index < 3 }">
              <span>{{ index + 1 }}</span>
              <strong>{{ item.username }}</strong>
              <b>{{ Number(item.score) || 0 }}</b>
              <em>{{ formatQueueDuration(item.duration) }}</em>
              <button 
                class="score-delete" 
                type="button" 
                :aria-label="`删除 ${item.username} 的全部成绩`"
                @click="deleteNoteShooterScore({ id: item.id, playerId: item.playerId, scope: 'player' })"
              >删除</button>
            </li>
          </ol>
        </section>
        
        <aside class="score-recent-board">
          <div class="queue-board-head">
            <strong>最近成绩</strong>
            <span class="live-dot">LIVE</span>
          </div>
          <div v-if="!recent.length" class="muted">暂无记录</div>
          <div v-else class="score-recent-list">
            <article v-for="item in recent" :key="item.id">
              <div>
                <strong>{{ item.username }}</strong>
                <span>{{ formatQueueTime(item.at) }}</span>
              </div>
              <b>{{ Number(item.score) || 0 }}</b>
              <button 
                class="score-delete" 
                type="button" 
                :aria-label="`删除 ${item.username} 的成绩`"
                @click="deleteNoteShooterScore({ id: item.id })"
              >删除</button>
            </article>
          </div>
        </aside>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { apiFetch } from '../api/http';

const router = useRouter();

const queueScores = ref<any>(null);
const queueScoresLoading = ref(false);
const queueScoreError = ref("");
const queueScoresUpdatedAt = ref(0);

let queueScoreEvents: EventSource | null = null;

const leaderboard = computed(() => queueScores.value?.leaderboard || []);
const recent = computed(() => queueScores.value?.recent || []);
const updatedText = computed(() => queueScoresUpdatedAt.value ? new Date(queueScoresUpdatedAt.value).toLocaleTimeString() : "等待同步");

function formatQueueDuration(value: any) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return seconds ? `${seconds}s` : "-";
}

function formatQueueTime(value: any) {
  const time = Number(value);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleTimeString();
}

async function loadQueueScores(force = false) {
  if (queueScoresLoading.value && !force) return;
  queueScoresLoading.value = true;
  queueScoreError.value = "";
  try {
    const response = await fetch(`/api/note-shooter-scores?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("读取排行榜失败");
    queueScores.value = await response.json();
  } catch (error: any) {
    queueScoreError.value = error.message || "读取排行榜失败";
  } finally {
    queueScoresLoading.value = false;
  }
}

function startQueueScoreStream() {
  if (queueScoreEvents || !("EventSource" in window)) return;
  queueScoreEvents = new EventSource("/api/note-shooter-scores/events");
  queueScoreEvents.addEventListener("scores", (event) => {
    try {
      queueScores.value = JSON.parse(event.data);
      queueScoresUpdatedAt.value = Date.now();
      queueScoreError.value = "";
    } catch {
      queueScoreError.value = "成绩数据解析失败";
    }
  });
  queueScoreEvents.onerror = () => {
    queueScoreError.value = "实时连接暂时中断，正在自动重连";
  };
}

function stopQueueScoreStream() {
  if (queueScoreEvents) {
    queueScoreEvents.close();
    queueScoreEvents = null;
  }
}

async function deleteNoteShooterScore({ id, playerId = "", scope = "" }: any) {
  if (!id && !playerId) return;
  try {
    const response = await apiFetch("/api/note-shooter-scores", {
      method: "DELETE",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ id, playerId, scope }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent("/scores")}`);
        return;
      }
      throw new Error(result.message || "删除失败");
    }
    queueScores.value = result;
    queueScoresUpdatedAt.value = Date.now();
    queueScoreError.value = "";
    await loadQueueScores(true);
  } catch (error: any) {
    queueScoreError.value = error.message || "删除失败";
  }
}

onMounted(() => {
  if (!queueScores.value && !queueScoresLoading.value && !queueScoreError.value) {
    loadQueueScores();
  }
  startQueueScoreStream();
});

onUnmounted(() => {
  stopQueueScoreStream();
});
</script>
