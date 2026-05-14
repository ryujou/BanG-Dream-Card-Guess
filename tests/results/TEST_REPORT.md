# ============================================================
# BanG Dream! Card Guess — 全面测试报告
# ============================================================
# 项目: bangbangcai-booth-game v1.5.1
# 测试日期: 2026-05-13 ~ 2026-05-14
# 测试工程师: Sisyphus (自动化测试)
# 测试模式: 只测不修 (Test Only, No Fix)
# ============================================================

## 目录
1. 测试概览
2. 构建验证
3. 依赖安全审计
4. 单元测试 + 代码覆盖率
5. HTTP API 端点测试
6. Playwright 浏览器端到端测试
7. 安全头部审计
8. 源码安全静态分析
9. 移动端响应式测试
10. Bundle 体积分析
11. 风险汇总

---

## 一、测试概览

| 测试类别 | 测试项数 | 通过 | 失败 | 状态 |
|---------|---------|------|------|------|
| 构建验证 | 1 | 1 | 0 | ✅ |
| 依赖审计 | 155 packages | 153 | 2 (moderate) | ⚠️ |
| 单元测试 | 81 | 81 | 0 | ✅ |
| API 端点测试 | 20 | 20 | 0 | ✅ |
| 浏览器页面测试 | 10 页面 | 10 | 0 | ✅ |
| Console 错误检测 | 10 页面 | 9 | 1 (mobile) | ⚠️ |
| 安全头部 | 6 项 | 0 | 6 | ❌ |

---

## 二、构建验证

命令: `npm run build` (vite build)

结果: ✅ 构建成功

```
vite v5.4.21 building for production...
✓ 6 modules transformed.
dist/index.html                 0.63 kB (gzip: 0.38 kB)
dist/assets/index-DMliXHkb.css 42.78 kB (gzip: 8.83 kB)
dist/assets/index-DKrFYtiz.js  519.60 kB (gzip: 134.99 kB)
✓ built in 3.13s
```

⚠️ 警告: JS chunk 超过 500KB (主要是 Three.js)
  建议: 动态 import() 或 manualChunks 拆分

Bundle 分析:
  - index-DKrFYtiz.js: 510.2 KB (Three.js 占大头)
  - index-DMliXHkb.css: 41.8 KB

---

## 三、依赖安全审计 (npm audit)

总依赖: 155 packages (prod: 96, dev: 60, optional: 50)

| 严重程度 | 数量 |
|---------|------|
| Critical | 0 |
| High | 0 |
| Moderate | 2 |
| Low | 0 |

### 漏洞详情

| 包名 | 版本范围 | CWE | CVSS | 说明 | 修复 |
|------|---------|-----|------|------|------|
| esbuild | ≤0.24.2 | CWE-346 | 5.3 | Dev server 允许任意网站请求并读取响应 | 升级 vite |
| vite | ≤6.4.1 | CWE-22 + CWE-200 | - | Optimized deps .map 文件路径遍历 | 升级到 ^8.0.12 |

---

## 四、单元测试 + 代码覆盖率

框架: Vitest 4.1.6 + @vitest/coverage-v8

### 测试结果: ✅ 81/81 全部通过

| 测试文件 | 测试数 | 状态 |
|---------|-------|------|
| auth.test.mjs | 18 | ✅ |
| config.test.mjs | 22 | ✅ |
| scores.test.mjs | 21 | ✅ |
| network.test.mjs | 20 | ✅ |
| **合计** | **81** | **✅** |

### 代码覆盖率

| 文件 | 语句 | 分支 | 函数 | 行 |
|------|------|------|------|------|
| auth.mjs | 95.55% | 84.37% | 100% | 94.73% |
| config.mjs | 71.42% | 73.07% | 68.75% | 66.66% |
| network.mjs | 100% | 86.66% | 100% | 100% |
| scores.mjs | 18.81% | 46.76% | 20% | 20.54% |
| community.mjs | 0% | 0% | 0% | 0% |
| crop.mjs | 0% | 0% | 0% | 0% |
| **总计** | **29.42%** | **41.91%** | **34.95%** | **30.13%** |

未覆盖原因:
- community.mjs: 依赖文件 I/O (readFileSync/writeFile)
- crop.mjs: 依赖 Jimp 图像处理库
- scores.mjs: 大部分函数依赖文件 I/O 和 HTTP 请求上下文

---

## 五、HTTP API 端点测试

服务器: http://127.0.0.1:5199 (booth 模式)

| # | 端点 | 方法 | 状态码 | Content-Type | 结果 |
|---|------|------|--------|-------------|------|
| 1 | /api/health | GET | 200 | application/json | ✅ |
| 2 | /api/network | GET | 200 | application/json | ✅ |
| 3 | /api/community | GET | 200 | application/json | ✅ |
| 4 | /api/queue-scores | GET | 200 | application/json | ✅ |
| 5 | /api/note-shooter-scores | GET | 200 | application/json | ✅ |
| 6 | /api/stopwatch-settings | GET | 200 | application/json | ✅ |
| 7 | /api/qr?text=test | GET | 200 | image/svg+xml | ✅ |
| 8 | /api/login (wrong pw) | POST | 403 | application/json | ✅ |
| 9 | /api/login (correct pw) | POST | 200 | application/json | ✅ |
| 10 | / (home) | GET | 200 | text/html | ✅ |
| 11 | /player | GET | 200 | text/html | ✅ |
| 12 | /host | GET | 200→/login | text/html | ✅ (auth redirect) |
| 13 | /settings | GET | 200→/login | text/html | ✅ (auth redirect) |
| 14 | /solo | GET | 200 | text/html | ✅ |
| 15 | /login | GET | 200 | text/html | ✅ |
| 16 | /qr | GET | 200 | text/html | ✅ |
| 17 | /note-shooter | GET | 200 | text/html | ✅ |
| 18 | /scores | GET | 200 | text/html | ✅ |
| 19 | /community-admin | GET | 200 | text/html | ✅ |
| 20 | /nonexistent | GET | 200 | text/html | ⚠️ (SPA fallback) |
| 21 | /api/community (noauth) | POST | 401 | application/json | ✅ (auth required) |

关键发现:
- ✅ 认证保护正常: /host, /settings 重定向到 /login
- ✅ 未认证 POST 正确返回 401
- ✅ 错误密码正确返回 403
- ⚠️ /nonexistent 返回 200 (SPA fallback) — 可接受但建议返回自定义 404 页

---

## 六、Playwright 浏览器端到端测试

### 桌面端 (1920x1080)

| 页面 | Console Errors | Console Warnings | 渲染 | 截图 |
|------|---------------|-----------------|------|------|
| / (home) | 0 | 0 | ✅ | screenshot-home.png |
| /player | 0 | 0 | ✅ | screenshot-player.png |
| /login | 0 | 0 | ✅ | - |
| /solo | 0 | 0 | ✅ | - |
| /settings → /login | 0 | 0 | ✅ | - |
| /host → /login | 0 | 0 | ✅ | - |
| /qr | 0 | 0 | ✅ | - |
| /community-admin | 0 | 0 | ✅ | - |
| /scores | 0 | 0 | ✅ | - |
| /note-shooter → /scores | 0 | 0 | ✅ | - |

### 移动端 (375x812 - iPhone)

| 页面 | Console Errors | Console Warnings | 渲染 |
|------|---------------|-----------------|------|
| /community-admin | 1 ❌ | 0 | ⚠️ |

移动端错误详情:
```
[ERROR] Failed to load resource: the server responded with a status of 404 
URL: https://cdn.jsdelivr.net/npm/@json-editor/json-editor@latest/dist/jsoneditor.min.css
```

根因: community-admin 页面引用的 CDN CSS 文件不存在或路径已变更

---

## 七、安全头部审计

响应头检查 (GET /):

```
HTTP/1.1 200 OK
Cache-Control: no-cache
Content-Type: text/html; charset=utf-8
```

| 安全头部 | 状态 | 风险 |
|---------|------|------|
| Content-Security-Policy | ❌ 缺失 | XSS/数据注入 |
| X-Content-Type-Options: nosniff | ❌ 缺失 | MIME 嗅探 |
| X-Frame-Options | ❌ 缺失 | 点击劫持 |
| Strict-Transport-Security (HSTS) | ❌ 缺失 | 降级攻击 |
| Referrer-Policy | ❌ 缺失 | URL 信息泄露 |
| X-XSS-Protection | ❌ 缺失 | 旧浏览器 XSS 过滤 |

---

## 八、源码安全静态分析

### ✅ 已做好的安全措施

| 措施 | 位置 |
|------|------|
| 密码 timingSafeEqual 防时序攻击 | src/server/auth.mjs#L13 |
| Session token 使用 crypto.randomBytes(32) | src/server/auth.mjs#L28 |
| Cookie HttpOnly + SameSite=Lax | src/server/auth.mjs#L59 |
| 数值参数严格边界限制 (Math.max/min) | server.mjs#L380-L400 |
| 数组参数白名单过滤 | server.mjs#L404-L408 |
| 请求体大小限制 1MB | src/server/scores.mjs#L134 |
| 分数提交速率限制 (20-30/min/IP) | src/server/scores.mjs#L265-L279 |
| 图片上传 MIME 验证 | server.mjs#L103 |
| 静态文件路径遍历防护 | server.mjs#L744, L747 |
| 上传文件名防注入 (timestamp + random) | server.mjs#L107 |
| 已认证端点正确返回 401 | server.mjs#L87, L97 |
| 浏览器 Origin 验证 (note-shooter API) | src/server/scores.mjs#L281-L287 |

### ⚠️ 安全风险

| 优先级 | 问题 | 位置 | 类型 |
|--------|------|------|------|
| 🔴 P0 | innerHTML 直接渲染用户数据 | src/web/main.js 多处 | XSS |
| 🔴 P0 | 缺少 CSP 头部 | server.mjs sendJson/streamFile | 防御缺失 |
| 🟠 P1 | 登录无暴力破解/速率限制 | server.mjs#L155 | 认证 |
| 🟡 P2 | 缺少 CSRF Token | 所有 POST 端点 | CSRF |
| 🟡 P2 | WebSocket 无 Origin 验证 | server.mjs#L197 | WebSocket |
| 🟡 P2 | Bestdori 代理无超时 | server.mjs#L731 | DoS |
| 🔵 P3 | /api/health 暴露内部信息 | server.mjs#L682 | 信息泄露 |

---

## 九、移动端响应式测试

视口: 375x812 (iPhone)

| 检查项 | 结果 |
|--------|------|
| 页面可加载 | ✅ |
| 内容未溢出 | ✅ |
| 可滚动 | ✅ |
| CDN 依赖错误 | ❌ (jsoneditor.min.css 404) |
| Console Errors | 1 |

---

## 十、Bundle 体积分析

| 文件 | 大小 | Gzip |
|------|------|------|
| index.html | 0.63 KB | 0.38 KB |
| CSS | 42.78 KB | 8.83 KB |
| JS (含 Three.js) | 519.60 KB | 134.99 KB |

⚠️ 主要体积来源: Three.js (~500KB)
建议: 按需加载 Three.js (只 stopwatch-challenge 和 bang-klotski 使用)

---

## 十一、测试环境信息

| 项目 | 值 |
|------|-----|
| Node.js | v24.13.0 |
| 测试框架 | Vitest 4.1.6 |
| 覆盖率工具 | @vitest/coverage-v8 |
| Playwright | v1.60.0 |
| 测试服务器端口 | 5199 |
| 测试模式 | booth |

---

## 十二、总结

### 通过项 (✅)
- 构建: 无错误通过
- 单元测试: 81/81 通过
- API 端点: 20/20 正常响应
- 认证保护: 正确拦截未授权访问
- 浏览器渲染: 所有页面正常加载
- 输入验证: 数值/数组/字符串验证到位

### 需关注 (⚠️)
- 2 个 moderate 依赖漏洞 (vite/esbuild)
- CDN 资源 404 (移动端 community-admin)
- Bundle 体积 519KB (Three.js)
- 代码覆盖率偏低 (29.42%)

### 需改进 (❌)
- 6 项安全头部全部缺失
- XSS 风险 (innerHTML 未过滤)
- 登录无暴力破解防护
- CSRF 保护缺失

---

报告生成时间: 2026-05-14 09:05 CST
测试工具: Vitest + Playwright + curl + 静态源码分析
