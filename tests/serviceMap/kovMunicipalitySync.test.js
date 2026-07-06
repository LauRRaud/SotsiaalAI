import test from "node:test";
import assert from "node:assert/strict";

import {
  mapKovAdminMunicipalityToServiceMapEntry,
  syncKovMunicipalitiesToServiceMap
} from "../../lib/serviceMap/kovMunicipalitySync.js";

test("KOV admin municipality rows can become reviewable social welfare map entries", () => {
  const entry = mapKovAdminMunicipalityToServiceMapEntry({
    officialWebsite: "https://parnu.ee",
    ragDocId: "kov-parnu-linn",
    municipality: {
      id: "parnu-id",
      slug: "parnu-linn",
      displayName: "Pärnu linn",
      county: "Pärnumaa"
    }
  });

  assert.equal(entry.id, "kov-municipality-parnu-linn");
  assert.equal(entry.type, "KOV_SOCIAL_CONTACT");
  assert.equal(entry.title, "Pärnu linn sotsiaalhoolekanne");
  assert.equal(entry.municipalityId, "parnu-id");
  assert.equal(entry.municipalityName, "Pärnu linn");
  assert.equal(entry.county, "Pärnumaa");
  assert.equal(entry.website, "https://parnu.ee");
  assert.equal(entry.sourceDocId, "kov-parnu-linn");
  assert.equal(entry.status, "NEEDS_REVIEW");
  assert.equal(entry.geocodingStatus, "PENDING");
  assert.equal(entry.address, "Pärnu linn");
});

test("dry-run plans municipality-level KOV map entries without writing", async () => {
  const calls = [];
  const prisma = {
    municipalityKovAdmin: {
      findMany: async () => [
        {
          officialWebsite: "https://parnu.ee",
          ragDocId: "kov-parnu-linn",
          municipality: {
            id: "parnu-id",
            slug: "parnu-linn",
            displayName: "Pärnu linn",
            county: "Pärnumaa",
            isActive: true
          }
        },
        {
          officialWebsite: "",
          ragDocId: null,
          municipality: {
            id: "tallinn-id",
            slug: "tallinn",
            displayName: "Tallinn",
            county: "Harjumaa",
            isActive: true
          }
        }
      ]
    },
    serviceMapEntry: {
      upsert: async (payload) => calls.push(payload)
    }
  };

  const result = await syncKovMunicipalitiesToServiceMap({ prisma, dryRun: true });

  assert.equal(result.scannedMunicipalities, 2);
  assert.equal(result.planned, 2);
  assert.equal(result.upserted, 0);
  assert.equal(calls.length, 0);
  assert.deepEqual(result.entries.map((entry) => entry.id), [
    "kov-municipality-parnu-linn",
    "kov-municipality-tallinn"
  ]);
});
