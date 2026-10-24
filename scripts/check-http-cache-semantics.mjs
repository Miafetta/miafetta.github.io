import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve("astro/package.json"));
const CachePolicy = astroRequire("http-cache-semantics");
const request = { url: "https://example.test/image.png", method: "GET", headers: {} };
const staleRequest = { ...request, headers: { "cache-control": "max-stale=3600" } };

function policy(headers, options) {
  const result = new CachePolicy(request, { status: 200, headers }, options);
  const now = result.now();
  result.now = () => now + 2000;
  return result;
}

for (const headers of [
  { "cache-control": "max-age=3600", "set-cookie": "session=private" },
  { "cache-control": "private, max-age=3600" },
  { "cache-control": "no-store" },
  { "cache-control": "no-cache, max-age=3600" },
  { "cache-control": "max-age=3600", vary: "*" },
]) {
  const cached = policy(headers);
  assert.equal(cached.satisfiesWithoutRevalidation(staleRequest), false);
  assert.equal(cached.evaluateRequest(staleRequest).response, undefined);
}

// Explicitly cacheable responses must retain legal max-stale behavior.
for (const headers of [
  { "cache-control": "public, max-age=0" },
  { "cache-control": "public, max-age=0", "set-cookie": "session=public" },
]) {
  assert.equal(policy(headers).satisfiesWithoutRevalidation(staleRequest), true);
}
assert.equal(policy({ "cache-control": "max-age=3600" }).satisfiesWithoutRevalidation(request), true);
assert.equal(policy({ "cache-control": "max-age=0", "set-cookie": "session=private" }, { shared: false })
  .satisfiesWithoutRevalidation(staleRequest), true);
console.log("Cache policy security and max-stale compatibility checks passed.");
