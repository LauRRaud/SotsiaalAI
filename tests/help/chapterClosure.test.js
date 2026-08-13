import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("SOL-HELP-10 negatiivtõend: kõik loetletud rajad kasutavad jagatud limiterit", () => {
  const root = read("app/api/help/listings/route.js");
  const detail = read("app/api/help/listings/[kind]/[id]/route.js");
  const address = read("app/api/service-map/address-suggestions/route.js");
  for (const [label, source] of [["root", root], ["detail", detail], ["address", address]]) {
    assert.match(source, /consumeHelpRateLimit|enforceHelpRateLimit/, `${label}: jagatud limiter puudub`);
  }
  assert.match(root, /operation: "list:get"/);
  for (const operation of ["detail:get", "detail:patch", "detail:delete"]) {
    assert.match(detail, new RegExp(`"${operation}"`));
  }
  assert.match(address, /operation: "address-request"/);
  assert.match(address, /address-provider/, "välisgeokodeerija eraldi kvoot puudub");
});

test("SOL-HELP-11 negatiivtõend: server ei kärbi kasutaja kuulutuseteksti slice'iga", () => {
  for (const path of ["lib/help/requests.js", "lib/help/offers.js"]) {
    const source = read(path);
    assert.doesNotMatch(source, /return\s+(?:title|description|normalized)\.slice\(0,\s*(?:max|160|5000)\)/, path);
    assert.match(source, /normalizeHelpListingText/, `${path}: väljapõhine piirivalideerija puudub`);
  }
  assert.match(read("lib/help/listingLimits.js"), /HELP_LISTING_FIELD_TOO_LONG/);
  const ui = read("components/chat/SelectedListingContext.jsx");
  assert.match(ui, /maxLength/);
  assert.match(ui, /HELP_LISTING_TEXT_LIMITS/);
});

test("SOL-HELP-12 olemasolev DB-filter ja cursor on route'ini ühendatud", () => {
  const mapEntries = read("lib/help/mapEntries.js");
  const route = read("app/api/service-map/entries/route.js");
  assert.match(mapEntries, /filters\.AND\.push\(\{ OR:/);
  assert.match(mapEntries, /orderBy:\s*\[\{ updatedAt: "desc" \}, \{ id: "desc" \}\]/);
  assert.match(mapEntries, /take:\s*paged \? take \+ 1 : take/);
  assert.match(route, /page:\s*activePage/);
});

test("SOL-HELP-13 negatiivtõend: ACCEPT seob MATCHED oleku ning ruumi kontakt/sulgemine match'i elutsükliga", () => {
  const matches = read("lib/help/matches.js");
  const messageRoute = read("app/api/rooms/[roomId]/messages/route.js");
  const roomRoute = read("app/api/rooms/[roomId]/route.js");
  assert.match(matches, /data:\s*\{ status: "MATCHED" \}/);
  assert.match(matches, /markHelpMatchContactedByRoom/);
  assert.match(matches, /closeHelpMatchForArchivedRoom/);
  assert.match(messageRoute, /markHelpMatchContactedByRoom/);
  assert.match(roomRoute, /closeHelpMatchForArchivedRoom/);
});

test("HELP eelvaate kaarditekst on UTF-8 ning lokaliseeritud, mitte katkine fallback", () => {
  const preview = read("lib/help/workflowPreview.js");
  assert.doesNotMatch(preview, /Ć|Ç/);
  for (const locale of ["et", "en", "ru"]) {
    const messages = JSON.parse(read(`messages/${locale}.json`));
    const workflow = messages.chat.helpWorkflow;
    assert.ok(workflow.preview.mapVisibleValue);
    assert.ok(workflow.preview.mapPrivacyValue);
    assert.ok(workflow.preview.mapRegionUnspecified);
    assert.ok(workflow.labels.mapVisibility);
    assert.ok(workflow.labels.mapPrivacy);
  }
});
