#!/usr/bin/env node

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { DATA_EXPORT_REGISTRY } from "../lib/dataExport/registry.js";
import { prisma as appDb } from "../lib/prisma.js";
import { signServiceMapSuggestion } from "../lib/serviceMap/addressSuggestionToken.js";
import {
  processServiceProviderProfileRagJobs,
  queueServiceProviderProfileRagJob
} from "../lib/serviceProviderProfileRagJobs.js";
import {
  getServiceProviderProfileForOwner,
  listPublishedServiceMapEntries,
  reconcileServiceProviderProfileRagJobs,
  serviceProviderProfileRagPayload,
  upsertServiceProviderProfileForOwner
} from "../lib/serviceProviderProfiles.js";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: []
});
let passed = 0;
function expect(label, value) {
  if (!value) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const profileInclude = {
  serviceMapEntry: true,
  serviceItems: { include: { locationLinks: true } },
  serviceLocations: { include: { serviceLinks: true } }
};

function profileData(ownerId, organizationName, extra = {}) {
  return {
    ownerId,
    ownershipMode: "SOLO",
    organizationName,
    status: "DRAFT",
    mapVisible: false,
    assistantRecommendationAllowed: false,
    ...extra
  };
}

async function createRagProfile(ownerId, marker, revisionAt) {
  return db.serviceProviderProfile.create({
    data: profileData(ownerId, `RAG ${marker}`, {
      status: "PUBLISHED",
      mapVisible: true,
      assistantRecommendationAllowed: true,
      publicSlug: `rag-${marker.toLowerCase()}`,
      updatedAt: revisionAt,
      serviceItems: {
        create: [
          { name: `PUBLIC-${marker}`, description: `VISIBLE-${marker}`, status: "PUBLISHED", mapVisible: true },
          { name: `HIDDEN-${marker}`, description: `SECRET-${marker}`, status: "HIDDEN", mapVisible: true },
          { name: `DRAFT-${marker}`, description: `DRAFT-SECRET-${marker}`, status: "DRAFT", mapVisible: true },
          { name: `NO-MAP-${marker}`, description: `MAP-SECRET-${marker}`, status: "PUBLISHED", mapVisible: false }
        ]
      }
    }),
    include: profileInclude
  });
}

try {
  const [ownerA, ownerB, ownerMap, ownerInvalid, ownerRagA, ownerRagB, ownerRagC] = await Promise.all(
    ["a", "b", "map", "invalid", "rag-a", "rag-b", "rag-c"].map(suffix =>
      db.user.create({ data: { email: `sprof-${suffix}@probe.invalid` } })
    )
  );

  const tokenNow = new Date();
  const validSuggestion = {
    normalizedAddress: "Tamme tn 1, Tallinn",
    latitude: 59.437,
    longitude: 24.7536,
    adsObjectId: "ads-probe-valid",
    provider: "maaruum"
  };
  const validToken = signServiceMapSuggestion(validSuggestion, { userId: ownerA.id, now: tokenNow });
  const initial = await upsertServiceProviderProfileForOwner(ownerA.id, {
    organizationName: "CAS algseis",
    status: "DRAFT",
    serviceLocations: [{
      id: "location-client",
      label: "Kontrollitud koht",
      address: validSuggestion.normalizedAddress,
      geocodingSuggestionToken: validToken,
      mapVisible: true,
      status: "PUBLISHED"
    }]
  });
  const matched = await db.serviceProviderLocation.findFirst({ where: { providerProfileId: initial.id } });
  expect("signed server suggestion persists MATCHED coordinates and provider evidence", matched?.geocodingStatus === "MATCHED" && matched.adsObjectId === "ads-probe-valid" && matched.latitude === 59.437);

  const expiredToken = signServiceMapSuggestion(validSuggestion, {
    userId: ownerInvalid.id,
    now: new Date(tokenNow.getTime() - 20 * 60 * 1000),
    ttlMs: 1_000
  });
  const invalid = await upsertServiceProviderProfileForOwner(ownerInvalid.id, {
    organizationName: "Võltsitud asukoht",
    status: "DRAFT",
    serviceLocations: [{
      id: "forged-location",
      address: "Vale koht",
      normalizedAddress: "Võltsitud aadress",
      latitude: 999,
      longitude: Number.POSITIVE_INFINITY,
      adsObjectId: "ads-forged",
      geocodingProvider: "attacker",
      geocodingSuggestionToken: expiredToken,
      mapVisible: true,
      status: "PUBLISHED"
    }]
  });
  const rejected = await db.serviceProviderLocation.findFirst({ where: { providerProfileId: invalid.id } });
  expect("expired or forged raw location fails closed without coordinates or client provider", rejected?.geocodingStatus === "PENDING" && rejected.latitude == null && rejected.longitude == null && rejected.adsObjectId == null && rejected.geocodingRaw == null);

  await wait(10);
  const expectedUpdatedAt = (await getServiceProviderProfileForOwner(ownerA.id)).updatedAt;
  const competingInputs = ["WIN-A", "WIN-B"].map(marker => ({
    organizationName: `CAS ${marker}`,
    shortDescription: marker,
    status: "DRAFT",
    expectedUpdatedAt: expectedUpdatedAt.toISOString(),
    serviceItems: [{ name: `SERVICE-${marker}`, description: marker, status: "DRAFT", mapVisible: false }],
    serviceLocations: []
  }));
  const decisions = await Promise.allSettled(competingInputs.map(input => upsertServiceProviderProfileForOwner(ownerA.id, input)));
  const winner = decisions.find(item => item.status === "fulfilled")?.value;
  const loser = decisions.find(item => item.status === "rejected")?.reason;
  expect("two stale full forms have exactly one PostgreSQL commit winner", decisions.filter(item => item.status === "fulfilled").length === 1 && decisions.filter(item => item.status === "rejected").length === 1 && loser?.status === 409);
  const afterRace = await db.serviceProviderProfile.findUnique({ where: { id: initial.id }, include: profileInclude });
  expect("profile and child rows belong to the same winning revision", afterRace.shortDescription === winner.shortDescription && afterRace.serviceItems.length === 1 && afterRace.serviceItems[0].description === winner.shortDescription && afterRace.serviceLocations.length === 0);

  const publicProfile = await db.serviceProviderProfile.create({
    data: profileData(ownerMap.id, "Kaardi privaatsus", {
      status: "PUBLISHED",
      mapVisible: true,
      publicSlug: "map-privacy-probe",
      serviceItems: { create: [
        { name: "PUBLIC-MAP", status: "PUBLISHED", mapVisible: true },
        { name: "HIDDEN-MAP-SECRET", status: "HIDDEN", mapVisible: true },
        { name: "DRAFT-MAP-SECRET", status: "DRAFT", mapVisible: true },
        { name: "NO-MAP-SECRET", status: "PUBLISHED", mapVisible: false }
      ] },
      serviceLocations: { create: {
        label: "Avalik koht", normalizedAddress: "Tartu mnt 1, Tallinn", latitude: 59.432,
        longitude: 24.76, geocodingStatus: "MATCHED", mapVisible: true, status: "PUBLISHED"
      } }
    }),
    include: profileInclude
  });
  const publicLocation = publicProfile.serviceLocations[0];
  await db.serviceProviderServiceLocation.createMany({
    data: publicProfile.serviceItems.map(service => ({ providerServiceId: service.id, providerLocationId: publicLocation.id }))
  });
  const entry = await db.serviceMapEntry.create({ data: {
    providerProfileId: publicProfile.id,
    type: "SERVICE_PROVIDER",
    title: "Kaardi privaatsus",
    status: "PUBLISHED",
    geocodingStatus: "MATCHED",
    latitude: 59.432,
    longitude: 24.76
  } });
  const mapEntries = await listPublishedServiceMapEntries({ entryId: entry.id, includeUnlocated: true }, db);
  const mapText = JSON.stringify(mapEntries);
  expect("public map location resolves only the allowlisted published service", mapEntries.length === 1 && mapEntries[0].providerProfile.serviceItems.length === 1 && mapText.includes("PUBLIC-MAP") && !mapText.includes("HIDDEN-MAP-SECRET") && !mapText.includes("DRAFT-MAP-SECRET") && !mapText.includes("NO-MAP-SECRET"));

  const corpus = new Map();
  const send = async job => {
    corpus.set(job.documentId, { text: job.payload.text, metadata: job.payload.metadata });
    return { inserted: 1 };
  };
  const revisionA = new Date(Date.now() + 1_000);
  const ragA = await createRagProfile(ownerRagA.id, "A", revisionA);
  const payloadA = serviceProviderProfileRagPayload(ragA);
  const payloadText = JSON.stringify(payloadA);
  expect("RAG payload text metadata and counter share one public projection", payloadA.metadata.service_count === 1 && payloadText.includes("PUBLIC-A") && !payloadText.includes("HIDDEN-A") && !payloadText.includes("SECRET-A") && !payloadText.includes("DRAFT-SECRET-A") && !payloadText.includes("MAP-SECRET-A"));
  const jobA = await queueServiceProviderProfileRagJob({ db, profile: ragA, payload: payloadA, now: revisionA });
  let failFinalDbOnce = true;
  const dbFailureProxy = new Proxy(db, {
    get(target, property) {
      if (property === "$transaction" && failFinalDbOnce) {
        return async () => {
          failFinalDbOnce = false;
          throw new Error("injected-final-db-failure");
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  const firstAttempt = await processServiceProviderProfileRagJobs({ db: dbFailureProxy, send, jobId: jobA.id, now: revisionA });
  const failedJob = await db.serviceProviderProfileRagJob.findUnique({ where: { id: jobA.id } });
  expect("remote ingest success plus final DB failure leaves a durable retry", firstAttempt.failed === 1 && failedJob.status === "FAILED" && corpus.size === 1);
  const restartedAt = new Date(revisionA.getTime() + 2 * 60 * 60 * 1000);
  const restarted = await processServiceProviderProfileRagJobs({ db, send, jobId: jobA.id, now: restartedAt });
  const recoveredA = await db.serviceProviderProfile.findUnique({ where: { id: ragA.id } });
  expect("worker restart retries the deterministic document and restores the DB link", restarted.succeeded === 1 && corpus.size === 1 && recoveredA.ragSourceId === payloadA.doc_id);
  expect("RAG integration search returns zero hidden-marker hits", [...corpus.values()].filter(document => JSON.stringify(document).includes("HIDDEN-A")).length === 0);

  const revisionB = new Date(Date.now() + 4_000);
  const ragB = await createRagProfile(ownerRagB.id, "B", revisionB);
  const payloadB = serviceProviderProfileRagPayload(ragB);
  const jobB = await queueServiceProviderProfileRagJob({ db, profile: ragB, payload: payloadB, now: revisionB });
  const lost = await processServiceProviderProfileRagJobs({
    db, send, jobId: jobB.id, now: revisionB,
    afterRemoteSuccess: async () => { throw new Error("injected-response-loss"); }
  });
  const recoveredBAt = new Date(revisionB.getTime() + 2 * 60 * 60 * 1000);
  const recoveredB = await processServiceProviderProfileRagJobs({ db, send, jobId: jobB.id, now: recoveredBAt });
  expect("lost remote response remains retryable and converges after restart", lost.failed === 1 && recoveredB.succeeded === 1 && corpus.has(payloadB.doc_id));

  const revisionOld = new Date(Date.now() + 7_000);
  const ragC = await createRagProfile(ownerRagC.id, "C-OLD", revisionOld);
  const oldPayload = serviceProviderProfileRagPayload(ragC);
  const oldJob = await queueServiceProviderProfileRagJob({ db, profile: ragC, payload: oldPayload, now: revisionOld });
  const revisionNew = new Date(revisionOld.getTime() + 1_000);
  const updatedC = await db.serviceProviderProfile.update({
    where: { id: ragC.id },
    data: { organizationName: "RAG C-NEW", updatedAt: revisionNew },
    include: profileInclude
  });
  const newPayload = serviceProviderProfileRagPayload(updatedC);
  const newJob = await queueServiceProviderProfileRagJob({ db, profile: updatedC, payload: newPayload, now: revisionNew });
  const stale = await processServiceProviderProfileRagJobs({ db, send, jobId: oldJob.id, now: revisionNew });
  const fresh = await processServiceProviderProfileRagJobs({ db, send, jobId: newJob.id, now: revisionNew });
  const staleRow = await db.serviceProviderProfileRagJob.findUnique({ where: { id: oldJob.id } });
  expect("stale job is superseded and the newer revision wins", stale.superseded === 1 && fresh.succeeded === 1 && staleRow.status === "SUPERSEDED" && corpus.get(newPayload.doc_id)?.metadata?.profile_revision === revisionNew.toISOString());
  const reconciliation = await reconcileServiceProviderProfileRagJobs({
    db,
    readDocument: async documentId => corpus.has(documentId)
      ? { id: documentId, ...corpus.get(documentId).metadata }
      : null,
    repair: false
  });
  expect("reconcile check compares persisted revisions with the remote registry", reconciliation.drifted === 0 && reconciliation.consistent === 3);

  await db.serviceProviderProfile.create({ data: profileData(ownerB.id, "Teise omaniku SOLO") });
  await db.serviceProviderProfile.create({ data: profileData(null, "Omanikuta SOLO") });
  const organization = await db.organization.create({
    data: { displayName: "Organisatsiooni profiil", legalKind: "NGO", status: "DRAFT" }
  });
  await db.serviceProviderProfile.create({
    data: {
      organizationId: organization.id,
      ownershipMode: "ORGANIZATION",
      organizationName: "Organisatsiooni profiil"
    }
  });
  const exportSurface = DATA_EXPORT_REGISTRY.find(surface => surface.name === "service_provider_profile");
  const [ownerAExport, ownerBExport] = await Promise.all([
    exportSurface.collect({ db, userId: ownerA.id }),
    exportSurface.collect({ db, userId: ownerB.id })
  ]);
  const ownerACopy = ownerAExport[0].content.toString("utf8");
  const ownerBCopy = ownerBExport[0].content.toString("utf8");
  expect("data copy returns only each owner's SOLO profile with child timestamps", ownerAExport[0].count === 1 && ownerBExport[0].count === 1 && ownerACopy.includes(afterRace.organizationName) && ownerBCopy.includes("Teise omaniku SOLO") && !ownerACopy.includes("Teise omaniku SOLO") && !ownerACopy.includes("Omanikuta SOLO") && !ownerACopy.includes("Organisatsiooni profiil") && ownerACopy.includes("createdAt") && ownerACopy.includes("updatedAt"));
  await db.user.delete({ where: { id: ownerA.id } });
  const orphanAfterDeletion = await db.serviceProviderProfile.findUnique({ where: { id: initial.id } });
  expect("copy is collectable immediately before account deletion and profile then becomes ownerless", ownerACopy.length > 0 && orphanAfterDeletion?.ownerId == null);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await Promise.all([appDb.$disconnect().catch(() => null), db.$disconnect().catch(() => null)]);
}
