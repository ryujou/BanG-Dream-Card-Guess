# 🔒 安全审计报告：BanG Dream! Card Guess (xtbang.top)

**审计范围**：`F:\lumia\vue_bbc` 源码 + 已部署站点 `https://xtbang.top`  
**审计日期**：2026-05-16  
**审计方法**：静态代码审查、配置分析、依赖扫描、已部署站点探测

---

## 📊 总览

| 严重级别 | 数量 |
|---------|------|
| 🔴 严重 (Critical) | 3 |
| 🟠 高危 (High) | 3 |
| 🟡 中危 (Medium) | 5 |
| 🟢 低危 (Low) | 6 |

---

## ✅ 安全优势（做得好的地方）

以下领域的安全性做得不错：

1. **无 npm 依赖漏洞** — `npm audit` 显示 0 个漏洞
2. **防止 XSS** — 没有使用 `v-html`、`innerHTML` 或 `dangerouslySetInnerHTML`；Vue 模板引擎自动转义用户内容
3. **来源验证** — HTTP 修改方法与 WebSocket 连接均验证来源
4. **登录认证** — 使用 `timingSafeEqual`（防时序攻击）进行密码比较，登录限流（每 IP 10 分钟 10 次）
5. **Auth Cookie 安全** — `HttpOnly`、`SameSite=Lax`，部署环境使用 `Secure` 标志
6. **输入限制** — 请求体限制 1MB，用户名截断为 30 字符，团队名称截断为 20 字符，分数上限限制
7. **路径遍历防护** — `serveStatic` 通过检查 `filePath.startsWith(publicDir)` 验证文件访问安全性
8. **传输安全** — nginx 启用 HSTS，仅支持 TLS 1.2/1.3
9. **CSRF 保护** — 采用双重提交 Cookie 模式，存在 CSRF 令牌校验逻辑
10. **代理安全** — Bestdori 代理设置 10 秒超时，防止无限期挂起
11. **CSP 已配置** — 应用层及 nginx 层均配置内容安全策略
12. **开放重定向防范** — `safeNextPath()` 验证路径以 `/` 开头且不含 `//`
13. **敏感文件已忽略** — `Server/` 目录、`.env`、`*.pem`、`*.key` 已在 `.gitignore` 中，确认未被 Git 跟踪

---

## 🔴 严重漏洞 (Critical)

### C-01：CORS 配置错误 — 允许任意来源携带凭证

**文件**：`Server/bangbangcai.conf` (L42) / `Server/bangbangcai.https.conf` (L40)

```nginx
# 第 42 行
add_header Access-Control-Allow-Origin $http_origin always;
add_header Access-Control-Allow-Credentials true always;
```

**影响**：任何网站均可向 `xtbang.top` 发起经过认证的跨域请求（携带 Cookie）。由于 CSRF 保护存在漏洞（见 C-02），攻击者可利用此配置窃取会话状态、篡改游戏设置或读取诊断信息。

**修复方案**：

```nginx
# 将 $http_origin 替换为固定域名
add_header Access-Control-Allow-Origin "https://xtbang.top" always;
```

或者，若确实需要多域名支持，则应维护显式域名白名单。

---

### C-02：CSRF 保护存在多个绕过路径

**文件**：`src/server/utils/http.ts` (L39-L44)

```typescript
export function requiresCsrfCheck(req: IncomingMessage, pathname: string): boolean {
  if (pathname === "/api/login") return false;        // ✅ 合理
  if (pathname === "/api/queue-scores") return false; // ❌ 绕过
  if (pathname.startsWith("/note-shooter-api/")) return false; // ❌ 绕过
  return isAuthenticated(req);                         // ⚠️ 仅认证时生效
}
```

**影响**：以下端点虽为 POST 且可修改数据，但未受 CSRF 保护：

- `POST /api/queue-scores` — 攻击者可伪造分数提交
- `POST /note-shooter-api/*` — 攻击者可伪造音符射手分数
- `POST /api/note-shooter-scores` (DELETE 方法) — 虽需密码但无 CSRF 保护
- `POST /api/community` — 需认证但 CSRF 检查仅在已认证时生效

**修复方案**：

```typescript
export function requiresCsrfCheck(req: IncomingMessage, pathname: string): boolean {
  if (pathname === "/api/login") return false;
  // 对所有修改类端点启用 CSRF 检查
  return true;
}
```

并确保所有修改类端点均包含有效的 CSRF 令牌。

---

### C-03：`/api/note-shooter-scores` DELETE — 身份认证弱且缺乏 CSRF 保护

**文件**：`src/server/index.ts` (L220-L242)

```typescript
// 第 228 行
if (!isAuthenticated(req) && !verifyPassword(password)) return sendJson(res, ...);
```

此端点允许仅凭口令（不经身份认证会话）删除分数，这降低了暴力破解攻击的门槛。同时，该端点缺乏 CSRF 保护。

**修复方案**：要求同时具备身份认证会话 **及** CSRF 令牌，同时对此端点启用登录限流。

---

## 🟠 高危漏洞 (High)

### H-01：CSP 允许 `'unsafe-inline'` 脚本和样式

**文件**：`Server/bangbangcai.https.conf` (L35), `src/server/utils/http.ts` (L11-L21)

```nginx
Content-Security-Policy "default-src 'self'; ... script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; ..."
```

**影响**：`'unsafe-inline'` 会使 CSP 对 XSS 攻击的主要防护完全失效，因为攻击者注入的内联脚本将直接受 CSP 允许。

**修复方案**：

1. 从 `script-src` 中**移除** `'unsafe-inline'`
2. 使用 nonce 或 hash 方式替代内联脚本（如严格需要）
3. 将 `cdn.jsdelivr.net` 加入白名单，替代通配符 `https:`

---

### H-02：CSP 允许通配符 HTTPS 源

**文件**：`Server/bangbangcai.https.conf` (L35)

```nginx
img-src 'self' data: https:;     # 允许任意 HTTPS 图片源
media-src 'self' data: https:;   # 允许任意 HTTPS 媒体源
style-src 'self' 'unsafe-inline' https:;  # 允许任意 HTTPS 样式源
script-src 'self' 'unsafe-inline' https:; # 允许任意 HTTPS 脚本源
```

**影响**：任何 HTTPS 域均可注入资源，包括恶意第三方 CDN。虽然实际攻击窗口较小，但仍不符合最小权限原则。

**修复方案**：将图片、媒体、样式和脚本的源白名单限制为项目实际使用的外部域：

```nginx
script-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
img-src 'self' data: https://bestdori.com https://cdn.jsdelivr.net;
```

---

### H-03：`POST /api/queue-scores` 缺乏来源验证与 CSRF 检查

**文件**：`src/server/index.ts` (L199-L216)

```typescript
// 第 199-216 行 — 无 isTrustedOrigin 检查，无 CSRF 检查
if (url.pathname === "/api/queue-scores" && req.method === "POST") {
  const body = parseRequestPayload(req, await readRequestBody(req));
  // ... 直接写入分数
  return sendJson(res, { ok: true, ... });
}
```

由于 nginx CORS 配置错误（C-01），任何网站均可伪造此请求。虽然数据本身为非关键数据（分数），但攻击者可通过垃圾数据污染排行榜。

**修复方案**：

1. 修复 CORS 配置（C-01）
2. 对此端点添加来源验证
3. 对此端点启用 CSRF 保护

---

## 🟡 中危漏洞 (Medium)

### M-01：nginx 与应用层 CSP 不一致

- **应用层**（HTTP 头）：`frame-ancestors 'self'` — 允许同源框架嵌入
- **Nginx 层**：`frame-ancestors 'none'` — 禁止所有框架嵌入

浏览器通常取最严格的策略，但 CSP 不一致可能导致安全配置误解与维护困难。

**修复方案**：统一应用层与 nginx 的 CSP，合并为单一控制点。

---

### M-02：`safeUrl` 未对社区数据中的危险协议进行服务端过滤

**文件**：`src/client/utils/image.ts` (L1-L18)

`safeUrl` 函数已正确处理 `javascript:` 协议（只允许 `http:` / `https:`），但社区数据写入端点未进行服务端验证。攻击者若获得管理权限，可存储潜在的钓鱼链接或恶意 URL。

**修复方案**：在服务端的 `writeCommunityData` 中对 URL 字段进行验证，确保仅允许 `http:` 和 `https:` 协议。

---

### M-03：`/api/health` 端点公开系统信息

**文件**：`src/server/index.ts` (L142)

`GET /api/health` 无需认证即可访问，返回内容包括：

- 应用版本 (`version`)
- Node.js 版本 (`nodeVersion`)
- 已连接客户端数量
- 在线时间 (`uptimeMs`)
- 内存缓存状态

**已确认**：已部署站点 `https://xtbang.top/api/health` 返回完整系统信息。

**影响**：版本信息可用于针对性的漏洞利用。

**修复方案**：精简公开健康端点，仅保留 `{ ok: true }`。将详细诊断信息置于认证端点 `/api/diagnostics` 之后。

---

### M-04：SSH 私钥存放于工作目录

**文件**：`Server/id_ed25519`

虽已被 `.gitignore` 排除且未被 Git 跟踪，但 SSH 私钥存放在工作目录中仍有被 IDE 索引、备份软件复制或用户误操作的风险。

**修复方案**：将密钥移动到 `~/.ssh/` 并设置 `700` 权限。从项目工作目录中删除。同时，`Server/IP.txt` 中包含纯文本服务器 IP 及用户名，也建议一并移除。

---

### M-05：分数数据以明文 JSON 文件存储

**文件**：`src/server/scores.ts` (L14-L15)

`queue-scores.json` 与 `note-shooter-scores.json` 以明文 JSON 存储，无文件权限限制或加密措施。若服务器文件系统被读取，攻击者可修改分数数据。

**修复方案**：对分数文件设置严格的 `600` 文件权限。同时，对文件内容进行校验和或签名，以便检测篡改。

---

## 🟢 低危漏洞 (Low)

### L-01：SSL 密码套件配置较基础

**文件**：`Server/bangbangcai.https.conf` (L31)

```nginx
ssl_ciphers HIGH:!aNULL:!MD5;
```

建议使用 Mozilla 推荐的现代配置：

```nginx
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
```

### L-02：未设置 `ssl_prefer_server_ciphers`

nginx 配置中未指定 `ssl_prefer_server_ciphers on;`，可能导致客户端选择较弱的密码套件。

### L-03：nginx HTTP 配置返回内容可能与 HTTPS 配置不一致

`Server/bangbangcai.http.conf` 与 `Server/bangbangcai.https.conf` 的 CSP 头不同步。但 HTTP 配置仅用作重定向，实际风险较低。

### L-04：未设置 OCSP Stapling

SSL 配置中未启用 OCSP Stapling (`ssl_stapling`)，可提升 TLS 握手性能并增强证书吊销检查。

### L-05：未配置速率限制的全局策略

除登录端点外，其他端点（包括 `/api/health`）未设置全局速率限制。虽与 CORS 漏洞结合时有较大风险，但单独影响较小。

### L-06：`X-XSS-Protection` 设置不一致

- Nginx：`X-XSS-Protection: 0`（禁用旧版 XSS 过滤器，现代最佳实践）
- 应用层 HTTP 头：`X-XSS-Protection: 1; mode=block`

两处设置不一致。

---

## 📋 修复优先级

| 优先级 | 漏洞编号 | 描述 | 预计工作量 |
|--------|---------|------|-----------|
| 🔴 P0 | C-01 | 修复 CORS 通配符来源 | 1 行修改 |
| 🔴 P0 | C-02 | 为所有修改端点添加 CSRF 保护 | ~10 行修改 |
| 🔴 P0 | C-03 | 对分数删除端点增加认证要求 | ~5 行修改 |
| 🟠 P1 | H-01 | 从 CSP 中移除 `'unsafe-inline'` | 需全面测试 |
| 🟠 P1 | H-02 | 将 CSP 通配符替换为白名单 | ~5 行修改 |
| 🟠 P1 | H-03 | 对队列分数端点添加来源验证 | ~2 行修改 |
| 🟡 P2 | M-01 | 统一 CSP 头 | ~3 行修改 |
| 🟡 P2 | M-03 | 精简公开健康端点 | ~3 行修改 |
| 🟡 P2 | M-04 | 从工作目录移除 SSH 密钥 | 文件操作 |
| 🟢 P3 | L-01-L04 | SSL/nginx 加固 | ~10 行修改 |

---

## 🔍 部署站点快速检查结果

对 `https://xtbang.top` 的探测确认：

- ✅ HTTPS 正常响应，返回 200
- ✅ HSTS 头已设置（`max-age=31536000`）
- ✅ `X-Frame-Options: DENY` 已设置
- ✅ `X-Content-Type-Options: nosniff` 已设置
- ✅ TLS 1.2/1.3 可用
- ⚠️ CSP 包含 `'unsafe-inline'`（已知问题）
- ⚠️ `/api/health` 公开暴露系统详情（已知问题）
- ✅ 应用版本：`1.5.1`，Node.js `v20.20.2`，当前 0 个在线客户端
