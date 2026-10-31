# 湘潭同好会 · BanG Dream! / 世界计划 / 蔚蓝档案

一个面向同好交流与线下活动的非官方社区网站。以三种作品主题串联角色首页、猜图游戏、互动小游戏和活动相册，前端使用 React + TypeScript，后端使用 Go，数据存储采用 SQLite。

**在线体验：[xtbang.top](https://xtbang.top)** · **源码：[BanG-Dream-Card-Guess](https://github.com/ryujou/BanG-Dream-Card-Guess)**

## 功能

- **三主题首页**：BanG Dream!、世界计划、蔚蓝档案；70 位游戏角色立绘轮换，支持主题配色、角色光标和手机布局。
- **猜图游戏**：单人练习、主持房间与多人参与；BanG Dream! / 世界计划卡面猜图，蔚蓝档案使用记忆大厅画面。
- **互动小游戏**：音符射手、华容道、秒表挑战，以及蔚蓝档案泡泡月饼大作战。
- **社团内容**：成员、活动、视频与相册；相册分组、分批加载、图片懒加载和放大预览，支持后台编辑。
- **账号与成绩**：管理员、主持权限、成绩查询；账号由管理员创建。
- **周边与统计**：商品展示、小程序入口；可选接入 Umami，凭据仅配置在后端。

主题入口：[BanG Dream!](https://xtbang.top/) · [世界计划](https://xtbang.top/?theme=sekai) · [蔚蓝档案](https://xtbang.top/?theme=bluearchive)

## 技术栈与目录

| 部分 | 技术 / 位置 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、CSS Modules、Motion；`src/client/` |
| 业务组件与逻辑 | `src/client/features/`，页面由 `src/client/pages/` 组合 |
| 后端 | Go、HTTP / WebSocket、SQLite；`backend/` |
| 前端协议类型 | `src/shared/types.ts` |
| 游戏数据 | `resource/`：角色昵称、卡池、裁剪坐标、素材来源 |
| 静态资源 | `public/`：角色、字体、小游戏及 BA 记忆大厅图片 |
| 测试 | Vitest、Playwright、Go testing；`tests/` 与 `backend/*_test.go` |
| 部署模板 | `deploy/frontend.nginx.conf`、`ecosystem.config.cjs` |

## 本地运行

需要 **Node.js 24**、npm 和 **Go 1.27+**。

```sh
git clone https://github.com/ryujou/BanG-Dream-Card-Guess.git
cd BanG-Dream-Card-Guess
npm ci
```

复制环境模板：

```powershell
# PowerShell 7
Copy-Item .env.example .env
```

Linux / macOS 使用 `cp .env.example .env`。在 `.env` 中填写自己的 `BOOTSTRAP_ADMIN_PASSWORD`，然后启动：

```sh
npm run dev
```

打开 `http://127.0.0.1:5173`。Vite 将 API 和 WebSocket 转发到本地 Go 后端，默认端口 8080。也可分别执行 `npm run dev:frontend` 和 `npm run dev:backend`。

首次启动会在 `DATA_DIR` 创建数据库和 `admin` 账号，密码取自环境配置；已有数据库不会重新初始化账号。新实例的成员、活动、相册和成绩由自己的管理后台维护。

BanG Dream! 和世界计划卡图按需从素材源获取并缓存，需要网络连接。蔚蓝档案猜图使用仓库中的记忆大厅图片。运行游戏不需要 Python 或 GPU；`scripts/detect-faces.py` 和 `weight/best.pt` 仅用于维护裁剪坐标。

## 配置

| 变量 | 用途 |
| --- | --- |
| `BOOTSTRAP_ADMIN_PASSWORD` | 首次初始化管理员密码，必填 |
| `HOST` / `PORT` | Go 监听地址和端口 |
| `DATA_DIR` | 数据库及上传目录，默认 `./data` |
| `PUBLIC_ORIGIN` | 对外访问源，本地开发为 `http://127.0.0.1:5173` |
| `DEV_ORIGIN` | 开发前端源，生产环境留空 |
| `API_PROXY_TARGET` | 可选，覆盖 Vite 的后端代理目标 |
| `UMAMI_BASE_URL` / `UMAMI_WEBSITE_ID` | 可选统计服务 |
| `UMAMI_SHARE_ID` / `UMAMI_API_TOKEN` | 后端统计访问凭据，按服务配置选择 |
| `VITE_UMAMI_SCRIPT_URL` / `VITE_UMAMI_WEBSITE_ID` | 可选前端统计脚本和公开站点标识 |
| `VITE_SHOP_QR_URL` | 可选商品小程序码图片地址 |

`VITE_*` 变量会进入浏览器构建产物，只能放公开配置。密码、Token 和服务器管理凭据应保留在服务端环境中。

## 构建与部署

```sh
npm run build
```

产物为 `dist/client/` 和 `dist/server/xtbang`（Windows 为 `xtbang.exe`）。前端由静态服务器提供，Go 提供 API、WebSocket 和业务文件。

Nginx 模板以应用目录为启动前缀，前端监听 `127.0.0.1:8080`，代理到 Go `127.0.0.1:8081`。部署时按自己的域名调整 `server_name`、CSP 中的 WebSocket 地址和 `PUBLIC_ORIGIN`，在外层反向代理配置 HTTPS。PM2 模板管理前后端进程；运行 Go 二进制无需在服务器安装 Go 编译器。

发布时携带 `dist/`、`resource/`、`public/` 和部署配置。数据库、上传目录和 `.env` 使用部署实例自己的文件。BA 卡图由后端从 `public/cards/bluearchive/` 读取，不在前端构建目录中。

## 验证

```sh
npm run typecheck
npm run test:backend
npm run test:frontend
```

前端测试包括逻辑测试和真实 Chrome 组件测试，需要安装 Chrome，或通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指定 Chromium。覆盖率针对全部 `src/client`，报告输出到 `artifacts/coverage/frontend/`；配置的门槛不代表每次提交的实测结果。

端到端测试针对单独的测试实例运行：

```powershell
npx playwright install chromium
$env:E2E_BASE_URL = 'http://127.0.0.1:5173'
$env:E2E_ADMIN_PASSWORD = '测试实例的管理员密码'
npm run test:e2e
```

端到端测试会操作账号、内容和成绩，请使用测试实例。

## 数据与隐私

公开仓库包含程序源码、测试及游戏静态资源。线上数据库、SQL 导出、账号和成绩、群相册、成员头像、用户上传、环境文件、服务器凭据、日志和内部部署记录不随源码发布。`.env.example` 仅提供空配置模板。

活动相册通过管理后台维护图片地址、所属相册和文案。QQ / NapCat 管理接口及凭据不属于公开前端，也不需要为本地启动配置机器人。

## 素材与致谢

角色、卡面、记忆大厅、音乐、字体与第三方小游戏归各自权利人所有；公开源码不代表授予这些素材的再分发或商用许可。项目为非官方同好作品，与各作品官方无隶属关系。

- 素材来源与字体许可证见 [素材说明](docs/assets.md)。
- [Bestdori](https://bestdori.com/)、[Sekai Viewer](https://sekai.best/)、[SchaleDB](https://schaledb.com/)、[Blue Archive Wiki](https://bluearchive.wiki/) 提供游戏数据或素材参考。
- 泡泡月饼大作战见 [独立项目](https://github.com/ryujou/bluearchive-mooncake-local) 与 [资源说明](public/games/ba-mooncake/README.md)。
