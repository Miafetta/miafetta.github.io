import { execFileSync } from "node:child_process";
import { appendFile, readFile, readdir } from "node:fs/promises";

export async function prepareIndexNow(before) {
    const { site, urls, key } = await readSite();
    const selected = new Set();
    if (!before || /^0+$/.test(before)) {
        urls.forEach(url => selected.add(url));
    } else {
        if (!/^[a-f0-9]{40}$/.test(before)) throw new Error("Invalid previous commit SHA");
        const changed = git("diff", "--name-only", "--no-renames", "-z", before, "HEAD").split("\0").filter(Boolean);
        const firstSubmission = !git("ls-tree", "--name-only", "-z", before, "--", "public/indexnow-key.txt");
        if (firstSubmission || changed.some(isSharedPageSource)) {
            urls.forEach(url => selected.add(url));
        }
        const postDirs = new Set(changed.map(file => /^src\/content\/posts\/([^/]+)\//.exec(file)?.[1]).filter(Boolean));
        for (const dir of postDirs) {
            for (const revision of [before, "HEAD"]) {
                const url = await postUrl(revision, dir, site);
                if (url) selected.add(url);
            }
        }
        if (postDirs.size && [...selected].some(url => new URL(url).pathname.startsWith("/posts/"))) {
            selected.add(site.href);
            selected.add(new URL("archive/", site).href);
        }
        for (const file of changed) {
            const spec = /^src\/content\/spec\/(about|resume)\.md$/.exec(file);
            if (spec) selected.add(new URL(`${spec[1]}/`, site).href);
        }
    }
    if (selected.size > 10_000) throw new Error("IndexNow supports at most 10,000 URLs per submission");
    return { host: site.host, key, keyLocation: new URL("indexnow-key.txt", site).href, urlList: [...selected].sort() };
}

export async function submitIndexNow(payload, endpoint = "https://api.indexnow.org/indexnow") {
    if (!payload.urlList.length) {
        console.log("IndexNow: no public page changes to submit.");
        return;
    }
    const verification = await fetch(payload.keyLocation, { signal: AbortSignal.timeout(30_000) });
    if (verification.status !== 200 || (await verification.text()).trim() !== payload.key) {
        throw new Error(`IndexNow verification file is not available or does not match: ${payload.keyLocation}`);
    }
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 200 && response.status !== 202) {
        throw new Error(`IndexNow HTTP ${response.status}: ${await response.text()}`);
    }
    console.log(`IndexNow HTTP ${response.status}: ${payload.urlList.length} URLs received${response.status === 202 ? "; key validation pending" : ""}. This does not confirm indexing.`);
    console.log(payload.urlList.join("\n"));
}

async function readSite() {
    const files = (await readdir("dist")).filter(file => /^sitemap-\d+\.xml$/.test(file));
    const urls = [];
    for (const file of files) {
        const xml = await readFile(`dist/${file}`, "utf8");
        urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).href));
    }
    if (!urls.length) throw new Error("Build the site before preparing IndexNow URLs");
    const site = new URL("/", urls[0]);
    if (urls.some(url => new URL(url).origin !== site.origin)) throw new Error("Sitemap URLs must share one origin");
    const key = (await readFile("public/indexnow-key.txt", "utf8")).trim();
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("Invalid IndexNow key");
    return { site, urls, key };
}

function git(...args) {
    return execFileSync("git", args, { encoding: "utf8" });
}

function isSharedPageSource(file) {
    return /^src\/(?!content\/)/.test(file) || file === "astro.config.mjs" || file.startsWith("public/favicon") || file === "public/indexnow-key.txt";
}

async function postUrl(revision, dir, site) {
    const file = `src/content/posts/${dir}/index.md`;
    if (!git("ls-tree", "--name-only", "-z", revision, "--", file)) return;
    const { parseFrontmatter } = await import("@astrojs/markdown-remark");
    const { slug } = await import("github-slugger");
    const { frontmatter } = parseFrontmatter(git("show", `${revision}:${file}`));
    if (frontmatter.draft === true) return;
    const id = frontmatter.slug ? String(frontmatter.slug) : slug(dir);
    return new URL(`posts/${id}/`, site).href;
}

if (import.meta.main) {
    const command = process.argv[2];
    if (command === "prepare") {
        const payload = JSON.stringify(await prepareIndexNow(process.env.INDEXNOW_BEFORE));
        if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `payload=${payload}\n`);
        else console.log(payload);
    } else if (command === "submit") {
        await submitIndexNow(JSON.parse(process.env.INDEXNOW_PAYLOAD));
    } else {
        throw new Error("Usage: node scripts/indexnow.mjs prepare|submit");
    }
}
