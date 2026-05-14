<template>
  <div class="stage">
    <div class="status-strip">
      <div class="timer">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 7v5l3 2"></path>
        </svg>
        <span>{{ game?.leftSeconds ?? "--" }}</span>
      </div>
      <div class="round-state">{{ statusText }}</div>
    </div>
    <div class="crop-grid" aria-live="polite">
      <div v-if="game?.loading" class="crop-tile skeleton"></div>
      <div v-else-if="crop" class="crop-tile" :class="{ 'is-new-crop': isNewCrop }">
        <img :src="crop.image" alt="裁剪卡面" />
      </div>
      <div v-else class="empty-state"><span>?</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { statusText as getStatusText } from '../../utils/stateText';

const props = defineProps<{
  game?: any;
}>();

const cropKey = computed(() => {
  const c = props.game?.current?.crop;
  return c ? `${props.game?.current?.imageUrl || ""}:${c.x}:${c.y}:${c.size}` : "";
});

const lastStageCropKey = ref("");
const isNewCrop = ref(false);

watch(() => cropKey.value, (newKey, oldKey) => {
  if (newKey && newKey !== oldKey) {
    isNewCrop.value = true;
    lastStageCropKey.value = newKey;
    // reset animation class after tick if needed, wait, old logic:
    // const isNewCrop = Boolean(cropKey && cropKey !== lastStageCropKey);
    // if (cropKey) lastStageCropKey = cropKey;
    // We just rely on Vue updating the class.
    setTimeout(() => {
      isNewCrop.value = false;
    }, 500); // 500ms animation duration
  }
}, { immediate: true });

const crop = computed(() => props.game?.current?.crop);

const statusText = computed(() => {
  return getStatusText(props.game?.status);
});
</script>
