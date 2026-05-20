<template>
  <main class="stats-shell">
    <section class="stats-card">
      <h1 class="stats-title">访问来源地区</h1>
      <p class="stats-desc">展示本站访问者的大致来源地区，数据来自自托管 Umami。</p>
      <div v-if="showPlaceholder" class="stats-placeholder">
        统计展示页尚未配置，请在环境变量中设置 UMAMI_SHARE_URL。
      </div>
      <iframe
        v-else
        class="stats-frame"
        :src="umamiConfig.shareUrl"
        title="访问来源地区统计"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { hasConfiguredShareUrl, umamiConfig } from '../config/umami';

const showPlaceholder = computed(() => !hasConfiguredShareUrl());
</script>

<style scoped>
.stats-shell {
  min-height: 100vh;
  padding: 24px 16px 40px;
  display: flex;
  justify-content: center;
  background: var(--bg-color, #f6f7fb);
}

.stats-card {
  width: 100%;
  max-width: 1120px;
  background: #fff;
  border: 1px solid rgba(18, 23, 38, 0.08);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 24px rgba(18, 23, 38, 0.08);
}

.stats-title {
  margin: 0;
  font-size: 1.5rem;
}

.stats-desc {
  margin: 10px 0 18px;
  color: #4f5b73;
}

.stats-placeholder {
  border: 1px dashed rgba(79, 91, 115, 0.45);
  border-radius: 12px;
  padding: 28px 16px;
  color: #4f5b73;
  background: rgba(79, 91, 115, 0.05);
}

.stats-frame {
  width: 100%;
  height: 680px;
  border: 0;
  border-radius: 12px;
  background: #fff;
}

@media (max-width: 768px) {
  .stats-shell {
    padding: 16px 12px 28px;
  }

  .stats-card {
    padding: 14px;
    border-radius: 12px;
  }

  .stats-frame {
    height: 560px;
  }
}
</style>
