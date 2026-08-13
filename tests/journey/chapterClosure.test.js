import assert from "node:assert/strict";
import test from "node:test";

import {
  JOURNEY_LIST_LIMITS,
  JOURNEY_TEXT_LIMITS
} from "../../lib/journey/constants.js";
import {
  normalizeJourneyCreateInput,
  normalizeJourneyUpdateInput
} from "../../lib/journey/validation.js";
import {
  decodeJourneyCursor,
  encodeJourneyCursor
} from "../../lib/journey/pagination.js";
import { buildJourneyExport } from "../../lib/journey/export.js";
import {
  exportJourneyForUser,
  listJourneyActivityForUser
} from "../../lib/journey/service.js";

function assertBoundary({ field, limit, makeInput, normalize = normalizeJourneyUpdateInput }) {
  const below = "x".repeat(limit - 1);
  const exact = "x".repeat(limit);
  const above = "x".repeat(limit + 1);
  assert.equal(makeInput(normalize(makeInput(below)))[field], below);
  assert.equal(makeInput(normalize(makeInput(exact)))[field], exact);
  assert.throws(
    () => normalize(makeInput(above)),
    (error) => error?.status === 400
      && error?.code === "JOURNEY_FIELD_TOO_LONG"
      && error?.field === field
      && error?.limit === limit
  );
}

function nestedTextCase(path, limit, makeContext) {
  for (const length of [limit - 1, limit]) {
    const normalized = normalizeJourneyUpdateInput({ context: makeContext("x".repeat(length)) });
    const value = path.split(".").reduce((current, key) => current[key], normalized.context);
    assert.equal(value.length, length, `${path} accepts ${length}`);
  }
  assert.throws(
    () => normalizeJourneyUpdateInput({ context: makeContext("x".repeat(limit + 1)) }),
    (error) => error?.code === "JOURNEY_FIELD_TOO_LONG" && error?.limit === limit,
    `${path} rejects ${limit + 1}`
  );
}

function nestedListCase(path, limit, makeContext) {
  const items = (count) => Array.from({ length: count }, (_, index) => `${path}-${index}`);
  for (const count of [limit - 1, limit]) {
    const normalized = normalizeJourneyUpdateInput({ context: makeContext(items(count)) });
    const value = path.split(".").reduce((current, key) => current[key], normalized.context);
    assert.equal(value.length, count, `${path} accepts ${count}`);
  }
  assert.throws(
    () => normalizeJourneyUpdateInput({ context: makeContext(items(limit + 1)) }),
    (error) => error?.code === "JOURNEY_LIST_TOO_LONG" && error?.limit === limit,
    `${path} rejects ${limit + 1}`
  );
}

test("SOL-JOUR-17: scalar and list boundaries reject instead of truncating", () => {
  for (const [field, limit] of [
    ["title", JOURNEY_TEXT_LIMITS.title],
    ["summary", JOURNEY_TEXT_LIMITS.summary]
  ]) {
    assertBoundary({
      field,
      limit,
      makeInput: (value) => typeof value === "string" ? { [field]: value } : value
    });
  }

  for (const [field, limit] of Object.entries(JOURNEY_LIST_LIMITS)) {
    if (!["domains", "missingInfo", "riskSignals", "suggestedActions"].includes(field)) continue;
    const make = (count) => Array.from({ length: count }, (_, index) => `${field}-${index}`);
    assert.equal(normalizeJourneyUpdateInput({ [field]: make(limit - 1) })[field].length, limit - 1);
    assert.equal(normalizeJourneyUpdateInput({ [field]: make(limit) })[field].length, limit);
    assert.throws(
      () => normalizeJourneyUpdateInput({ [field]: make(limit + 1) }),
      (error) => error?.status === 400
        && error?.code === "JOURNEY_LIST_TOO_LONG"
        && error?.field === field
        && error?.limit === limit
    );
  }

  const source = {
    summary: "  säilib   täpselt sisuliselt  ",
    domains: ["eluase", "töö"],
    context: { personWish: "oma kodu" }
  };
  const normalized = normalizeJourneyCreateInput(source);
  assert.equal(normalized.summary, "säilib täpselt sisuliselt");
  assert.deepEqual(normalized.domains, source.domains);
  assert.equal(normalized.context.personWish, source.context.personWish);

  for (const length of [JOURNEY_TEXT_LIMITS.contextText - 1, JOURNEY_TEXT_LIMITS.contextText]) {
    assert.equal(
      normalizeJourneyUpdateInput({ context: { personWish: "x".repeat(length) } }).context.personWish.length,
      length
    );
  }
  assert.throws(
    () => normalizeJourneyUpdateInput({ context: { personWish: "x".repeat(JOURNEY_TEXT_LIMITS.contextText + 1) } }),
    (error) => error?.code === "JOURNEY_FIELD_TOO_LONG" && error?.limit === JOURNEY_TEXT_LIMITS.contextText
  );

  const contextLimit = JOURNEY_LIST_LIMITS.contextItems;
  const contextItems = (count) => Array.from({ length: count }, (_, index) => `context-${index}`);
  assert.equal(normalizeJourneyUpdateInput({ context: { lifeDomains: contextItems(contextLimit - 1) } }).context.lifeDomains.length, contextLimit - 1);
  assert.equal(normalizeJourneyUpdateInput({ context: { lifeDomains: contextItems(contextLimit) } }).context.lifeDomains.length, contextLimit);
  assert.throws(
    () => normalizeJourneyUpdateInput({ context: { lifeDomains: contextItems(contextLimit + 1) } }),
    (error) => error?.code === "JOURNEY_LIST_TOO_LONG" && error?.limit === contextLimit
  );

  const devices = (count) => Array.from({ length: count }, (_, index) => ({ name: `device-${index}` }));
  assert.equal(normalizeJourneyUpdateInput({ context: { assistiveDevices: devices(7) } }).context.assistiveDevices.length, 7);
  assert.equal(normalizeJourneyUpdateInput({ context: { assistiveDevices: devices(8) } }).context.assistiveDevices.length, 8);
  assert.throws(
    () => normalizeJourneyUpdateInput({ context: { assistiveDevices: devices(9) } }),
    (error) => error?.code === "JOURNEY_LIST_TOO_LONG" && error?.field === "assistiveDevices"
  );

  for (const length of [JOURNEY_TEXT_LIMITS.shortItem - 1, JOURNEY_TEXT_LIMITS.shortItem]) {
    assert.equal(
      normalizeJourneyUpdateInput({ suggestedActions: [{ title: "x".repeat(length) }] }).suggestedActions[0].title.length,
      length
    );
  }
  assert.throws(
    () => normalizeJourneyUpdateInput({ suggestedActions: [{ title: "x".repeat(JOURNEY_TEXT_LIMITS.shortItem + 1) }] }),
    (error) => error?.code === "JOURNEY_FIELD_TOO_LONG" && error?.field === "suggestedActions[].title"
  );

  assertBoundary({
    field: "conversationId",
    limit: JOURNEY_TEXT_LIMITS.conversationId,
    makeInput: (value) => typeof value === "string"
      ? { summary: "summary", conversationId: value }
      : value,
    normalize: normalizeJourneyCreateInput
  });

  for (const [field, limit] of [
    ["id", 80],
    ["title", 220],
    ["description", 220],
    ["type", 60]
  ]) {
    for (const length of [limit - 1, limit]) {
      const normalized = normalizeJourneyUpdateInput({
        suggestedActions: [{ title: "action", [field]: "x".repeat(length) }]
      });
      assert.equal(normalized.suggestedActions[0][field].length, length);
    }
    assert.throws(
      () => normalizeJourneyUpdateInput({
        suggestedActions: [{ title: "action", [field]: "x".repeat(limit + 1) }]
      }),
      (error) => error?.code === "JOURNEY_FIELD_TOO_LONG" && error?.limit === limit
    );
  }

  for (const key of [
    "source", "overviewType", "personWish", "personContext", "contextNote",
    "municipalityName", "municipalityText", "municipalityId", "municipality",
    "county", "region", "kov"
  ]) {
    nestedTextCase(key, JOURNEY_TEXT_LIMITS.contextText, (value) => ({ [key]: value }));
  }

  for (const key of ["lifeDomains", "needTags", "keywords"]) {
    nestedListCase(key, JOURNEY_LIST_LIMITS.contextItems, (value) => ({ [key]: value }));
  }

  for (const [field, limit] of [
    ["id", 80], ["name", 120], ["status", 40], ["useContext", 40],
    ["issue", 300], ["supportNeed", 300]
  ]) {
    nestedTextCase(`assistiveDevices.0.${field}`, limit, (value) => ({ assistiveDevices: [{ [field]: value }] }));
  }
  for (const key of ["relatedNeedTags", "relatedLifeDomains", "relatedDocuments", "suggestedActions"]) {
    nestedListCase(`assistiveDevices.0.${key}`, 20, (value) => ({ assistiveDevices: [{ name: "device", [key]: value }] }));
  }

  for (const [field, limit] of [["categoryCode", 80], ["timing", 300], ["conditions", 500]]) {
    nestedTextCase(`helpMediation.${field}`, limit, (value) => ({ helpMediation: { [field]: value } }));
  }
  for (const key of ["needTags", "lifeDomains", "relatedServiceCategories"]) {
    nestedListCase(`helpMediation.${key}`, 20, (value) => ({ helpMediation: { [key]: value } }));
  }

  for (const field of ["serviceName", "currentProvider", "municipality", "userGoal"]) {
    nestedTextCase(`serviceContinuity.${field}`, JOURNEY_TEXT_LIMITS.contextText, (value) => ({
      serviceContinuity: { [field]: value }
    }));
  }
  for (const field of ["endDate", "updatedAt"]) {
    nestedTextCase(`serviceContinuity.${field}`, 80, (value) => ({ serviceContinuity: { [field]: value } }));
  }
  for (const field of ["userQuestion", "goal"]) {
    nestedTextCase(`healthContact.${field}`, JOURNEY_TEXT_LIMITS.contextText, (value) => ({
      healthContact: { [field]: value }
    }));
  }
});

test("SOL-JOUR-15: cursor is stable, opaque and rejects malformed input", () => {
  const row = { updatedAt: new Date("2026-08-13T10:00:00.000Z"), id: "journey_42" };
  const cursor = encodeJourneyCursor(row, "updatedAt");
  assert.doesNotMatch(cursor, /journey_42/u);
  assert.deepEqual(decodeJourneyCursor(cursor, "updatedAt"), {
    value: new Date("2026-08-13T10:00:00.000Z"),
    id: "journey_42"
  });
  assert.throws(() => decodeJourneyCursor("not-a-cursor", "updatedAt"), {
    status: 400,
    code: "JOURNEY_CURSOR_INVALID"
  });
});

test("SOL-JOUR-16: versioned export contains visible data and names deliberate exclusions", () => {
  const journey = {
    id: "journey_1",
    ownerUserId: "owner_secret",
    conversationId: "conversation_1",
    roleContext: "CLIENT",
    status: "ARCHIVED",
    sharingStatus: "PRIVATE",
    title: "Eluase",
    summary: "Täidetud kokkuvõte",
    primaryPath: "PRE_INQUIRY",
    domains: ["eluase"],
    missingInfo: ["täpsustus"],
    riskSignals: ["risk"],
    suggestedActions: [{ id: "a1", type: "REVIEW", title: "Vaata üle", description: "Kirjeldus" }],
    context: { personWish: "soov", activityLog: [{ title: "võltsitud" }] },
    createdAt: "2026-08-12T10:00:00.000Z",
    updatedAt: "2026-08-13T10:00:00.000Z"
  };
  const value = buildJourneyExport({
    journey,
    activity: [{ id: "event_1", type: "workspace.archived", occurredAt: "2026-08-13T10:00:00.000Z" }],
    linkedPreInquiries: [{ id: "pi_1", topic: "Kodu", status: "READY", createdAt: "2026-08-12T11:00:00.000Z", updatedAt: "2026-08-13T09:00:00.000Z" }],
    exportedAt: new Date("2026-08-13T12:00:00.000Z")
  });
  assert.equal(value.schemaVersion, "1.0");
  assert.equal(value.journey.riskSignals[0], "risk");
  assert.equal(value.journey.context.personWish, "soov");
  assert.equal(value.origin.conversationId, "conversation_1");
  assert.equal(value.links.preInquiries[0].id, "pi_1");
  assert.equal(value.activity[0].type, "workspace.archived");
  assert.ok(value.excludedFields.includes("ownerUserId"));
  assert.ok(value.excludedFields.includes("context.activityLog"));
  assert.equal(JSON.stringify(value).includes("owner_secret"), false);
  assert.equal(JSON.stringify(value).includes("võltsitud"), false);
});

test("SOL-JOUR-14: owner-scoped activity returns the latest server events beyond the old cap", async () => {
  const events = Array.from({ length: 61 }, (_, index) => ({
    id: `event-${String(index).padStart(2, "0")}`,
    type: index === 60 ? "workspace.archived" : "workspace.updated",
    occurredAt: new Date(1_700_000_000_000 + index * 1000)
  })).reverse();
  const db = {
    domainEvent: {
      async findMany({ where, take }) {
        assert.equal(where.actorUserId, "owner-1");
        assert.equal(where.workspaceId, "journey-1");
        return events.slice(0, take);
      },
      async count() { return events.length; }
    }
  };
  const page = await listJourneyActivityForUser("owner-1", "journey-1", { db, limit: 8 });
  assert.equal(page.totalCount, 61);
  assert.equal(page.items.length, 8);
  assert.equal(page.items[0].type, "workspace.archived");
  assert.equal(page.hasMore, true);
});

test("SOL-JOUR-16: audit failure prevents export bytes from being produced", async () => {
  const row = {
    id: "journey-1", ownerUserId: "owner-1", conversationId: null, roleContext: "CLIENT",
    status: "ACTIVE", sharingStatus: "PRIVATE", title: "Journey", summary: "Summary",
    primaryPath: null, domains: [], missingInfo: [], riskSignals: [], suggestedActions: [],
    context: {}, createdAt: new Date(), updatedAt: new Date()
  };
  const tx = {
    journey: { async findFirst() { return row; } },
    preInquiry: { async findMany() { return []; } },
    domainEvent: { async findMany() { return []; } },
    dataAuditLog: { async create() { throw Object.assign(new Error("audit unavailable"), { code: "AUDIT_DOWN" }); } }
  };
  const db = { async $transaction(callback) { return callback(tx); } };
  await assert.rejects(
    exportJourneyForUser("owner-1", "journey-1", { db }),
    { code: "AUDIT_DOWN" }
  );
});
