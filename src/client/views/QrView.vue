<template>
  <main class="qr-shell">
    <section class="qr-panel">
      <div class="qr-head">
        <div>
          <p class="eyebrow">Booth QR Codes</p>
          <h1>扫码入口</h1>
        </div>
        <div class="qr-actions">
          <button class="primary" id="printQr" type="button" @click="printQr">打印</button>
          <router-link to="/note-shooter">音符射手</router-link>
          <router-link v-if="appMode === 'solo'" to="/solo">自玩页</router-link>
          <template v-else>
            <router-link to="/player">玩家页</router-link>
            <router-link to="/login">主持登录</router-link>
          </template>
        </div>
      </div>

      <div v-if="qrError" class="login-error">{{ qrError }}</div>
      
      <div class="qr-grid">
        <article v-for="(item, idx) in qrCards" :key="idx" class="qr-card">
          <div>
            <span>{{ item.tag }}</span>
            <h2>{{ item.title }}</h2>
          </div>
          <img :src="`/api/qr?text=${encodeURIComponent(item.url)}`" :alt="item.title + '二维码'" />
          <code>{{ item.url }}</code>
        </article>
      </div>

      <div class="wifi-panel">
        <div>
          <strong>Wi-Fi 二维码</strong>
        </div>
        <form id="wifiForm" class="wifi-form" @submit.prevent="handleWifiForm">
          <input name="ssid" type="text" placeholder="Wi-Fi 名称" v-model="wifiForm.ssid" />
          <input name="password" type="text" placeholder="Wi-Fi 密码" v-model="wifiForm.password" />
          <select name="auth" v-model="wifiForm.auth">
            <option value="WPA">WPA/WPA2</option>
            <option value="nopass">无密码</option>
          </select>
          <button class="primary" type="submit">生成 Wi-Fi 码</button>
        </form>
        <div v-if="wifiText" class="wifi-qr">
          <img :src="`/api/qr?text=${encodeURIComponent(wifiText)}`" alt="Wi-Fi 二维码" />
          <code>{{ wifiQr.ssid }}</code>
        </div>
      </div>

      <div v-if="lanEntries.length" class="qr-lan">
        <strong>检测到的局域网地址</strong>
        <code v-for="(entry, idx) in lanEntries" :key="idx">
          {{ entry.pages?.player || `${entry.origin}/player` }}
        </code>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { loadWifiQr, saveWifiQr, wifiQrText } from '../utils/storage';
import type { NetworkEntry, NetworkInfo, NetworkPages } from '../types/ui';

const qrInfo = ref<NetworkInfo | null>(null);
const qrLoading = ref(false);
const qrError = ref("");

const wifiQr = ref(loadWifiQr());
const wifiForm = ref({ ...wifiQr.value });

const wifiText = computed(() => {
  return wifiQrText(wifiQr.value);
});

function handleWifiForm() {
  wifiQr.value = { ...wifiForm.value };
  saveWifiQr(wifiQr.value);
}

const appMode = computed(() => qrInfo.value?.appMode || "booth");

const fallbackPages = computed(() => ({
  player: `${window.location.origin}/player`,
  noteShooter: `${window.location.origin}/note-shooter`,
  queue: `${window.location.origin}/note-shooter`,
  login: `${window.location.origin}/login`,
  settings: `${window.location.origin}/settings`,
  solo: `${window.location.origin}/solo`,
  qr: `${window.location.origin}/qr`,
}));

const primaryEntry = computed<NetworkEntry>(() => {
  const entries = qrInfo.value?.entries || [];
  return entries.find((entry) => !entry.local) || {
    origin: qrInfo.value?.currentOrigin || window.location.origin,
    pages: qrInfo.value?.pages || fallbackPages.value,
  };
});

const pages = computed<NetworkPages>(() => ({ ...fallbackPages.value, ...(primaryEntry.value.pages || {}) }));

const qrCards = computed(() => {
  return appMode.value === "solo"
    ? [
        { title: "自己玩模式", tag: "Solo", url: pages.value.solo },
        { title: "音符射手", tag: "Note Shooter", url: pages.value.noteShooter },
        { title: "入口总览", tag: "QR", url: pages.value.qr },
      ]
    : [
        { title: "玩家页", tag: "Player", url: pages.value.player },
        { title: "音符射手", tag: "Note Shooter", url: pages.value.noteShooter },
        { title: "主持登录", tag: "Host", url: pages.value.login },
        { title: "设置页", tag: "Setup", url: pages.value.settings },
      ];
});

const lanEntries = computed(() => {
  return (qrInfo.value?.entries || []).filter((entry) => !entry.local);
});

async function loadQrInfo() {
  qrLoading.value = true;
  try {
    const response = await fetch("/api/network");
    if (!response.ok) throw new Error("获取网络地址失败");
    qrInfo.value = await response.json();
  } catch (error: unknown) {
    qrError.value = error instanceof Error ? error.message : "获取网络地址失败";
  } finally {
    qrLoading.value = false;
  }
}

function printQr() {
  window.print();
}

onMounted(() => {
  loadQrInfo();
});
</script>
