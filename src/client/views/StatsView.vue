<template>
  <main class="stats-page">
    <img
      v-if="leftStandeeUrl"
      class="side-standee side-standee-left"
      :src="leftStandeeUrl"
      alt=""
      loading="eager"
      decoding="async"
    />
    <img
      v-if="rightStandeeUrl"
      class="side-standee side-standee-right"
      :src="rightStandeeUrl"
      alt=""
      loading="eager"
      decoding="async"
    />

    <section class="card">
      <h1>访问来源地区</h1>

      <div v-if="!hasConfiguredShareUrl()" class="empty">统计展示页尚未配置，请设置 UMAMI_SHARE_URL。</div>
      <div v-else-if="loading" class="empty">正在加载统计数据...</div>
      <div v-else-if="error" class="empty">加载失败：{{ error }}</div>

      <template v-else>
        <div class="map-card" v-if="worldMapSvg" v-html="worldMapSvg"></div>

        <div class="table-grid">
          <article class="table-card">
            <h2>省份/州</h2>
            <table class="table">
              <thead>
                <tr>
                  <th>地区</th>
                  <th>访客</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in regionRows" :key="`region-${item.code}`">
                  <td>{{ item.name }}</td>
                  <td>{{ item.value }}</td>
                </tr>
                <tr v-if="regionRows.length === 0">
                  <td colspan="2" class="muted">暂无省份/州数据</td>
                </tr>
              </tbody>
            </table>
          </article>

          <article class="table-card">
            <h2>国家/地区</h2>
            <table class="table">
              <thead>
                <tr>
                  <th>国家</th>
                  <th>访客</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in countryRows" :key="`country-${item.code}`">
                  <td>{{ item.name }}</td>
                  <td>{{ item.value }}</td>
                </tr>
                <tr v-if="countryRows.length === 0">
                  <td colspan="2" class="muted">暂无国家数据</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      </template>

    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { hasConfiguredShareUrl, umamiConfig } from '../config/umami';

type UmamiShareResponse = { websiteId: string; token: string };
type Metric = { x: string; y: number };
type Row = { code: string; name: string; value: number };

const loading = ref(false);
const error = ref('');
const regionRows = ref<Row[]>([]);
const countryRows = ref<Row[]>([]);
const leftStandeeUrl = ref('');
const rightStandeeUrl = ref('');
const worldMapSvg = ref('');

const STANDEES_JSON_URL = '/standees/standees.json';
const WORLD_MAP_SVG_URL = '/maps/world.svg';

const COUNTRY_NAMES: Record<string, string> = {
  CN: '中国', SG: '新加坡', JP: '日本', KR: '韩国', US: '美国', HK: '中国香港', TW: '中国台湾',
  GB: '英国', DE: '德国', FR: '法国', CA: '加拿大', AU: '澳大利亚', IN: '印度',
  TH: '泰国', MY: '马来西亚', MO: '中国澳门',
};

const PROVINCE_NAMES: Array<[RegExp, string]> = [
  [/hunan/i, '湖南'], [/hubei/i, '湖北'], [/guangdong/i, '广东'], [/guangxi/i, '广西'],
  [/beijing/i, '北京'], [/shanghai/i, '上海'], [/tianjin/i, '天津'], [/chongqing/i, '重庆'],
  [/zhejiang/i, '浙江'], [/jiangsu/i, '江苏'], [/fujian/i, '福建'], [/jiangxi/i, '江西'],
  [/anhui/i, '安徽'], [/henan/i, '河南'], [/hebei/i, '河北'], [/shanxi/i, '山西'],
  [/shaanxi/i, '陕西'], [/sichuan/i, '四川'], [/yunnan/i, '云南'], [/guizhou/i, '贵州'],
  [/liaoning/i, '辽宁'], [/jilin/i, '吉林'], [/heilongjiang/i, '黑龙江'], [/shandong/i, '山东'],
  [/gansu/i, '甘肃'], [/qinghai/i, '青海'], [/hainan/i, '海南'], [/xinjiang/i, '新疆'],
  [/ningxia/i, '宁夏'], [/inner mongolia/i, '内蒙古'], [/tibet/i, '西藏'],
  [/hong kong/i, '中国香港'], [/macau/i, '中国澳门'], [/taiwan/i, '中国台湾'],
];

const CN_REGION_CODE_MAP: Record<string, string> = {
  BJ: '北京', TJ: '天津', HE: '河北', SX: '山西', NM: '内蒙古', LN: '辽宁', JL: '吉林', HL: '黑龙江',
  SH: '上海', JS: '江苏', ZJ: '浙江', AH: '安徽', FJ: '福建', JX: '江西', SD: '山东', HA: '河南',
  HB: '湖北', HN: '湖南', GD: '广东', GX: '广西', HI: '海南', CQ: '重庆', SC: '四川', GZ: '贵州',
  YN: '云南', XZ: '西藏', SN: '陕西', GS: '甘肃', QH: '青海', NX: '宁夏', XJ: '新疆', HK: '中国香港',
  MO: '中国澳门', TW: '中国台湾',
};

const SUBDIVISION_NAMES: Record<string, string> = {
  'US-CA': '美国·加利福尼亚州',
  'US-NY': '美国·纽约州',
  'US-TX': '美国·得克萨斯州',
  'US-WA': '美国·华盛顿州',
  'US-FL': '美国·佛罗里达州',
  'US-IL': '美国·伊利诺伊州',
  'KR-11': '韩国·首尔特别市',
  'KR-26': '韩国·釜山广域市',
  'KR-27': '韩国·大邱广域市',
  'KR-28': '韩国·仁川广域市',
  'KR-29': '韩国·光州广域市',
  'KR-30': '韩国·大田广域市',
  'KR-31': '韩国·蔚山广域市',
  'TH-10': '泰国·曼谷',
};

const JP_PREFECTURES: Record<string, string> = {
  '01': '北海道', '02': '青森县', '03': '岩手县', '04': '宫城县', '05': '秋田县', '06': '山形县', '07': '福岛县',
  '08': '茨城县', '09': '栃木县', '10': '群马县', '11': '埼玉县', '12': '千叶县', '13': '东京都', '14': '神奈川县',
  '15': '新潟县', '16': '富山县', '17': '石川县', '18': '福井县', '19': '山梨县', '20': '长野县', '21': '岐阜县',
  '22': '静冈县', '23': '爱知县', '24': '三重县', '25': '滋贺县', '26': '京都府', '27': '大阪府', '28': '兵库县',
  '29': '奈良县', '30': '和歌山县', '31': '鸟取县', '32': '岛根县', '33': '冈山县', '34': '广岛县', '35': '山口县',
  '36': '德岛县', '37': '香川县', '38': '爱媛县', '39': '高知县', '40': '福冈县', '41': '佐贺县', '42': '长崎县',
  '43': '熊本县', '44': '大分县', '45': '宫崎县', '46': '鹿儿岛县', '47': '冲绳县',
};

const US_STATES: Record<string, string> = {
  AL: '阿拉巴马州', AK: '阿拉斯加州', AZ: '亚利桑那州', AR: '阿肯色州', CA: '加利福尼亚州', CO: '科罗拉多州',
  CT: '康涅狄格州', DE: '特拉华州', FL: '佛罗里达州', GA: '佐治亚州', HI: '夏威夷州', ID: '爱达荷州',
  IL: '伊利诺伊州', IN: '印第安纳州', IA: '艾奥瓦州', KS: '堪萨斯州', KY: '肯塔基州', LA: '路易斯安那州',
  ME: '缅因州', MD: '马里兰州', MA: '马萨诸塞州', MI: '密歇根州', MN: '明尼苏达州', MS: '密西西比州',
  MO: '密苏里州', MT: '蒙大拿州', NE: '内布拉斯加州', NV: '内华达州', NH: '新罕布什尔州', NJ: '新泽西州',
  NM: '新墨西哥州', NY: '纽约州', NC: '北卡罗来纳州', ND: '北达科他州', OH: '俄亥俄州', OK: '俄克拉何马州',
  OR: '俄勒冈州', PA: '宾夕法尼亚州', RI: '罗得岛州', SC: '南卡罗来纳州', SD: '南达科他州', TN: '田纳西州',
  TX: '得克萨斯州', UT: '犹他州', VT: '佛蒙特州', VA: '弗吉尼亚州', WA: '华盛顿州', WV: '西弗吉尼亚州',
  WI: '威斯康星州', WY: '怀俄明州', DC: '华盛顿哥伦比亚特区',
};

const CA_PROVINCES: Record<string, string> = {
  AB: '艾伯塔省', BC: '不列颠哥伦比亚省', MB: '马尼托巴省', NB: '新不伦瑞克省', NL: '纽芬兰与拉布拉多省',
  NS: '新斯科舍省', NT: '西北地区', NU: '努纳武特地区', ON: '安大略省', PE: '爱德华王子岛省',
  QC: '魁北克省', SK: '萨斯喀彻温省', YT: '育空地区',
};

const AU_STATES: Record<string, string> = {
  NSW: '新南威尔士州', VIC: '维多利亚州', QLD: '昆士兰州', WA: '西澳大利亚州', SA: '南澳大利亚州',
  TAS: '塔斯马尼亚州', NT: '北领地', ACT: '澳大利亚首都领地',
};

const MY_STATES: Record<string, string> = {
  JHR: '柔佛', KDH: '吉打', KTN: '吉兰丹', MLT: '马六甲', NSN: '森美兰', PHG: '彭亨', PNG: '槟城',
  PRK: '霹雳', PLS: '玻璃市', SGR: '雪兰莪', TRG: '登嘉楼', SWK: '砂拉越', SBH: '沙巴', KUL: '吉隆坡',
  LBN: '纳闽', PJY: '布城',
};

function decodeSubdivisionName(countryCode: string, subdivisionCode: string): string | null {
  const cc = countryCode.toUpperCase();
  const sub = subdivisionCode.toUpperCase();
  if (cc === 'CN') return CN_REGION_CODE_MAP[sub] || null;
  if (cc === 'JP') return JP_PREFECTURES[sub] ? `日本·${JP_PREFECTURES[sub]}` : null;
  if (cc === 'US') return US_STATES[sub] ? `美国·${US_STATES[sub]}` : null;
  if (cc === 'CA') return CA_PROVINCES[sub] ? `加拿大·${CA_PROVINCES[sub]}` : null;
  if (cc === 'AU') return AU_STATES[sub] ? `澳大利亚·${AU_STATES[sub]}` : null;
  if (cc === 'MY') return MY_STATES[sub] ? `马来西亚·${MY_STATES[sub]}` : null;
  return null;
}

function parseShareSlug(url: string): string {
  const trimmed = url.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/share/');
  return idx >= 0 ? trimmed.slice(idx + '/share/'.length) : '';
}

function pickTwoStandees(candidates: string[]): [string, string] {
  const pool = candidates.filter(Boolean);
  if (pool.length === 0) return ['', ''];
  if (pool.length === 1) return [pool[0], pool[0]];
  const left = pool[Math.floor(Math.random() * pool.length)];
  let right = left;
  let guard = 0;
  while (right === left && guard < 8) {
    right = pool[Math.floor(Math.random() * pool.length)];
    guard += 1;
  }
  return [left, right];
}

function normalizeProvinceName(raw: string): string {
  const text = raw.trim();
  const normalized = text.toUpperCase();
  if (SUBDIVISION_NAMES[normalized]) return SUBDIVISION_NAMES[normalized];

  const genericSubdivisionMatch = normalized.match(/^([A-Z]{2})-([A-Z0-9]{1,3})$/);
  if (genericSubdivisionMatch) {
    const countryCode = genericSubdivisionMatch[1];
    const subdivisionCode = genericSubdivisionMatch[2];
    const named = decodeSubdivisionName(countryCode, subdivisionCode);
    if (named) return named;
    const countryName = COUNTRY_NAMES[countryCode] || decodeCountryName(countryCode);
    if (countryName) return `${countryName}·${subdivisionCode}`;
  }

  for (const [pattern, name] of PROVINCE_NAMES) {
    if (pattern.test(text)) return name;
  }
  return text;
}

function decodeCountryName(code: string): string {
  try {
    const display = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
    const translated = display.of(code.toUpperCase());
    return translated || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function parseStandeeUrls(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (payload && typeof payload === 'object') {
    const data = payload as { standees?: unknown; items?: unknown };
    if (Array.isArray(data.standees)) {
      return data.standees.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (Array.isArray(data.items)) {
      return data.items
        .map((item) => {
          if (item && typeof item === 'object') {
            return String((item as { url?: unknown }).url || '').trim();
          }
          return '';
        })
        .filter(Boolean);
    }
  }
  return [];
}

function mixHeatColor(value: number, max: number): string {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const h = 210 - Math.round(ratio * 45);
  const s = 65 + Math.round(ratio * 20);
  const l = 88 - Math.round(ratio * 36);
  return `hsl(${h} ${s}% ${l}%)`;
}

function buildWorldMapSvg(svgText: string, countryRows: Row[]): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return '';

  const max = countryRows.reduce((m, row) => Math.max(m, row.value), 0);
  const valueMap = new Map(countryRows.map((row) => [row.code.toLowerCase(), row]));
  const cnRow = valueMap.get('cn');
  const cnLinkedCodes = new Set(['tw', 'hk', 'mo']);

  const paths = svg.querySelectorAll('path[id]');
  paths.forEach((path) => {
    const id = (path.getAttribute('id') || '').toLowerCase();
    const hit = valueMap.get(id) || (cnRow && cnLinkedCodes.has(id) ? cnRow : undefined);
    path.setAttribute('stroke', '#ffffff');
    path.setAttribute('stroke-width', '0.35');
    if (hit) {
      path.setAttribute('fill', mixHeatColor(hit.value, max));
      path.setAttribute('fill-opacity', '0.95');
      const name = path.getAttribute('name') || hit.code;
      path.setAttribute('data-title', `${name}: ${hit.value}`);
    } else {
      path.setAttribute('fill', '#e5e7eb');
      path.setAttribute('fill-opacity', '0.95');
    }
  });

  svg.setAttribute('class', 'stats-world-map');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '访问来源国家热力图');

  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

async function loadRandomStandees(): Promise<void> {
  leftStandeeUrl.value = '';
  rightStandeeUrl.value = '';

  try {
    const response = await fetch(STANDEES_JSON_URL, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      const urls = parseStandeeUrls(data);
      const [left, right] = pickTwoStandees(urls);
      if (left && right) {
        leftStandeeUrl.value = left;
        rightStandeeUrl.value = right;
        return;
      }
    }
  } catch {
    // keep empty when local standee list is unavailable
  }
}

async function fetchMetricsRows(type: 'region' | 'country'): Promise<Row[]> {
  const slug = parseShareSlug(umamiConfig.shareUrl);
  if (!slug) return [];

  const shareRes = await fetch(`/api/share/${slug}`);
  if (!shareRes.ok) throw new Error('无法获取 share 配置');
  const shareData = (await shareRes.json()) as UmamiShareResponse;

  const endAt = Date.now();
  const startAt = 0;
  const url = `/api/websites/${shareData.websiteId}/metrics?startAt=${startAt}&endAt=${endAt}&type=${type}&limit=100`;

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

  const data = (await metricsRes.json()) as Metric[];
  return (Array.isArray(data) ? data : [])
    .filter((x) => x.x && Number.isFinite(x.y))
    .map((x) => ({
      code: x.x.toUpperCase(),
      name: type === 'region'
        ? normalizeProvinceName(x.x)
        : (COUNTRY_NAMES[x.x.toUpperCase()] || decodeCountryName(x.x.toUpperCase())),
      value: x.y,
    }))
    .sort((a, b) => b.value - a.value);
}

onMounted(async () => {
  void loadRandomStandees();

  if (!hasConfiguredShareUrl()) return;
  loading.value = true;
  error.value = '';
  try {
    const [regionData, countryData, mapSvgText] = await Promise.all([
      fetchMetricsRows('region'),
      fetchMetricsRows('country'),
      fetch(WORLD_MAP_SVG_URL, { cache: 'force-cache' }).then((res) => (res.ok ? res.text() : '')),
    ]);

    regionRows.value = regionData;
    countryRows.value = countryData;

    if (mapSvgText) {
      worldMapSvg.value = buildWorldMapSvg(mapSvgText, countryData);
    }
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
  max-width: 980px;
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

.table-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.table-card {
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  padding: 10px;
}

.table-card h2 {
  margin: 0 0 8px;
  font-size: 1.1rem;
}

.map-card {
  margin: 14px 0 12px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  padding: 10px;
  overflow: hidden;
}

:deep(.stats-world-map) {
  display: block;
  width: 100%;
  height: auto;
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

@media (max-width: 840px) {
  .table-grid {
    grid-template-columns: 1fr;
  }
}

</style>
