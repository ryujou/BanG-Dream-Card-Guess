# Vue3 + TypeScript 重构验收

本文档记录当前本地分支的交付验收方式。验收只验证行为兼容和运行稳定性，不要求推送远端，不要求创建 GitHub PR。

## 不变项

- 不改变页面视觉效果。
- 不改变现有路由。
- 不改变 HTTP API 的旧响应结构。
- 不改变 WebSocket 消息格式。
- 不改变游戏规则。
- 不改变 AppSnapshot 结构。
- 不改变 settings 字段语义。
- 不改变 scores 数据结构。
- 不改变 `npm run booth` 和 `npm run solo` 使用方式。

## 安装与启动

```sh
npm install
npm run dev
npm run booth
npm run solo
```

## 构建与测试

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
```

也可以执行：

```sh
npm run verify
```

## 页面验收

- `/player` 玩家页可打开并接收状态。
- `/host` 主持页登录后可控制游戏。
- `/settings` 设置页登录后可保存设置。
- `/solo` 单人模式可打开。
- `/note-shooter` 横幅和游戏资源可加载。
- `/scores` 成绩榜可打开。
- `/qr` 可显示局域网页面入口。
- `/diagnostics` 可显示诊断信息。

## 协议验收

- `/api/health` 仍包含旧字段，并追加诊断字段。
- `/api/diagnostics` 和 `/api/diagnostics/export` 需要主持鉴权。
- WebSocket `state`、`authRequired`、`error` 等消息格式保持兼容。
- player 角色不会执行旧版不允许的主持命令。

## 现场验收

1. 执行 `npm run booth`。
2. 电脑打开 `/host` 并登录。
3. 手机扫码 `/qr` 中的 `/player` 地址。
4. 主持开始游戏，玩家页状态同步。
5. 打开 `/diagnostics`，确认连接数、缓存和最近错误可见。
6. 执行 `npm run solo`，确认单人模式可启动。

## 本地交付声明

- 所有改动仅本地保存。
- 不需要 push。
- 不需要 GitHub PR。
