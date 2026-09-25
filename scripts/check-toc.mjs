// Run with: node scripts/check-toc.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/widget/TOC.astro", import.meta.url), "utf8");
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];
const frames = new Map();
const listeners = [];
const scrolls = [];
const history = [];
let frameId = 0;
let Toc;
class Element {
    addEventListener(type, handler, options) {
        listeners.push({ target: this, type, handler, capture: !!options?.capture });
    }
    removeEventListener(type, handler, options) {
        const i = listeners.findIndex(l => l.target === this && l.type === type &&
            l.handler === handler && l.capture === !!options?.capture);
        if (i >= 0) listeners.splice(i, 1);
    }
}
class Anchor extends Element {
    hash = "#heading";
    closest() { return true; }
}
class MouseEvent {
    button = 0;
    composedPath() { return [anchor]; }
    preventDefault() {}
}
const anchor = new Anchor();
const wrapper = new Element();
const heading = new Element();
heading.parentElement = new Element();
heading.scrollIntoView = options => scrolls.push(options);
const document = new Element();
document.getElementById = id => ({ "toc-inner-wrapper": wrapper, heading })[id] ?? null;
document.querySelectorAll = () => [anchor];
// No animationend ever fires: covers disabled, absent, and already-finished animations.
document.querySelector = () => new Element();
runInNewContext(ts.transpileModule(script, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText, {
    HTMLElement: Element, HTMLAnchorElement: Anchor, MouseEvent, document,
    window: { history: { pushState: (...args) => history.push(args) } },
    customElements: { get: () => undefined, define: (_, value) => { Toc = value; } },
    IntersectionObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
});
const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(fn => fn());
};
const toc = new Toc();
toc.fallback = () => {};
let updates = 0;
toc.toggleActiveHeading = () => updates++;
toc.scrollToActiveHeading = () => {};
toc.connectedCallback();
flush();
assert.equal(toc.headings[0], heading, "TOC must initialize without animationend");
for (const listener of listeners.filter(l => l.type === "click")) listener.handler(new MouseEvent());
assert.equal(scrolls.length, 1, "One click must scroll once");
assert.equal(history.length, 1, "One click must add one history entry");
assert.equal(scrolls[0].behavior, "auto", "CSS must control reduced-motion scrolling");
heading.getAttribute = () => "heading";
toc.markVisibleSection([{ isIntersecting: true, target: {
    children: [heading], firstChild: { nodeType: 3 }, firstElementChild: heading,
} }]);
assert.equal(toc.anchorNavTarget, null, "Whitespace before a heading must not lock TOC following");
const modifiedClick = new MouseEvent();
modifiedClick.ctrlKey = true;
toc.handleAnchorClick(modifiedClick);
assert.equal(history.length, 1, "Modified clicks must keep native behavior");
toc.update();
toc.update();
flush();
assert.equal(updates, 1, "Updates in one frame must be coalesced");
toc.update();
toc.disconnectedCallback();
assert.equal(listeners.length, 0, "Disconnect must remove capture listeners");
assert.equal(frames.size, 0, "Disconnect must cancel pending animation frames");
toc.connectedCallback();
toc.disconnectedCallback();
assert.equal(frames.size, 0, "Leaving before initialization must cancel it");
console.log("TOC lifecycle, single-click scrolling, and frame cleanup passed.");
