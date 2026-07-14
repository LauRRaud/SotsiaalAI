import test from "node:test";
import assert from "node:assert/strict";

import { assistPreInquiry } from "../../lib/preInquiries.js";
import { preInquiryAvailabilityNotices } from "../../lib/serviceAvailabilityUi.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function service(id, availabilityStatus, availabilityCheckedAt, availabilityDescription = null) {
  return {
    id,
    name: `Koduteenus ${id}`,
    description: "Koduse toimetuleku tugi",
    category: "koduteenus",
    targetGroups: ["täiskasvanud"],
    serviceArea: "Tallinn",
    feeType: "FREE",
    priceDescription: null,
    availabilityStatus,
    availabilityDescription,
    availabilityCheckedAt,
    mapVisible: true,
    status: "PUBLISHED"
  };
}

test("assist query, mapper and recipient notice UI share the same availability contract", async () => {
  const selected = [];
  const services = [
    service("fresh", "accepting", NOW),
    service("stale", "accepting", new Date("2026-05-01T12:00:00.000Z")),
    service("closed", "not_accepting", NOW),
    service("unknown", null, null)
  ];
  const db = {
    serviceMapEntry: {
      async findMany(args) {
        selected.push(args.include.providerProfile.select.serviceItems.select);
        return [{
          id: "entry-1",
          type: "SERVICE_PROVIDER",
          title: "Koduteenuse osutaja",
          description: "Koduteenus ja koduse toimetuleku tugi",
          email: "provider@example.test",
          phone: null,
          address: "Tallinn",
          county: "Harju maakond",
          municipalityName: "Tallinn",
          providerProfileId: "profile-1",
          providerProfile: {
            id: "profile-1",
            ownerId: "owner-1",
            organizationName: "Turvaline Teenus",
            shortDescription: "Koduteenus",
            services: ["Koduteenus"],
            serviceCategories: ["koduteenus"],
            targetGroups: ["täiskasvanud"],
            serviceArea: "Tallinn",
            acceptsPlatformPreInquiries: true,
            acceptsEmailPreInquiries: true,
            serviceItems: services
          }
        }];
      }
    },
    user: { async findMany() { return []; } }
  };

  const result = await assistPreInquiry({
    topic: "Koduteenus",
    situation: "Vajan igapäevase koduse toimetuleku jaoks koduteenust.",
    municipality: "Tallinn",
    desiredRecipientType: "SERVICE_PROVIDER"
  }, { db, now: NOW });

  assert.deepEqual(selected[0].availabilityStatus, true);
  assert.deepEqual(selected[0].availabilityDescription, true);
  assert.deepEqual(selected[0].availabilityCheckedAt, true);
  assert.equal(result.suggestions.length, 1);

  const entry = result.suggestions[0];
  const mapped = new Map(entry.providerProfile.serviceItems.map((item) => [item.id, item.availability]));
  assert.equal(mapped.get("fresh").status, "accepting");
  assert.equal(mapped.get("fresh").freshness, "fresh");
  assert.equal(mapped.get("stale").freshness, "stale");
  assert.equal(mapped.get("closed").status, "not_accepting");
  assert.equal(mapped.get("closed").freshness, "fresh");
  assert.equal(mapped.get("unknown").freshness, "unknown");

  const notices = preInquiryAvailabilityNotices(entry, null);
  assert.deepEqual(notices.map(({ service: item }) => item.id), ["stale", "closed", "unknown"]);
  assert.equal(notices.some(({ service: item }) => item.id === "fresh"), false);
});
