import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHelpWorkflowMetadata,
  loadHelpListingDetailForViewer,
  listHelpOfferListingViews,
  listHelpRequestListingViews,
  runHelpChatWorkflow,
  serializeHelpMapEntry,
  toPublicHelpListingProjection
} from "../../lib/help/index.js";

const REQUEST_OWNER = "request-owner";
const OFFER_OWNER = "offer-owner";
const STRANGER = "stranger";
const MUNICIPALITY_INTERNAL_ID = "MUNICIPALITY_INTERNAL_ID_MARKER";

const REQUEST_MARKERS = Object.freeze({
  beneficiaryLabel: "REQ_BENEFICIARY_PRIVATE_MARKER",
  urgency: "REQ_URGENCY_PRIVATE_MARKER",
  providerScopeOrConditions: "REQ_PROVIDER_SCOPE_PRIVATE_MARKER",
  skillsOrBackground: "REQ_SKILLS_PRIVATE_MARKER",
  rawPlace: "REQ_RAW_PLACE_PRIVATE_MARKER"
});

const OFFER_MARKERS = Object.freeze({
  beneficiaryLabel: "OFF_BENEFICIARY_PRIVATE_MARKER",
  urgency: "OFF_URGENCY_PRIVATE_MARKER",
  providerScopeOrConditions: "OFF_PROVIDER_SCOPE_PRIVATE_MARKER",
  skillsOrBackground: "OFF_SKILLS_PRIVATE_MARKER",
  rawPlace: "OFF_RAW_PLACE_PRIVATE_MARKER"
});

const ALL_PRIVATE_MARKERS = Object.freeze([
  ...Object.values(REQUEST_MARKERS),
  ...Object.values(OFFER_MARKERS)
]);

function taxonomy() {
  return {
    municipality: {
      id: MUNICIPALITY_INTERNAL_ID,
      slug: "safe-municipality",
      displayName: "Turvaline vald",
      county: "Turvaline maakond"
    },
    primaryCategory: {
      id: "category-internal-id",
      code: "TRANSPORT",
      labelEt: "Transport",
      labelEn: "Transport",
      labelRu: "Transport"
    },
    targetGroupLinks: [{
      targetGroupId: "target-group-internal-id",
      targetGroup: {
        id: "target-group-internal-id",
        code: "ELDER",
        labelEt: "Eakas",
        labelEn: "Elderly",
        labelRu: "Elderly"
      }
    }]
  };
}

function mapEntry(kind, markers) {
  return {
    id: `${kind.toLowerCase()}-map-entry`,
    kind,
    mapVisible: true,
    mapMode: "PHYSICAL",
    address: markers.rawPlace,
    normalizedAddress: markers.rawPlace,
    latitude: 58.5,
    longitude: 25.5,
    geocodingStatus: "MATCHED",
    county: "Turvaline maakond",
    municipalityIds: [MUNICIPALITY_INTERNAL_ID],
    serviceArea: Object.values(markers).join(" "),
    categoryCode: "TRANSPORT",
    helpType: "VOLUNTARY",
    targetGroupCodes: ["ELDER"],
    needTags: Object.values(markers),
    deliveryModes: ["REGIONAL"],
    contactMode: "PLATFORM",
    status: "PUBLISHED",
    expiresAt: null,
    privacyNote: Object.values(markers).join(" "),
    createdAt: new Date("2026-07-16T08:00:00.000Z"),
    updatedAt: new Date("2026-07-16T08:00:00.000Z")
  };
}

function privateRecord(kind, markers) {
  const isOffer = kind === "offer";
  const copiedPrivateText = Object.values(markers).join(" | ");
  return {
    id: isOffer ? "offer-private" : "request-private",
    userId: isOffer ? OFFER_OWNER : REQUEST_OWNER,
    municipalityId: MUNICIPALITY_INTERNAL_ID,
    primaryCategoryId: "category-internal-id",
    title: copiedPrivateText,
    description: copiedPrivateText,
    structuredSummary: copiedPrivateText,
    roleLabel: copiedPrivateText,
    ...markers,
    availabilityOrStart: copiedPrivateText,
    compensationDetails: copiedPrivateText,
    conditions: copiedPrivateText,
    helpType: "VOLUNTARY",
    timeType: "RECURRING",
    status: "OPEN",
    expiresAt: null,
    createdAt: new Date("2026-07-16T08:00:00.000Z"),
    updatedAt: new Date("2026-07-16T08:00:00.000Z"),
    ...taxonomy(),
    mapEntry: mapEntry(isOffer ? "HELP_OFFER" : "HELP_REQUEST", markers),
    categoryLinks: []
  };
}

function model(rows = []) {
  return {
    async findUnique({ where }) {
      const row = rows.find((item) => item.id === where.id);
      return row ? structuredClone(row) : null;
    },
    async findMany() {
      return structuredClone(rows);
    },
    async count() {
      return rows.length;
    }
  };
}

function listingDb({ requests = [], offers = [] } = {}) {
  return {
    helpRequest: model(requests),
    helpOffer: model(offers)
  };
}

function assertNoMunicipalityIdKey(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoMunicipalityIdKey(item);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.notEqual(key, "municipalityId", "avalik väljund sisaldas municipalityId võtit");
    assert.notEqual(key, "municipalityIds", "avalik väljund sisaldas municipalityIds võtit");
    assertNoMunicipalityIdKey(child);
  }
}

function assertPublicPayloadIsSafe(value, markers = ALL_PRIVATE_MARKERS) {
  const serialized = JSON.stringify(value);
  for (const marker of markers) {
    assert.ok(!serialized.includes(marker), `avalik väljund lekitas markeri ${marker}`);
  }
  assert.ok(!serialized.includes(MUNICIPALITY_INTERNAL_ID), "avalik väljund lekitas KOV-i sisemise ID");
  assertNoMunicipalityIdKey(value);
}

function assertOwnerStillSeesMarkers(listing, markers) {
  for (const [field, marker] of Object.entries(markers)) {
    assert.equal(listing[field], marker, `omanikuvaatest puudus ${field}`);
  }
}

test("HELP-P0a request kasutab detailis, globaalnimekirjas ja Teenusekaardil sama ohutut projektsiooni", async () => {
  const request = privateRecord("request", REQUEST_MARKERS);
  const db = listingDb({ requests: [request] });

  const publicDetail = await loadHelpListingDetailForViewer(
    { kind: "request", id: request.id, viewerId: STRANGER },
    db
  );
  const globalList = await listHelpRequestListingViews(
    { scope: "global", limit: 10 },
    { locale: "et" },
    db
  );
  const mapPayload = serializeHelpMapEntry({
    ...request.mapEntry,
    request,
    offer: null
  }, { locale: "et", currentUserId: STRANGER });
  const ownerDetail = await loadHelpListingDetailForViewer(
    { kind: "request", id: request.id, viewerId: REQUEST_OWNER },
    db
  );

  assert.equal(publicDetail.outcome, "ok");
  assert.equal(publicDetail.listing.title, "Abipalve: Transport - Turvaline vald");
  assert.equal(publicDetail.listing.roleLabel, "");
  assertPublicPayloadIsSafe(publicDetail.listing, Object.values(REQUEST_MARKERS));
  assertPublicPayloadIsSafe(globalList, Object.values(REQUEST_MARKERS));
  assertPublicPayloadIsSafe(mapPayload, Object.values(REQUEST_MARKERS));
  assert.equal(ownerDetail.isOwner, true);
  assertOwnerStillSeesMarkers(ownerDetail.listing, REQUEST_MARKERS);
});

test("HELP-P0a offer kasutab detailis, globaalnimekirjas ja Teenusekaardil sama ohutut projektsiooni", async () => {
  const offer = privateRecord("offer", OFFER_MARKERS);
  const db = listingDb({ offers: [offer] });

  const publicDetail = await loadHelpListingDetailForViewer(
    { kind: "offer", id: offer.id, viewerId: STRANGER },
    db
  );
  const globalList = await listHelpOfferListingViews(
    { scope: "global", limit: 10 },
    { locale: "et" },
    db
  );
  const mapPayload = serializeHelpMapEntry({
    ...offer.mapEntry,
    request: null,
    offer
  }, { locale: "et", currentUserId: STRANGER });
  const ownerDetail = await loadHelpListingDetailForViewer(
    { kind: "offer", id: offer.id, viewerId: OFFER_OWNER },
    db
  );

  assert.equal(publicDetail.outcome, "ok");
  assert.equal(publicDetail.listing.title, "Abipakkumine: Transport - Turvaline vald");
  assert.equal(publicDetail.listing.roleLabel, "");
  assertPublicPayloadIsSafe(publicDetail.listing, Object.values(OFFER_MARKERS));
  assertPublicPayloadIsSafe(globalList, Object.values(OFFER_MARKERS));
  assertPublicPayloadIsSafe(mapPayload, Object.values(OFFER_MARKERS));
  assert.equal(ownerDetail.isOwner, true);
  assertOwnerStillSeesMarkers(ownerDetail.listing, OFFER_MARKERS);
});

async function runBrowseWorkflow({ sourceKind, source, candidate }) {
  const isRequestSource = sourceKind === "request";
  const db = listingDb({
    requests: isRequestSource ? [source] : [candidate],
    offers: isRequestSource ? [candidate] : [source]
  });
  return runHelpChatWorkflow({
    message: "jätka",
    userId: source.userId,
    replyLang: "et",
    workflowState: {
      namespace: "help",
      intent: isRequestSource ? "browse_help_offers" : "browse_help_requests",
      mode: "browse",
      step: "browse",
      municipalityId: MUNICIPALITY_INTERNAL_ID,
      municipalityCandidates: [{
        id: MUNICIPALITY_INTERNAL_ID,
        displayName: "Turvaline vald",
        county: "Turvaline maakond"
      }],
      sourceRecordId: source.id,
      linkedRequestId: isRequestSource ? source.id : null,
      linkedOfferId: isRequestSource ? null : source.id
    }
  }, db);
}

test("HELP-P0b vestluse offer browse HTTP-vastus ja persisted metadata on fail-closed", async () => {
  const request = privateRecord("request", REQUEST_MARKERS);
  const offer = privateRecord("offer", OFFER_MARKERS);
  const result = await runBrowseWorkflow({ sourceKind: "request", source: request, candidate: offer });
  const persistedMetadata = buildHelpWorkflowMetadata(result.workflowState);
  const httpResponse = {
    reply: result.reply,
    workflow: persistedMetadata.workflow
  };

  assert.equal(result.handled, true);
  assert.equal(result.workflowState.browseResults.length, 1);
  assert.equal(result.workflowState.municipalityId, MUNICIPALITY_INTERNAL_ID);
  assertPublicPayloadIsSafe(httpResponse, Object.values(OFFER_MARKERS));
  assertPublicPayloadIsSafe(persistedMetadata, Object.values(OFFER_MARKERS));
});

test("HELP-P0b vestluse request browse HTTP-vastus ja persisted metadata on fail-closed", async () => {
  const request = privateRecord("request", REQUEST_MARKERS);
  const offer = privateRecord("offer", OFFER_MARKERS);
  const result = await runBrowseWorkflow({ sourceKind: "offer", source: offer, candidate: request });
  const persistedMetadata = buildHelpWorkflowMetadata(result.workflowState);
  const httpResponse = {
    reply: result.reply,
    workflow: persistedMetadata.workflow
  };

  assert.equal(result.handled, true);
  assert.equal(result.workflowState.browseResults.length, 1);
  assert.equal(result.workflowState.municipalityId, MUNICIPALITY_INTERNAL_ID);
  assertPublicPayloadIsSafe(httpResponse, Object.values(REQUEST_MARKERS));
  assertPublicPayloadIsSafe(persistedMetadata, Object.values(REQUEST_MARKERS));
});

test("HELP-P0a legacy kirje jääb fail-closed ka siis, kui algsed privaatväljad puuduvad", () => {
  const legacyMarker = "LEGACY_COPIED_PRIVATE_TEXT_MARKER";
  const legacy = privateRecord("request", REQUEST_MARKERS);
  legacy.title = legacyMarker;
  legacy.description = legacyMarker;
  legacy.structuredSummary = legacyMarker;
  legacy.roleLabel = legacyMarker;
  legacy.mapEntry.needTags = [legacyMarker];
  legacy.mapEntry.serviceArea = legacyMarker;
  delete legacy.beneficiaryLabel;
  delete legacy.urgency;
  delete legacy.providerScopeOrConditions;
  delete legacy.skillsOrBackground;
  delete legacy.rawPlace;

  const projection = toPublicHelpListingProjection(legacy, { kind: "request", locale: "et" });
  assertPublicPayloadIsSafe(projection, [legacyMarker]);
});
