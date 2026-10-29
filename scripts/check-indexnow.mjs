import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { submitIndexNow } from "./indexnow.mjs";

const root = await mkdtemp(path.join(tmpdir(), "fuwari-indexnow-check-"));
const script = fileURLToPath(new URL("./indexnow.mjs", import.meta.url));
const key = "indexnow-test-key-1234";
const site = "https://example.test/";
const url = pathname => new URL(pathname, site).href;
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const commit = () => {
    git("add", ".");
    git("-c", "user.name=IndexNow Check", "-c", "user.email=indexnow@example.test", "commit", "-qm", "fixture");
    return git("rev-parse", "HEAD");
};
const put = async (file, content) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
};
const post = (name, metadata = "") => put(`src/content/posts/${name}/index.md`, `---\ntitle: Test\n${metadata}---\nArticle\n`);
const sitemap = paths => put("dist/sitemap-0.xml", `<urlset>${paths.map(p => `<url><loc>${url(p)}</loc></url>`).join("")}</urlset>`);
const prepare = before => JSON.parse(execFileSync(process.execPath, [script, "prepare"], {
    cwd: root, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: "", INDEXNOW_BEFORE: before ?? "" },
}));

try {
    git("init", "-q");
    git("config", "core.autocrlf", "false");
    await put("public/indexnow-key.txt", `${key}\n`);
    await post("中文 # Guide");
    await post("Removed");
    await post("Hidden", "draft: true\n");
    await post("Publish", "draft: true\n");
    await post("Unpublish");
    await post("Old");
    await post("Untouched");
    await put("src/content/posts/Untouched/media/cover.png", "old image");
    await put("src/content/spec/about.md", "About\n");
    await sitemap(["", "archive/", "about/", "posts/中文--guide/", "posts/removed/", "posts/unpublish/", "posts/old/", "posts/untouched/"]);
    const before = commit();

    const full = prepare();
    assert.equal(full.host, "example.test");
    assert.equal(full.key, key);
    assert.equal(full.keyLocation, url("indexnow-key.txt"));
    assert.equal(full.urlList.length, 8);
    assert.deepEqual(prepare("0".repeat(40)), full);
    assert.deepEqual(prepare(before).urlList, []);

    await put("README.md", "Documentation only\n");
    const docs = commit();
    assert.deepEqual(prepare(before).urlList, []);

    await post("中文 # Guide", "slug: new-custom-slug\n");
    await rm(path.join(root, "src/content/posts/Removed"), { recursive: true });
    await post("Hidden", "draft: true\n");
    await put("src/content/posts/Hidden/media/image.png", "draft image");
    await post("Publish");
    await post("Unpublish", "draft: true\n");
    await rm(path.join(root, "src/content/posts/Old"), { recursive: true });
    await post("New");
    await post("Added", "slug: explicit-slug\n");
    await put("src/content/spec/about.md", "Updated about\n");
    await sitemap(["", "archive/", "about/", "posts/new-custom-slug/", "posts/publish/", "posts/new/", "posts/explicit-slug/", "posts/untouched/"]);
    const changed = commit();
    assert.deepEqual(prepare(docs).urlList, ["", "archive/", "about/", "posts/中文--guide/", "posts/new-custom-slug/", "posts/removed/", "posts/publish/", "posts/unpublish/", "posts/old/", "posts/new/", "posts/explicit-slug/"].map(url).sort());

    await put("src/content/posts/Untouched/media/cover.png", "new image");
    const imageChanged = commit();
    assert.deepEqual(prepare(changed).urlList, ["", "archive/", "posts/untouched/"].map(url).sort());

    await put("src/content/posts/Hidden/media/image.png", "updated draft image");
    const draftChanged = commit();
    assert.deepEqual(prepare(imageChanged).urlList, []);

    await put("src/layouts/Layout.astro", "Shared SEO change\n");
    commit();
    assert.deepEqual(prepare(draftChanged).urlList, prepare().urlList);

    await rm(path.join(root, "public/indexnow-key.txt"));
    const noKey = commit();
    await put("public/indexnow-key.txt", key);
    commit();
    assert.deepEqual(prepare(noKey).urlList, prepare().urlList);

    let received;
    let status = 200;
    let onlineKey = key;
    const server = createServer(async (request, response) => {
        if (request.url === "/indexnow-key.txt") response.end(onlineKey);
        else {
            assert.equal(request.method, "POST");
            assert.equal(request.headers["content-type"], "application/json; charset=utf-8");
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            received = JSON.parse(Buffer.concat(chunks).toString());
            response.writeHead(status).end(status === 429 ? "rate limited" : "");
        }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
        const endpoint = `http://127.0.0.1:${server.address().port}`;
        const payload = { ...full, keyLocation: `${endpoint}/indexnow-key.txt` };
        await submitIndexNow(payload, `${endpoint}/indexnow`);
        assert.deepEqual(received, payload);
        status = 202;
        await submitIndexNow(payload, `${endpoint}/indexnow`);
        status = 429;
        await assert.rejects(submitIndexNow(payload, `${endpoint}/indexnow`), /HTTP 429: rate limited/);
        onlineKey = "wrong key";
        await assert.rejects(submitIndexNow(payload, `${endpoint}/indexnow`), /verification file/);
        received = undefined;
        await submitIndexNow({ ...payload, urlList: [] }, `${endpoint}/indexnow`);
        assert.equal(received, undefined);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
    console.log("IndexNow checks passed: Git changes, Unicode URLs, drafts, removals, images, full submission, and HTTP responses.");
} finally {
    await rm(root, { recursive: true, force: true });
}
