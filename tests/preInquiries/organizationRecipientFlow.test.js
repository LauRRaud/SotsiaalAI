import test from "node:test";
import assert from "node:assert/strict";

import {
  assertRecipientChangeAllowed,
  sendPreInquiryCorrection,
  updatePreInquiry
} from "../../lib/preInquiries.js";

const AUTHOR = "org-author";
const ORG_ID = "org-intake";
const PERSON_ID = "person-recipient";
const UPDATED_AT = new Date("2026-08-13T12:00:00.000Z");

function inquiry(overrides = {}) {
  return {
    id: "inq-org",
    authorId: AUTHOR,
    recipientOwnerId: null,
    recipientOrganizationId: ORG_ID,
    recipientEntryId: null,
    recipientServiceId: null,
    recipientLocationId: null,
    sourceJourneyId: null,
    recipientType: "ORGANIZATION_INBOX",
    deliveryChannel: "INTERNAL",
    selectedRecipientEmail: null,
    selectedRecipientName: "Tartu vastuvõtutiim",
    topic: "Eluase",
    situation: "Sünteetiline olukorra kirjeldus organisatsiooni pöördumise testiks.",
    assessmentState: null,
    generatedDraft: "Sünteetiline mustand",
    userEditedDraft: "Sünteetiline mustand",
    receiverNote: null,
    receiverChecklist: null,
    nextContactOn: null,
    status: "DRAFT",
    sentAt: null,
    openedAt: null,
    recalledAt: null,
    supersededById: null,
    externalSendConfirmedAt: null,
    createdAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    recipientEntry: null,
    recipientOrganization: { id: ORG_ID, displayName: "Tartu vastuvõtutiim", legalKind: "MUNICIPALITY" },
    author: { id: AUTHOR, email: "author@synthetic.invalid", role: "CLIENT" },
    recipientOwner: null,
    ...overrides
  };
}

function same(actual, expected) {
  if (actual instanceof Date || expected instanceof Date) {
    return new Date(actual).getTime() === new Date(expected).getTime();
  }
  return actual === expected;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some((branch) => matches(row, branch));
    return same(row?.[key], value);
  });
}

function createDb(initial, { failInbox = false } = {}) {
  const rows = new Map([[initial.id, structuredClone(initial)]]);
  const inbox = [];
  const audit = [];
  let sequence = 0;
  let updates = 0;

  const hydrate = (row) => row ? structuredClone(row) : null;
  const client = {
    preInquiry: {
      async findFirst({ where }) {
        return hydrate([...rows.values()].find((row) => matches(row, where)));
      },
      async findUnique({ where, select }) {
        const row = rows.get(where.id);
        if (!row) return null;
        if (!select) return hydrate(row);
        return Object.fromEntries(Object.keys(select).map((key) => [key, row[key] ?? null]));
      },
      async updateMany({ where, data }) {
        const row = [...rows.values()].find((candidate) => matches(candidate, where));
        if (!row) return { count: 0 };
        Object.assign(row, structuredClone(data));
        updates += 1;
        return { count: 1 };
      },
      async create({ data }) {
        const id = `inq-org-correction-${++sequence}`;
        const created = inquiry({
          ...structuredClone(data),
          id,
          openedAt: null,
          recalledAt: null,
          supersededById: null,
          recipientOrganization: data.recipientOrganizationId
            ? { id: data.recipientOrganizationId, displayName: "Tartu vastuvõtutiim", legalKind: "MUNICIPALITY" }
            : null,
          recipientOwner: data.recipientOwnerId
            ? { id: data.recipientOwnerId, email: "person@synthetic.invalid", role: "SOCIAL_WORKER" }
            : null,
          createdAt: new Date(UPDATED_AT.getTime() + sequence),
          updatedAt: new Date(UPDATED_AT.getTime() + sequence)
        });
        rows.set(id, created);
        return hydrate(created);
      }
    },
    organization: {
      async findFirst({ where }) {
        return where.id === ORG_ID
          ? { id: ORG_ID, displayName: "Tartu vastuvõtutiim", legalKind: "MUNICIPALITY" }
          : null;
      },
      async findMany() {
        return [{
          id: ORG_ID,
          displayName: "Tartu vastuvõtutiim",
          legalKind: "MUNICIPALITY",
          municipality: { displayName: "Tartu linn", county: "Tartu maakond" }
        }];
      }
    },
    organizationInboxItem: {
      async createMany({ data }) {
        if (failInbox) throw new Error("synthetic inbox failure");
        const candidate = data[0];
        if (inbox.some((item) => item.organizationId === candidate.organizationId && item.sourceId === candidate.sourceId)) {
          return { count: 0 };
        }
        inbox.push({ id: `inbox-${inbox.length + 1}`, ...structuredClone(candidate) });
        return { count: 1 };
      },
      async findFirst({ where }) {
        return hydrate(inbox.find((item) => matches(item, where)));
      }
    },
    dataAuditLog: {
      async create({ data }) {
        audit.push(structuredClone(data));
        return { id: `audit-${audit.length}`, ...data };
      }
    },
    user: {
      async findUnique({ where }) {
        return where.email === "person@synthetic.invalid"
          ? { id: PERSON_ID, acceptsPreInquiries: true }
          : null;
      }
    },
    serviceMapEntry: { async findUnique() { return null; } },
    room: { async findFirst() { return null; } },
    async $executeRaw() { return 1; },
    async $transaction(callback) {
      const rowSnapshot = structuredClone([...rows.entries()]);
      const inboxSnapshot = structuredClone(inbox);
      const auditSnapshot = structuredClone(audit);
      const beforeUpdates = updates;
      try {
        return await callback(client);
      } catch (error) {
        rows.clear();
        rowSnapshot.forEach(([id, row]) => rows.set(id, row));
        inbox.splice(0, inbox.length, ...inboxSnapshot);
        audit.splice(0, audit.length, ...auditSnapshot);
        updates = beforeUpdates;
        throw error;
      }
    }
  };

  return {
    client,
    inbox,
    audit,
    row: (id = initial.id) => hydrate(rows.get(id)),
    rows: () => [...rows.values()].map(hydrate),
    updates: () => updates
  };
}

async function withOrgInboxFlag(value, callback) {
  const previousWorkspace = process.env.ORG_WORKSPACE_ENABLED;
  const previousInbox = process.env.ORG_INBOX_ENABLED;
  process.env.ORG_WORKSPACE_ENABLED = value ? "1" : "0";
  process.env.ORG_INBOX_ENABLED = value ? "1" : "0";
  try {
    return await callback();
  } finally {
    if (previousWorkspace === undefined) delete process.env.ORG_WORKSPACE_ENABLED;
    else process.env.ORG_WORKSPACE_ENABLED = previousWorkspace;
    if (previousInbox === undefined) delete process.env.ORG_INBOX_ENABLED;
    else process.env.ORG_INBOX_ENABLED = previousInbox;
  }
}

test("public organization recipient projection exposes only a server-issued inbox id and public metadata", async () => {
  const preInquiries = await import("../../lib/preInquiries.js");
  assert.equal(typeof preInquiries.listPreInquiryOrganizationRecipients, "function");
  const db = createDb(inquiry());
  const recipients = await withOrgInboxFlag(true, () =>
    preInquiries.listPreInquiryOrganizationRecipients({ db: db.client })
  );
  assert.deepEqual(recipients, [{
    id: `organization-inbox:${ORG_ID}`,
    recipientOrganizationId: ORG_ID,
    type: "ORGANIZATION_INBOX",
    title: "Tartu vastuvõtutiim",
    legalKind: "MUNICIPALITY",
    municipalityName: "Tartu linn",
    county: "Tartu maakond",
    deliveryChannel: "INTERNAL"
  }]);
  assert.doesNotMatch(JSON.stringify(recipients), /membership|owner|email|module/iu);
});

test("content-only PATCH preserves the locked organization recipient", async () => {
  const db = createDb(inquiry());
  const result = await withOrgInboxFlag(true, () => updatePreInquiry(AUTHOR, "inq-org", {
    topic: "Uuendatud eluaseme teema",
    expectedUpdatedAt: UPDATED_AT.toISOString()
  }, { db: db.client }));

  assert.equal(result.recipientOrganizationId, ORG_ID);
  assert.equal(result.recipientOwnerId, null);
  assert.equal(result.deliveryChannel, "INTERNAL");
  assert.equal(result.selectedRecipientName, "Tartu vastuvõtutiim");
});

test("explicit organization-to-person PATCH clears only the organization recipient", async () => {
  const db = createDb(inquiry());
  const result = await withOrgInboxFlag(true, () => updatePreInquiry(AUTHOR, "inq-org", {
    recipientOrganizationId: null,
    recipientEntryId: null,
    recipientType: "KOV_CONTACT",
    selectedRecipientName: "Isiklik vastuvõtja",
    selectedRecipientEmail: "person@synthetic.invalid",
    expectedUpdatedAt: UPDATED_AT.toISOString()
  }, { db: db.client }));

  assert.equal(result.recipientOrganizationId, null);
  assert.equal(result.recipientOwnerId, PERSON_ID);
  assert.equal(result.selectedRecipientEmail, "person@synthetic.invalid");
});

test("a closed organization inbox flag fails closed instead of silently changing the recipient", async () => {
  const db = createDb(inquiry());
  const error = await withOrgInboxFlag(false, () => updatePreInquiry(AUTHOR, "inq-org", {
    topic: "Ei tohi adressaati kaotada",
    expectedUpdatedAt: UPDATED_AT.toISOString()
  }, { db: db.client })).then(() => null, (reason) => reason);

  assert.equal(error?.status, 409);
  assert.equal(error?.message, "pre_inquiries.errors.recipient_channel_changed");
  assert.equal(db.row().recipientOrganizationId, ORG_ID);
  assert.equal(db.updates(), 0);
});

test("organization recipient changes are blocked after a canonical room exists", async () => {
  const error = await assertRecipientChangeAllowed({
    room: { async findFirst() { return { id: "room-org" }; } }
  }, {
    inquiryId: "inq-org",
    previousRecipientOwnerId: null,
    nextRecipientOwnerId: null,
    previousRecipientOrganizationId: ORG_ID,
    nextRecipientOrganizationId: "org-other"
  }).then(() => null, (reason) => reason);

  assert.equal(error?.status, 409);
  assert.equal(error?.message, "pre_inquiries.errors.recipient_locked_by_room");
});

test("organization correction creates one inbox item before linking and retries idempotently", async () => {
  const opened = inquiry({
    status: "SENT",
    sentAt: new Date("2026-08-13T11:00:00.000Z"),
    openedAt: new Date("2026-08-13T11:30:00.000Z")
  });
  const db = createDb(opened);
  const input = {
    expectedUpdatedAt: UPDATED_AT.toISOString(),
    situation: "Parandatud sünteetiline olukord.",
    correctionText: "Parandatud sünteetiline pöördumine."
  };

  const first = await withOrgInboxFlag(true, () =>
    sendPreInquiryCorrection(AUTHOR, opened.id, input, { db: db.client })
  );
  assert.equal(first.created, true);
  assert.equal(first.inquiry.recipientOrganizationId, ORG_ID);
  assert.equal(first.inquiry.recipientOwnerId, null);
  assert.equal(first.inquiry.recipientOrganization.displayName, "Tartu vastuvõtutiim");
  assert.equal(db.inbox.length, 1);
  assert.equal(db.inbox[0].sourceId, first.inquiry.id);
  assert.equal(db.row(opened.id).supersededById, first.inquiry.id);

  const repeated = await withOrgInboxFlag(true, () =>
    sendPreInquiryCorrection(AUTHOR, opened.id, { ...input, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }, { db: db.client })
  );
  assert.equal(repeated.created, false);
  assert.equal(repeated.inquiry.id, first.inquiry.id);
  assert.equal(db.inbox.length, 1);
});

test("organization inbox failure rolls back replacement and supersession link", async () => {
  const opened = inquiry({
    status: "SENT",
    sentAt: new Date("2026-08-13T11:00:00.000Z"),
    openedAt: new Date("2026-08-13T11:30:00.000Z")
  });
  const db = createDb(opened, { failInbox: true });

  await assert.rejects(
    withOrgInboxFlag(true, () => sendPreInquiryCorrection(AUTHOR, opened.id, {
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      situation: "Parandatud sünteetiline olukord.",
      correctionText: "Parandatud sünteetiline pöördumine."
    }, { db: db.client })),
    /synthetic inbox failure/u
  );
  assert.equal(db.rows().length, 1);
  assert.equal(db.row(opened.id).supersededById, null);
  assert.equal(db.inbox.length, 0);
});
