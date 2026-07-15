import test from "node:test";
import assert from "node:assert/strict";

import {
  loadHelpListingDetailForViewer,
  listHelpRequestListingViews,
  listHelpOfferListingViews,
  listPublishedHelpMapEntries
} from "../../lib/help/index.js";

// ---------------------------------------------------------------------------
// Faithful in-memory prisma. The service functions under test build the real
// `where` object; this store APPLIES that where (AND/OR/NOT/eq/gt/in/not/has/
// contains). No test hand-builds a where — the store only evaluates what the
// real code produced, so a broken filter fails the assertion.
// ---------------------------------------------------------------------------

function matchesCondition(value, cond) {
  if (cond === null) return value === null || value === undefined;
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    if ("gt" in cond) return value != null && new Date(value).getTime() > new Date(cond.gt).getTime();
    if ("gte" in cond) return value != null && new Date(value).getTime() >= new Date(cond.gte).getTime();
    if ("lt" in cond) return value != null && new Date(value).getTime() < new Date(cond.lt).getTime();
    if ("in" in cond) return Array.isArray(cond.in) && cond.in.includes(value);
    if ("has" in cond) return Array.isArray(value) && value.includes(cond.has);
    if ("not" in cond) {
      if (cond.not === null) return value !== null && value !== undefined;
      return value !== cond.not;
    }
    if ("contains" in cond) {
      const hay = String(value ?? "");
      const needle = String(cond.contains ?? "");
      return cond.mode === "insensitive"
        ? hay.toLowerCase().includes(needle.toLowerCase())
        : hay.includes(needle);
    }
    return false;
  }
  return value === cond;
}

function matchesWhere(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      if (!(cond || []).every((clause) => matchesWhere(row, clause))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(cond || []).some((clause) => matchesWhere(row, clause))) return false;
      continue;
    }
    if (key === "NOT") {
      if (matchesWhere(row, cond)) return false;
      continue;
    }
    if (!matchesCondition(row[key], cond)) return false;
  }
  return true;
}

function makeModel(rows) {
  return {
    async findUnique({ where }) {
      const row = rows.find((item) => item.id === where.id);
      return row ? structuredClone(row) : null;
    },
    async findMany({ where, orderBy, skip = 0, take } = {}) {
      let out = rows.filter((item) => matchesWhere(item, where));
      if (Array.isArray(orderBy) && orderBy.length) {
        out = out.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      if (skip) out = out.slice(skip);
      if (take != null) out = out.slice(0, take);
      return structuredClone(out);
    },
    async count({ where } = {}) {
      return rows.filter((item) => matchesWhere(item, where)).length;
    }
  };
}

function makeDb({ requests = [], offers = [], mapEntries = [] } = {}) {
  return {
    helpRequest: makeModel(requests),
    helpOffer: makeModel(offers),
    helpMapEntry: makeModel(mapEntries)
  };
}

const OWNER = "owner-1";
const STRANGER = "stranger-2";
const ADMIN = "admin-3";

// Private markers must NEVER surface in a non-owner projection.
const PRIVATE_MARKERS = [
  "RAWPLACE_PRIVATE",
  "BENEFICIARY_PRIVATE",
  "URGENCY_PRIVATE",
  "SKILLS_PRIVATE",
  "PROVIDERSCOPE_PRIVATE",
  "EXACT_ADDRESS_PRIVATE",
  "EXACT_NORMALIZED_PRIVATE"
];

function requestRecord(over = {}) {
  return {
    id: "req-open",
    userId: OWNER,
    municipalityId: "mun-1",
    primaryCategoryId: "cat-1",
    title: "Vajan transporti",
    description: "Avalik kirjeldus transpordist.",
    structuredSummary: "Kokkuvõte",
    roleLabel: "eakas",
    beneficiaryLabel: "BENEFICIARY_PRIVATE",
    urgency: "URGENCY_PRIVATE",
    availabilityOrStart: "õhtuti",
    compensationDetails: "tasuta",
    conditions: "Avalik tingimus",
    skillsOrBackground: "SKILLS_PRIVATE",
    rawPlace: "RAWPLACE_PRIVATE",
    helpType: "VOLUNTARY",
    timeType: "RECURRING",
    status: "OPEN",
    classificationSource: "USER",
    classificationConfidence: null,
    userConfirmedAt: new Date("2026-07-14T09:00:00.000Z"),
    expiresAt: null,
    createdAt: new Date("2026-07-14T09:00:00.000Z"),
    updatedAt: new Date("2026-07-14T09:00:00.000Z"),
    municipality: { id: "mun-1", slug: "paide", displayName: "Paide", county: "Järva maakond" },
    primaryCategory: { id: "cat-1", code: "TRANSPORT", labelEt: "Transport", labelEn: "Transport", labelRu: "Транспорт" },
    targetGroupLinks: [
      { targetGroupId: "tg-1", targetGroup: { id: "tg-1", code: "ELDERLY", labelEt: "Eakas", labelEn: "Elderly", labelRu: "Пожилой" } }
    ],
    mapEntry: {
      id: "me-req",
      kind: "HELP_REQUEST",
      mapVisible: true,
      mapMode: "PHYSICAL",
      address: "EXACT_ADDRESS_PRIVATE",
      normalizedAddress: "EXACT_NORMALIZED_PRIVATE",
      latitude: 58.8854,
      longitude: 25.5573,
      geocodingStatus: "MATCHED",
      county: "Järva maakond",
      municipalityIds: ["mun-1"],
      serviceArea: "Paide",
      categoryCode: "TRANSPORT",
      helpType: "VOLUNTARY",
      targetGroupCodes: ["ELDERLY"],
      needTags: [],
      deliveryModes: ["ON_SITE"],
      contactMode: "PLATFORM",
      status: "PUBLISHED",
      expiresAt: null,
      privacyNote: "Kaardil kasutatakse üldistatud piirkonda; täpset koduaadressi ei avaldata."
    },
    ...over
  };
}

function offerRecord(over = {}) {
  return {
    ...requestRecord(),
    id: "off-open",
    title: "Pakun transporti",
    description: "Avalik pakkumine transpordist.",
    beneficiaryLabel: null,
    urgency: null,
    providerScopeOrConditions: "PROVIDERSCOPE_PRIVATE",
    mapEntry: { ...requestRecord().mapEntry, id: "me-off", kind: "HELP_OFFER" },
    ...over
  };
}

function serializedHasNoPrivateMarkers(listing) {
  const blob = JSON.stringify(listing);
  for (const marker of PRIVATE_MARKERS) {
    assert.ok(!blob.includes(marker), `avalik projektsioon lekitas privaatvälja: ${marker}`);
  }
}

// ===========================================================================
// DETAIL VISIBILITY (V1) — loadHelpListingDetailForViewer on siduv leping
// ===========================================================================

test("1. omanik loeb enda DRAFT kirjet -> lubatud + omanikuprojektsioon", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "DRAFT" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: OWNER },
    db
  );
  assert.equal(result.outcome, "ok");
  assert.equal(result.isOwner, true);
  // Omanik NÄEB oma privaatvälju (töövoog säilib) — regressioonivalve.
  assert.equal(result.listing.rawPlace, "RAWPLACE_PRIVATE");
  assert.equal(result.listing.editableRawPlace, "RAWPLACE_PRIVATE");
  assert.equal(result.listing.beneficiaryLabel, "BENEFICIARY_PRIVATE");
});

test("2. võõras loeb DRAFT kirjet -> not_found (404)", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "DRAFT" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    db
  );
  assert.deepEqual(result, { outcome: "not_found" });
});

test("3. võõras loeb CLOSED kirjet -> not_found (404)", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "CLOSED" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    db
  );
  assert.deepEqual(result, { outcome: "not_found" });
});

test("4. võõras loeb CANCELLED kirjet -> not_found (404)", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "CANCELLED" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    db
  );
  assert.deepEqual(result, { outcome: "not_found" });
});

test("5. võõras loeb ARCHIVED kirjet -> not_found (404)", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "ARCHIVED" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    db
  );
  assert.deepEqual(result, { outcome: "not_found" });
});

test("5b. võõras loeb MATCHED kirjet -> not_found (ainult OPEN on avalik)", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "MATCHED" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    db
  );
  assert.deepEqual(result, { outcome: "not_found" });
});

test("6. võõras loeb OPEN kirjet -> lubatud, kuid privaatväljad puuduvad", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "OPEN" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    db
  );
  assert.equal(result.outcome, "ok");
  assert.equal(result.isOwner, false);
  assert.equal(result.listing.isOwn, false);
  // Avalik sisu on olemas
  assert.equal(result.listing.title, "Vajan transporti");
  assert.equal(result.listing.description, "Avalik kirjeldus transpordist.");
  // Privaatväljad fail-closed puuduvad
  assert.equal(result.listing.rawPlace, undefined);
  assert.equal(result.listing.editableRawPlace, undefined);
  assert.equal(result.listing.beneficiaryLabel, undefined);
  assert.equal(result.listing.urgency, undefined);
  assert.equal(result.listing.skillsOrBackground, undefined);
  assert.equal(result.listing.structuredSummary, undefined);
  assert.equal(result.listing.municipalityId, undefined);
  assert.equal(result.listing.primaryCategoryId, undefined);
  // Täpne asukoht/koordinaat ei tohi kusagil olla
  assert.equal(result.listing.mapEntry, undefined);
  serializedHasNoPrivateMarkers(result.listing);
});

test("7. anonüümne vaataja OPEN kirjel ei saa privaatprojektsiooni (teenusekiht)", async () => {
  // NB: route jõustab 401 enne siia jõudmist; teenusekiht käitleb anonüümset
  // kui võõrast — OPEN -> avalik projektsioon, mitteavalik -> not_found.
  const db = makeDb({ requests: [requestRecord({ status: "DRAFT" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: "" },
    db
  );
  assert.deepEqual(result, { outcome: "not_found" });
});

test("8. ADMIN (mitteomanik) ei näe võõra DRAFT-i ilma eraldi lepinguta", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "DRAFT" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: ADMIN },
    db
  );
  assert.deepEqual(result, { outcome: "not_found" });
});

// ===========================================================================
// GLOBAL LIST FLOOR (V2) — listHelp*ListingViews
// ===========================================================================

function mixedRequestStore() {
  return [
    requestRecord({ id: "r-open", status: "OPEN", createdAt: new Date("2026-07-14T09:00:00.000Z") }),
    requestRecord({ id: "r-draft", status: "DRAFT", createdAt: new Date("2026-07-14T08:00:00.000Z") }),
    requestRecord({ id: "r-closed", status: "CLOSED", createdAt: new Date("2026-07-14T07:00:00.000Z") }),
    requestRecord({ id: "r-cancelled", status: "CANCELLED", createdAt: new Date("2026-07-14T06:00:00.000Z") }),
    requestRecord({ id: "r-archived", status: "ARCHIVED", createdAt: new Date("2026-07-14T05:00:00.000Z") }),
    requestRecord({ id: "r-open-other", userId: STRANGER, status: "OPEN", createdAt: new Date("2026-07-14T04:00:00.000Z") }),
    requestRecord({ id: "r-draft-other", userId: STRANGER, status: "DRAFT", createdAt: new Date("2026-07-14T03:00:00.000Z") })
  ];
}

test("9. globaalne loend ilma staatuseta sisaldab ainult OPEN kirjeid", async () => {
  const db = makeDb({ requests: mixedRequestStore() });
  const items = await listHelpRequestListingViews(
    { scope: "global", excludeUserId: OWNER, limit: 50 },
    { locale: "et" },
    db
  );
  assert.ok(items.length > 0);
  for (const item of items) {
    assert.equal(item.statusLabel !== undefined, true);
  }
  // Ainult võõra OPEN kirje (r-open-other) — mitte ükski DRAFT/CLOSED/...
  const ids = items.map((item) => item.id);
  assert.deepEqual(ids, ["r-open-other"]);
});

test("10. globaalne loend parameetriga status=DRAFT ei laienda nähtavust", async () => {
  const db = makeDb({ requests: mixedRequestStore() });
  const items = await listHelpRequestListingViews(
    { scope: "global", excludeUserId: OWNER, status: "DRAFT", limit: 50 },
    { locale: "et" },
    db
  );
  assert.deepEqual(items.map((item) => item.id), ["r-open-other"]);
});

test("11. globaalne loend status=CLOSED/CANCELLED/ARCHIVED ei laienda nähtavust", async () => {
  for (const status of ["CLOSED", "CANCELLED", "ARCHIVED"]) {
    const db = makeDb({ requests: mixedRequestStore() });
    const items = await listHelpRequestListingViews(
      { scope: "global", excludeUserId: OWNER, status, limit: 50 },
      { locale: "et" },
      db
    );
    assert.deepEqual(
      items.map((item) => item.id),
      ["r-open-other"],
      `status=${status} ei tohi laiendada`
    );
  }
});

test("12. scope=mine säilitab omaniku töövoo (näeb oma DRAFT-i)", async () => {
  const db = makeDb({ requests: mixedRequestStore() });
  // Omanik küsib oma DRAFT-e
  const drafts = await listHelpRequestListingViews(
    { scope: "mine", userId: OWNER, status: "DRAFT", limit: 50 },
    { locale: "et" },
    db
  );
  assert.deepEqual(drafts.map((item) => item.id), ["r-draft"]);
  // Omanik küsib kõiki oma kirjeid (staatuseta) -> näeb kõiki oma staatuseid
  const all = await listHelpRequestListingViews(
    { scope: "mine", userId: OWNER, limit: 50 },
    { locale: "et" },
    db
  );
  const ids = all.map((item) => item.id).sort();
  assert.deepEqual(ids, ["r-archived", "r-cancelled", "r-closed", "r-draft", "r-open"]);
});

test("13. abisoov ja abipakkumine käituvad võrdselt (offer-põrand)", async () => {
  const offers = [
    offerRecord({ id: "o-open", status: "OPEN", createdAt: new Date("2026-07-14T09:00:00.000Z") }),
    offerRecord({ id: "o-draft", userId: STRANGER, status: "DRAFT", createdAt: new Date("2026-07-14T08:00:00.000Z") }),
    offerRecord({ id: "o-open-other", userId: STRANGER, status: "OPEN", createdAt: new Date("2026-07-14T07:00:00.000Z") })
  ];
  const db = makeDb({ offers });
  const globalItems = await listHelpOfferListingViews(
    { scope: "global", excludeUserId: OWNER, status: "DRAFT", limit: 50 },
    { locale: "et" },
    db
  );
  assert.deepEqual(globalItems.map((item) => item.id), ["o-open-other"]);

  const mineItems = await listHelpOfferListingViews(
    { scope: "mine", userId: STRANGER, status: "DRAFT", limit: 50 },
    { locale: "et" },
    db
  );
  assert.deepEqual(mineItems.map((item) => item.id), ["o-draft"]);
});

test("14. globaalne loend ei väljasta rawPlace ega privaatvälju", async () => {
  const db = makeDb({ requests: mixedRequestStore() });
  const items = await listHelpRequestListingViews(
    { scope: "global", excludeUserId: OWNER, limit: 50 },
    { locale: "et" },
    db
  );
  assert.ok(items.length > 0);
  serializedHasNoPrivateMarkers(items);
  for (const item of items) {
    assert.equal(item.rawPlace, undefined);
    assert.equal(item.beneficiaryLabel, undefined);
    assert.equal(item.urgency, undefined);
  }
});

test("15. võõra mitteavaliku ID olemasolu ei ole 404 kuju kaudu eristatav", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "DRAFT" })] });
  const missing = await loadHelpListingDetailForViewer(
    { kind: "request", id: "does-not-exist", viewerId: STRANGER },
    db
  );
  const hiddenDraft = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    db
  );
  const hiddenClosedDb = makeDb({ requests: [requestRecord({ status: "CLOSED" })] });
  const hiddenClosed = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: STRANGER },
    hiddenClosedDb
  );
  // Kõik kolm tagastavad bait-identse tulemuse -> route -> identne 404 keha.
  assert.deepEqual(missing, { outcome: "not_found" });
  assert.deepEqual(hiddenDraft, { outcome: "not_found" });
  assert.deepEqual(hiddenClosed, { outcome: "not_found" });
  assert.deepEqual(missing, hiddenDraft);
  assert.deepEqual(hiddenDraft, hiddenClosed);
});

test("16. omanikuprojektsioon säilitab redigeerimisvoo (publish/edit regressioonivalve)", async () => {
  const db = makeDb({ requests: [requestRecord({ status: "OPEN" })] });
  const result = await loadHelpListingDetailForViewer(
    { kind: "request", id: "req-open", viewerId: OWNER },
    db
  );
  assert.equal(result.outcome, "ok");
  assert.equal(result.isOwner, true);
  // Redigeerimisvoo väljad peavad omanikule alles jääma
  for (const field of ["editableTitle", "editableDescription", "editableRawPlace", "status", "primaryCategoryCode"]) {
    assert.ok(field in result.listing, `omanikuprojektsioonist puudub väli: ${field}`);
  }
  assert.equal(result.listing.editableTitle, "Vajan transporti");
});

test("17. teenusekaart saab jätkuvalt ainult avaldamiseks lubatud kirjed", async () => {
  const publishedEntry = {
    id: "hme-published",
    kind: "HELP_REQUEST",
    requestId: "req-open",
    offerId: null,
    mapVisible: true,
    mapMode: "AREA",
    address: null,
    normalizedAddress: null,
    latitude: 58.8854,
    longitude: 25.5573,
    geocodingStatus: "MATCHED",
    county: "Järva maakond",
    municipalityIds: ["mun-1"],
    serviceArea: "Paide",
    categoryCode: "TRANSPORT",
    helpType: "VOLUNTARY",
    targetGroupCodes: ["ELDERLY"],
    needTags: [],
    deliveryModes: ["REGIONAL"],
    contactMode: "PLATFORM",
    status: "PUBLISHED",
    expiresAt: null,
    privacyNote: "Üldistatud piirkond.",
    createdAt: new Date("2026-07-14T09:00:00.000Z"),
    updatedAt: new Date("2026-07-14T09:00:00.000Z"),
    request: requestRecord({ status: "OPEN" }),
    offer: null
  };
  const reviewEntry = {
    ...publishedEntry,
    id: "hme-review",
    status: "REVIEW",
    request: requestRecord({ id: "req-review", status: "OPEN" })
  };
  const db = makeDb({ mapEntries: [publishedEntry, reviewEntry] });
  const entries = await listPublishedHelpMapEntries({ locale: "et" }, db);
  const ids = entries.map((entry) => entry.id);
  assert.ok(ids.includes("hme-published"), "avaldatud kaardikirje peab olema nähtav");
  assert.ok(!ids.includes("hme-review"), "REVIEW kaardikirje ei tohi olla nähtav");
});
