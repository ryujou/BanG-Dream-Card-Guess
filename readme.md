# BanG Dream! Card Guess

BanG Dream! Card Guess 是一个面向线下摊位、同好会和本地活动的 Web 互动游戏。玩家端只看到裁剪后的卡面局部，主持端负责开始题目、判定答案、揭晓完整卡面和控制比赛流程。项目同时包含单人自玩模式、音符射手小游戏、成绩榜、二维码入口和运行诊断能力。

当前分支已经完成 Vue3 + TypeScript 重构：前端、后端、共享协议类型、服务层、测试和本地打包脚本都纳入 TypeScript 管理。`server.mjs` 仅保留为 Node 启动兼容入口，实际后端实现位于 `src/server/index.ts`，编译输出到 `dist-server`。

## 功能概览

- 摊位主持模式：`/host` 控制，`/player` 展示给玩家。
- 单人自玩模式：`/solo` 输入答案并自动判定。
- WebSocket 实时同步玩家端、主持端、设置页和单人模式状态。
- 智能裁剪卡面，支持人脸策略：跟随难度、不限制、避开、优先、只切人脸。
- 本地卡牌缓存，支持离线现场运行。
- 设置页支持导入/导出配置。
- 本地成绩榜和音符射手排行榜。
- QR 页面自动展示局域网入口和 Wi-Fi 二维码。
- 运行诊断：`/api/health`、`/api/diagnostics`、`/api/diagnostics/export`、`/diagnostics`。
- 本地发布包：`npm run package:local` 生成 `tar.gz`。
- 类型健康检查：`npm run check:any` 当前基线为 `TOTAL 0`。

## 页面入口

| 页面 | 路由 | 说明 |
| --- | --- | --- |
| 首页 | `/` | 活动入口与导航 |
| 玩家页 | `/player` | 玩家或展示屏使用 |
| 主持页 | `/host` | 控制游戏，需要主持登录 |
| 设置页 | `/settings` | 调整规则与题库筛选，需要主持登录 |
| 登录页 | `/login` | 主持登录 |
| 单人页 | `/solo` | 单人自玩模式 |
| 二维码页 | `/qr` | 局域网入口、Wi-Fi 二维码和打印入口 |
| 音符射手 | `/note-shooter` | 等待玩家时的小游戏 |
| 旧队列入口 | `/queue` | 兼容重定向到 `/note-shooter` |
| 成绩榜 | `/scores` | 本地排行榜 |
| 掐秒表挑战 | `/games/stopwatch-challenge` | 独立小游戏 |
| 运行诊断页 | `/diagnostics` | 本地现场排错信息 |

## 环境要求

- Node.js 18+，推荐 Node.js 20 LTS。
- Python 3.9+ 仅在人脸检测重新生成时需要。
- 现场离线使用前，建议提前缓存卡牌资源。

## 快速开始

```sh
npm install
npm run dev
```

开发服务器默认监听：

```text
http://127.0.0.1:5173
```

构建：

```sh
npm run build
```

摊位模式：

```sh
npm run booth
```

单人模式：

```sh
npm run solo
```

本地验证：

```sh
npm run check:any
npm run check:types
npm run build
npm test
npm run test:e2e
npm run verify
```

本地打包：

```sh
npm run package:local
```

输出位置：

```text
artifacts/bang-dream-card-guess-local.tar.gz
```

## Windows 一键脚本

```bat
scripts\install-env.cmd
scripts\start-booth.cmd
scripts\start-solo.cmd
scripts\stop-server.cmd
```

`scripts\start-booth.cmd` 会构建前端和后端，然后打开本地服务窗口。当前脚本会把主持密码设置为 `123456`，也可以通过环境变量覆盖：

```bat
set HOST_PASSWORD=your-password
scripts\start-booth.cmd
```

## macOS / Linux 脚本

```sh
chmod +x scripts/*.sh
./scripts/install-env.sh
./scripts/start-booth.sh
./scripts/start-solo.sh
./scripts/stop-server.sh
```

指定端口：

```sh
PORT=5180 npm run booth
```

## 主持登录与安全

`/host` 和 `/settings` 需要主持登录。密码来自 `HOST_PASSWORD`。如果未设置，服务端会生成临时密码并在启动日志中打印。

相关行为保持不变：

- 登录使用 cookie。
- CSRF 校验保持启用。
- WebSocket 的 `authRequired` 消息格式保持不变。
- host/settings 权限判断保持在服务端。
- 未登录访问 `/api/diagnostics` 返回 401。

## 游戏流程

### 摊位模式

1. 启动 `npm run booth`。
2. 主持打开 `/login` 登录。
3. 主持打开 `/host`。
4. 玩家或展示屏打开 `/player`。
5. 主持开始题目，玩家根据裁剪卡面猜角色。
6. 主持判定正确、错误、跳过或揭晓。
7. 状态通过 WebSocket 同步到所有页面。

### 主持快捷键

| 按键 | 功能 |
| --- | --- |
| `Space` / `ArrowRight` | 开始或下一题 |
| `R` | 重切 |
| `V` | 揭晓 |
| `Enter` | 答对 |
| `Backspace` | 答错 |
| `S` | 跳过 |
| `U` | 撤销 |
| `1` / `2` | 切换 A/B 队 |
| `Escape` | 停止 |

### 单人模式

打开 `/solo`。页面连接 WebSocket 的 self role，玩家输入答案后由服务端根据昵称表判定。

## 设置与规则

设置页 `/settings` 可调整：

- 游戏模式：单人、双队。
- 难度：easy、normal、hard。
- 每题秒数。
- 每人题数。
- 裁剪尺寸。
- 智能候选数。
- 最大重切次数。
- 卡面去重窗口。
- 角色去重窗口。
- 答对加分。
- 答错扣分。
- 连击加分。
- 自动下一题。
- A/B 队名。
- 乐队筛选。
- 稀有度筛选。
- 属性筛选。
- 卡面版本：特训前、特训后。
- 卡面人数：单人、多人。
- 人脸裁剪策略。

配置持久化到 `data/settings.json`，导入/导出结构保持兼容。

## 卡牌缓存与离线运行

卡牌题库来自 `resource/all5_2.json`，昵称来自 `resource/nickname.json`。运行时优先读取 `public/cards/` 本地缓存，缺失时才尝试从 Bestdori 下载。

提前缓存卡面：

```sh
npm run cache-cards
```

缓存路径保持为：

```text
public/cards/
```

离线现场建议：

1. 提前执行 `npm run cache-cards`。
2. 确认 `public/cards/` 已生成卡面资源。
3. 启动 `npm run booth`。
4. 手机和电脑连接同一 Wi-Fi 或热点。
5. 打开 `/qr` 使用局域网地址扫码。

## 人脸检测与裁剪

项目内置 `data/face-boxes.json` 和 `weight/best.pt`。普通使用不需要重新检测。

重新检测：

```sh
pip install ultralytics
npm run detect-faces
```

裁剪逻辑保持服务端执行，主要步骤：

1. 读取卡面图片。
2. 根据设置生成随机候选点。
3. 根据 faceCropMode 追加人脸候选点。
4. 对候选区域按颜色变化、边缘密度、人脸策略打分。
5. 避免与历史裁剪位置过近。
6. 返回裁剪图片 data URL 和裁剪坐标。

本轮重构只做类型化和服务层抽离，不改变裁剪算法结果。

## 音符射手与成绩榜

`/note-shooter` 集成开源音符射手小游戏。成绩写入本地：

```text
data/note-shooter-scores.json
```

成绩榜页面：

```text
/scores
```

队列分数和音符射手分数结构保持不变。SSE 广播格式保持不变。

## QR 与局域网排错

`/qr` 会显示：

- 当前模式。
- 玩家页入口。
- 主持登录入口。
- 设置页入口。
- 音符射手入口。
- 单人模式入口。
- Wi-Fi 二维码。
- 检测到的局域网地址。

手机扫码无法访问时，优先检查：

1. 手机和电脑是否在同一网络。
2. 二维码是否使用 `192.168.x.x` 等局域网地址，而不是 `127.0.0.1`。
3. Windows 防火墙是否允许 Node.js。
4. `/api/health` 是否正常。
5. `/diagnostics` 中 network 信息是否有地址。

## 运行诊断

公开健康检查：

```text
GET /api/health
```

主持鉴权诊断：

```text
GET /api/diagnostics
GET /api/diagnostics/export
```

诊断页面：

```text
/diagnostics
```

诊断信息包含：

- appMode。
- uptime。
- version。
- Node 版本。
- WebSocket 连接数。
- role 统计。
- 卡牌缓存摘要。
- 当前游戏状态摘要。
- network 地址数量。
- scores 摘要。
- 最近错误。

诊断信息不会暴露：

- 主持密码。
- cookie。
- CSRF token。
- 完整本地文件路径。
- 完整卡牌数据。
- 用户隐私数据。

## TypeScript 重构说明

当前项目已完成全量 TypeScript 化与严格化：

- 前端：Vue3 + TypeScript。
- 后端：`src/server/**/*.ts`。
- 共享类型：`src/shared/types/**`。
- 游戏核心状态机：`src/server/game/**`。
- 副作用服务层：`src/server/services/**`。
- 脚本：`scripts/*.ts` 编译到 `dist-scripts`。
- 测试：Vitest + Playwright。
- `tsconfig.server.json` 已启用 `strict: true`。
- `npm run check:any` 当前为 `TOTAL 0`。

保留的兼容入口：

```text
server.mjs
```

它只负责加载编译后的：

```text
dist-server/server/index.js
```

## 后端结构

```text
src/server/
  index.ts                 # HTTP/WebSocket 入口
  auth.ts                  # 登录、cookie、CSRF
  config.ts                # 默认设置、常量、持久化路径
  crop.ts                  # 裁剪算法
  network.ts               # 本地网络信息
  scores.ts                # 成绩读写、SSE、API
  game/                    # 纯游戏状态逻辑
    state.ts
    settings.ts
    scoring.ts
    history.ts
    commands.ts
    reducer.ts
    snapshot.ts
  services/                # 副作用服务层
    cardProvider.ts
    cardCache.ts
    cropService.ts
    timerService.ts
    randomService.ts
    scoreStore.ts
    qrcodeService.ts
    networkService.ts
    production.ts
  utils/
    guards.ts
    http.ts
    logger.ts
```

## 测试

```sh
npm run check:any
npm run check:types
npm run build:server
npm run build
npm test
npm run test:e2e
npm run verify
```

当前测试覆盖重点：

- game reducer/state/settings/scoring/history/snapshot。
- WebSocket 协议回归。
- diagnostics/health。
- 服务层离线与异常场景。
- score normalization。
- guard/type contract。
- Playwright 路由和视觉回归。

## 本地发布包

生成本地交付包：

```sh
npm run package:local
```

输出：

```text
artifacts/bang-dream-card-guess-local.tar.gz
```

如果需要集中安装包，可把压缩包放入：

```text
artifacts/release-packages/
```

压缩包排除：

- `.git`
- `node_modules`
- `dist`
- `dist-server`
- `dist-scripts`
- `.server-build`
- `test-results`
- `playwright-report`
- `coverage`
- 既有 `.tar.gz` / `.zip`
- 临时日志

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm install` | 安装依赖 |
| `npm run dev` | Vite 开发服务器 |
| `npm run build` | 前端构建 + 后端编译 |
| `npm run build:server` | 只编译后端 |
| `npm run build:scripts` | 编译脚本到 `dist-scripts` |
| `npm run booth` | 构建并启动摊位模式 |
| `npm run solo` | 构建并启动单人模式 |
| `npm run cache-cards` | 缓存卡牌图片 |
| `npm run detect-faces` | 重新生成人脸框数据 |
| `npm test` | Vitest 单元/服务端测试 |
| `npm run test:e2e` | Playwright E2E，自动启动测试服务器 |
| `npm run verify` | 构建、测试和 E2E 总验证 |
| `npm run check:any` | 显式 any 基线报告 |
| `npm run check:types` | 前端 + 后端类型检查 |
| `npm run package:local` | 生成本地交付包 |

## 数据文件

| 路径 | 说明 |
| --- | --- |
| `data/settings.json` | 持久化设置 |
| `data/face-boxes.json` | 人脸框缓存 |
| `data/queue-scores.json` | 队列成绩 |
| `data/note-shooter-scores.json` | 音符射手成绩 |
| `public/cards/` | 卡牌图片缓存 |
| `resource/all5_2.json` | 卡牌题库 |
| `resource/nickname.json` | 角色昵称 |

## 文档

- `docs/local-release.md`：本地发布、离线运行和验收。
- `docs/diagnostics.md`：运行诊断和现场排错。
- `docs/vue3-ts-refactor-acceptance.md`：重构验收说明。
- `docs/type-debt.md`：类型债务基线。

## 注意事项

- 不需要 `git push` 才能本地运行或交付。
- 不需要创建 GitHub PR。
- 现场使用建议固定 `HOST_PASSWORD`。
- 公开网络部署必须使用强密码，并确认防火墙、代理和 HTTPS 策略。
- BanG Dream! 相关素材版权归对应权利方所有，本项目仅用于同好交流、线下互动和非商业展示。
