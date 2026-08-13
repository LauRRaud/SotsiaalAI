import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { splitServiceLocationMapEntries } from "../../lib/serviceProviderServiceLocations.js";

const source = fs.readFileSync(new URL("../../lib/serviceProviderProfiles.js", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../../app/api/service-provider/profile/route.js", import.meta.url), "utf8");
const boundary = fs.readFileSync(new URL("../../lib/serviceProviderProfileBoundary.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const registry = fs.readFileSync(new URL("../../lib/dataExport/registry.js", import.meta.url), "utf8");
const ragJobs = fs.readFileSync(new URL("../../lib/serviceProviderProfileRagJobs.js", import.meta.url), "utf8");
const ragService = fs.readFileSync(new URL("../../rag-service/main.py", import.meta.url), "utf8");

const service = (id, status, mapVisible, marker) => ({
  id,
  name: marker,
  description: `${marker}-description`,
  status,
  mapVisible,
  locationLinks: []
});

test("SPROF-03: public location resolves only allowlisted public services", () => {
  const entries = splitServiceLocationMapEntries({
    id: "provider",
    providerProfile: {
      serviceItems: [service("public", "PUBLISHED", true, "PUBLIC")],
      serviceLocations: [{
        id: "location",
        status: "PUBLISHED",
        mapVisible: true,
        geocodingStatus: "MATCHED",
        latitude: 59.4,
        longitude: 24.7,
        serviceLinks: [
          { providerServiceId: "public", providerService: service("public", "PUBLISHED", true, "PUBLIC") },
          { providerServiceId: "hidden", providerService: service("hidden", "HIDDEN", true, "HIDDEN_SECRET") },
          { providerServiceId: "draft", providerService: service("draft", "DRAFT", true, "DRAFT_SECRET") },
          { providerServiceId: "not-map", providerService: service("not-map", "PUBLISHED", false, "MAP_SECRET") }
        ]
      }]
    }
  });
  assert.deepEqual(entries[0].providerProfile.serviceItems.map((item) => item.name), ["PUBLIC"]);
  assert.deepEqual(entries[0].providerProfile.serviceLocations[0].serviceLinks, [{
    providerServiceId: "public",
    providerLocationId: "location"
  }]);
  assert.doesNotMatch(JSON.stringify(entries), /HIDDEN_SECRET|DRAFT_SECRET|MAP_SECRET/u);
});

test("SPROF-04: RAG text, metadata and counters share the public-service projection", () => {
  assert.match(source, /publicServiceProviderServices/u);
  assert.doesNotMatch(source, /services:\s*\(profile\.serviceItems \|\| \[\]\)\.map/u);
  assert.doesNotMatch(source, /service_count:\s*\(profile\.serviceItems \|\| \[\]\)\.length/u);
});

test("SPROF-05: full profile save requires an atomic expectedUpdatedAt CAS and preserves local UI on conflict", () => {
  assert.match(source, /expectedUpdatedAt/u);
  assert.match(source, /updateMany\([\s\S]*updatedAt:\s*expectedUpdatedAt/u);
  assert.match(`${route}\n${boundary}`, /profile_conflict/u);
  assert.match(ui, /expectedUpdatedAt:\s*profile\?\.updatedAt/u);
  assert.match(ui, /conflictProfile/u);
});

test("SPROF-06: raw client coordinates never become MATCHED without a signed suggestion", () => {
  assert.match(source, /verifyServiceMapSuggestionToken/u);
  assert.match(source, /geocodingSuggestionToken/u);
  assert.doesNotMatch(source, /provider:\s*normalizeText\(input\.geocodingProvider \|\| input\.provider\) \|\| "maaruum"/u);
});

test("SPROF-07: profile RAG ingest is represented by a durable revisioned job", () => {
  assert.match(schema, /model ServiceProviderProfileRagJob/u);
  assert.match(source, /queueServiceProviderProfileRagJob/u);
  assert.match(source, /processServiceProviderProfileRagJobs/u);
  assert.match(ragJobs, /profileId_revisionAt/u);
  assert.match(ragJobs, /updatedAt:\s*job\.revisionAt/u);
  assert.match(ragService, /PUBLIC_DOCUMENT_METADATA_FIELDS[\s\S]*"profile_revision"/u);
});

test("SPROF-08: data export contains an owner-scoped SOLO service profile surface", () => {
  assert.match(registry, /name:\s*"service_provider_profile"/u);
  assert.match(registry, /ownerId:\s*userId[\s\S]*ownershipMode:\s*"SOLO"/u);
});
