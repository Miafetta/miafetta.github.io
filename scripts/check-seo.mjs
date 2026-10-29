import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import sharp from "sharp";

const dist = new URL("../dist/", import.meta.url);
const home = await readFile(new URL("index.html", dist), "utf8");
const site = new URL(home.match(/<meta property="og:url" content="([^"]+)"/)[1]);
const robots = await readFile(new URL("robots.txt", dist), "utf8");
assert.ok(!/^Disallow:\s*\/(?:_astro\/)?\s*$/m.test(robots), "Images must be crawlable");

const banner = home.match(/<div[^>]*id="banner"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
const homeImage = home.match(/<meta property="og:image" content="([^"]+)"/);
await checkImage(home, banner?.[1] ?? homeImage?.[1]);
for (const path of ["/favicon.ico", "/favicon/favicon-192x192.png"]) {
    assert.ok(home.includes(`href="${path}"`));
}

const posts = (await readdir(new URL("posts/", dist), { withFileTypes: true }))
    .filter(entry => entry.isDirectory());
assert.ok(posts.length > 0, "No articles checked");
for (const post of posts) {
    const html = await readFile(new URL(`posts/${post.name}/index.html`, dist), "utf8");
    const cover = html.match(/<div[^>]*id="post-cover"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
    const jsonLd = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(jsonLd, `Missing structured data: ${post.name}`);
    const article = JSON.parse(jsonLd[1]);
    assert.equal(article.image, cover ? new URL(cover[1], site).href : undefined, post.name);
    await checkImage(html, cover?.[1]);
}
await checkFavicons();
console.log(`SEO checks passed: homepage, ${posts.length} articles, crawlable images, and favicon assets.`);

async function checkImage(html, src) {
    assert.ok(html.includes('<meta name="robots" content="max-image-preview:large">'));
    if (!src) {
        assert.ok(!html.includes('property="og:image"'));
        assert.ok(!html.includes('name="twitter:image"'));
        return;
    }
    const image = new URL(src, site);
    assert.ok(html.includes(`<meta property="og:image" content="${image.href}">`));
    assert.ok(html.includes(`<meta name="twitter:image" content="${image.href}">`));
    if (image.origin === site.origin) {
        const asset = await readFile(new URL(`.${image.pathname}`, dist));
        assert.ok(asset.length > 0, `Missing image: ${image.pathname}`);
    }
}

async function checkFavicons() {
    const png = await sharp(await readFile(new URL("favicon/favicon-192x192.png", dist))).metadata();
    assert.equal(png.width, 192);
    assert.equal(png.height, 192);
    const ico = await readFile(new URL("favicon.ico", dist));
    assert.equal(ico.readUInt16LE(0), 0);
    assert.equal(ico.readUInt16LE(2), 1);
    assert.equal(ico.readUInt16LE(4), 3);
    for (const [index, size] of [16, 32, 48].entries()) {
        const offset = 6 + index * 16;
        const length = ico.readUInt32LE(offset + 8);
        const start = ico.readUInt32LE(offset + 12);
        const { info } = await sharp(ico.subarray(start, start + length))
            .raw().toBuffer({ resolveWithObject: true });
        assert.equal(info.width, size);
        assert.equal(info.height, size);
        assert.equal(ico[offset], size);
        assert.equal(ico[offset + 1], size);
    }
}
