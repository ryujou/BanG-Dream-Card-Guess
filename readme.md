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
- [功能详解](#功能详解)
- [界面预览](#界面预览)
- [模式说明](#模式说明)
- [页面入口](#页面入口)
- [环境与依赖](#环境与依赖)
- [快速开始](#快速开始)
- [一键脚本](#一键脚本)
- [默认配置](#默认配置)
- [现场部署建议](#现场部署建议)
- [卡面缓存](#卡面缓存)
- [人脸检测与裁剪策略](#人脸检测与裁剪策略)
- [二维码与离线](#二维码与离线)
- [智能裁剪算法](#智能裁剪算法)
- [主持鉴权](#主持鉴权)
- [资源来源](#资源来源)
- [内置接口](#内置接口)
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
- 支持 YOLO 动漫人脸预检测，可设置避开人脸、优先人脸或只切人脸
- 正方形切图，支持主持和玩家重切
- 揭晓时完整展示卡面，并用红框标出切图位置
- 支持单人计分、双队互动、连击、倒计时、玩家页重切按钮开关、自动下一题
- 支持难度预设、乐队/稀有度/属性/卡面版本筛选
- 支持本轮去重、下一题预加载、误判撤销、主持快捷键
- 玩家页支持全屏按钮，主持页和玩家页支持答题音效
- 二维码页支持玩家入口、主持入口和 Wi-Fi 二维码打印
- PWA 离线缓存基础页面和静态素材，提前缓存卡面后可降低现场网络依赖
- 设置支持本地持久化、导入/导出和运行状态检查
- 支持提前缓存 Bestdori 卡面，减少现场网络依赖
- 背景参考 BanG Dream! 官网浅色 pattern 风格，并额外加入猴子 pattern

## 功能详解

### 玩家屏幕

玩家页位于 `/player`，适合投到平板、笔记本或外接屏幕上。玩家页只展示题目必要信息，不显示答案和主持操作。

- 显示当前局部裁剪图、分数、连击、回合数和倒计时。
- 揭晓时完整覆盖展示卡面，并用红框标出刚才裁剪的位置。
- 可在设置页控制是否允许玩家自己点击“重切”。
- 提供“加入湘潭同好会”入口和全屏按钮，方便现场展示。
- 支持答题音效；可在设置中关闭。

### 主持控制台

主持页位于 `/host`，需要密码登录。主持人在这里控制题目流程和判定玩家答案。

- 开始/下一题、重切、揭晓、答对、答错、跳过、撤销判定。
- 显示正确答案、常用昵称、完整卡面和历史记录。
- 双队模式下可以切换当前答题队伍。
- 支持键盘快捷键，减少现场用鼠标点按钮的频率。
- 自动预加载下一题，降低下一题等待时间。

### 设置页

设置页位于 `/settings`，需要密码登录。保存后会写入本地 `data/settings.json`，重启服务仍会保留。

- 玩法模式：单人挑战 / 双队互动。
- 难度预设：简单 / 普通 / 困难，会自动调整裁剪尺寸和候选数。
- 裁剪参数：裁剪尺寸、智能候选数、最大重切次数、人脸裁剪策略。
- 计分规则：答对加分、答错扣分、连击加分、自动下一题。
- 玩家显示：是否显示倒计时、是否允许重切、玩家页是否显示重切按钮、是否启用音效。
- 卡池筛选：乐队、稀有度、属性、训练前/训练后/随机。
- 去重规则：短时间内避免重复卡面和重复角色。
- 运行状态：显示卡池数量、本地缓存数量、玩家/主持连接数、下一题预加载状态。
- 人脸状态：显示已生成人脸框数据的卡面数量，以及当前实际使用的人脸策略。
- 设置导入/导出：可以把一套活动配置保存成 JSON，下次直接导入。

### 二维码页

二维码页位于 `/qr`，用于现场打印。

- 自动检测本机局域网 IP，优先生成局域网入口二维码。
- 摊位模式会生成玩家页、主持登录页、设置页二维码。
- 自己玩模式会生成自玩页二维码。
- 支持填写 Wi-Fi 名称、密码和加密方式，点击“生成 Wi-Fi 码”后生成 Wi-Fi 二维码。
- Wi-Fi 二维码不会边输入边刷新，避免输入时卡顿。

### 离线与现场稳定性

项目内置 PWA Service Worker，会缓存基础页面、背景图和已访问过的静态资源。卡面体积较大，现场前建议先执行 `npm run cache-cards` 下载卡面到 `public/cards/`。

实际离线能力取决于两部分：

- 基础页面和背景：浏览器打开过后可由 PWA 缓存。
- 卡面图片：需要提前缓存到 `public/cards/`，否则缺图时仍会尝试联网下载。

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

默认主持密码：

```text
BangBang@2026
```

公网或陌生局域网使用时，请通过 `HOST_PASSWORD` 环境变量改成自己的密码。

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
| Python | 3.9+ | 仅在人脸预检测时需要 |
| ultralytics | YOLO 推理 | 仅在人脸预检测时需要，`pip install ultralytics` |

## 快速开始

### 1. 安装依赖

```sh
npm install
```

### 2. 可选：提前缓存卡面和人脸框

现场使用前建议先缓存卡面：

```sh
npm run cache-cards
```

项目已包含默认 YOLO 动漫人脸权重 `weight/best.pt`。如需更新人脸框数据库，可以继续执行：

```sh
pip install ultralytics
npm run detect-faces
```

生成结果会保存到 `data/face-boxes.json`，游戏启动时会自动读取。

### 3. 启动摊位模式

```sh
npm run booth
```

打开：

- 玩家页：`http://127.0.0.1:5173/player`
- 登录页：`http://127.0.0.1:5173/login`
- 主持页：`http://127.0.0.1:5173/host`
- 设置页：`http://127.0.0.1:5173/settings`
- 二维码页：`http://127.0.0.1:5173/qr`

默认主持密码：

```text
BangBang@2026
```

### 4. 启动自己玩模式

```sh
npm run solo
```

打开：

- 自玩页：`http://127.0.0.1:5173/solo`
- 二维码页：`http://127.0.0.1:5173/qr`

### 5. 生产构建

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
- 启动脚本会先执行前端构建，再启动本地 Node.js 服务。
- 如果默认端口 `5173` 被占用，可以先设置 `PORT` 环境变量再启动。

Windows PowerShell 修改端口示例：

```powershell
$env:PORT="5180"; scripts\start-booth.cmd
```

macOS / Ubuntu 修改端口示例：

```sh
PORT=5180 ./scripts/start-booth.sh
```

## 默认配置

默认配置来自 `server.mjs` 中的 `defaultSettings`，首次启动或删除 `data/settings.json` 后会回到这些值。

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| 主持密码 | `BangBang@2026` | 通过 `HOST_PASSWORD` 环境变量覆盖 |
| 模式 | `single` | 单人挑战 |
| 每题秒数 | `60` | 倒计时秒数 |
| 每人题数 | `3` | 现场轮换时参考 |
| 难度 | `normal` | 普通难度 |
| 人脸策略 | `auto` | 跟随难度：简单优先人脸，普通不限制，困难避开人脸 |
| 裁剪尺寸 | `180` | 正方形裁剪边长，单位像素 |
| 智能候选数 | `120` | 每题随机评估的候选裁剪区域数量 |
| 最大重切 | `3` | 每题可重切次数 |
| 允许重切 | 开启 | 主持可重切 |
| 玩家页显示重切 | 开启 | 玩家可自行重切 |
| 启用音效 | 开启 | 玩家页和主持页都会播放反馈音 |
| 显示倒计时 | 开启 | 关闭后不会计时结束 |
| 判定后揭晓答案 | 开启 | 答对/答错/跳过后显示完整卡面 |
| 自动下一题 | 关闭 | 开启后按设定延迟自动进入下一题 |
| 自动下一题延迟 | `1800ms` | 自动下一题等待时间 |
| 答对加分 | `1` | 基础得分 |
| 答错扣分 | `0` | 默认不扣分 |
| 连击加分 | 关闭 | 开启后按当前连击追加分数 |
| 卡面去重窗口 | `20` | 最近 20 张卡面尽量不重复 |
| 角色去重窗口 | `8` | 最近 8 个角色尽量不重复 |
| 乐队筛选 | 全部 | 默认包含全部角色组 |
| 稀有度筛选 | `1`~`5` | 默认包含全部稀有度 |
| 属性筛选 | 全部 | `cool` / `happy` / `powerful` / `pure` |
| 卡面版本 | `mixed` | 训练前/训练后随机 |
| A 队名称 | `A 队` | 双队互动模式使用 |
| B 队名称 | `B 队` | 双队互动模式使用 |

难度预设：

| 难度 | 裁剪尺寸 | 智能候选数 | 适用场景 |
| --- | --- | --- | --- |
| 简单 | `230` | `90` | 新玩家、现场暖场 |
| 普通 | `180` | `120` | 默认玩法 |
| 困难 | `130` | `170` | 熟练玩家或挑战局 |

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

设置页保存后会写入本地 `data/settings.json`，重启服务后会保留模式、规则和队伍名称。`data/settings.json` 是运行时配置文件；`data/face-boxes.json` 是项目自带的人脸框数据库。

现场建议提前检查：

- 先运行 `npm run cache-cards`，确认卡面缓存完成。
- 打开 `/settings`，检查“本地缓存”和“筛选卡池”数量是否正常。
- 打开 `/qr`，确认玩家二维码使用的是局域网 IP，不是 `127.0.0.1`。
- 平板或手机扫码进入 `/player` 后，主持页检查玩家连接数是否增加。
- 如果要打印 Wi-Fi 二维码，填完 SSID 和密码后点击“生成 Wi-Fi 码”，再打印页面。

主持页快捷键：

| 按键 | 功能 |
| --- | --- |
| `Space` / `→` | 开始或下一题 |
| `R` | 重切 |
| `V` | 揭晓 |
| `Enter` | 答对 |
| `Backspace` | 答错 |
| `S` | 跳过 |
| `U` | 撤销上一次判定 |
| `1` / `2` | 双队模式切换 A / B 队 |

设置页提供运行状态检查，会显示筛选后的卡池数量、本地缓存数量、玩家/主持连接数和下一题预加载状态。设置也可以导入/导出 JSON，便于不同活动规则快速切换。

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
- `public/cards/` 是本地卡面缓存目录，可按需要重新下载或清空。
- 浏览器会通过 PWA Service Worker 缓存基础页面和静态背景；卡面仍建议提前执行缓存脚本。

## 人脸检测与裁剪策略

项目支持把动漫人脸识别提前离线跑完，运行游戏时只读取检测框，不在现场实时跑 YOLO。这样可以把“难度不切人脸区域”做成设置项，同时避免游戏过程中卡顿。

准备步骤：

1. 项目已提供默认 YOLO 权重 `weight/best.pt` 和人脸框数据库 `data/face-boxes.json`，普通使用不需要重新检测。
2. 如果更换权重或卡面缓存，先执行 `npm run cache-cards`，确保 `public/cards/` 里有卡面。
3. 安装 Python 依赖并重新生成检测框：

```sh
pip install ultralytics
npm run detect-faces
```

检测结果会写入：

```text
data/face-boxes.json
```

`data/face-boxes.json` 会按卡面相对路径保存图片宽高和人脸框，例如：

```json
{
  "images": {
    "res001001_rip/card_normal.png": {
      "width": 1334,
      "height": 1002,
      "faces": [
        { "x": 512.4, "y": 218.6, "w": 96.3, "h": 102.1, "conf": 0.91, "cls": 1, "label": "face" }
      ]
    }
  }
}
```

设置页的人脸策略：

| 策略 | 说明 |
| --- | --- |
| 跟随难度 | 默认值。简单模式优先切人脸，普通模式不限制，困难模式避开人脸 |
| 不限制 | 只使用原本的智能裁剪评分，不参考人脸框 |
| 避开人脸 | 根据 `eyes` / `face` / `mouth` 检测框扩张出脸部禁区，重叠越多分数越低，适合提高难度 |
| 优先人脸 | 人脸附近候选会加分，适合降低难度或暖场 |
| 只切人脸 | 尽量只选择覆盖脸部禁区的区域；如果该卡没有检测框，会回退到普通智能裁剪 |

检测脚本支持增量更新。已经写入 `data/face-boxes.json` 的图片默认不会重复检测；如果更换权重或想重跑全部图片，可以使用：

```sh
python scripts/detect-faces.py --force
```

常用参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--weights` | `weight/best.pt` | YOLO 权重路径 |
| `--cards` | `public/cards` | 本地卡面目录 |
| `--output` | `data/face-boxes.json` | 检测框输出路径 |
| `--imgsz` | `1280` | YOLO 推理尺寸 |
| `--conf` | `0.10` | 置信度阈值 |
| `--batch` | `8` | 批处理数量 |
| `--device` | 空 | 可指定 `cpu`、`0` 等设备 |

## 二维码与离线

### `/qr` 二维码页

`/qr` 页面用于现场打印或临时扫码。页面会调用本地 `/api/network` 获取当前可用地址，并优先使用局域网地址生成二维码。

摊位模式会生成：

- 玩家页二维码：给玩家或展示设备使用。
- 主持登录二维码：给主持手机或主持电脑使用。
- 设置页二维码：给开场前调规则使用。
- Wi-Fi 二维码：手动填入 SSID、密码和加密方式后生成。

自己玩模式会生成：

- 自玩页二维码。
- 入口总览二维码。
- Wi-Fi 二维码。

普通 Wi-Fi 二维码只能让设备连接 Wi-Fi，不能保证连接后自动打开网页。因此现场推荐打印两个二维码：一个用于连接 Wi-Fi，一个用于打开 `/player` 或 `/solo`。

### PWA 离线缓存

项目提供 `public/sw.js` 和 `public/manifest.webmanifest`。浏览器访问页面后，会缓存基础 HTML、JS、CSS、背景 pattern 和猴子图案。

需要注意：

- Service Worker 不缓存 WebSocket 实时状态。
- Service Worker 不会主动缓存全部卡面。
- 卡面离线依赖 `public/cards/` 是否提前下载。
- 如果更新代码后浏览器仍显示旧界面，可以强制刷新或清理站点数据。

## 智能裁剪算法

裁剪逻辑在服务端完成，核心目标是减少两类影响体验的情况：

- 重切后和上一张局部图差别不大。
- 截到天空、纯色背景、大片色块等信息量很低的区域。

实现思路：

1. 随机生成多个候选正方形裁剪点，候选数量由设置项“智能候选数”控制。
2. 对每个候选区域采样，计算颜色变化、亮度方差、饱和度、边缘密度等指标。
3. 如果区域颜色过于集中、亮度变化太小、边缘过少，会直接降权或丢弃，避免选中大色块背景。
4. 如果启用了“优先人脸”或“只切人脸”，会额外围绕已检测到的脸部禁区生成候选点，避免纯随机采样碰不到人脸。
5. 对高分候选按分数排序，优先选择细节更多的区域。
6. 记录最近几次裁剪位置，重切时要求新位置和历史位置保持一定距离。
7. 如果距离要求太严格导致没有合适候选，会逐级放宽距离，最后才回退到最高分候选。

基础智能裁剪会用图像统计特征估算“这块图有没有足够可猜的信息”。如果已经运行 `npm run detect-faces` 生成 `data/face-boxes.json`，裁剪评分还会叠加人脸框策略：困难时可以避开人脸，简单时可以优先人脸，或者由设置强制指定。检测模型会输出 `eyes`、`face`、`mouth` 三类框，运行时会把眼睛和嘴巴这种局部框扩张成近似脸部区域再参与评分。游戏运行时不会加载 YOLO 模型，只读取 JSON 检测框，所以现场性能开销很小。

## 主持鉴权

主持页 `/host` 和设置页 `/settings` 都需要登录。默认主持密码：

```text
BangBang@2026
```

登录成功后浏览器会获得一个本地 Cookie，有效期为 1 天。关闭服务后，服务端临时认证 token 会重新生成，下一次启动需要重新登录。

公开网络、公网部署或陌生局域网使用时，请务必通过环境变量修改默认密码。

Windows PowerShell：

```powershell
$env:HOST_PASSWORD="你的强密码"; npm run booth
```

macOS / Ubuntu：

```sh
HOST_PASSWORD="你的强密码" npm run booth
```

如果用一键脚本，也可以先设置环境变量：

Windows PowerShell：

```powershell
$env:HOST_PASSWORD="你的强密码"; scripts\start-booth.cmd
```

macOS / Ubuntu：

```sh
HOST_PASSWORD="你的强密码" ./scripts/start-booth.sh
```

自己玩模式 `/solo` 不需要登录，只开放自玩相关命令，不开放主持和设置能力。

## 资源来源

| 资源 | 路径 | 来源说明 |
| --- | --- | --- |
| 原 Koishi 插件 | - | 参考自 [xsjh/koishi-plugin-bangbangcai](https://github.com/xsjh/koishi-plugin-bangbangcai) |
| 卡面立绘 | `public/cards/` | 运行时从 Bestdori 资源路径读取并缓存 |
| 题库数据 | `resource/all5_2.json` | 来自原 Koishi 插件整理数据 |
| 角色昵称 | `resource/nickname.json` | 来自原 Koishi 插件整理数据 |
| 背景 pattern | `public/bg/bg_pattern_*` | 参考 BanG Dream! 官网浅色 pattern 风格 |
| 猴子图案 | `public/bg/monkey.png` | 项目自备/用户提供素材 |
| 人脸检测权重 | `weight/best.pt` | YOLO 动漫人脸权重，项目自带 |

Bestdori 卡面资源路径示例：

```text
https://bestdori.com/assets/jp/characters/resourceset/...
```

版权说明：

- BanG Dream! 相关角色、卡面与素材版权归对应权利方所有。
- 本项目仅用于同好交流、线下互动与非商业展示。
- 批量缓存的卡面立绘建议只作为本地活动素材使用。

## 内置接口

这些接口主要给前端页面使用，也可用于现场排查。

| 接口 | 说明 |
| --- | --- |
| `GET /api/network` | 返回本机端口、当前访问地址、检测到的局域网入口 |
| `GET /api/health` | 返回卡池数量、缓存数量、连接数、预加载状态、人脸框数据数量 |
| `GET /api/qr?text=...` | 生成 SVG 二维码 |
| `POST /api/login` | 主持登录 |
| `POST /api/logout` | 主持退出 |
| `GET /bestdori/...` | Bestdori 静态资源代理 |
| `WS /ws` | 玩家页、主持页、设置页同步通道 |

## 目录结构

```text
BanG-Dream-Card-Guess/
├── index.html                  # Vite HTML 入口
├── package.json                # npm 脚本与依赖
├── package-lock.json           # npm 锁定文件
├── readme.md                   # 项目说明
├── server.mjs                  # 本地 HTTP/WebSocket 服务
├── vite.config.mjs             # Vite 配置
├── data/
│   ├── settings.json           # 设置页保存结果，本地运行生成
│   └── face-boxes.json         # 人脸检测框数据库
├── public/                     # 静态资源
│   ├── manifest.webmanifest    # PWA 配置
│   ├── sw.js                   # 离线缓存 Service Worker
│   ├── bg/                     # 背景 pattern 与猴子素材
│   └── cards/                  # 本地卡面缓存
├── resource/                   # 题库与昵称数据
│   ├── all5_2.json
│   └── nickname.json
├── screenshots/                # README 截图
│   ├── player.png
│   └── solo.png
├── scripts/                    # 一键安装与启动脚本
│   ├── cache-cards.mjs
│   ├── detect-faces.py
│   ├── install-env.cmd
│   ├── install-env.sh
│   ├── start-booth.cmd
│   ├── start-booth.sh
│   ├── stop-server.cmd
│   ├── stop-server.sh
│   ├── start-solo.cmd
│   └── start-solo.sh
├── weight/                     # YOLO 动漫人脸权重目录
│   └── best.pt
└── src/
    └── web/                    # 前端页面
        ├── main.js
        └── styles.css
```

## 常见问题

**Q: 现场没有公网还能玩吗？**  
A: 可以。提前执行 `npm run cache-cards` 后，题目数据和大部分卡面都在本地。玩家页、主持页和设置页只需要连上同一个局域网。

**Q: 玩家扫码连 Wi-Fi 后能自动打开玩家页吗？**  
A: 普通 Wi-Fi 二维码不能自动继续打开网页。推荐打印两个二维码：一个连 Wi-Fi，一个由 `/qr` 页面生成并打开 `/player`。

**Q: 主持页怎么防止玩家误入？**  
A: `/host` 和 `/settings` 都需要密码登录。默认密码是 `BangBang@2026`，公网部署时请用 `HOST_PASSWORD` 环境变量修改默认密码。

**Q: 自己玩模式为什么不需要登录？**  
A: 自己玩模式只开放 `/solo` 的自玩命令，不开放主持设置页，适合个人练习和线上自测。

**Q: PWA 离线是不是完全不需要网络？**
A: 基础页面、背景和已打开过的静态资源可以离线缓存；题目卡面仍取决于 `public/cards/` 是否提前缓存完整。现场建议先执行 `npm run cache-cards`。

**Q: 设置了避开人脸但还是偶尔切到脸怎么办？**
A: 先确认设置页运行状态里“人脸框数据”不是 0。如果更换了卡面缓存或权重，可以用 `python scripts/detect-faces.py --force` 重新生成。避开人脸依赖检测框，极端侧脸、遮挡脸或特别小的人脸仍可能漏检，现场可以配合“重切”处理。

欢迎加入湘潭 BanG Dream! 同好会：[点击链接加入群聊【湘潭BanG Dream!同好会】](https://qm.qq.com/q/6ytGE7qIWQ)
