import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";

// Run against pnpm dev; temporary articles exercise the real schema and page.
const base = process.argv[2] ?? "http://127.0.0.1:4321";
const cases = [
    { updated: "2026-11-17", credit: { text: "  Source  ", url: " https://example.com/source " }, show: true },
    { updated: "2026-11-16", credit: { text: "Source" } },
    { credit: { url: "https://example.com/source" } },
    { credit: { text: "Source", url: "" } },
    { credit: { text: "   ", url: "https://example.com/source" } },
    { credit: { text: "Source", url: "   " } },
    { credit: {} },
    {},
    { image: false, credit: { text: "Source", url: "https://example.com/source" } },
];
const created = [];
try {
    for (const [index, test] of cases.entries()) {
        const name = `post-details-check-${process.pid}-${index}`;
        const dir = new URL(`../src/content/posts/${name}/`, import.meta.url);
        mkdirSync(dir);
        created.push(dir);
        const fields = ["---", `title: ${name}`, "published: 2026-11-16"];
        if (test.updated) fields.push(`updated: ${test.updated}`);
        if (test.image !== false) fields.push('image: "/favicon/favicon-192x192.png"');
        if (test.credit) fields.push(`coverCredit: ${JSON.stringify(test.credit)}`);
        writeFileSync(new URL("index.md", dir), `${fields.join("\n")}\n---\nFixture body.\n`);
        let html;
        for (let attempt = 0; attempt < 30; attempt++) {
            const response = await fetch(`${base}/posts/${name}/`);
            if (response.ok) { html = await response.text(); break; }
            assert.equal(response.status, 404, await response.text());
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        assert.ok(html, `Fixture not loaded: ${name}`);
        const dates = [...html.matchAll(/<time datetime="([^"]+)"/g)].map(match => match[1]);
        assert.deepEqual(dates, ["2026-11-16", test.updated ?? "2026-11-16"]);
        const license = html.slice(html.indexOf('license-container'));
        assert.match(license, new RegExp(`最后修改于</div>\\s*<div[^>]*>${test.updated ?? "2026-11-16"}</div>`));
        const credit = html.match(/<a[^>]*aria-label="访问图片来源: Source"[^>]*>/);
        assert.equal(!!credit, !!test.show, `Credit visibility: ${index}`);
        if (test.show) {
            assert.ok(credit[0].includes('href="https://example.com/source"'));
            assert.ok(credit[0].includes('target="_blank"'));
            assert.ok(credit[0].includes('rel="noopener"'));
        }
        assert.equal(html.includes('id="post-cover"'), test.image !== false);
    }
    const home = await (await fetch(base)).text();
    assert.ok(!home.includes("edit-calendar-outline-rounded"), "Cards must hide update dates");
    console.log("Post dates, fallbacks, cover credit conditions and card regression checks passed.");
} finally {
    for (const dir of created) {
        unlinkSync(new URL("index.md", dir));
        rmdirSync(dir);
    }
}
