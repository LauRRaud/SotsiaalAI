import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("personal search keeps private query text out of the URL and public-read maintenance", () => {
  const route = read("app/api/otsi/route.js");
  const page = read("components/search/PersonalSearchPage.jsx");

  assert.match(route, /export async function POST/u);
  assert.doesNotMatch(route, /runRetentionCleanup:\s*true/u);
  assert.match(route, /await\s+enforceRateLimit/u);
  assert.match(page, /fetch\("\/api\/otsi"/u);
  assert.match(page, /method:\s*"POST"/u);
  assert.doesNotMatch(page, /\/api\/otsi\?q=/u);
  const maintenance = read("lib/search/retentionMaintenance.js");
  const cleanupRoute = read("app/api/internal/retention/cleanup/route.js");
  assert.match(maintenance, /pg_try_advisory_lock/u);
  assert.match(maintenance, /pg_advisory_unlock/u);
  assert.match(cleanupRoute, /runRetentionMaintenanceWithSharedLock/u);
});

test("personal search contract exposes stable cursors, partial-source state and distinct document targets", () => {
  const service = read("lib/search/personalSearch.js");

  assert.match(service, /Promise\.allSettled/u);
  assert.match(service, /hasMore/u);
  assert.match(service, /nextCursor/u);
  assert.match(service, /cursor:/u);
  assert.match(service, /\/documents\//u);
  assert.doesNotMatch(service, /\|\|\s*"Vestlus"|\|\|\s*"Teekond"|\|\|\s*"Dokument"/u);
});

test("all locales own translated untitled and partial-search labels", () => {
  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(read(`messages/${locale}.json`));
    assert.equal(typeof messages.personal_search?.untitled?.conversation, "string");
    assert.equal(typeof messages.personal_search?.untitled?.journey, "string");
    assert.equal(typeof messages.personal_search?.untitled?.document, "string");
    assert.equal(typeof messages.personal_search?.partial, "string");
  }
});
