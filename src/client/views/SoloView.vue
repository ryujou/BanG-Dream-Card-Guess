<template>
  <main class="shell player-shell">
    <section class="game-panel player-panel solo-panel">
      <Topbar 
        :game="game" 
        :settings="settings" 
        :connected="connected"
        :showCommunityLink="true"
      />
      
      <RevealStage 
        v-if="revealed && current" 
        :current="current" 
        :game="game" 
      />
      <GameStage 
        v-else 
        :game="game" 
      />
      
      <form class="solo-answer" id="soloAnswer" @submit.prevent="submitGuess">
        <input 
          name="guess" 
          type="text" 
          placeholder="输入角色名或昵称" 
          autocomplete="off" 
          :disabled="!canPlay" 
          v-model="soloGuess" 
        />
        <button class="primary" type="submit" :disabled="!canPlay">提交答案</button>
      </form>
      
      <div class="solo-controls">
        <button class="primary" @click="command('start')">{{ current ? '下一题' : '开始' }}</button>
        <button 
          :disabled="!canPlay || !settings?.allowRecrop || (game?.recrops || 0) >= (settings?.maxRecrops || 0)" 
          @click="command('recrop')"
        >
          重切 {{ Math.max(0, (settings?.maxRecrops || 0) - (game?.recrops || 0)) }}
        </button>
        <button :disabled="!current || game?.status === 'idle'" @click="command('reveal')">揭晓</button>
        <button class="danger" :disabled="game?.status === 'idle'" @click="command('stop')">停止游戏</button>
        <button @click="command('reset')">重置</button>
      </div>
      
      <div class="player-result">
        <strong>{{ game?.message || '点击开始' }}</strong>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useGameStore } from '../stores/game';
import Topbar from '../components/game/Topbar.vue';
import GameStage from '../components/game/GameStage.vue';
import RevealStage from '../components/game/RevealStage.vue';

const gameStore = useGameStore();
const { snapshot, connected } = storeToRefs(gameStore);

const game = computed(() => snapshot.value?.game);
const settings = computed(() => snapshot.value?.settings);
const current = computed(() => game.value?.current);

const revealed = computed(() => ["revealed", "finished"].includes(game.value?.status || ''));
const canPlay = computed(() => game.value?.status === "playing");

const soloGuess = ref("");

function command(cmd: string) {
  soloGuess.value = "";
  gameStore.command(cmd);
}

function submitGuess() {
  const guess = soloGuess.value;
  soloGuess.value = "";
  gameStore.command("selfGuess", { guess: guess || "" });
}
</script>
