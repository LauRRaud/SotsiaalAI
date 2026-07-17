import test from "node:test";
import assert from "node:assert/strict";

import { normalizeServiceMapRecipientEntryId } from "../../lib/preInquiries.js";

test("provider location marker resolves to the authoritative service-map entry", () => {
  assert.equal(
    normalizeServiceMapRecipientEntryId("entry-123:location:location-456"),
    "entry-123"
  );
});

test("ordinary service-map recipient ids remain unchanged", () => {
  assert.equal(normalizeServiceMapRecipientEntryId("entry-123"), "entry-123");
  assert.equal(normalizeServiceMapRecipientEntryId(""), null);
});
