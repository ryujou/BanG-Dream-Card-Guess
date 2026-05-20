# BanG Dream! Card Guess

面向线下活动/同好会的 BanG Dream! 互动猜卡 Web 应用，支持主持端、玩家端、单人模式和多个小游戏。

## 新增内容（本次）

- 新增 `/stats` 统计展示页
  - 世界地图热力图（按国家聚合）
  - 省份/州与国家/地区双表并排展示（移动端自动纵向）
  - 省份/州优先显示，国家作为独立表同时显示
- Umami 统计接入完成
  - 主页新增“查看访问来源地图”入口
  - 全站接入 Umami tracking script
  - 支持长期累计展示（`/stats` 使用全历史时间范围）
- 地区名称中文化增强
  - 国家代码转中文（含回退）
  - 多国家区域代码转中文（CN/US/JP/KR/TH/CA/AU/MY 等）
- `/stats` 视觉增强
  - 使用本地 standee 静态资源随机展示
  - 世界地图使用本地开源 SVG（`public/maps/world.svg`）

## 页面入口

- `/`：主页
- `/player`：玩家页
- `/host`：主持控制台
- `/solo`：单人模式
- `/note-shooter`：音符射手
- `/games/stopwatch-challenge`：秒表挑战
- `/games/bang-klotski`：华容道小游戏
- `/stats`：访问来源统计地图与聚合表
- `/diagnostics`：运行诊断

## 快速开始

```bash
npm install
npm run dev
```

默认开发地址：`http://127.0.0.1:5173`

## 构建与运行

```bash
npm run build
npm run booth   # 线下摊位模式
npm run solo    # 单人模式
```

## 质量检查

```bash
npm run typecheck
npm run build
npm test
```

## Umami 相关文档

- 总体文档：`docs/umami.md`
- 自托管部署目录：`infra/umami/`
  - `docker-compose.yml`
  - `.env.example`
  - `deploy.sh`
  - `backup.sh`
  - `restore.sh`
  - `Caddyfile.example`
  - `nginx.conf.example`

## 主要目录

- `src/client/`：前端（Vue 3 + TS）
- `src/server/`：后端（Node + TS）
- `src/shared/`：共享类型
- `public/`：静态资源
- `docs/`：项目文档
- `infra/`：基础设施部署文件

## 说明

- 本仓库不提交真实密钥、真实 `.env`、真实统计 ID。
- 统计地区数据由 Umami IP 地理信息提供，精度可能受代理/VPN/CDN/运营商出口影响。
