# 运行诊断与现场排错

## 诊断入口

- `/api/health`：公开轻量健康检查，包含服务状态、版本、连接数、缓存摘要、游戏摘要和最近错误摘要。
- `/api/diagnostics`：主持鉴权后的完整诊断摘要。
- `/api/diagnostics/export`：主持鉴权后的诊断 JSON 导出。
- `/diagnostics`：诊断页面，可查看服务、WebSocket、局域网地址、缓存、成绩摘要和最近错误，并复制诊断信息。

诊断信息不会包含主持密码、Cookie、CSRF token、完整本地文件路径、完整题库或完整图片 URL 列表。

## 手机无法访问二维码

1. 确认手机和运行电脑连接同一个 Wi-Fi 或热点。
2. 打开 `/qr`，优先扫描非 `127.0.0.1` 的局域网地址。
3. 打开 `/diagnostics`，查看 `network.lanHosts` 和地址数量。
4. 检查 Windows 防火墙是否阻止 Node.js。
5. 如果电脑有多个虚拟网卡，优先使用和手机同网段的地址。

## WebSocket 断线怎么看

1. 打开 `/diagnostics` 查看 `websocket.connectedClients`。
2. 查看 `websocket.roles` 是否包含 player、host 或 settings。
3. 查看 `/api/health` 的 `connectedClients` 是否随页面打开变化。
4. 如果连接数不增长，检查浏览器控制台、端口、防火墙和代理设置。

## 题库缓存异常怎么看

1. 打开 `/api/health` 查看 `cache.cardCount`、`cache.cachedSets`、`cache.cachePercent`。
2. 打开 `/diagnostics` 查看 cache 摘要。
3. 如果现场离线，提前执行 `npm run cache-cards`。
4. 如果缓存损坏，删除对应缓存后重新联网缓存。

## scores 写入失败怎么看

1. 打开 `/diagnostics` 查看 `scores.queue` 和 `scores.noteShooter`。
2. 查看最近错误中是否有 scores 读写失败。
3. 确认运行目录下 `data` 目录可写。
4. 不要手动改写运行中的 scores JSON 文件。

## 如何导出诊断信息

1. 主持登录后打开 `/diagnostics`。
2. 点击复制诊断信息。
3. 或访问 `/api/diagnostics/export` 保存 JSON。
4. 反馈问题时附上导出的 JSON、启动命令和浏览器地址。
