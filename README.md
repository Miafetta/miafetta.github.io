# 🍥 Miafetta's Cafe

![Node.js >= 20](https://img.shields.io/badge/node.js-%3E%3D20-brightgreen)
![pnpm >= 9](https://img.shields.io/badge/pnpm-%3E%3D9-blue)
![Astro](https://img.shields.io/badge/Astro-5.x-orange)

基于 [Astro](https://astro.build) 和 [Fuwari](https://github.com/saicaca/fuwari) 修改的个人静态博客。

[**🖥️ 在线预览（GitHub Pages）**](https://miafetta.github.io)

🌏 README in
[**English**](./README.en.md)

## ✨ 功能特性

- [x] 基于 [Astro](https://astro.build)、[Svelte](https://svelte.dev) 和 [Tailwind CSS](https://tailwindcss.com) 开发
- [x] 流畅的动画和页面过渡
- [x] 亮色 / 暗色模式
- [x] 自定义主题色、横幅图片和 favicon
- [x] 响应式设计，并针对移动端横幅显示做了调整
- [x] 使用 [Pagefind](https://pagefind.app/) 实现搜索
- [x] Markdown 扩展语法
- [x] Markdown 标题自动编号
- [x] 文章页和“关于我”页面的文内目录
- [x] 可选的侧边栏手机状态卡片
- [x] RSS feed 和 sitemap
- [x] 使用 GitHub Actions 部署到 GitHub Pages

## 🚀 使用方法

1. 安装依赖：
   ```sh
   pnpm install
   ```
2. 启动本地开发服务器：
   ```sh
   pnpm dev
   ```
3. 通过配置文件 `src/config.ts` 自定义站点。
4. 执行 `pnpm new-post <filename>` 创建新文章，并在 `src/content/posts/` 目录中编辑。
5. 部署前构建站点：
   ```sh
   pnpm build
   ```

## ⚙️ 站点配置

大部分站点选项都可以在 `src/config.ts` 中修改，包括标题、个人信息、横幅图片、favicon、文内目录和手机状态卡片。

### 手机状态卡片

侧边栏手机状态卡片可以通过 `siteConfig.phoneStatus` 开启或关闭：

```ts
phoneStatus: {
  enable: true,
  apiUrl: "https://api.example.com/api/status/latest",
  refreshInterval: 60_000,
  fallbackTitle: "主人正在绝赞摸鱼中…",
},
```

卡片会从 `apiUrl` 读取最新设备状态。当 API 离线、`data` 为 `null`，或 `device_name` 为空时，会回退到 `fallbackTitle` 并隐藏所有详情模块。单个字段为空时，对应模块会整体隐藏。

## 📝 文章 Frontmatter

```yaml
---
title: My First Blog Post
published: 2026-01-01
description: This is the first post of my blog.
image: ./cover.jpg
tags: [Foo, Bar]
category: Notes
draft: false
lang: en      # 仅当文章语言与 `config.ts` 中的网站语言不同时需要设置
numbering: H2 # H1, H2, Roman, Chinese, none
---
```

## 🧩 Markdown 扩展语法

除 Astro 默认支持的 [GitHub Flavored Markdown](https://github.github.com/gfm/) 外，本项目还包含以下扩展：

- Admonitions 提示块
- GitHub 仓库卡片
- 使用 Expressive Code 增强代码块
- 使用 KaTeX 渲染数学公式
- 标题锚点和文内目录
- 可选的标题自动编号

### 标题自动编号

在 frontmatter 中设置 `numbering` 可以控制标题编号：

| 值        | 效果                                  |
|:----------|:--------------------------------------|
| `H1`      | 从 `h1` 到 `h6` 编号                  |
| `H2`      | 从 `h2` 到 `h6` 编号，适合指南类文章 |
| `Roman`   | 使用罗马数字、字母、数字混合编号     |
| `Chinese` | 使用中文样式编号                      |
| `none`    | 关闭标题编号                          |

## ⚡ 指令

下列指令均需要在项目根目录执行：

| Command                    | Action                            |
|:---------------------------|:----------------------------------|
| `pnpm install`             | 安装依赖                          |
| `pnpm dev`                 | 在 `localhost:4321` 启动开发服务器 |
| `pnpm build`               | 构建生产站点到 `./dist/`          |
| `pnpm preview`             | 本地预览已构建的网站              |
| `pnpm astro check`         | 检查 Astro 代码错误               |
| `pnpm biome ci ./src`      | 使用 Biome 执行格式和 lint 检查   |
| `pnpm format`              | 使用 Biome 格式化源码             |
| `pnpm new-post <filename>` | 创建新文章                        |
| `pnpm astro ...`           | 执行 `astro add`、`astro check` 等 |
| `pnpm astro --help`        | 显示 Astro CLI 帮助               |

## 🚢 部署

本站已配置为部署到 GitHub Pages：

- `site`: `https://miafetta.github.io`
- `base`: `/`
- 部署工作流：`.github/workflows/deploy.yml`

推送到 `main` 分支后会自动触发检查和部署。

## 🔗 相关项目

```text
Miafetta/status-sync-android
        |
        | 上传状态
        v
Miafetta/status-sync-api
        |
        | 输出清洗后的状态 JSON
        v
Miafetta/miafetta.github.io  <- 当前项目
```

- [Miafetta/status-sync-android](https://github.com/Miafetta/status-sync-android)：Android 状态采集与上传端。
- [Miafetta/status-sync-api](https://github.com/Miafetta/status-sync-api)：状态数据处理 API。
- [Miafetta/miafetta.github.io](https://github.com/Miafetta/miafetta.github.io)：博客展示端，当前项目。

## 📄 License

本项目基于 [Fuwari](https://github.com/saicaca/fuwari) 修改，原项目使用 MIT License。
