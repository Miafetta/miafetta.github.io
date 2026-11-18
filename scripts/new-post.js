import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const name = (args[0] ?? "").trim().replace(/[/\\]index\.md$/i, "").replace(/\.md$/i, "");

// The content loader accepts exactly one post directory containing index.md.
if (args.length !== 1 || !name || /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
    /[. ]$/.test(name) || /\.mdx$/i.test(name) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
    console.error("Usage: pnpm new-post <post-name> (one directory name; Markdown only)");
    process.exit(1);
}

const today = new Date();
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
const fullPath = path.join("src", "content", "posts", name, "index.md");
const content = `---
title: ${JSON.stringify(name)}
published: ${date}
updated: ${date}
description: ''
image: ''
coverCredit:
  text: ''
  url: ''
tags: []
category: ''
draft: false
lang: ''
numbering: H2
---
`;

try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, { flag: "wx" });
    console.log(`Post ${fullPath} created`);
} catch (error) {
    console.error(`Could not create post: ${error.message}`);
    process.exitCode = 1;
}
