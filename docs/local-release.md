# 本地发布包与离线运行

本文档用于把当前本地版本交付给测试人员或现场使用者。所有步骤都在本地完成，不需要 `git push`，不需要创建 GitHub PR。

## 环境准备

```sh
npm install
```

建议使用 Node.js 18+。首次现场使用前，如果需要离线卡面，请提前联网执行：

```sh
npm run cache-cards
```

## 常用启动

开发启动：

```sh
npm run dev
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

## 测试与验收

单项执行：

```sh
npm run typecheck
npm run build
npm test
npm run test:e2e
```

一键验收：

```sh
npm run verify
```

## 本地交付包

生成压缩包：

```sh
npm run package:local
```

输出位置：

```text
artifacts/bang-dream-card-guess-local.tar.gz
```

压缩包包含源码、`package.json`、`package-lock.json`、`readme.md`、`docs`、`scripts`、`src`、`public`、测试与配置文件。压缩包排除 `.git`、`node_modules`、`dist`、`dist-server`、`.server-build`、测试报告、覆盖率目录、已有压缩包和日志。

## 解压后的运行流程

```sh
npm install
npm run build
npm run booth
```

或单人模式：

```sh
npm run solo
```

## 离线注意事项

- 页面基础资源由 `public` 提供，构建后可本地启动。
- 卡牌图片离线依赖 `public/cards/` 缓存，现场前建议执行 `npm run cache-cards`。
- 题库和昵称数据来自仓库内资源文件。
- 成绩写入本地 `data` 目录。

## 本地交付声明

- 本阶段所有改动仅保留在本地分支。
- 不需要执行 `git push`。
- 不需要创建 GitHub PR。
