<template>
  <main class="shell host-shell">
    <section class="game-panel">
      <Topbar 
        :game="game" 
        :settings="settings" 
      />
      <GameStage 
        :game="game" 
      />
      <div class="host-controls">
        <button class="primary" :disabled="false" @click="command('start')">开始/下一题</button>
        <button 
          :disabled="!canPlay || !settings?.allowRecrop || Number(game?.recrops || 0) >= Number(settings?.maxRecrops || 0)" 
          @click="command('recrop')"
        >
          重切 {{ Math.max(0, Number(settings?.maxRecrops || 0) - Number(game?.recrops || 0)) }}
        </button>
        <button :disabled="!canReveal" @click="command('reveal')">揭晓</button>
        <button class="success" :disabled="!canPlay" @click="command('correct')">答对</button>
        <button class="danger" :disabled="!canPlay" @click="command('wrong')">答错</button>
        <button :disabled="!canPlay" @click="command('skip')">跳过</button>
        <button :disabled="!game?.canUndo" @click="command('undo')">撤销判定</button>
        <button class="danger" :disabled="game?.status === 'idle'" @click="command('stop')">停止游戏</button>
      </div>
      <div class="shortcut-strip">
        <span>空格 下一题</span>
        <span>R 重切</span>
        <span>V 揭晓</span>
        <span>Enter 答对</span>
        <span>Backspace 答错</span>
        <span>S 跳过</span>
        <span>U 撤销</span>
        <span>Esc 停止</span>
      </div>
      
      <div v-if="settings?.mode === 'versus'" class="team-switch">
        <button 
          @click="command('team', { team: 'A' })" 
          :class="{ 'is-active': settings.currentTeam === 'A' }"
        >
          {{ game?.teams?.A?.name || 'A 队' }}
        </button>
        <button 
          @click="command('team', { team: 'B' })" 
          :class="{ 'is-active': settings.currentTeam === 'B' }"
        >
          {{ game?.teams?.B?.name || 'B 队' }}
        </button>
      </div>
    </section>

    <aside class="side-panel">
      <div class="answer-card host-answer-card">
        <RevealStage v-if="current" :current="current" :game="{ message: '答案' }" />
        <div v-else class="answer-placeholder">?</div>
      </div>
      
      <section class="compact-panel">
        <div class="panel-title">
          <span>主持信息</span>
          <div class="panel-links">
            <router-link class="text-link" to="/settings">设置</router-link>
            <router-link class="text-link" to="/qr">二维码</router-link>
            <button class="link-button" type="button" @click="logout">退出</button>
          </div>
        </div>
        
        <div class="answer-list">
          <span>正确答案</span>
          <strong>{{ current?.displayName || "未开始" }}</strong>
          <small>{{ (current?.acceptedAnswers as string[] | undefined)?.slice(0, 10).join(" / ") || "" }}</small>
        </div>
        
        <form id="hostStopwatchSettingsForm" class="host-mini-settings" @submit.prevent="saveStopwatchSettings">
          <strong>掐秒表挑战设置</strong>
          <label class="setting-field">
            <span>目标时间（秒）</span>
            <input name="targetSeconds" type="number" min="1" max="99.99" step="0.01" v-model.number="stopwatchForm.targetSeconds" />
          </label>
          <label class="setting-field">
            <span>容差时间（秒）</span>
            <input name="toleranceSeconds" type="number" min="0.01" max="99.99" step="0.01" v-model.number="stopwatchForm.toleranceSeconds" />
          </label>
          <div class="host-mini-settings-actions">
            <button class="primary" type="submit">保存设置</button>
            <button id="hostStopwatchResetButton" type="button" @click="resetStopwatchSettings">恢复默认</button>
          </div>
          <p v-if="stopwatchError" id="hostStopwatchSettingsError" class="host-mini-settings-error">{{ stopwatchError }}</p>
        </form>
        
        <div v-if="!game?.history?.length" class="muted">暂无记录</div>
        <div v-else class="history">
          <div v-for="(item, i) in game.history" :key="i" class="history-item" :class="item.result as string">
            <span>{{ item.result === 'correct' ? '?' : '!' }}</span>
            <strong>{{ item.name }}</strong>
          </div>
        </div>
        
        <button class="reset-button" @click="command('reset')">重置本局</button>
      </section>
    </aside>
  </main>
</template>

<script setup lang="ts">
import { computed, reactive, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useGameStore } from '../stores/game';
import Topbar from '../components/game/Topbar.vue';
import GameStage from '../components/game/GameStage.vue';
import RevealStage from '../components/game/RevealStage.vue';
import { useHostShortcuts } from '../composables/useHostShortcuts';

const router = useRouter();
const gameStore = useGameStore();
const { snapshot } = storeToRefs(gameStore);

const game = computed(() => snapshot.value?.game);
const settings = computed(() => snapshot.value?.settings);
const current = computed(() => game.value?.current);

const canPlay = computed(() => game.value?.status === "playing");
const canReveal = computed(() => current.value && game.value?.status !== "idle");

const STOPWATCH_DEFAULT_SETTINGS = { targetSeconds: 10, toleranceSeconds: 0.02 };

const stopwatchForm = reactive({
  targetSeconds: STOPWATCH_DEFAULT_SETTINGS.targetSeconds,
  toleranceSeconds: STOPWATCH_DEFAULT_SETTINGS.toleranceSeconds
});

const stopwatchError = ref("");

watch(() => settings.value, (newSettings) => {
  if (newSettings) {
    stopwatchForm.targetSeconds = Number(newSettings.stopwatchTargetSeconds) || STOPWATCH_DEFAULT_SETTINGS.targetSeconds;
    stopwatchForm.toleranceSeconds = Number(newSettings.stopwatchToleranceSeconds) || STOPWATCH_DEFAULT_SETTINGS.toleranceSeconds;
  }
}, { immediate: true });

function command(cmd: string, payload: Record<string, unknown> = {}) {
  gameStore.command(cmd, payload);
}

useHostShortcuts(gameStore);

function saveStopwatchSettings() {
  stopwatchError.value = "保存中...";
  fetch("/api/settings/stopwatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stopwatchForm),
  }).then(async (res) => {
    if (res.ok) {
      stopwatchError.value = "已保存";
      setTimeout(() => { stopwatchError.value = ""; }, 2000);
    } else {
      stopwatchError.value = (await res.text()) || "保存失败";
    }
  }).catch(() => {
    stopwatchError.value = "保存失败";
  });
}

function resetStopwatchSettings() {
  stopwatchForm.targetSeconds = STOPWATCH_DEFAULT_SETTINGS.targetSeconds;
  stopwatchForm.toleranceSeconds = STOPWATCH_DEFAULT_SETTINGS.toleranceSeconds;
  saveStopwatchSettings();
}

async function logout() {
  try {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  } catch (e) {
    console.error(e);
  }
}
</script>
