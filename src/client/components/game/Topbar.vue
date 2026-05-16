<template>
  <div class="topbar">
    <div>
      <p class="eyebrow">BanG Dream! Card Guess</p>
      <h1>邦邦猜</h1>
      <span v-if="!connected" class="screen-label">离线</span>
    </div>
    
    <div v-if="showCommunityLink" class="player-top-actions">
      <a class="community-link" :href="COMMUNITY_URL" target="_blank" rel="noreferrer">
        <span>湘潭同好会</span>
        <strong>加入群聊</strong>
      </a>
      <a class="community-link queue-link" href="/note-shooter">
        <span>音符射手</span>
        <strong>开源小游戏</strong>
      </a>
      <button class="fullscreen-button" id="fullscreenButton" type="button" aria-label="进入全屏" @click="toggleFullscreen">
        <span>全屏</span>
      </button>
    </div>
    
    <div class="scoreboard" aria-label="score">
      <div><span>{{ game?.score ?? 0 }}</span><small>得分</small></div>
      <div><span>{{ game?.streak ?? 0 }}</span><small>连击</small></div>
      <div><span>{{ game?.total ?? 0 }}</span><small>回合</small></div>
    </div>
    
    <div v-if="settings?.mode === 'versus'" class="team-score">
      <span>{{ game?.teams?.A?.name || "A 队" }} {{ game?.teams?.A?.score || 0 }}</span>
      <span>{{ game?.teams?.B?.name || "B 队" }} {{ game?.teams?.B?.score || 0 }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ClientGameSettings, ClientGameState } from '../../types/ui';

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";

const props = defineProps<{
  game?: ClientGameState;
  settings?: ClientGameSettings;
  connected?: boolean;
  showCommunityLink?: boolean;
}>();

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}
</script>
