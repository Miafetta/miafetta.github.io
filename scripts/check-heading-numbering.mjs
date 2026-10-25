import assert from "node:assert/strict";
import {
    createHeadingNumberer,
    getNumberedHeadingText,
    headingNumberingModes,
    normalizeHeadingNumbering,
    parseHeadingNumbering,
} from "../src/plugins/rehype-heading-numbering.ts";

for (const mode of headingNumberingModes) {
    assert.equal(parseHeadingNumbering(` ${mode.toLowerCase()} `), mode);
}
for (const value of [undefined, null, 42, "invalid", "toString"]) {
    assert.equal(parseHeadingNumbering(value), undefined);
}
assert.equal(normalizeHeadingNumbering(undefined), "H2");
assert.equal(normalizeHeadingNumbering("invalid", "none"), "none");
const decimal = createHeadingNumberer("H2");
assert.equal(decimal.next(1), null);
assert.equal(decimal.next(2), "1.");
assert.equal(decimal.next(3), "1.1");
assert.equal(decimal.next(2), "2.");
assert.equal(createHeadingNumberer("Roman").next(1), "I.");
assert.equal(createHeadingNumberer("Chinese").next(1), "一、");
assert.equal(createHeadingNumberer("none").next(2), null);
assert.equal(getNumberedHeadingText("1. Heading", "1."), "1. Heading");
console.log("Shared numbering modes, invalid values and numbering output passed.");
