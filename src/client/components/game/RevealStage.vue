<template>
  <div class="reveal-stage">
    <div class="answer-visual">
      <img class="answer-backdrop" :src="current?.imageUrl" alt="" aria-hidden="true" />
      <div
        class="answer-frame"
        :style="{
          '--image-ratio': ((current?.imageWidth || 1) / (current?.imageHeight || 1)).toString(),
          'aspect-ratio': `${current?.imageWidth || 1} / ${current?.imageHeight || 1}`
        }"
      >
        <img class="answer-image" :src="current?.imageUrl" :alt="current?.displayName || '答案'" />
        
        <span
          v-if="showCropMarker && current?.crop && current?.imageWidth && current?.imageHeight"
          class="crop-marker"
          :style="{
            left: `${(current.crop.x / current.imageWidth) * 100}%`,
            top: `${(current.crop.y / current.imageHeight) * 100}%`,
            width: `${(current.crop.size / current.imageWidth) * 100}%`,
            height: `${(current.crop.size / current.imageHeight) * 100}%`
          }"
        ></span>
      </div>
    </div>
    <div class="answer-meta">
      <span>{{ badge }}</span>
      <strong>{{ current?.displayName || "" }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ClientCurrentCard, ClientGameState } from '../../types/ui';

const props = defineProps<{
  current: ClientCurrentCard | null | undefined;
  game?: Partial<ClientGameState>;
}>();

const badge = computed(() => props.game?.message || "答案揭晓");
const showCropMarker = true; // Always true from renderRevealStage in main.js
</script>
