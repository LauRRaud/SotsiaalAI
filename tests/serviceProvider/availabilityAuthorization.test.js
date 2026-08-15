import test from "node:test";
import assert from "node:assert/strict";

import { serviceAvailabilityFingerprint } from "../../lib/serviceAvailability.server.js";
import { confirmServiceAvailabilityRecord } from "../../lib/serviceAvailabilityOperations.js";

function confirmationDb(service, { updateCount = 1 } = {}) {
  const calls = { find: [], updates: [], profileReads: 0 };
  return {
    calls,
    serviceProviderService: {
      async findFirst(query) {
        calls.find.push(query);
        return service;
      },
      async updateMany(query) {
        calls.updates.push(query);
        return { count: updateCount };
      }
    },
    serviceProviderProfile: {
      async findUnique() {
        calls.profileReads += 1;
        return { id: service?.providerProfileId, serviceItems: [service] };
      }
    }
  };
}

test("availability confirmation scopes the lookup to the authenticated owner", async () => {
  const db = confirmationDb(null);
  await assert.rejects(
    confirmServiceAvailabilityRecord({ db, ownerId: "owner-a", serviceId: "service-1", expectedFingerprint: "fingerprint" }),
    (error) => error?.status === 404
  );
  assert.equal(db.calls.find[0].where.providerProfile.ownerId, "owner-a");
  assert.equal(db.calls.find[0].where.providerProfile.ownershipMode, "SOLO");
  assert.equal(db.calls.updates.length, 0);
});

test("retained provenance owner cannot confirm an organization profile", async () => {
  const organizationService = {
    id: "service-1",
    providerProfileId: "profile-org",
    availabilityStatus: "accepting",
    availabilityDescription: null
  };
  const db = confirmationDb(organizationService);
  db.serviceProviderService.findFirst = async (query) => {
    db.calls.find.push(query);
    return query.where.providerProfile.ownershipMode === "SOLO" ? null : organizationService;
  };

  await assert.rejects(
    confirmServiceAvailabilityRecord({
      db,
      ownerId: "former-owner",
      serviceId: organizationService.id,
      expectedFingerprint: serviceAvailabilityFingerprint(organizationService)
    }),
    (error) => error?.status === 404
  );
  assert.equal(db.calls.updates.length, 0);
  assert.equal(db.calls.profileReads, 0);
});

test("stale fingerprint returns 409 and performs no write", async () => {
  const service = {
    id: "service-1",
    providerProfileId: "profile-1",
    availabilityStatus: "accepting",
    availabilityDescription: null
  };
  const db = confirmationDb(service);
  await assert.rejects(
    confirmServiceAvailabilityRecord({ db, ownerId: "owner-a", serviceId: service.id, expectedFingerprint: "stale" }),
    (error) => error?.status === 409
  );
  assert.equal(db.calls.updates.length, 0);
});

test("matching fingerprint confirms only unchanged availability content", async () => {
  const service = {
    id: "service-1",
    providerProfileId: "profile-1",
    availabilityStatus: "waitlist",
    availabilityDescription: "2 nädalat"
  };
  const db = confirmationDb(service);
  const now = new Date("2026-07-14T12:00:00.000Z");
  const profile = await confirmServiceAvailabilityRecord({
    db,
    ownerId: "owner-a",
    serviceId: service.id,
    expectedFingerprint: serviceAvailabilityFingerprint(service),
    now
  });
  assert.equal(profile.id, "profile-1");
  assert.equal(db.calls.updates.length, 1);
  assert.equal(db.calls.updates[0].where.availabilityStatus, "waitlist");
  assert.equal(db.calls.updates[0].where.availabilityDescription, "2 nädalat");
  assert.deepEqual(db.calls.updates[0].where.providerProfile, {
    ownerId: "owner-a",
    ownershipMode: "SOLO"
  });
  assert.equal(db.calls.updates[0].data.availabilityCheckedAt, now);
  assert.equal(db.calls.updates[0].data.availabilityReminderSentAt, null);
});

test("a concurrent content change returns 409 after the conditional write", async () => {
  const service = {
    id: "service-1",
    providerProfileId: "profile-1",
    availabilityStatus: "accepting",
    availabilityDescription: null
  };
  const db = confirmationDb(service, { updateCount: 0 });
  await assert.rejects(
    confirmServiceAvailabilityRecord({ db, ownerId: "owner-a", serviceId: service.id, expectedFingerprint: serviceAvailabilityFingerprint(service) }),
    (error) => error?.status === 409
  );
  assert.equal(db.calls.profileReads, 0);
});
