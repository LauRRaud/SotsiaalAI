import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../../app/api/reflections/route.js", import.meta.url), "utf8");
const page = await readFile(new URL("../../components/reflection/ReflectionPage.jsx", import.meta.url), "utf8");

test("list route passes cursor and returns explicit page metadata", () => {
  assert.match(route, /cursor: requestUrl\.searchParams\.get\("cursor"\)/);
  assert.match(route, /reflections: result\.items, page: result\.page/);
});

test("create route forwards Idempotency-Key and distinguishes replay", () => {
  assert.match(route, /request\.headers\.get\("Idempotency-Key"\)/);
  assert.match(route, /replayed \? 200 : 201/);
});

test("UI keeps one create key across retry and de-duplicates load-more rows by id", () => {
  assert.match(page, /const \[createKey, setCreateKey\]/);
  assert.match(page, /idempotencyKey: createKey/);
  assert.match(page, /const byId = new Map\(current\.map\(\(item\) => \[item\.id, item\]\)\)/);
  assert.match(page, /reflection\.list\.load_more/);
});

test("stale UI keeps the local form and renders local and server versions side by side", () => {
  assert.match(page, /setConflictReflection\(payload\.details\.current\)/);
  assert.match(page, /reflection\.conflict\.your_version/);
  assert.match(page, /reflection\.conflict\.server_version/);
  assert.match(page, /form\[field\]/);
  assert.match(page, /conflictReflection\[field\]/);
});

test("reflection API message keys are translated instead of shown as machine text", () => {
  assert.match(page, /apiKey\.startsWith\("reflection\."\)/);
  assert.match(page, /translated !== apiKey/);
});
