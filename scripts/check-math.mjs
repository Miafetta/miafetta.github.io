import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import katex from "katex";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

const rendererRequire = createRequire(import.meta.resolve("rehype-katex"));
assert.equal(rendererRequire("katex").version, katex.version,
    "Markdown's KaTeX renderer must match the site's KaTeX CSS and fonts");

const processor = await createMarkdownProcessor({
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
});
for (const displayMode of [false, true]) {
    const formula = String.raw`\frac{a^2+b^2}{c} = \sqrt{x}`;
    const markdown = displayMode ? `$$\n${formula}\n$$` : `$${formula}$`;
    const { code } = await processor.render(markdown);
    assert.ok(code.includes('class="katex"'));
    assert.ok(code.includes('class="mfrac"'));
    assert.ok(code.includes('<msqrt>'));
    assert.ok(code.includes('<math'));
    assert.equal(code.includes('class="katex-display"'), displayMode);
    assert.ok(!code.includes("katex-error"));
}
console.log(`KaTeX ${katex.version}: matching assets, inline and display math passed.`);
