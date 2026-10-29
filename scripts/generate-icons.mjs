import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const source = fileURLToPath(new URL("../src/assets/images/avatar.jpg", import.meta.url));
const directory = new URL("../src/icons/", import.meta.url);
const faviconDirectory = new URL("../public/favicon/", import.meta.url);
await mkdir(directory, { recursive: true });
await mkdir(faviconDirectory, { recursive: true });
for (const size of [16, 32, 48, 180, 192, 512]) {
    const target = fileURLToPath(new URL(`avatar-${size}.png`, directory));
    // Match public/favicon/favicon.svg: a 238 px radius on a 1080 px square.
    const radius = size * 238 / 1080;
    const mask = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`);
    await sharp(source).rotate().resize(size, size, { fit: "cover" })
        .ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toFile(target);
    const { data, info } = await sharp(target).raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, size);
    assert.equal(info.height, size);
    assert.equal(info.channels, 4);
    for (const pixel of [0, size - 1, size * (size - 1), size * size - 1]) {
        assert.equal(data[pixel * 4 + 3], 0, "Rounded corners must be transparent");
    }
    assert.equal(data[(Math.floor(size / 2) * size + Math.floor(size / 2)) * 4 + 3], 255);
    if (size === 16 || size === 32 || size === 192) {
        await sharp(target).png().toFile(fileURLToPath(new URL(`favicon-${size}x${size}.png`, faviconDirectory)));
    }
}
await writeFaviconIco();
const image = await sharp(source).rotate().resize(512, 512, { fit: "cover" }).png().toBuffer();
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080"><defs><clipPath id="rounded-favicon"><rect width="1080" height="1080" rx="238"/></clipPath></defs><image width="1080" height="1080" clip-path="url(#rounded-favicon)" href="data:image/png;base64,${image.toString("base64")}"/></svg>`;
await writeFile(new URL("favicon.svg", faviconDirectory), favicon);
const { data: svgPixels } = await sharp(Buffer.from(favicon)).resize(32, 32).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
assert.equal(svgPixels[3], 0, "SVG favicon must preserve transparent corners");
assert.equal(svgPixels[(16 * 32 + 16) * 4 + 3], 255);
console.log("Rounded avatar icons and separate public favicons generated and verified.");

async function writeFaviconIco() {
    const iconSizes = [16, 32, 48];
    const iconHeader = Buffer.alloc(6 + 16 * iconSizes.length);
    iconHeader.writeUInt16LE(1, 2);
    iconHeader.writeUInt16LE(iconSizes.length, 4);
    const iconImages = [];
    let iconOffset = iconHeader.length;
    for (const [index, size] of iconSizes.entries()) {
        const image = await readFile(new URL(`avatar-${size}.png`, directory));
        const entryOffset = 6 + 16 * index;
        iconHeader[entryOffset] = size;
        iconHeader[entryOffset + 1] = size;
        iconHeader.writeUInt16LE(1, entryOffset + 4);
        iconHeader.writeUInt16LE(32, entryOffset + 6);
        iconHeader.writeUInt32LE(image.length, entryOffset + 8);
        iconHeader.writeUInt32LE(iconOffset, entryOffset + 12);
        iconImages.push(image);
        iconOffset += image.length;
    }
    await writeFile(new URL("../public/favicon.ico", import.meta.url), Buffer.concat([iconHeader, ...iconImages]));
}
