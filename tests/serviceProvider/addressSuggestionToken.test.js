import assert from "node:assert/strict";
import test from "node:test";

import {
  signServiceMapSuggestion,
  verifyServiceMapSuggestionToken
} from "../../lib/serviceMap/addressSuggestionToken.js";

const env = { SERVICE_MAP_SUGGESTION_SECRET: "test-only-suggestion-secret" };
const now = new Date("2026-08-13T20:00:00.000Z");
const suggestion = {
  normalizedAddress: "Tamme tn 1, Tallinn",
  latitude: 59.437,
  longitude: 24.7536,
  adsObjectId: "ads-verified-1",
  provider: "maaruum"
};

test("signed address suggestion binds owner and every authoritative field", () => {
  const token = signServiceMapSuggestion(suggestion, { userId: "owner-a", now, env });
  assert.deepEqual(verifyServiceMapSuggestionToken(token, { userId: "owner-a", now, env }), suggestion);
  assert.equal(verifyServiceMapSuggestionToken(token, { userId: "owner-b", now, env }), null);

  const [body, signature] = token.split(".");
  const forged = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  forged.adsObjectId = "ads-forged";
  const forgedBody = Buffer.from(JSON.stringify(forged)).toString("base64url");
  assert.equal(verifyServiceMapSuggestionToken(`${forgedBody}.${signature}`, { userId: "owner-a", now, env }), null);
});

test("address suggestion token fails closed for invalid coordinates and expiry", () => {
  assert.equal(signServiceMapSuggestion({ ...suggestion, latitude: 90 }, { userId: "owner-a", now, env }), null);
  assert.equal(signServiceMapSuggestion({ ...suggestion, latitude: Number.NaN }, { userId: "owner-a", now, env }), null);
  assert.equal(signServiceMapSuggestion({ ...suggestion, longitude: Number.POSITIVE_INFINITY }, { userId: "owner-a", now, env }), null);
  assert.equal(signServiceMapSuggestion({ ...suggestion, latitude: 60.1, longitude: 24.7 }, { userId: "owner-a", now, env }), null);

  const expired = signServiceMapSuggestion(suggestion, { userId: "owner-a", now, ttlMs: 1, env });
  assert.equal(verifyServiceMapSuggestionToken(expired, {
    userId: "owner-a",
    now: new Date(now.getTime() + 2),
    env
  }), null);
  assert.equal(signServiceMapSuggestion(suggestion, { userId: "owner-a", now, env: {} }), null);
});
