# 🍥 Miafetta's Cafe

![Node.js >= 22.23.4](https://img.shields.io/badge/node.js-%3E%3D22.23.4-brightgreen)
![pnpm 12.6.0](https://img.shields.io/badge/pnpm-12.6.0-blue)
![Astro](https://img.shields.io/badge/Astro-7.x-orange)

基于 [Astro](https://astro.build) 和 [Fuwari](https://github.com/saicaca/fuwari) 修改的个人静态博客。

[**🖥️ 在线预览（GitHub Pages）**](https://blog.miafetta.cafe)

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

使用 Node.js 22.23.4 或 24.22.1（与 CI 一致），以及 `packageManager` 指定的 pnpm 12.6.0。

1. 安装依赖：
   ```sh
   pnpm install
   ```
2. 启动本地开发服务器：
   ```sh
   pnpm dev
   ```
3. 通过配置文件 `src/config.ts` 自定义站点。
4. 执行 `pnpm new-post "文章名"`，在 `src/content/posts/文章名/index.md` 中编辑文章，并将图片放在同目录或其 `media/` 子目录。支持省略或附带 `.md`；目前不加载 MDX 或多层文章目录。
5. 部署前构建站点：
   ```sh
   pnpm build
   ```

## ⚙️ 站点配置

大部分站点选项都可以在 `src/config.ts` 中修改，包括标题、个人信息、横幅图片、favicon、文内目录和手机状态卡片。

`siteConfig.favicon` 显式配置 `public/favicon/` 中的独立 favicon（SVG、16 和 32 像素 PNG）。更换 `src/assets/images/avatar.jpg` 后运行 `pnpm icons`，会重新生成这些 favicon，以及 `src/icons/` 中的 16、32、48、180、192、512 像素圆角头像图标。`src/icons/` 也可放置供 astro-icon 使用的本地 SVG。

Front Matter 编辑器使用 `lang` 字段；预览通过 `scripts/frontmatter-preview.mjs` 按文章目录生成与 Astro 一致的 URL。使用前先运行 `pnpm dev`。

### 目录职责

| 目录 | 用途 |
|:-----|:-----|
| `src/pages/` | 页面路由，以及 RSS、robots.txt 输出 |
| `src/layouts/` | 页面框架；`Layout.astro` 显式引入全局样式 |
| `src/components/` | 页面组件；`PostList` 排列文章卡片，`PostCard` 展示单篇摘要 |
| `src/content/posts/` | 文章及其图片；每篇文章一个目录，以 `index.md` 为入口 |
| `src/content/spec/` | 关于本站、简历等独立页面的 Markdown 内容 |
| `src/assets/`、`src/icons/` | 源图片与生成的头像图标 |
| `src/styles/` | 主题变量、全局样式与 Markdown 扩展样式 |
| `src/scripts/` | 浏览器端布局、图片布局与灯箱脚本 |
| `src/plugins/` | Markdown 和 Expressive Code 构建插件 |
| `src/utils/`、`src/types/`、`src/constants/`、`src/i18n/` | 工具函数、类型、常量与翻译 |
| `public/` | 按原路径发布的 favicon、下载素材及站点验证文件 |
| `scripts/` | 本地开发工具、图标生成和回归检查；不在浏览器执行 |
| `patches/` | pnpm 应用的依赖补丁 |

`GlobalStyles.astro` 和旧 `BlogPostData` 类型暂作预留；当前全局样式由布局显式引入，文章类型以 `astro:content` 的 `CollectionEntry<"posts">` 为准。`.astro/`、`dist/`、`node_modules/` 是已忽略的本地生成目录。

### 手机状态卡片

侧边栏手机状态卡片可以通过 `siteConfig.phoneStatus` 开启或关闭：

```ts
phoneStatus: {
  enable: true,
  apiUrl: "https://api.example.com/hikari/status",
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
| `pnpm test`                | 检查文章创建、预览路径、标题编号和 TOC 回归 |
| `pnpm icons`               | 从头像重新生成站点图标             |
| `pnpm preview`             | 本地预览已构建的网站              |
| `pnpm astro check`         | 检查 Astro 代码错误               |
| `pnpm biome ci ./src`      | 使用 Biome 执行格式和 lint 检查   |
| `pnpm format`              | 使用 Biome 格式化源码             |
| `pnpm new-post "文章名"`   | 创建文章目录及 `index.md`          |
| `pnpm astro ...`           | 执行 `astro add`、`astro check` 等 |
| `pnpm astro --help`        | 显示 Astro CLI 帮助               |

## 🚢 部署

本站已配置为部署到 GitHub Pages：

- `site`: `https://blog.miafetta.cafe`
- `base`: `/`
- 部署工作流：`.github/workflows/deploy.yml`

推送到 `main` 分支后会自动触发检查和部署。

## 🔗 相关项目

```text
Miafetta/hikari-android
        |
        | 上传状态
        v
Miafetta/hikari-api
        |
        | 输出清洗后的状态 JSON
        v
Miafetta/miafetta.github.io  <- 当前项目
```

- [Miafetta/hikari-android](https://github.com/Miafetta/hikari-android)：Android 状态采集与上传端。
- [Miafetta/hikari-api](https://github.com/Miafetta/hikari-api)：状态数据处理 API。
- [Miafetta/miafetta.github.io](https://github.com/Miafetta/miafetta.github.io)：博客展示端，当前项目。

## 📄 License

本项目基于 [Fuwari](https://github.com/saicaca/fuwari) 修改，原项目使用 MIT License。
