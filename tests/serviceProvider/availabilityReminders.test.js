import test from "node:test";
import assert from "node:assert/strict";

import {
  buildServiceAvailabilityReminderEmail,
  dispatchServiceAvailabilityReminders,
  listServiceAvailabilityAdminRows
} from "../../lib/serviceAvailabilityReminders.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function staleService() {
  return {
    id: "service-1",
    name: "Koduteenus",
    status: "PUBLISHED",
    availabilityStatus: "accepting",
    availabilityDescription: null,
    availabilityCheckedAt: new Date("2026-05-01T12:00:00.000Z"),
    availabilityReminderSentAt: null,
    providerProfileId: "profile-1",
    providerProfile: {
      id: "profile-1",
      ownerId: "owner-1",
      organizationName: "Turvaline Teenus",
      email: "fallback@example.test",
      owner: { id: "owner-1", email: "owner@example.test" }
    }
  };
}

function reminderDb(service) {
  const audits = [];
  const queries = [];
  return {
    audits,
    queries,
    serviceProviderService: {
      async findMany(args) {
        queries.push(args);
        return [service];
      },
      async updateMany({ where, data }) {
        if (where.availabilityReminderSentAt !== service.availabilityReminderSentAt) return { count: 0 };
        service.availabilityReminderSentAt = data.availabilityReminderSentAt;
        return { count: 1 };
      }
    },
    dataAuditLog: {
      async create({ data }) {
        audits.push(data);
        return data;
      }
    }
  };
}

test("reminder contains no pre-inquiry or client content", () => {
  const service = staleService();
  const email = buildServiceAvailabilityReminderEmail({
    service: { ...service, secretClientText: "SENSITIVE CLIENT CASE" },
    profile: service.providerProfile,
    baseUrl: "https://example.test",
    locale: "et"
  });
  assert.match(email.text, /Koduteenus/);
  assert.match(email.text, /https:\/\/example\.test\/teenuseprofiil\?availability=review/);
  assert.doesNotMatch(JSON.stringify(email), /SENSITIVE CLIENT CASE/);
});

test("successful reminder is claimed once and audited without recipient PII in metadata", async () => {
  const service = staleService();
  const db = reminderDb(service);
  const sent = [];
  const options = {
    db,
    now: NOW,
    freshDays: 28,
    transportConfigured: true,
    from: "system@example.test",
    baseUrl: "https://example.test",
    mailer: { async sendMail(message) { sent.push(message); } }
  };
  const first = await dispatchServiceAvailabilityReminders(options);
  const second = await dispatchServiceAvailabilityReminders(options);
  assert.equal(first.sent, 1);
  assert.equal(second.sent, 0);
  assert.equal(sent.length, 1);
  assert.equal(db.queries[0].where.availabilityReminderSentAt, null);
  assert.equal("OR" in db.queries[0].where, false, "already-reminded rows cannot fill the bounded query window");
  assert.equal(db.audits[0].action, "service_availability_reminder_sent");
  assert.equal(JSON.stringify(db.audits[0].meta).includes("owner@example.test"), false);
});

test("missing transport produces auditable not_sent and does not mark delivery", async () => {
  const service = staleService();
  const db = reminderDb(service);
  const result = await dispatchServiceAvailabilityReminders({
    db,
    now: NOW,
    transportConfigured: false,
    from: "system@example.test",
    baseUrl: "https://example.test"
  });
  assert.equal(result.notSent, 1);
  assert.equal(service.availabilityReminderSentAt, null);
  assert.equal(db.audits[0].action, "service_availability_reminder_not_sent");
  assert.equal(db.audits[0].meta.reason, "transport_missing");
});

test("admin overview returns stale and unknown rows but no fresh rows", async () => {
  const stale = staleService();
  const unknown = { ...staleService(), id: "service-2", availabilityStatus: null, availabilityCheckedAt: null };
  const fresh = { ...staleService(), id: "service-3", availabilityCheckedAt: new Date("2026-07-10T12:00:00.000Z") };
  const rows = await listServiceAvailabilityAdminRows({
    db: { serviceProviderService: { async findMany() { return [stale, unknown, fresh]; } } },
    now: NOW,
    freshDays: 28
  });
  assert.deepEqual(rows.map((row) => row.id), ["service-1", "service-2"]);
  assert.equal(rows[0].availability.freshness, "stale");
  assert.equal(rows[1].availability.freshness, "unknown");
});
