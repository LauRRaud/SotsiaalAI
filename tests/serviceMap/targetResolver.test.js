import test from "node:test";
import assert from "node:assert/strict";
import { resolveServiceMapTarget } from "../../lib/serviceMap/targetResolver.js";

test("service target resolves a published provider location composite", async () => {
  const result = await resolveServiceMapTarget({
    entryId: "provider:location:loc",
    loadServiceEntries: async () => [{ id: "provider:location:loc", type: "SERVICE_PROVIDER", providerLocationId: "loc" }]
  });
  assert.equal(result.canonicalEntryId, "provider:location:loc");
  assert.equal(result.entryType, "SERVICE_PROVIDER");
});

test("foreign match and anonymous listing fail closed", async () => {
  const db = { helpMatch: { findFirst: async () => null } };
  const loadHelpEntries = async () => { throw new Error("help loader must not run"); };
  assert.equal(await resolveServiceMapTarget({ db, listing: "listing", loadHelpEntries }), null);
  assert.equal(await resolveServiceMapTarget({ db, userId: "stranger", match: "match", loadHelpEntries }), null);
});
