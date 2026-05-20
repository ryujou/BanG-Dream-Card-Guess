# Umami 接入与自托管部署

## 1) 总体架构

- 个人网站: https://xtbang.top
- Umami: https://stats.xtbang.top
- 统计展示页: https://xtbang.top/stats

## 2) DNS 配置

- `stats.xtbang.top` 的 A 记录指向公网服务器 IP
- 如果 `xtbang.top` 也自托管，需确保 `xtbang.top` 的 A/AAAA/CNAME 记录正确

## 3) 服务器部署步骤

```bash
cd infra/umami
cp .env.example .env
nano .env
bash deploy.sh
```

## 4) SSH 自动部署说明

本仓库可通过 SSH 上传到服务器目录 `/opt/umami` 后部署。

常用检查命令:

```bash
cd /opt/umami
docker compose ps
docker compose logs --tail=100 umami
curl -I http://127.0.0.1:3000
```

## 5) 需要手动填写或确认的值

- `POSTGRES_PASSWORD`
- `APP_SECRET`
- `UMAMI_PUBLIC_URL`
- `SITE_PUBLIC_URL`
- `ALLOWED_FRAME_URLS`
- `VITE_UMAMI_WEBSITE_ID`
- `VITE_UMAMI_SHARE_URL`

## 6) Umami 后台初始化

1. 访问 `https://stats.xtbang.top`
2. 登录管理员账号
3. 立即修改默认密码
4. 添加网站 `https://xtbang.top`
5. 复制 website id
6. 创建 public share link 或 board
7. 将 website id 与 share URL 写入网站环境变量

## 7) 个人网站本地预览

```bash
npm install
cp .env.local.example .env.local
# 填写 VITE_UMAMI_WEBSITE_ID 与 VITE_UMAMI_SHARE_URL
npm run dev
```

打开 `http://127.0.0.1:5173/stats`。

## 8) 部署后验证

- 打开首页 `https://xtbang.top`
- 浏览器 Network 确认加载 `https://stats.xtbang.top/script.js`
- 打开 `https://xtbang.top/stats`
- 确认 iframe 显示 Umami share page / board
- 在 Umami 后台查看访问数据
- 检查来源国家/地区是否出现

## 9) 常见问题

- `script.js` 加载失败: 检查 DNS、HTTPS、反代
- iframe 空白: 检查 `ALLOWED_FRAME_URLS`、`X-Frame-Options`、`Content-Security-Policy`
- 没有数据: 检查 website id、浏览器广告拦截、脚本是否加载
- 地区不准: VPN、代理、CDN、公司/学校出口网络会影响 IP 定位
- 不要提交真实 `.env`

## 10) 部署平台环境变量

本项目是 Vite，公开环境变量前缀为 `VITE_`。

需要配置:

- `VITE_UMAMI_BASE_URL=https://stats.xtbang.top`
- `VITE_UMAMI_SCRIPT_SRC=https://stats.xtbang.top/script.js`
- `VITE_UMAMI_WEBSITE_ID=REPLACE_WITH_UMAMI_WEBSITE_ID`
- `VITE_UMAMI_SHARE_URL=https://stats.xtbang.top/share/REPLACE_ME`

如果使用 Vercel/Netlify/Cloudflare Pages/GitHub Pages/自托管 CI，请在对应平台项目环境变量设置页写入以上值。
