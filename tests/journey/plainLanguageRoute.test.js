import test from "node:test";
import assert from "node:assert/strict";

import { POST } from "../../app/api/journeys/[id]/plain-language/route.js";

const OWNER = "user-a";
const reqBody = (body) => ({ json: async () => body });
const ctx = (id = "j1") => ({ params: { id } });

function makeDeps({ session = { user: { id: OWNER } }, journey, journeyError, onGetJourney } = {}) {
  return {
    getServerSession: async () => session,
    getJourneyForUser: async (userId, journeyId) => {
      onGetJourney?.(userId, journeyId);
      if (journeyError) throw journeyError;
      return journey;
    }
  };
}

test("an unauthenticated caller is rejected with 401 and no journey is read", async () => {
  let read = false;
  const res = await POST(reqBody({ confirmed: true }), ctx(), makeDeps({
    session: null,
    onGetJourney: () => { read = true; }
  }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.messageKey, "api.common.unauthorized");
  assert.equal(read, false);
});

test("the reading aid requires explicit consent — confirmed:true — before any journey is read", async () => {
  for (const payload of [{}, { confirmed: false }, { confirmed: "yes" }]) {
    let read = false;
    const res = await POST(reqBody(payload), ctx(), makeDeps({
      journey: { summary: "Tavaline kokkuvõte.", title: "T", updatedAt: "x", context: {} },
      onGetJourney: () => { read = true; }
    }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.messageKey, "journeys.plain_language.confirmation_required");
    assert.equal(read, false, `payload ${JSON.stringify(payload)} must not read the journey`);
  }
});

test("an officially-flagged journey cannot be simplified even on a manual API call", async () => {
  const res = await POST(reqBody({ confirmed: true }), ctx(), makeDeps({
    journey: { summary: "Tavaline kokkuvõte.", title: "T", updatedAt: "x", context: { isOfficial: true } }
  }));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.messageKey, "journeys.plain_language.not_available");
});

test("a crisis summary cannot be simplified even on a manual API call", async () => {
  const res = await POST(reqBody({ confirmed: true }), ctx(), makeDeps({
    journey: { summary: "Helista kohe 112.", title: "T", updatedAt: "x", context: {} }
  }));
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.messageKey, "journeys.plain_language.not_available");
});

test("a journey the caller does not own returns 404, never another person's content", async () => {
  const notFound = Object.assign(new Error("journeys.errors.not_found"), { status: 404 });
  const res = await POST(reqBody({ confirmed: true }), ctx(), makeDeps({ journeyError: notFound }));
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.messageKey, "journeys.errors.not_found");
});

test("a successful reading aid preserves the original: only the owner's own summary, split verbatim", async () => {
  const seen = [];
  const summary = "Esita taotlus 17. juuliks. Küsi vajadusel abi.";
  const res = await POST(reqBody({ confirmed: true }), ctx("j1"), makeDeps({
    journey: { summary, title: "Abi teekond", updatedAt: "2026-07-17T00:00:00.000Z", context: {} },
    onGetJourney: (userId, journeyId) => seen.push([userId, journeyId])
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.source, { kind: "JOURNEY_SUMMARY", title: "Abi teekond", updatedAt: "2026-07-17T00:00:00.000Z" });
  assert.deepEqual(body.readingAid, ["Esita taotlus 17. juuliks.", "Küsi vajadusel abi."]);
  // Every reading-aid line is a verbatim slice of the original summary.
  for (const line of body.readingAid) assert.ok(summary.includes(line));
  // The raw summary is never echoed back as its own field or rewritten.
  assert.equal("summary" in body, false);
  // Ownership was enforced with the session user id, not a client-supplied id.
  assert.deepEqual(seen, [[OWNER, "j1"]]);
});
