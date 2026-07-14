import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  canonicalServiceAvailabilityStatus,
  getServiceAvailabilityState,
  isCanonicalServiceAvailabilityStatus,
  normalizeAvailabilityStatusForWrite,
  serializePublicServiceAvailability,
  serviceAvailabilityRagFields,
  serviceAvailabilityReminderDue
} from "../../lib/serviceAvailability.js";
import { serviceAvailabilityFingerprint } from "../../lib/serviceAvailability.server.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");
const profileSource = fs.readFileSync(new URL("../../lib/serviceProviderProfiles.js", import.meta.url), "utf8");

test("availability has exactly three canonical application-layer states", () => {
  assert.equal(isCanonicalServiceAvailabilityStatus("accepting"), true);
  assert.equal(isCanonicalServiceAvailabilityStatus("waitlist"), true);
  assert.equal(isCanonicalServiceAvailabilityStatus("not_accepting"), true);
  assert.equal(isCanonicalServiceAvailabilityStatus("limited"), false);
  assert.equal(canonicalServiceAvailabilityStatus("Saadaval"), "accepting");
  assert.equal(canonicalServiceAvailabilityStatus("Järjekord"), "waitlist");
  assert.equal(canonicalServiceAvailabilityStatus("Peatatud"), "not_accepting");
  assert.equal(canonicalServiceAvailabilityStatus("Piiratud vastuvõtt"), "unknown");
});

test("unknown legacy status survives an unrelated owner save but cannot be introduced anew", () => {
  const existing = { id: "service-1", availabilityStatus: "Piiratud vastuvõtt" };
  assert.equal(normalizeAvailabilityStatusForWrite("Piiratud vastuvõtt", existing), "Piiratud vastuvõtt");
  assert.throws(
    () => normalizeAvailabilityStatusForWrite("Piiratud vastuvõtt", null),
    (error) => error?.status === 400 && error?.message === "service_provider_profile.errors.availability_status_invalid"
  );
});

test("freshness is calculated from server time and does not persist a stale boolean", () => {
  const fresh = getServiceAvailabilityState({
    availabilityStatus: "accepting",
    availabilityCheckedAt: "2026-06-17T12:00:00.000Z"
  }, { now: NOW, freshDays: 28 });
  const stale = getServiceAvailabilityState({
    availabilityStatus: "waitlist",
    availabilityDescription: "umbes 3 nädalat",
    availabilityCheckedAt: "2026-06-15T11:59:59.000Z"
  }, { now: NOW, freshDays: 28 });
  const unknown = getServiceAvailabilityState({ availabilityStatus: "accepting" }, { now: NOW });

  assert.equal(fresh.freshness, "fresh");
  assert.equal(fresh.ageDays, 27);
  assert.equal(stale.freshness, "stale");
  assert.equal(stale.description, "umbes 3 nädalat");
  assert.equal(unknown.freshness, "unknown");
  assert.equal(unknown.reason, "never_confirmed");
});

test("public availability never presents an arbitrary legacy value as a trusted state", () => {
  assert.deepEqual(serializePublicServiceAvailability({
    availabilityStatus: "custom production text",
    availabilityCheckedAt: NOW
  }, { now: NOW }), {
    status: "unknown",
    freshness: "unknown",
    reason: "status_unknown",
    stale: false,
    ageDays: 0,
    freshDays: 28,
    checkedAt: NOW.toISOString(),
    description: null
  });
});

test("availability fingerprint changes only when the availability content changes", () => {
  const service = { id: "service-1", availabilityStatus: "waitlist", availabilityDescription: "2 nädalat" };
  const fingerprint = serviceAvailabilityFingerprint(service);
  assert.equal(fingerprint, serviceAvailabilityFingerprint({ ...service, updatedAt: new Date() }));
  assert.notEqual(fingerprint, serviceAvailabilityFingerprint({ ...service, availabilityDescription: "3 nädalat" }));
  assert.equal(serviceAvailabilityFingerprint({ ...service, availabilityStatus: "legacy" }), null);
});

test("reminder is due once per unchanged stale confirmation", () => {
  const service = {
    availabilityStatus: "accepting",
    availabilityCheckedAt: "2026-05-01T12:00:00.000Z",
    availabilityReminderSentAt: null
  };
  assert.equal(serviceAvailabilityReminderDue(service, { now: NOW, freshDays: 28 }), true);
  assert.equal(serviceAvailabilityReminderDue({
    ...service,
    availabilityReminderSentAt: "2026-06-01T12:00:00.000Z"
  }, { now: NOW, freshDays: 28 }), false);
});

test("RAG metadata and text mark stale availability instead of presenting it as fresh", () => {
  const service = {
    id: "service-1",
    name: "Koduteenus",
    status: "PUBLISHED",
    availabilityStatus: "accepting",
    availabilityCheckedAt: new Date("2026-01-01T00:00:00.000Z"),
    locationLinks: []
  };
  const fields = serviceAvailabilityRagFields(service);
  assert.equal(fields.availability_status, "accepting");
  assert.equal(fields.availability_freshness, "stale");
  assert.equal(fields.availability_stale, true);
  assert.match(profileSource, /Kattesaadavuse info \(\$\{availability\.freshness\}\)/);
  assert.match(profileSource, /\.\.\.serviceAvailabilityRagFields\(service\)/);
});

test("full profile saves cannot silently overwrite a concurrent freshness confirmation", () => {
  assert.match(profileSource, /findUnique\(\{[\s\S]*where: \{ ownerId \}[\s\S]*include: serviceProviderProfileFullInclude/);
  assert.match(profileSource, /\{ isolationLevel: "Serializable" \}/);
  assert.match(profileSource, /error\?\.code === "P2034"/);
  assert.match(profileSource, /MAX_PROFILE_SAVE_ATTEMPTS = 3/);
});
