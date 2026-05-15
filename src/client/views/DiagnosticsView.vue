<template>
  <main class="diagnostics-shell">
    <section class="diagnostics-panel">
      <div class="diagnostics-head">
        <div>
          <p class="eyebrow">Runtime Diagnostics</p>
          <h1>运行诊断</h1>
        </div>
        <div class="diagnostics-actions">
          <button class="primary" type="button" @click="loadDiagnostics">刷新</button>
          <button type="button" @click="copyDiagnostics">复制诊断信息</button>
          <router-link to="/login" v-if="unauthorized">登录主持端</router-link>
        </div>
      </div>

      <div v-if="error" class="login-error">{{ error }}</div>
      <div v-if="unauthorized" class="diagnostics-note">当前显示公开 health 摘要。登录主持端后可查看完整诊断信息。</div>

      <div class="diagnostics-grid">
        <article>
          <span>状态</span>
          <strong>{{ health.ok ? 'OK' : 'Unknown' }}</strong>
          <small>{{ health.appMode || '-' }} · {{ health.version || '-' }}</small>
        </article>
        <article>
          <span>WebSocket</span>
          <strong>{{ health.connectedClients ?? 0 }}</strong>
          <small>clients</small>
        </article>
        <article>
          <span>缓存</span>
          <strong>{{ health.cache?.cachePercent ?? health.cachePercent ?? 0 }}%</strong>
          <small>{{ health.cache?.cachedSets ?? health.cachedSets ?? 0 }} sets</small>
        </article>
        <article>
          <span>最近错误</span>
          <strong>{{ health.errors?.recentCount ?? 0 }}</strong>
          <small>{{ health.errors?.lastMessage || 'none' }}</small>
        </article>
      </div>

      <div class="diagnostics-columns">
        <section>
          <h2>服务</h2>
          <dl>
            <div><dt>Node</dt><dd>{{ health.nodeVersion || '-' }}</dd></div>
            <div><dt>Uptime</dt><dd>{{ Math.round((health.uptimeMs || 0) / 1000) }}s</dd></div>
            <div><dt>Game</dt><dd>{{ health.game?.status || '-' }}</dd></div>
            <div><dt>Network</dt><dd>{{ health.network?.addressesCount ?? 0 }} addresses</dd></div>
          </dl>
        </section>

        <section>
          <h2>诊断 JSON</h2>
          <pre>{{ formattedDiagnostics }}</pre>
        </section>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const diagnostics = ref<any>(null);
const health = ref<any>({});
const error = ref('');
const unauthorized = ref(false);

const formattedDiagnostics = computed(() => JSON.stringify(diagnostics.value || { health: health.value }, null, 2));

async function loadDiagnostics() {
  error.value = '';
  unauthorized.value = false;
  try {
    const response = await fetch('/api/diagnostics');
    if (response.status === 401) {
      unauthorized.value = true;
      await loadHealth();
      diagnostics.value = { health: health.value };
      return;
    }
    if (!response.ok) throw new Error('诊断信息获取失败');
    diagnostics.value = await response.json();
    health.value = diagnostics.value.health || {};
  } catch (err: any) {
    error.value = err.message || '诊断信息获取失败';
    await loadHealth();
  }
}

async function loadHealth() {
  const response = await fetch('/api/health');
  if (response.ok) health.value = await response.json();
}

async function copyDiagnostics() {
  const text = formattedDiagnostics.value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

onMounted(loadDiagnostics);
</script>
