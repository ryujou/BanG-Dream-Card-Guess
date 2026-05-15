<template>
  <main class="shell player-shell">
    <section class="game-panel player-panel">
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
      
      <div v-if="!revealed && showRecropButton" class="player-controls">
        <button 
          data-command="recrop" 
          :disabled="!canRecrop" 
          @click="handleRecrop"
        >
          重切 {{ recropsLeft }}
        </button>
      </div>
      
      <div v-if="!(revealed && current)" class="player-result">
        <strong>{{ game?.message || "等待主持开始" }}</strong>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
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
const showRecropButton = computed(() => settings.value?.showPlayerRecrop !== false);
const canRecrop = computed(() => 
  game.value?.status === "playing" && 
  settings.value?.allowRecrop && 
  Number(game.value?.recrops || 0) < Number(settings.value?.maxRecrops || 0)
);
const recropsLeft = computed(() => 
  Math.max(0, Number(settings.value?.maxRecrops || 0) - Number(game.value?.recrops || 0))
);

function handleRecrop() {
  gameStore.command('recrop');
}
</script>
