import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cwd = mkdtempSync(path.join(tmpdir(), "fuwari-post-check-"));
const script = fileURLToPath(new URL("./new-post.js", import.meta.url));
const preview = fileURLToPath(new URL("./frontmatter-preview.mjs", import.meta.url));
const create = (...args) => spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });

try {
    assert.equal(create("你好 # new post").status, 0);
    const target = path.join(cwd, "src/content/posts/你好 # new post/index.md");
    const content = readFileSync(target, "utf8");
    assert.match(content, /title: "你好 # new post"/);
    assert.equal(path.matchesGlob("你好 # new post/index.md", "*/index.md"), true);
    assert.notEqual(create("你好 # new post").status, 0);
    assert.equal(readFileSync(target, "utf8"), content, "Existing posts must not be overwritten");
    for (const name of ["guide.md", "bundle/index.md"]) {
        assert.equal(create(name).status, 0);
        assert.ok(existsSync(path.join(cwd, "src/content/posts", name.replace(/(?:\/index)?\.md$/, ""), "index.md")));
    }
    for (const name of ["../escape", "nested/post", "post.mdx", "CON", "..", ""]) {
        assert.notEqual(create(name).status, 0, name);
    }
    assert.notEqual(create().status, 0);
    for (const args of [
        ["D:\\Blog", "D:\\Blog\\src\\content\\posts\\Docker 与 Docker Compose：入门与实践\\index.md", "Title"],
        ["'D:\\Blog'", "'D:\\Blog\\src\\content\\posts\\Docker", "与", "Docker", "Compose：入门与实践\\index.md'", "'Title'"],
    ]) {
        const result = spawnSync(process.execPath, [preview, ...args], { encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, "posts/docker-与-docker-compose入门与实践");
    }
    console.log("New post discovery, safe paths, YAML titles and overwrite protection passed.");
} finally {
    rmSync(cwd, { recursive: true, force: true });
}
