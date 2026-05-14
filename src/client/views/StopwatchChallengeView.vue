<template>
  <div ref="container">
    <main class="stopwatch-page" data-mode="idle">
      <section class="stopwatch-card stopwatch-card-minimal">
        <div class="stopwatch-display-wrap">
          <div class="stopwatch-target">加载中...</div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const container = ref<HTMLElement | null>(null);

onMounted(async () => {
  try {
    // @ts-ignore
    const mod = await import('../../web/stopwatch-challenge.js');
    if (container.value) {
      mod.mountStopwatchChallenge(container.value);
    }
  } catch (e) {
    if (container.value) {
      container.value.innerHTML = `<main class="login-shell"><section class="login-panel"><h1>加载失败</h1><p>请刷新后重试</p></section></main>`;
    }
  }
});
</script>
