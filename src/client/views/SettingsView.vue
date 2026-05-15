<template>
  <main class="settings-shell">
    <section class="settings-panel">
      <div class="settings-head">
        <div>
          <p class="eyebrow">Booth Settings</p>
          <h1>设置</h1>
        </div>
        <div class="nav-links">
          <router-link to="/player">玩家页</router-link>
          <router-link to="/host">主持页</router-link>
          <router-link to="/qr">二维码</router-link>
          <a href="/community-admin">同好会主页编辑</a>
          <button type="button" @click="logout">退出</button>
        </div>
      </div>

      <form id="settingsForm" class="settings-grid" @submit.prevent="saveSettings" @input="markDirty" @change="markDirty">
        <label class="setting-field">
          <span>模式</span>
          <select name="mode" v-model="draft.mode">
            <option value="single">单人挑战</option>
            <option value="versus">双队互动</option>
          </select>
        </label>
        
        <label class="setting-field">
          <span>难度预设</span>
          <select name="difficulty" v-model="draft.difficulty" @change="applyDifficultyPreset">
            <option value="easy">简单</option>
            <option value="normal">普通</option>
            <option value="hard">困难</option>
          </select>
        </label>
        
        <label class="setting-field">
          <span>人脸策略</span>
          <select name="faceCropMode" v-model="draft.faceCropMode">
            <option value="auto">跟随难度</option>
            <option value="none">不限制</option>
            <option value="avoid">避开人脸</option>
            <option value="prefer">优先人脸</option>
            <option value="only">只切人脸</option>
          </select>
        </label>
        
        <label class="setting-field"><span>每题秒数</span><input name="roundSeconds" type="number" min="10" max="300" v-model.number="draft.roundSeconds"></label>
        <label class="setting-field"><span>每人题数</span><input name="questionsPerPlayer" type="number" min="1" max="30" v-model.number="draft.questionsPerPlayer"></label>
        <label class="setting-field"><span>裁剪尺寸</span><input name="cropSize" type="number" min="60" max="260" v-model.number="draft.cropSize"></label>
        <label class="setting-field"><span>智能候选数</span><input name="candidateCount" type="number" min="30" max="300" v-model.number="draft.candidateCount"></label>
        <label class="setting-field"><span>最大重切</span><input name="maxRecrops" type="number" min="0" max="20" v-model.number="draft.maxRecrops"></label>
        <label class="setting-field"><span>卡面去重窗口</span><input name="avoidRecentCards" type="number" min="0" max="200" v-model.number="draft.avoidRecentCards"></label>
        <label class="setting-field"><span>角色去重窗口</span><input name="avoidRecentCharacters" type="number" min="0" max="40" v-model.number="draft.avoidRecentCharacters"></label>
        <label class="setting-field"><span>答对加分</span><input name="correctPoints" type="number" min="0" max="100" v-model.number="draft.correctPoints"></label>
        <label class="setting-field"><span>答错扣分</span><input name="wrongPenalty" type="number" min="0" max="100" v-model.number="draft.wrongPenalty"></label>
        <label class="setting-field"><span>自动下一题延迟(ms)</span><input name="autoNextDelay" type="number" min="300" max="10000" v-model.number="draft.autoNextDelay"></label>
        
        <label class="setting-field"><span>A 队名称</span><input name="teamAName" type="text" v-model="draft.teamAName"></label>
        <label class="setting-field"><span>B 队名称</span><input name="teamBName" type="text" v-model="draft.teamBName"></label>
        
        <fieldset class="setting-group">
          <legend>特训状态 (都选或都不选等于混合)</legend>
          <div class="checkbox-list">
            <label><input type="checkbox" value="normal" v-model="draft.cardVariants">特训前</label>
            <label><input type="checkbox" value="trained" v-model="draft.cardVariants">特训后</label>
          </div>
        </fieldset>
        
        <fieldset class="setting-group">
          <legend>卡面人数 (都选或都不选等于不限)</legend>
          <div class="checkbox-list">
            <label><input type="checkbox" value="single" v-model="draft.cardCharacterLimits">单人</label>
            <label><input type="checkbox" value="multiple" v-model="draft.cardCharacterLimits">多人</label>
          </div>
        </fieldset>
        
        <fieldset class="setting-group">
          <legend>乐队筛选</legend>
          <div class="checkbox-list">
            <label v-for="band in bands" :key="band.id">
              <input type="checkbox" :value="String(band.id)" v-model="draft.cardBands">{{ band.name }}
            </label>
          </div>
        </fieldset>
        
        <fieldset class="setting-group">
          <legend>稀有度筛选</legend>
          <div class="checkbox-list">
            <label v-for="rarity in rarities" :key="rarity">
              <input type="checkbox" :value="String(rarity)" v-model="draft.cardRarities">{{ rarity }} 星
            </label>
          </div>
        </fieldset>
        
        <fieldset class="setting-group">
          <legend>属性筛选</legend>
          <div class="checkbox-list">
            <label v-for="attr in attributes" :key="attr">
              <input type="checkbox" :value="attr" v-model="draft.cardAttributes">{{ ATTRIBUTE_LABELS[attr] || attr }}
            </label>
          </div>
        </fieldset>
        
        <label class="setting-check">
          <input type="checkbox" name="allowRecrop" v-model="draft.allowRecrop">
          <span>允许重切</span>
        </label>
        <label class="setting-check">
          <input type="checkbox" name="showPlayerRecrop" v-model="draft.showPlayerRecrop">
          <span>玩家页显示重切</span>
        </label>
        <label class="setting-check">
          <input type="checkbox" name="soundEnabled" v-model="draft.soundEnabled">
          <span>开启音效</span>
        </label>
        <label class="setting-check">
          <input type="checkbox" name="showTimer" v-model="draft.showTimer">
          <span>显示倒计时</span>
        </label>
        <label class="setting-check">
          <input type="checkbox" name="revealAfterJudge" v-model="draft.revealAfterJudge">
          <span>判定后自动揭晓</span>
        </label>
        <label class="setting-check">
          <input type="checkbox" name="streakBonus" v-model="draft.streakBonus">
          <span>连击加分</span>
        </label>
        <label class="setting-check">
          <input type="checkbox" name="autoNext" v-model="draft.autoNext">
          <span>自动下一题</span>
        </label>
        
        <div class="settings-actions">
          <button class="primary" type="submit">保存设置</button>
          <button type="button" @click="command('reset')">重置游戏</button>
          <button type="button" @click="exportSettings">导出设置</button>
          <button type="button" @click="importFile?.click()">导入设置</button>
          <input ref="importFile" id="importSettingsFile" type="file" accept="application/json" hidden @change="importSettingsFile" />
        </div>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useGameStore } from '../stores/game';
import { apiFetch } from '../api/http';

const router = useRouter();
const gameStore = useGameStore();
const { snapshot } = storeToRefs(gameStore);

const settingsDirty = ref(false);
const settingsSaving = ref(false);

const importFile = ref<HTMLInputElement | null>(null);

const DIFFICULTY_PRESETS: Record<string, { label: string, cropSize: number, candidateCount: number }> = {
  easy: { label: "简单", cropSize: 230, candidateCount: 90 },
  normal: { label: "普通", cropSize: 180, candidateCount: 120 },
  hard: { label: "困难", cropSize: 130, candidateCount: 170 },
};

const ATTRIBUTE_LABELS: Record<string, string> = {
  cool: "Cool",
  happy: "Happy",
  powerful: "Powerful",
  pure: "Pure",
};

const defaultDraft = () => ({
  mode: "single",
  difficulty: "normal",
  faceCropMode: "auto",
  roundSeconds: 10,
  questionsPerPlayer: 5,
  cropSize: 180,
  candidateCount: 120,
  maxRecrops: 3,
  avoidRecentCards: 50,
  avoidRecentCharacters: 10,
  correctPoints: 10,
  wrongPenalty: 0,
  autoNextDelay: 3000,
  teamAName: "A 队",
  teamBName: "B 队",
  cardVariants: [] as string[],
  cardCharacterLimits: [] as string[],
  cardBands: [] as string[],
  cardRarities: [] as string[],
  cardAttributes: [] as string[],
  allowRecrop: true,
  showPlayerRecrop: true,
  soundEnabled: true,
  showTimer: true,
  revealAfterJudge: true,
  streakBonus: false,
  autoNext: false,
});

const draft = ref(defaultDraft());

const bands = computed(() => (snapshot.value?.meta?.bands as any[]) || []);
const rarities = computed(() => snapshot.value?.meta?.rarities || [1, 2, 3, 4, 5]);
const attributes = computed(() => snapshot.value?.meta?.attributes || ["cool", "happy", "powerful", "pure"]);

watch(() => snapshot.value, (newSnapshot) => {
  if (settingsDirty.value) return;
  if (settingsSaving.value) {
    settingsSaving.value = false;
    settingsDirty.value = false;
    return;
  }
  
  if (newSnapshot?.settings) {
    const s: any = newSnapshot.settings;
    const g: any = newSnapshot.game;
    
    draft.value = {
      ...defaultDraft(),
      ...s,
      cardVariants: s.cardVariants || [],
      cardCharacterLimits: s.cardCharacterLimits || [],
      cardBands: (s.cardBands || []).map(String),
      cardRarities: (s.cardRarities || []).map(String),
      cardAttributes: s.cardAttributes || [],
      teamAName: g?.teams?.A?.name || s.teamAName || "A 队",
      teamBName: g?.teams?.B?.name || s.teamBName || "B 队",
    };
  }
}, { immediate: true });

function markDirty() {
  settingsDirty.value = true;
}

function applyDifficultyPreset() {
  const preset = DIFFICULTY_PRESETS[draft.value.difficulty];
  if (preset) {
    draft.value.cropSize = preset.cropSize;
    draft.value.candidateCount = preset.candidateCount;
    markDirty();
  }
}

function command(cmd: string, payload: any = {}) {
  gameStore.command(cmd, payload);
}

function saveSettings() {
  settingsDirty.value = false;
  settingsSaving.value = true;
  command("settings", { ...draft.value });
}

function exportSettings() {
  const payload = {
    settings: snapshot.value?.settings || {},
    teams: snapshot.value?.game?.teams || {},
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bangbangcai-settings.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importSettingsFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  try {
    const value = JSON.parse(await file.text());
    const imported = value.settings || value;
    const teams = value.teams || {};
    settingsDirty.value = false;
    settingsSaving.value = true;
    command("importSettings", {
      ...imported,
      teamAName: teams.A?.name || imported.teamAName,
      teamBName: teams.B?.name || imported.teamBName,
    });
  } catch {
    alert("设置文件格式不正确");
  } finally {
    (event.target as HTMLInputElement).value = "";
  }
}

async function logout() {
  try {
    await apiFetch("/api/logout", { method: "POST" });
    router.push("/login");
  } catch (e) {
    console.error(e);
  }
}
</script>
