# 🍥 Miafetta's Cafe

![Node.js >= 22.23.4](https://img.shields.io/badge/node.js-%3E%3D22.23.4-brightgreen)
![pnpm 12.16.1](https://img.shields.io/badge/pnpm-12.16.1-blue)
![Astro](https://img.shields.io/badge/Astro-7.x-orange)

A personal static blog built with [Astro](https://astro.build), based on [Fuwari](https://github.com/saicaca/fuwari).

[**🖥️ Live Site (GitHub Pages)**](https://blog.miafetta.cafe)

🌏 README in
[**中文**](./README.md)

## ✨ Features

- [x] Built with [Astro](https://astro.build), [Svelte](https://svelte.dev) and [Tailwind CSS](https://tailwindcss.com)
- [x] Smooth animations and page transitions
- [x] Light / dark mode
- [x] Customizable theme colors, banner and favicon
- [x] Responsive design with mobile banner adjustments
- [x] Search functionality with [Pagefind](https://pagefind.app/)
- [x] Markdown extended features
- [x] Configurable heading numbering for Markdown posts
- [x] Table of contents for posts and the resume page
- [x] Optional phone status card in the sidebar
- [x] RSS feed and sitemap
- [x] GitHub Pages deployment with GitHub Actions

## 🚀 Getting Started

Use Node.js 22.23.4 or 24.22.1 (matching CI) and pnpm 12.16.1 as specified by `packageManager`.

1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Start the local development server:
   ```sh
   pnpm dev
   ```
3. Edit the config file `src/config.ts` to customize the site.
4. Run `pnpm new-post "Post name"` and edit `src/content/posts/Post name/index.md`. Put images alongside it or in its `media/` subdirectory. The `.md` suffix is optional; MDX and nested post directories are not loaded.
5. Build the site before deployment:
   ```sh
   pnpm build
   ```

## ⚙️ Site Configuration

Most site options can be edited in `src/config.ts`, including the title, profile, banner, favicon, table of contents and phone status card.

`siteConfig.favicon` explicitly lists the separate favicons in `public/favicon/` (SVG and 16/32 pixel PNGs). After changing `src/assets/images/avatar.jpg`, run `pnpm icons` to regenerate these favicons and the 16, 32, 48, 180, 192 and 512 pixel rounded avatar icons in `src/icons/`. Local astro-icon SVGs can also be placed in `src/icons/`.

The Front Matter editor uses the `lang` field. Its preview uses `scripts/frontmatter-preview.mjs` to generate the same post URL as Astro from the post directory. Start `pnpm dev` before previewing.

### Directory Responsibilities

| Directory | Purpose |
|:----------|:--------|
| `src/pages/` | Page routes, RSS and robots.txt output |
| `src/layouts/` | Page frames; `Layout.astro` explicitly imports global styles |
| `src/components/` | UI components; `PostList` arranges cards and `PostCard` displays one post summary |
| `src/content/posts/` | Posts and their images, one directory per post with an `index.md` entry |
| `src/content/spec/` | Markdown for standalone pages such as About and Resume |
| `src/assets/`, `src/icons/` | Source images and generated avatar icons |
| `src/styles/` | Theme variables, global styles and Markdown extensions |
| `src/scripts/` | Browser scripts for layout, image sizing and the lightbox |
| `src/plugins/` | Markdown and Expressive Code build plugins |
| `src/utils/`, `src/types/`, `src/constants/`, `src/i18n/` | Utilities, types, constants and translations |
| `public/` | Favicons, downloads and site verification files served at their original paths |
| `scripts/` | Local tools, icon generation and regression checks; never executed in the browser |
| `patches/` | Dependency patches applied by pnpm |

`GlobalStyles.astro` and the legacy `BlogPostData` type remain reserved. Layouts explicitly import global styles; active posts use `CollectionEntry<"posts">` from `astro:content`. `.astro/`, `dist/` and `node_modules/` are ignored local output directories.

### Phone Status Card

The sidebar phone status card can be enabled or disabled in `siteConfig.phoneStatus`:

```ts
phoneStatus: {
  enable: true,
  apiUrl: "https://api.example.com/hikari/status",
  refreshInterval: 60_000,
  fallbackTitle: "主人正在绝赞摸鱼中…",
},
```

The card reads the latest device status from `apiUrl`. When the API is offline, `data` is `null`, or `device_name` is empty, it falls back to `fallbackTitle` and hides all detail modules. Empty fields are hidden as whole modules.

## 📝 Frontmatter of Posts

```yaml
---
title: My First Blog Post
published: 2026-01-01
description: This is the first post of my blog.
image: ./cover.jpg
tags: [Foo, Bar]
category: Notes
draft: false
lang: en      # Set only if the post's language differs from the site's language in `config.ts`
numbering: H2 # H1, H2, Roman, Chinese, none
---
```

## 🧩 Markdown Extended Syntax

In addition to Astro's default support for [GitHub Flavored Markdown](https://github.github.com/gfm/), several extra Markdown features are included:

- Admonitions
- GitHub repository cards
- Enhanced code blocks with Expressive Code
- Math rendering with KaTeX
- Heading anchors and table of contents
- Optional automatic heading numbering

### Heading Numbering

Set `numbering` in frontmatter to control heading numbering:

| Value     | Action                                             |
|:----------|:---------------------------------------------------|
| `H1`      | Number from `h1` to `h6`                           |
| `H2`      | Number from `h2` to `h6`; default style for guides |
| `Roman`   | Use Roman / alphabetic / numeric mixed numbering   |
| `Chinese` | Use Chinese-style numbering                        |
| `none`    | Disable heading numbering                          |

## ⚡ Commands

All commands are run from the root of the project, from a terminal:

| Command                    | Action                                           |
|:---------------------------|:-------------------------------------------------|
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`                 | Starts local dev server at `localhost:4321`      |
| `pnpm build`               | Build the production site to `./dist/`           |
| `pnpm test`                | Check post creation, preview URLs, numbering and TOC regressions |
| `pnpm icons`               | Regenerate site icons from the avatar           |
| `pnpm preview`             | Preview the build locally, before deploying      |
| `pnpm astro check`         | Run Astro checks for errors in the code          |
| `pnpm biome ci ./src`      | Run formatting and lint checks with Biome        |
| `pnpm format`              | Format the source code using Biome               |
| `pnpm new-post "Post name"` | Create a post directory with `index.md`          |
| `pnpm astro ...`           | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro --help`        | Get help using the Astro CLI                     |

## 🚢 Deployment

This site is configured for GitHub Pages:

- `site`: `https://blog.miafetta.cafe`
- `base`: `/`
- Deployment workflow: `.github/workflows/deploy.yml`

Push to the `main` branch to trigger checks and deployment.

## 🔗 Related Projects

```text
Miafetta/hikari-android
        |
        | Uploads device status
        v
Miafetta/hikari-api
        |
        | Outputs cleaned status JSON
        v
Miafetta/miafetta.github.io  <- Current project
```

- [Miafetta/hikari-android](https://github.com/Miafetta/hikari-android): Android status collector and uploader.
- [Miafetta/hikari-api](https://github.com/Miafetta/hikari-api): Status data processing API.
- [Miafetta/miafetta.github.io](https://github.com/Miafetta/miafetta.github.io): Blog display frontend, current project.

## 📄 License

This project is based on [Fuwari](https://github.com/saicaca/fuwari), which is licensed under the MIT License.
