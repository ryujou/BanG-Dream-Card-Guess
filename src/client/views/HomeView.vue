<template>
  <main class="linktree-shell">
    <div class="linktree-container">
      <header class="linktree-header">
        <div class="linktree-icon-grid">
          <img class="linktree-avatar" src="/icon5.png" alt="湘潭 BanG Dream! 同好会" />
          <img class="linktree-avatar" src="/icon4.png" alt="湘潭 BanG Dream! 同好会图标4" />
          <img class="linktree-avatar" src="/icon3.png" alt="湘潭 BanG Dream! 同好会图标3" />
        </div>
        <h1 class="linktree-title">湘潭 BanG Dream! 同好会</h1>
        <p v-if="data.aboutUs" class="linktree-bio">{{ data.aboutUs }}</p>
      </header>

      <section class="linktree-links">
        <router-link class="linktree-pill primary-pill" to="/player">
          <span class="pill-icon">🎮</span>
          <span class="pill-text">进入猜卡游戏 (玩家页)</span>
        </router-link>
        <router-link class="linktree-pill" to="/host">
          <span class="pill-icon">👑</span>
          <span class="pill-text">游戏控制台 (主持页)</span>
        </router-link>
        <router-link class="linktree-pill" to="/note-shooter">
          <span class="pill-icon">🎍</span>
          <span class="pill-text">打发时间: 音符射手</span>
        </router-link>
        <router-link class="linktree-pill" to="/stopwatch-challenge">
          <span class="pill-icon">⏱</span>
          <span class="pill-text">掐秒表挑战</span>
        </router-link>
        <router-link class="linktree-pill" to="/games/bang-klotski">
          <span class="pill-icon">🧩</span>
          <span class="pill-text">华容道小游戏</span>
        </router-link>
        <a class="linktree-pill" href="https://enldm.cyou/bangmap" target="_blank" rel="noreferrer">
          <span class="pill-icon">🗺️</span>
          <span class="pill-text">BanG Map 同好会地图</span>
        </a>
        <a class="linktree-pill highlight-pill" :href="COMMUNITY_URL" target="_blank" rel="noreferrer">
          <span class="pill-icon">💬</span>
          <span class="pill-text">点击加入官方交流群</span>
        </a>
      </section>

      <section v-if="data.socialLinks && data.socialLinks.length" class="linktree-section">
        <h2>更多平台</h2>
        <div class="linktree-links">
          <a v-for="(link, i) in data.socialLinks" :key="i" class="linktree-pill" :href="safeUrl(link.url)" target="_blank" rel="noreferrer">
            <span class="pill-text">{{ link.title }}</span>
          </a>
        </div>
      </section>

      <section v-if="data.members && data.members.length" class="linktree-section">
        <h2>成员 / 贡献者</h2>
        <div class="linktree-member-grid">
          <a v-for="(member, i) in data.members" :key="i" class="linktree-member" :href="safeUrl(member.link) || '#'" :target="member.link ? '_blank' : undefined" :rel="member.link ? 'noreferrer' : undefined">
            <img class="member-avatar" :src="safeUrl(member.avatar)" :alt="member.name" />
            <div class="member-info">
              <strong class="member-name">{{ member.name }}</strong>
              <span v-if="member.role" class="member-role">{{ member.role }}</span>
            </div>
          </a>
        </div>
      </section>

      <section v-if="data.events && data.events.length" class="linktree-section">
        <h2>近期活动</h2>
        <div class="linktree-event-list">
          <article v-for="(event, i) in data.events" :key="i" class="linktree-event">
            <div class="event-date">{{ event.date }}</div>
            <h3 class="event-title">{{ event.title }}</h3>
            <p v-if="event.description" class="event-desc">{{ event.description }}</p>
          </article>
        </div>
      </section>

      <section v-if="data.photos && data.photos.length" class="linktree-section">
        <h2>活动返图</h2>
        <div class="linktree-photo-grid">
          <a v-for="(photo, i) in data.photos" :key="i" class="photo-card" :href="safeUrl(photo.url)" target="_blank" rel="noreferrer">
            <img :src="safeUrl(photo.url)" :alt="photo.caption || '活动照片'" loading="lazy" />
            <span v-if="photo.caption" class="photo-caption">{{ photo.caption }}</span>
          </a>
        </div>
      </section>

      <footer class="linktree-footer">
        <p>BanG Dream! Card Guess / 湘潭同好会现场互动大屏</p>
      </footer>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const COMMUNITY_URL = "https://qm.qq.com/q/6ytGE7qIWQ";

const data = ref<any>({ aboutUs: "", members: [], events: [], socialLinks: [], photos: [] });

function safeUrl(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  try {
    const url = new URL(raw, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) return "#";
    return url.href;
  } catch {
    return "#";
  }
}

onMounted(async () => {
  try {
    const response = await fetch("/api/community");
    if (response.ok) {
      data.value = await response.json();
    }
  } catch (e) {
    console.error("Failed to load community data", e);
  }
});
</script>
