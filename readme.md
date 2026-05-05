# BanG Dream! Card Guess

<p align="center">
  <img src="screenshots/player.png" alt="BanG Dream Card Guess player screen" width="760">
</p>

<p align="center">
  <a href="https://space.bilibili.com/3546647883680530"><img src="https://img.shields.io/badge/Author-ryujou-2B90D9?style=flat-square" alt="author"></a>
  <img src="https://img.shields.io/badge/Runtime-Node.js-3C873A?style=flat-square" alt="runtime">
  <img src="https://img.shields.io/badge/Frontend-Vite-646CFF?style=flat-square" alt="vite">
  <img src="https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=flat-square" alt="language">
  <img src="https://img.shields.io/badge/Mode-Booth%20%7C%20Solo-FF3D6E?style=flat-square" alt="mode">
  <img src="https://img.shields.io/badge/Status-Active-1EAE98?style=flat-square" alt="status">
</p>

> BanG Dream! 卡面猜图互动 Web 游戏。支持线下摊位主持模式、单人自玩模式、本地卡面缓存、智能正方形裁剪、玩家屏幕与主持控制台 WebSocket 同步。

## 目录

- [项目简介](#项目简介)
- [功能列表](#功能列表)
- [界面预览](#界面预览)
- [模式说明](#模式说明)
- [页面入口](#页面入口)
- [环境与依赖](#环境与依赖)
- [快速开始](#快速开始)
- [一键脚本](#一键脚本)
- [现场部署建议](#现场部署建议)
- [卡面缓存](#卡面缓存)
- [智能裁剪算法](#智能裁剪算法)
- [主持鉴权](#主持鉴权)
- [资源来源](#资源来源)
- [目录结构](#目录结构)
- [常见问题](#常见问题)

## 项目简介

BanG Dream! Card Guess 是从 Koishi 机器人猜卡插件改造成的本地 Web 游戏。它面向线下摊位互动场景：玩家只看到裁剪后的卡面局部，主持人在控制台判定玩家说出的角色名是否正确，揭晓时会显示完整卡面并用红框标出裁剪位置。

项目也提供自己玩模式，玩家可以直接在网页输入答案，不需要主持控制台。

## 功能列表

- 本地 Node.js 服务，前端由 Vite 构建
- WebSocket 同步玩家页、主持页、设置页
- 线下摊位模式：玩家屏幕 + 主持控制台 + 设置页
- 自己玩模式：单页面输入答案并自动判定
- 主持密码登录，避免玩家误入控制台
- 智能裁剪卡面局部，优先选择细节丰富区域
- 正方形切图，支持主持和玩家重切
- 揭晓时完整展示卡面，并用红框标出切图位置
- 支持单人计分、双队互动、连击、倒计时、玩家页重切按钮开关、自动下一题
- 支持提前缓存 Bestdori 卡面，减少现场网络依赖
- 背景参考 BanG Dream! 官网浅色 pattern 风格，并额外加入猴子 pattern

## 界面预览

### 玩家屏幕

<p align="center">
  <img src="screenshots/player.png" alt="Player screen" width="760">
</p>

### 自己玩模式

<p align="center">
  <img src="screenshots/solo.png" alt="Solo screen" width="760">
</p>

## 模式说明

### 摊位模式

摊位模式适合线下活动。玩家面前只放 `/player` 页面，主持人使用 `/host` 页面控制题目。

典型流程：

1. 主持点击“开始/下一题”。
2. 玩家看局部图，说出角色名或昵称。
3. 主持根据玩家回答点击“答对 / 答错 / 跳过”。
4. 页面揭晓完整卡面，并标出裁剪位置。
5. 主持进入下一题。

### 自己玩模式

自己玩模式使用 `/solo` 页面，不需要主持登录。玩家可以直接输入答案，网页会根据昵称表自动判定。

适合：

- 自己打开网页练习
- 不需要主持的线上玩法
- 展示项目基础功能

## 页面入口

摊位模式：

| 页面 | 地址 | 说明 |
| --- | --- | --- |
| 玩家页 | `http://127.0.0.1:5173/player` | 给玩家或展示屏幕使用 |
| 登录页 | `http://127.0.0.1:5173/login` | 主持登录 |
| 主持页 | `http://127.0.0.1:5173/host` | 控制题目与判定 |
| 设置页 | `http://127.0.0.1:5173/settings` | 调整规则与模式 |
| 二维码页 | `http://127.0.0.1:5173/qr` | 打印玩家页、主持页等入口二维码 |

自己玩模式：

| 页面 | 地址 | 说明 |
| --- | --- | --- |
| 自玩页 | `http://127.0.0.1:5173/solo` | 输入答案并自动判定 |
| 二维码页 | `http://127.0.0.1:5173/qr` | 打印自玩入口二维码 |

## 环境与依赖

| 组件 | 说明 | 备注 |
| --- | --- | --- |
| Node.js | 18+ | 推荐 Node.js 20 LTS |
| npm | Node.js 包管理器 | 随 Node.js 安装 |
| Vite | 前端构建 | 已写入 `devDependencies` |
| ws | WebSocket 服务 | 已写入 `dependencies` |
| Jimp | 服务端裁图 | 已写入 `dependencies` |
| qrcode | 本地二维码生成 | 已写入 `dependencies` |

## 快速开始

### 1. 安装依赖

```sh
npm install
```

### 2. 启动摊位模式

```sh
npm run booth
```

打开：

- 玩家页：`http://127.0.0.1:5173/player`
- 主持页：`http://127.0.0.1:5173/host`
- 设置页：`http://127.0.0.1:5173/settings`
- 二维码页：`http://127.0.0.1:5173/qr`

### 3. 启动自己玩模式

```sh
npm run solo
```

打开：

- 自玩页：`http://127.0.0.1:5173/solo`
- 二维码页：`http://127.0.0.1:5173/qr`

### 4. 生产构建

```sh
npm run build
npm run start
```

## 一键脚本

所有脚本位于 `scripts/`。

### Windows

第一次运行：

```bat
scripts\install-env.cmd
```

摊位模式：

```bat
scripts\start-booth.cmd
```

自己玩模式：

```bat
scripts\start-solo.cmd
```

关闭本地服务：

```bat
scripts\stop-server.cmd
```

### macOS / Ubuntu

第一次运行：

```sh
chmod +x scripts/install-env.sh scripts/start-booth.sh scripts/start-solo.sh
./scripts/install-env.sh
```

摊位模式：

```sh
./scripts/start-booth.sh
```

自己玩模式：

```sh
./scripts/start-solo.sh
```

关闭本地服务：

```sh
./scripts/stop-server.sh
```

说明：

- Windows 安装脚本会优先使用 `winget` 安装 Node.js LTS。
- macOS 安装脚本会优先使用 Homebrew 安装 Node.js。
- Ubuntu / Debian 安装脚本会通过 NodeSource 安装 Node.js 20 LTS。

## 现场部署建议

现场摊位建议使用本地局域网，不建议完全依赖公网。

推荐方案：

1. 笔记本运行 `scripts/start-booth.cmd` 或 `./scripts/start-booth.sh`。
2. 平板、主持手机、玩家屏幕连接同一个 Wi-Fi 或笔记本热点。
3. 启动日志会打印 `127.0.0.1` 和检测到的局域网入口。
4. 打开 `http://127.0.0.1:5173/qr`，页面会优先使用检测到的局域网地址生成二维码。
5. 玩家设备扫码打开笔记本局域网 IP，例如 `http://192.168.1.23:5173/player`。
6. 主持设备打开 `http://192.168.1.23:5173/login`，登录后进入主持页。

如果现场 Wi-Fi 不稳定，可以使用手机热点或 USB 共享网络。游戏控制和图片读取仍优先走本地服务，提前缓存卡面后对公网依赖会更低。

设置页保存后会写入本地 `data/settings.json`，重启服务后会保留模式、规则和队伍名称。`data/` 是运行时配置目录，不需要提交到 GitHub。

## 卡面缓存

提前下载卡面：

```sh
npm run cache-cards
```

卡面会保存到：

```text
public/cards/
```

注意：

- 该目录可能占用数 GB 磁盘空间。
- 运行游戏时会优先读取本地缓存，缺失时才联网下载并补到缓存。
- `public/cards/` 已写入 `.gitignore`，不会被版本控制。

## 智能裁剪算法

裁剪逻辑在服务端完成，核心目标是减少两类影响体验的情况：

- 重切后和上一张局部图差别不大。
- 截到天空、纯色背景、大片色块等信息量很低的区域。

实现思路：

1. 随机生成多个候选正方形裁剪点，候选数量由设置项“智能候选数”控制。
2. 对每个候选区域采样，计算颜色变化、亮度方差、饱和度、边缘密度等指标。
3. 如果区域颜色过于集中、亮度变化太小、边缘过少，会直接降权或丢弃，避免选中大色块背景。
4. 对高分候选按分数排序，优先选择细节更多的区域。
5. 记录最近几次裁剪位置，重切时要求新位置和历史位置保持一定距离。
6. 如果距离要求太严格导致没有合适候选，会逐级放宽距离，最后才回退到最高分候选。

这套策略不是识别人脸或角色部位，而是用图像统计特征估算“这块图有没有足够可猜的信息”。好处是速度快、离线可用，不需要额外 AI 模型；缺点是遇到复杂背景时仍可能切到误导区域，所以主持端保留了“重切”功能。

## 主持鉴权

主持页和设置页需要登录。默认主持密码：

```text
BangBang@2026
```

公开网络或公网部署时请使用环境变量修改。

Windows PowerShell：

```powershell
$env:HOST_PASSWORD="你的强密码"; npm run booth
```

macOS / Ubuntu：

```sh
HOST_PASSWORD="你的强密码" npm run booth
```

## 资源来源

| 资源 | 路径 | 来源说明 |
| --- | --- | --- |
| 原 Koishi 插件 | - | 参考自 [xsjh/koishi-plugin-bangbangcai](https://github.com/xsjh/koishi-plugin-bangbangcai) |
| 卡面立绘 | `public/cards/` | 运行时从 Bestdori 资源路径读取并缓存 |
| 题库数据 | `resource/all5_2.json` | 来自原 Koishi 插件整理数据 |
| 角色昵称 | `resource/nickname.json` | 来自原 Koishi 插件整理数据 |
| 背景 pattern | `public/bg/bg_pattern_*` | 参考 BanG Dream! 官网浅色 pattern 风格 |
| 猴子图案 | `public/bg/monkey.png` | 项目自备/用户提供素材 |

Bestdori 卡面资源路径示例：

```text
https://bestdori.com/assets/jp/characters/resourceset/...
```

版权说明：

- BanG Dream! 相关角色、卡面与素材版权归对应权利方所有。
- 本项目仅用于同好交流、线下互动与非商业展示。
- 不建议把批量缓存的卡面立绘提交到公开仓库。

## 目录结构

```text
BanG-Dream-Card-Guess/
├── .gitignore                  # Git 忽略规则
├── index.html                  # Vite HTML 入口
├── package.json                # npm 脚本与依赖
├── package-lock.json           # npm 锁定文件
├── readme.md                   # 项目说明
├── server.mjs                  # 本地 HTTP/WebSocket 服务
├── vite.config.mjs             # Vite 配置
├── data/                       # 运行时设置保存目录，不提交 GitHub
├── public/                     # 静态资源
│   ├── bg/                     # 背景 pattern 与猴子素材
│   └── cards/                  # 卡面缓存，不提交 GitHub
├── resource/                   # 题库与昵称数据
│   ├── all5_2.json
│   └── nickname.json
├── screenshots/                # README 截图
│   ├── player.png
│   └── solo.png
├── scripts/                    # 一键安装与启动脚本
│   ├── cache-cards.mjs
│   ├── install-env.cmd
│   ├── install-env.sh
│   ├── start-booth.cmd
│   ├── start-booth.sh
│   ├── stop-server.cmd
│   ├── stop-server.sh
│   ├── start-solo.cmd
│   └── start-solo.sh
└── src/
    └── web/                    # 前端页面
        ├── main.js
        └── styles.css
```

## 常见问题

**Q: 为什么不把下载好的卡面传到 GitHub？**  
A: 卡面缓存体积很大，而且涉及版权边界。项目会在本地运行时自动读取或补齐缓存。

**Q: 现场没有公网还能玩吗？**  
A: 可以。提前执行 `npm run cache-cards` 后，题目数据和大部分卡面都在本地。玩家页、主持页和设置页只需要连上同一个局域网。

**Q: 玩家扫码连 Wi-Fi 后能自动打开玩家页吗？**  
A: 普通 Wi-Fi 二维码不能自动继续打开网页。推荐打印两个二维码：一个连 Wi-Fi，一个由 `/qr` 页面生成并打开 `/player`。

**Q: 主持页怎么防止玩家误入？**  
A: `/host` 和 `/settings` 都需要密码登录。公网部署时请用 `HOST_PASSWORD` 环境变量修改默认密码。

**Q: 自己玩模式为什么不需要登录？**  
A: 自己玩模式只开放 `/solo` 的自玩命令，不开放主持设置页，适合个人练习和线上自测。

欢迎加入湘潭 BanG Dream! 同好会：[点击链接加入群聊【湘潭BanG Dream!同好会】](https://qm.qq.com/q/6ytGE7qIWQ)
