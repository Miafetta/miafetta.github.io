# 🍥 Miafetta's Cafe

![Node.js >= 20](https://img.shields.io/badge/node.js-%3E%3D20-brightgreen)
![pnpm >= 9](https://img.shields.io/badge/pnpm-%3E%3D9-blue)
![Astro](https://img.shields.io/badge/Astro-5.x-orange)

A personal static blog built with [Astro](https://astro.build), based on [Fuwari](https://github.com/saicaca/fuwari).

[**🖥️ Live Site (GitHub Pages)**](https://miafetta.github.io)

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

1. Install dependencies:
   ```sh
   pnpm install
   ```
2. Start the local development server:
   ```sh
   pnpm dev
   ```
3. Edit the config file `src/config.ts` to customize the site.
4. Run `pnpm new-post <filename>` to create a new post and edit it in `src/content/posts/`.
5. Build the site before deployment:
   ```sh
   pnpm build
   ```

## ⚙️ Site Configuration

Most site options can be edited in `src/config.ts`, including the title, profile, banner, favicon, table of contents and phone status card.

### Phone Status Card

The sidebar phone status card can be enabled or disabled in `siteConfig.phoneStatus`:

```ts
phoneStatus: {
  enable: true,
  apiUrl: "https://api.example.com/api/status/latest",
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
| `pnpm preview`             | Preview the build locally, before deploying      |
| `pnpm astro check`         | Run Astro checks for errors in the code          |
| `pnpm biome ci ./src`      | Run formatting and lint checks with Biome        |
| `pnpm format`              | Format the source code using Biome               |
| `pnpm new-post <filename>` | Create a new post                                |
| `pnpm astro ...`           | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro --help`        | Get help using the Astro CLI                     |

## 🚢 Deployment

This site is configured for GitHub Pages:

- `site`: `https://miafetta.github.io`
- `base`: `/`
- Deployment workflow: `.github/workflows/deploy.yml`

Push to the `main` branch to trigger checks and deployment.

## 🔗 Related Projects

```text
Miafetta/status-sync-android
        |
        | Uploads device status
        v
Miafetta/status-sync-api
        |
        | Outputs cleaned status JSON
        v
Miafetta/miafetta.github.io  <- Current project
```

- [Miafetta/status-sync-android](https://github.com/Miafetta/status-sync-android): Android status collector and uploader.
- [Miafetta/status-sync-api](https://github.com/Miafetta/status-sync-api): Status data processing API.
- [Miafetta/miafetta.github.io](https://github.com/Miafetta/miafetta.github.io): Blog display frontend, current project.

## 📄 License

This project is based on [Fuwari](https://github.com/saicaca/fuwari), which is licensed under the MIT License.
