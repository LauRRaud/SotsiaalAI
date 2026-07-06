import test from "node:test";
import assert from "node:assert/strict";

import {
  mapKovRagContactChunkToServiceMapEntry,
  mapServiceProviderRagDocumentToServiceMapEntry,
  syncServiceProviderDocumentsFromRagToServiceMap,
  syncKovContactsFromRagToServiceMap
} from "../../lib/serviceMap/ragServiceMapSync.js";

const municipality = {
  id: "parnu-id",
  slug: "parnu-linn",
  displayName: "Parnu linn",
  county: "Parnumaa"
};

const contactChunk = {
  id: "kov-parnu-linn:item:social_contacts",
  text: "Pärnu linnavalitsuse sotsiaalosakond, tel 444 8200, e-post linnavalitsus@parnu.ee",
  metadata: {
    doc_id: "kov-parnu-linn",
    item_id: "social_contacts",
    item_type: "contact",
    source_type: "municipality_kov",
    title: "Pärnu linnavalitsuse sotsiaalosakond",
    municipality_id: "parnu_linn",
    municipality_name: "Pärnu linn",
    municipality_slug: "parnu-linn",
    county: "Pärnumaa",
    contact_phone: "444 8200",
    contact_email: "linnavalitsus@parnu.ee",
    contact_address: "Suur-Sepa 16, Pärnu",
    contact_role: "Sotsiaalhoolekanne",
    contact_department: "Sotsiaalosakond",
    official_url: "https://parnu.ee/sotsiaal",
    checked_at: "2026-05-01T00:00:00.000Z"
  }
};

test("KOV RAG contact chunk maps to a structured service-map entry", () => {
  const entry = mapKovRagContactChunkToServiceMapEntry(contactChunk, { municipality });

  assert.equal(entry.id, "kov-contact-kov-parnu-linn-social-contacts");
  assert.equal(entry.type, "KOV_SOCIAL_CONTACT");
  assert.equal(entry.title, "Pärnu linnavalitsuse sotsiaalosakond");
  assert.equal(entry.municipalityId, "parnu-id");
  assert.equal(entry.municipalityName, "Pärnu linn");
  assert.equal(entry.county, "Pärnumaa");
  assert.equal(entry.phone, "444 8200");
  assert.equal(entry.email, "linnavalitsus@parnu.ee");
  assert.equal(entry.address, "Suur-Sepa 16, Pärnu");
  assert.equal(entry.website, "https://parnu.ee/sotsiaal");
  assert.equal(entry.sourceDocId, "kov-parnu-linn");
  assert.equal(entry.status, "NEEDS_REVIEW");
  assert.equal(entry.geocodingStatus, "PENDING");
});

test("sync reads ingested KOV contact chunks from RAG and upserts map entries", async () => {
  const upserts = [];
  const prisma = {
    municipalityKovAdmin: {
      findMany: async () => [
        {
          ragDocId: "kov::parnu-linn::bundle",
          ingestStatus: "INGESTED",
          municipality
        }
      ]
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async (payload) => {
        upserts.push(payload);
        return payload.create;
      }
    }
  };
  const ragClient = {
    listDocumentChunks: async (docId, filters) => {
      assert.equal(docId, "kov::parnu-linn::bundle");
      assert.deepEqual(filters, {
        itemType: "contact"
      });
      return [contactChunk];
    }
  };

  const result = await syncKovContactsFromRagToServiceMap({
    prisma,
    ragClient,
    dryRun: false
  });

  assert.equal(result.scannedDocuments, 1);
  assert.equal(result.scannedContacts, 1);
  assert.equal(result.upserted, 1);
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].where.id, "kov-contact-kov-parnu-linn-social-contacts");
  assert.equal(upserts[0].create.email, "linnavalitsus@parnu.ee");
});

test("sync normalizes legacy KOV admin ragDocId to current bundle doc id", async () => {
  const prisma = {
    municipalityKovAdmin: {
      findMany: async () => [
        {
          ragDocId: "kov-parnu-linn",
          ingestStatus: "INGESTED",
          municipality
        }
      ]
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("dry run should not upsert");
      }
    }
  };
  const ragClient = {
    listDocumentChunks: async (docId) => {
      assert.equal(docId, "kov::parnu-linn::bundle");
      return [];
    }
  };

  const result = await syncKovContactsFromRagToServiceMap({
    prisma,
    ragClient,
    dryRun: true
  });

  assert.equal(result.scannedDocuments, 1);
  assert.equal(result.failedDocuments, 0);
});

test("sync retries underscore KOV bundle doc id for legacy slug mismatches", async () => {
  const requested = [];
  const prisma = {
    municipalityKovAdmin: {
      findMany: async () => [
        {
          ragDocId: "kov-antsla-vald",
          ingestStatus: "INGESTED",
          municipality: {
            ...municipality,
            slug: "antsla-vald"
          }
        }
      ]
    },
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async () => {
        throw new Error("dry run should not upsert");
      }
    }
  };
  const ragClient = {
    listDocumentChunks: async (docId) => {
      requested.push(docId);
      if (docId === "kov::antsla-vald::bundle") {
        const error = new Error("RAG chunk request failed: HTTP 404");
        error.status = 404;
        throw error;
      }
      assert.equal(docId, "kov::antsla_vald::bundle");
      return [];
    }
  };

  const result = await syncKovContactsFromRagToServiceMap({
    prisma,
    ragClient,
    dryRun: true
  });

  assert.deepEqual(requested, ["kov::antsla-vald::bundle", "kov::antsla_vald::bundle"]);
  assert.equal(result.failedDocuments, 0);
});

test("service provider RAG organization document maps to a service-map entry", () => {
  const entry = mapServiceProviderRagDocumentToServiceMapEntry({
    docId: "organization-astangu",
    title: "Astangu Kutserehabilitatsiooni Keskus",
    source_type: "organization_profile",
    organization_type: "service_provider",
    organization_slug: "astangu",
    county: "Harjumaa",
    contact_email: "info@astangu.ee",
    contact_phone: "687 7231",
    official_website: "https://www.astangu.ee",
    checked_at: "2026-05-01T00:00:00.000Z"
  });

  assert.equal(entry.id, "service-provider-rag-organization-astangu");
  assert.equal(entry.type, "SERVICE_PROVIDER");
  assert.equal(entry.title, "Astangu Kutserehabilitatsiooni Keskus");
  assert.equal(entry.county, "Harjumaa");
  assert.equal(entry.email, "info@astangu.ee");
  assert.equal(entry.phone, "687 7231");
  assert.equal(entry.website, "https://www.astangu.ee");
  assert.equal(entry.sourceDocId, "organization-astangu");
  assert.equal(entry.status, "NEEDS_REVIEW");
  assert.equal(entry.geocodingStatus, "FAILED");
});

test("sync reads service provider organization documents from RAG and upserts map entries", async () => {
  const upserts = [];
  const prisma = {
    serviceMapEntry: {
      findUnique: async () => null,
      upsert: async (payload) => {
        upserts.push(payload);
        return payload.create;
      }
    }
  };
  const ragClient = {
    listDocuments: async () => [
      {
        docId: "organization-astangu",
        title: "Astangu Kutserehabilitatsiooni Keskus",
        source_type: "organization_profile",
        organization_type: "service_provider",
        contact_email: "info@astangu.ee",
        contact_phone: "687 7231"
      },
      {
        docId: "kov-parnu-linn",
        source_type: "municipality_kov"
      }
    ]
  };

  const result = await syncServiceProviderDocumentsFromRagToServiceMap({
    prisma,
    ragClient,
    dryRun: false
  });

  assert.equal(result.scannedDocuments, 2);
  assert.equal(result.scannedProviders, 1);
  assert.equal(result.upserted, 1);
  assert.equal(upserts[0].where.id, "service-provider-rag-organization-astangu");
});
