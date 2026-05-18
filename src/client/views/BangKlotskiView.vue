<template>
  <main class="bang-klotski-shell">
    <section class="bang-klotski-panel">
      <div class="bang-klotski-head">
        <div>
          <p class="eyebrow">Mini Game</p>
          <h1>BanG 华容道</h1>
        </div>
        <div class="qr-actions">
          <router-link to="/">返回首页</router-link>
        </div>
      </div>
      <div class="bang-klotski-frame-wrap">
        <iframe
          class="bang-klotski-frame"
          src="/games/bang-klotski/index.html"
          title="BanG Klotski Enhanced"
          allow="autoplay; fullscreen"
          loading="eager"
        ></iframe>
      </div>
      <p class="bang-klotski-credit">
        原仓库：<a href="https://github.com/KasumiAmi/BanGKlotski_Enhanced" target="_blank" rel="noreferrer">https://github.com/KasumiAmi/BanGKlotski_Enhanced</a>；本项目仅作为网页内嵌小游戏页面使用。
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
// Bang Klotski wrapper view
</script>
