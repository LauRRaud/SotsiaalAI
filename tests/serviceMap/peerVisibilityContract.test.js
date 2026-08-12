import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const route = readFileSync(join(root, "app/api/service-map/entries/route.js"), "utf8");
const mapEntries = readFileSync(join(root, "lib/help/mapEntries.js"), "utf8");

test("anonymous service-map requests do not load peer listings", () => {
  assert.match(route, /const canReadPeerListings = Boolean\(session\?\.user\?\.id\)/);
  assert.match(route, /loadPeerServiceMapEntries/);
  assert.match(route, /shouldLoadHelp && canReadPeerListings/);
  assert.match(route, /peerListingsAvailable: canReadPeerListings/);
});

test("peer map projection binds map records to an OPEN, unexpired source listing", () => {
  assert.match(mapEntries, /request: \{ is: \{ status: "OPEN"/);
  assert.match(mapEntries, /offer: \{ is: \{ status: "OPEN"/);
});
