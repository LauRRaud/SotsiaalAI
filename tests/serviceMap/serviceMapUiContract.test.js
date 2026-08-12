import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url), "utf8");
const map = fs.readFileSync(new URL("../../components/workspace/ServiceMapLeaflet.jsx", import.meta.url), "utf8");

test("map UI pages server results and rejects stale append responses", () => {
  assert.match(page, /serviceMapRequestRef/);
  assert.match(page, /payload\?\.page\?\.hasMore/);
  assert.match(page, /loadServiceMapPage\(\{ cursor: serviceMapPage\.nextCursor, append: true \}\)/);
  assert.doesNotMatch(page, /\.slice\(0,\s*24\)/);
  assert.match(page, /entryType === "KOV_SOCIAL_CONTACT" \? "KOV_CONTACT"/);
  assert.match(page, /payload\?\.partial === true/);
  assert.match(page, /partial_empty/);
  assert.match(page, /serviceMapPage\?\.hasMore && serviceMapPage\?\.nextCursor/);
  assert.match(page, /setLoadMoreError/);
  const staleCheck = page.indexOf("if (requestId !== serviceMapRequestRef.current) return;", page.indexOf("const payload = await response.json"));
  const responseError = page.indexOf("if (!response.ok) throw new Error", staleCheck);
  assert.ok(staleCheck > -1 && responseError > staleCheck, "stale response must be discarded before a non-OK response can mutate current state");
  assert.match(page, /setLoading\(true\);\s*setLoadingMore\(false\);\s*setLoadMoreError\(""\);/);
  assert.doesNotMatch(page.slice(page.indexOf("const loadServiceMapPage"), page.indexOf("const filteredEntries")), /setPeerListingsAvailable\(null\)/);
  assert.match(page, /isAuthenticated=\{Boolean\(session\?\.user\?\.id\)\}/);
});

test("browser uses only the same-origin tile proxy and handles tile failures", () => {
  assert.match(map, /\/api\/service-map\/tiles\/\{z\}\/\{x\}\/\{y\}/);
  assert.doesNotMatch(map, /NEXT_PUBLIC_SERVICE_MAP_TILE_URL|tiles\.maaamet\.ee/);
  assert.match(map, /tileLayer\.on\("tileerror"/);
  assert.match(map, /back_to_group/);
});
