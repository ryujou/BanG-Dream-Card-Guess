<template>
  <main class="stats-page">
    <section class="card">
      <h1>访问来源地区</h1>
      <p class="desc">仅展示国家/地区聚合统计，不展示页面路径、来源站或其他明细。</p>

      <div v-if="!hasConfiguredShareUrl()" class="empty">统计展示页尚未配置，请设置 UMAMI_SHARE_URL。</div>
      <div v-else-if="loading" class="empty">正在加载统计数据...</div>
      <div v-else-if="error" class="empty">加载失败：{{ error }}</div>

      <table v-else class="table">
        <thead>
          <tr>
            <th>国家/地区</th>
            <th>访客</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.code">
            <td>{{ item.name }}</td>
            <td>{{ item.value }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="2" class="muted">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { hasConfiguredShareUrl, umamiConfig } from '../config/umami';

type UmamiShareResponse = { websiteId: string; token: string };
type CountryMetric = { x: string; y: number };
type Row = { code: string; name: string; value: number };

const loading = ref(false);
const error = ref('');
const rows = ref<Row[]>([]);

const REGION_NAMES: Record<string, string> = {
  CN: '中国', SG: '新加坡', JP: '日本', KR: '韩国', US: '美国', HK: '中国香港', TW: '中国台湾',
  GB: '英国', DE: '德国', FR: '法国', CA: '加拿大', AU: '澳大利亚', IN: '印度',
};

function parseShareSlug(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/share/');
  return idx >= 0 ? trimmed.slice(idx + '/share/'.length) : '';
}

async function loadCountryRows(): Promise<Row[]> {
  const slug = parseShareSlug(umamiConfig.shareUrl);
  if (!slug) return [];

  const shareRes = await fetch(`/api/share/${slug}`);
  if (!shareRes.ok) throw new Error('无法获取 share 配置');
  const shareData = (await shareRes.json()) as UmamiShareResponse;

  const endAt = Date.now();
  const startAt = endAt - 30 * 24 * 60 * 60 * 1000;
  const url = `/api/websites/${shareData.websiteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=country&limit=100`;

  const metricsRes = await fetch(url, {
    headers: {
      'x-umami-share-token': shareData.token,
      'x-umami-share-context': '1',
      accept: 'application/json',
      'content-type': 'application/json',
    },
    referrer: `/share/${slug}`,
    referrerPolicy: 'strict-origin-when-cross-origin',
  });

  if (!metricsRes.ok) throw new Error(`数据接口异常（${metricsRes.status}）`);

  const data = (await metricsRes.json()) as CountryMetric[];
  return (Array.isArray(data) ? data : [])
    .filter((x) => x.x && Number.isFinite(x.y))
    .map((x) => ({
      code: x.x.toUpperCase(),
      name: REGION_NAMES[x.x.toUpperCase()] || x.x.toUpperCase(),
      value: x.y,
    }))
    .sort((a, b) => b.value - a.value);
}

onMounted(async () => {
  if (!hasConfiguredShareUrl()) return;
  loading.value = true;
  error.value = '';
  try {
    rows.value = await loadCountryRows();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '未知错误';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.stats-page {
  min-height: 100vh;
  padding: 24px 14px;
}

.card {
  max-width: 880px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(20, 28, 45, 0.08);
  border-radius: 14px;
  padding: 18px;
}

h1 {
  margin: 0;
  font-size: 1.7rem;
}

.desc {
  margin: 8px 0 14px;
  color: #4b5563;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  padding: 10px 8px;
  text-align: left;
}

th:last-child,
td:last-child {
  text-align: right;
}

.empty,
.muted {
  color: #6b7280;
}
</style>
