import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  getJourneyDetailForUser,
  listLinkedPreInquiriesForJourney
} from "../../lib/journey/service.js";

// A1 read side: the journey owner sees the minimal info of the pre-inquiries
// created from that journey. Dependency-injected fake-Prisma; owner scoping and
// field minimisation are what is under test here.

const OWNER = "user_owner";
const OTHER = "user_other";

function journeyRow(id, ownerUserId) {
  return {
    id,
    ownerUserId,
    conversationId: null,
    roleContext: "CLIENT",
    status: "ACTIVE",
    sharingStatus: "PRIVATE",
    title: `Journey ${id}`,
    summary: "Summary",
    primaryPath: "PRE_INQUIRY",
    domains: [],
    missingInfo: [],
    riskSignals: [],
    suggestedActions: [],
    context: {},
    createdAt: new Date("2026-07-10T09:00:00.000Z"),
    updatedAt: new Date("2026-07-11T09:00:00.000Z")
  };
}

function preInquiryRow(id, { sourceJourneyId, authorId, status = "DRAFT", topic = "Teema", updatedAt }) {
  return {
    id,
    sourceJourneyId,
    authorId,
    topic,
    status,
    // extra fields that must NOT leak through the minimal select
    situation: "PRIVATE BODY",
    userEditedDraft: "PRIVATE DRAFT",
    selectedRecipientEmail: "kov@example.test",
    createdAt: new Date("2026-07-12T09:00:00.000Z"),
    updatedAt: updatedAt || new Date("2026-07-12T10:00:00.000Z")
  };
}

function createFakeDb({ journeys = [], preInquiries = [], onFindMany } = {}) {
  return {
    journey: {
      async findFirst({ where }) {
        const row = journeys.find(
          (j) => j.id === where.id && j.ownerUserId === where.ownerUserId
        );
        return row ? { ...row } : null;
      }
    },
    preInquiry: {
      async findMany({ where, select, take }) {
        if (onFindMany) onFindMany();
        const selectKeys = Object.keys(select || {});
        const rows = preInquiries
          .filter(
            (p) => p.sourceJourneyId === where.sourceJourneyId && p.authorId === where.authorId
          )
          .slice()
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        // emulate Prisma `select`: only requested columns come back
        return rows.slice(0, take).map((row) =>
          Object.fromEntries(selectKeys.map((key) => [key, row[key]]))
        );
      },
      async count({ where }) {
        return preInquiries.filter(
          (p) => p.sourceJourneyId === where.sourceJourneyId && p.authorId === where.authorId
        ).length;
      }
    },
    domainEvent: { async findMany() { return []; }, async count() { return 0; } }
  };
}

test("#5 listLinkedPreInquiriesForJourney returns only that journey's inquiries, owner-scoped", async () => {
  const db = createFakeDb({
    journeys: [journeyRow("journey_a", OWNER), journeyRow("journey_b", OWNER)],
    preInquiries: [
      preInquiryRow("pi_a1", { sourceJourneyId: "journey_a", authorId: OWNER }),
      preInquiryRow("pi_a2", { sourceJourneyId: "journey_a", authorId: OWNER, updatedAt: new Date("2026-07-12T12:00:00.000Z") }),
      preInquiryRow("pi_b1", { sourceJourneyId: "journey_b", authorId: OWNER }),
      // linked to journey_a but authored by someone else -> must never appear
      preInquiryRow("pi_foreign", { sourceJourneyId: "journey_a", authorId: OTHER })
    ]
  });

  const { items: rows } = await listLinkedPreInquiriesForJourney(OWNER, "journey_a", { db });
  const ids = rows.map((r) => r.id);

  assert.deepEqual(ids, ["pi_a2", "pi_a1"], "only journey_a's own inquiries, newest first");
  assert.ok(!ids.includes("pi_b1"));
  assert.ok(!ids.includes("pi_foreign"));
});

test("#5 minimal info only: id/topic/status/timestamps, never the pre-inquiry body", async () => {
  const db = createFakeDb({
    journeys: [journeyRow("journey_a", OWNER)],
    preInquiries: [preInquiryRow("pi_a1", { sourceJourneyId: "journey_a", authorId: OWNER, topic: "Eluase", status: "READY" })]
  });

  const { items: [row] } = await listLinkedPreInquiriesForJourney(OWNER, "journey_a", { db });

  assert.deepEqual(Object.keys(row).sort(), ["createdAt", "id", "status", "topic", "updatedAt"]);
  assert.equal(row.topic, "Eluase");
  assert.equal(row.status, "READY");
  assert.equal(typeof row.createdAt, "string", "timestamps serialized to ISO strings");
  assert.equal(typeof row.updatedAt, "string");
  assert.ok(!("situation" in row));
  assert.ok(!("userEditedDraft" in row));
  assert.ok(!("selectedRecipientEmail" in row));
  assert.ok(!("sourceJourneyId" in row));
});

test("#7 status feedback passes through the active enum values correctly", async () => {
  const statuses = ["DRAFT", "READY", "SENT", "DOWNLOADED", "ARCHIVED"];
  const db = createFakeDb({
    journeys: [journeyRow("journey_a", OWNER)],
    preInquiries: statuses.map((status, index) =>
      preInquiryRow(`pi_${status}`, {
        sourceJourneyId: "journey_a",
        authorId: OWNER,
        status,
        updatedAt: new Date(`2026-07-12T${String(9 + index).padStart(2, "0")}:00:00.000Z`)
      })
    )
  });

  const { items: rows } = await listLinkedPreInquiriesForJourney(OWNER, "journey_a", { db });
  assert.deepEqual(rows.map((r) => r.status).sort(), statuses.slice().sort());
});

test("getJourneyDetailForUser returns the journey plus its linked pre-inquiries for the owner", async () => {
  const db = createFakeDb({
    journeys: [journeyRow("journey_a", OWNER)],
    preInquiries: [
      preInquiryRow("pi_a1", { sourceJourneyId: "journey_a", authorId: OWNER }),
      preInquiryRow("pi_b1", { sourceJourneyId: "journey_b", authorId: OWNER })
    ]
  });

  const detail = await getJourneyDetailForUser(OWNER, "journey_a", { db });

  assert.equal(detail.id, "journey_a");
  assert.ok(Array.isArray(detail.linkedPreInquiries));
  assert.deepEqual(detail.linkedPreInquiries.map((r) => r.id), ["pi_a1"]);
});

test("getJourneyDetailForUser gives a generic 404 for a foreign/missing journey and never reads its pre-inquiries", async () => {
  let findManyCalls = 0;
  const db = createFakeDb({
    journeys: [journeyRow("journey_a", OWNER)],
    preInquiries: [preInquiryRow("pi_a1", { sourceJourneyId: "journey_a", authorId: OWNER })],
    onFindMany: () => {
      findManyCalls += 1;
    }
  });

  const error = await getJourneyDetailForUser(OTHER, "journey_a", { db }).then(
    () => null,
    (err) => err
  );

  assert.ok(error instanceof Error);
  assert.equal(error.status, 404);
  assert.equal(error.message, "journeys.errors.not_found");
  assert.equal(findManyCalls, 0, "must reject on ownership before touching pre-inquiries");
});

test("listLinkedPreInquiriesForJourney returns an empty list for a journey with no inquiries", async () => {
  const db = createFakeDb({
    journeys: [journeyRow("journey_a", OWNER)],
    preInquiries: []
  });
  const page = await listLinkedPreInquiriesForJourney(OWNER, "journey_a", { db });
  assert.deepEqual(page.items, []);
  assert.equal(page.totalCount, 0);
});

test("journey pre-inquiry UI clears a stale source before starting an unrelated inquiry", async () => {
  const source = await readFile(
    new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url),
    "utf8"
  );
  const newInquiryHandler = source.match(
    /function handleNewInquiry\(\) \{(?<body>[\s\S]*?)\n  \}/u
  )?.groups?.body || "";

  assert.match(newInquiryHandler, /setJourneySourceId\(""\)/u);
});

test("journey back-link can load an authored inquiry outside the capped visible list", async () => {
  const source = await readFile(
    new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url),
    "utf8"
  );

  assert.match(
    source,
    /fetch\(`\/api\/pre-inquiries\/\$\{encodeURIComponent\(requestedId\)\}`/u
  );
  assert.match(source, /requestedInquiry\.authorId !== currentUserId/u);
});

test("journey links can request the authored client view for specialist accounts", async () => {
  const source = await readFile(
    new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url),
    "utf8"
  );

  assert.match(
    source,
    /clientAuthoringRequested\s*\?\s*"CLIENT"\s*:\s*normalizeWorkspaceRole\(session\?\.user\?\.role\)/u
  );
});
