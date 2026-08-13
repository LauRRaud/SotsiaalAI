import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../../app/api/journeys/[id]/help-request-draft/route.js";

function request(shareKeys) {
  return new Request("http://localhost/api/journeys/journey-a/help-request-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shareKeys })
  });
}

test("SOL-JOUR-10: help-request projection reads only the authenticated owner's Journey", async () => {
  const calls = [];
  const response = await POST(
    request(["summary", "unknown"]),
    { params: Promise.resolve({ id: "journey-a" }) },
    {
      requireJourneyUser: async () => ({ userId: "owner-a" }),
      getJourneyForUser: async (ownerId, journeyId) => {
        calls.push({ ownerId, journeyId });
        return {
          id: journeyId,
          summary: "OWNER_MARKER vajan transporti",
          domains: ["igapäevaelu toimingud"],
          context: {}
        };
      }
    }
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [{ ownerId: "owner-a", journeyId: "journey-a" }]);
  assert.match(JSON.stringify(payload.prefill), /OWNER_MARKER/);
  assert.deepEqual(payload.ignoredKeys, ["unknown"]);
});

test("SOL-JOUR-10: a foreign or missing Journey stays a generic 404", async () => {
  const response = await POST(
    request(["summary", "category", "region", "ownWords"]),
    { params: Promise.resolve({ id: "journey-foreign" }) },
    {
      requireJourneyUser: async () => ({ userId: "owner-a" }),
      getJourneyForUser: async () => {
        const error = new Error("journeys.errors.not_found");
        error.status = 404;
        throw error;
      }
    }
  );
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.deepEqual(payload, { ok: false, message: "journeys.errors.not_found" });
  assert.doesNotMatch(JSON.stringify(payload), /journey-foreign|summary|category|region|ownWords/u);
});
