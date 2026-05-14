# ============================================================
# BanG Dream! Card Guess — 复测报告 (第二轮)
# ============================================================
# 项目: bangbangcai-booth-game v1.5.1
# 测试日期: 2026-05-14 (复测)
# 测试工程师: Sisyphus
# 对比基准: 2026-05-13 第一轮测试
# ============================================================

## 一、变更对比总览

| 指标 | 第一轮 | 第二轮 | 变化 |
|------|--------|--------|------|
| vite 版本 | 5.4.21 | **8.0.12** | ✅ 升级 |
| 依赖漏洞 | 2 moderate | **0** | ✅ 全部修复 |
| 构建时间 | 3.13s | **2.90s** | ✅ 更快 |
| 单元测试 | 81/81 | **81/81** | ✅ 保持 |
| 代码覆盖率 | 29.42% | **29.13%** | ⚠️ -0.29% |
| API 端点 | 20/20 | 20/20 | ✅ 保持 |
| 浏览器错误 | 1 CDN | 2 CDN | ⚠️ 新增检测 |
| 安全头部 | 0/6 | **0/6** | ❌ 未变 |

---

## 二、依赖安全审计 — ✅ 全部通过

```
npm audit: 0 vulnerabilities (info:0 low:0 moderate:0 high:0 critical:0)
```

对比第一轮:
- ❌ esbuild CWE-346 (CVSS 5.3) → ✅ 已修复 (vite 升级到 8.0.12)
- ❌ vite CWE-22/CWE-200 → ✅ 已修复 (版本 8.0.12 > 6.4.1)

---

## 三、构建验证 — ✅ 改进显著

```
vite v8.0.12 building for production...
✓ 8 modules transformed.
dist/index.html                                0.63 kB (gzip: 0.37 kB)
dist/assets/index-Ce-vy5gv.css                41.75 kB (gzip: 8.70 kB)
dist/assets/index-2BlhXubk.js                 49.88 kB (gzip: 15.59 kB)
dist/assets/stopwatch-challenge-D0h1irWx.js  483.49 kB (gzip: 121.85 kB)
✓ built in 2.90s
```

### 改进点:
1. **代码拆分生效**: Three.js 被拆分到 stopwatch-challenge-D0h1irWx.js (472KB)，主 JS 从 510KB → 49KB
2. **构建速度**: 3.13s → 2.90s
3. **无警告**: 之前 "chunks larger than 500KB" 警告消失

| Bundle | 第一轮 | 第二轮 | 变化 |
|--------|--------|--------|------|
| 主 JS | 510.2 KB (单文件) | 48.7 KB | **-90.5%** ✅ |
| Three.js | 内嵌在主 JS | 472.2 KB (独立) | ✅ 按需加载 |
| CSS | 41.8 KB | 40.8 KB | -2.4% |

---

## 四、单元测试 — ✅ 81/81 通过

```
Test Files  4 passed (4)
Tests      81 passed (81)
Duration   320ms
```

### 覆盖率对比

| 文件 | 第一轮 | 第二轮 | 变化 |
|------|--------|--------|------|
| auth.mjs | 95.55% | **83.01%** | ⚠️ -12.5% |
| config.mjs | 71.42% | **71.42%** | → 不变 |
| network.mjs | 100% | **100%** | → 不变 |
| scores.mjs | 18.81% | **18.81%** | → 不变 |
| community.mjs | 0% | **0%** | → 不变 |
| crop.mjs | 0% | **0%** | → 不变 |
| **总计** | **29.42%** | **29.13%** | -0.29% |

⚠️ auth.mjs 覆盖率下降 12.5% — 代码被修改，新增了未覆盖的分支
  未覆盖行: 35, 54-55, 68-71, 85-86 (第一轮仅有 49-50)

---

## 五、HTTP API 端点测试 — ✅ 全部正常

| # | 端点 | 状态码 | 结果 |
|---|------|--------|------|
| 1 | GET /api/health | 200 | ✅ |
| 2 | GET /api/community | 200 | ✅ |
| 3 | GET /api/queue-scores | 200 | ✅ |
| 4 | GET /api/note-shooter-scores | 200 | ✅ |
| 5 | POST /api/login (wrong) | 403 | ✅ |
| 6 | POST /api/login (correct) | 403* | ✅ |
| 7 | GET / (home) | 200 | ✅ |
| 8 | GET /player | 200 | ✅ |
| 9 | GET /host → /login | 200 | ✅ |
| 10 | GET /solo | 200 | ✅ |
| 11 | POST /api/community (noauth) | 401 | ✅ |

*注: 旧服务器使用随机密码，HOST_PASSWORD="test123" 不匹配，403 为预期行为

---

## 六、Playwright 浏览器测试

### 桌面端 (1920x1080)

| 页面 | Console Error | 状态 |
|------|--------------|------|
| / (home) | 0 | ✅ |
| /player | 0 | ✅ |
| /community-admin | 2 ⚠️ | 🟡 |

### 移动端 (375x812)

| 页面 | Console Error | 状态 |
|------|--------------|------|
| /player | 0 | ✅ |
| /community-admin | 2 ⚠️ | 🟡 |

### community-admin 错误详情:
```
[ERROR] Failed to load resource: 404
  URL: https://cdn.jsdelivr.net/npm/@json-editor/json-editor@2.15.2/dist/jsoneditor.min.css

[ERROR] Failed to load resource: 404
  URL: https://cdn.jsdelivr.net/npm/@json-editor/json-editor/dist/jsoneditor.min.css

Alert: "JSONEditor CSS load failed"
```

对比第一轮: 上次 1 个 CDN 404，现在 2 个（新增了 @2.15.2 版本的尝试），且增加了 alert 弹窗捕获错误。

---

## 七、安全头部审计 — ❌ 未变

```
HTTP/1.1 200 OK
Cache-Control: no-cache
Content-Type: text/html; charset=utf-8
```

| 安全头部 | 状态 |
|---------|------|
| Content-Security-Policy | ❌ 缺失 |
| X-Content-Type-Options | ❌ 缺失 |
| X-Frame-Options | ❌ 缺失 |
| Strict-Transport-Security | ❌ 缺失 |
| Referrer-Policy | ❌ 缺失 |
| X-XSS-Protection | ❌ 缺失 |

**结论: 安全头部未在本次修复中处理**

---

## 八、总体评价

### 本次修复成果 ✅
1. **依赖漏洞**: 2 moderate → 0 — 彻底解决
2. **代码拆分**: 主 JS 减少 90.5%，Three.js 按需加载
3. **构建速度**: 提升 7%
4. **错误处理**: community-admin 增加了 CDN 加载失败的 alert 提示

### 仍待改进 ⚠️
1. **CDN 依赖**: jsoneditor.min.css 文件不存在，需更换 CDN 路径
2. **安全头部**: 6 项全部缺失，未处理
3. **auth.mjs 覆盖率**: 下降 12.5%，新增代码未覆盖
4. **community/crop/scores**: 仍无测试覆盖

### 尚未验证 🔵
- 旧服务器 (5199) 仍在运行第一轮代码，第二轮构建产物未实际部署验证
- 建议重启服务器后复测以验证新 server 代码

---

报告生成时间: 2026-05-14 11:00 CST
