import test from "node:test";
import assert from "node:assert/strict";

import {
  assistPreInquiry,
  confirmExternalPreInquirySent,
  createPreInquiry,
  updatePreInquiry
} from "../../lib/preInquiries.js";

const AUTHOR = "user_author";

function entry(overrides = {}) {
  return {
    id: "entry-a",
    type: "KOV_SOCIAL_CONTACT",
    status: "PUBLISHED",
    title: "Tartu sotsiaalosakond",
    description: "Eluaseme ja toimetuleku nõustamine Tartu elanikele",
    email: "tartu@example.test",
    phone: "+372 700 0000",
    address: "Tartu",
    county: "Tartu maakond",
    municipalityName: "Tartu linn",
    providerProfileId: null,
    providerProfile: null,
    ...overrides
  };
}

function createdRow(data) {
  return {
    id: "inquiry-1",
    authorId: AUTHOR,
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: new Date("2026-08-13T08:00:00.000Z"),
    sentAt: null,
    externalSendConfirmedAt: null,
    openedAt: null,
    recalledAt: null,
    supersededById: null,
    receiverNote: null,
    receiverChecklist: null,
    recipientEntry: null,
    author: null,
    recipientOwner: null,
    ...data
  };
}

function createDb(entries) {
  const writes = [];
  return {
    writes,
    serviceMapEntry: {
      async findFirst({ where }) {
        return entries.find((item) => item.id === where.id && item.status === where.status) || null;
      },
      async findMany({ where }) {
        const allowed = Array.isArray(where.status?.in) ? where.status.in : [where.status];
        return entries.filter((item) => allowed.includes(item.status));
      }
    },
    user: {
      async findUnique({ where }) {
        return where.email === "other@example.test"
          ? { id: "other-user", acceptsPreInquiries: true }
          : null;
      },
      async findMany() { return []; }
    },
    preInquiry: {
      async create({ data }) {
        writes.push(data);
        return createdRow(data);
      }
    }
  };
}

const baseInput = {
  topic: "Eluase",
  situation: "Vajan eluaseme ja toimetuleku küsimuses nõustamist."
};

test("assistant exposes only published entries to clients and admins", async () => {
  const db = createDb([
    entry(),
    entry({ id: "review", status: "NEEDS_REVIEW", title: "Ülevaatamata kontakt" }),
    entry({ id: "draft", status: "DRAFT", title: "Mustandkontakt" }),
    entry({ id: "hidden", status: "HIDDEN", title: "Peidetud kontakt" })
  ]);

  for (const activeRole of ["CLIENT", "ADMIN"]) {
    const result = await assistPreInquiry({
      ...baseInput,
      municipality: "Tartu linn",
      selectedNeedAreas: ["eluase"],
      activeRole
    }, { db });
    assert.deepEqual(result.suggestions.map((item) => item.id), ["entry-a"]);
  }
});

test("unpublished recipient id yields the same 404 and no create for every unpublished state", async () => {
  for (const status of ["NEEDS_REVIEW", "DRAFT", "HIDDEN"]) {
    const db = createDb([entry({ status })]);
    const error = await createPreInquiry(AUTHOR, {
      ...baseInput,
      recipientEntryId: "entry-a",
      selectedRecipientName: "Tartu sotsiaalosakond",
      selectedRecipientEmail: "tartu@example.test"
    }, { db }).then(() => null, (reason) => reason);

    assert.equal(error?.status, 404, status);
    assert.equal(error?.message, "api.common.not_found", status);
    assert.equal(db.writes.length, 0, status);
  }
});

test("entry A plus email B is rejected before create, while manual email remains a separate route", async () => {
  const db = createDb([entry()]);
  const error = await createPreInquiry(AUTHOR, {
    ...baseInput,
    recipientEntryId: "entry-a",
    selectedRecipientName: "Tartu sotsiaalosakond",
    selectedRecipientEmail: "other@example.test"
  }, { db }).then(() => null, (reason) => reason);

  assert.equal(error?.status, 400);
  assert.equal(db.writes.length, 0);

  await createPreInquiry(AUTHOR, {
    ...baseInput,
    selectedRecipientName: "Käsitsi sisestatud kontakt",
    selectedRecipientEmail: "other@example.test",
    recipientType: "KOV_CONTACT"
  }, { db });
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].recipientEntryId, null);
  assert.equal(db.writes[0].selectedRecipientEmail, "other@example.test");
});

test("update rejects an unpublished replacement recipient before writing", async () => {
  const current = createdRow({
    recipientEntryId: null,
    recipientServiceId: null,
    recipientLocationId: null,
    recipientType: "KOV_CONTACT",
    recipientOwnerId: null,
    recipientOrganizationId: null,
    deliveryChannel: "EXTERNAL_EMAIL",
    selectedRecipientEmail: "manual@example.test",
    selectedRecipientName: "Käsitsi kontakt",
    topic: "Eluase",
    situation: baseInput.situation,
    generatedDraft: "Mustand",
    userEditedDraft: "Mustand",
    assessmentState: null,
    status: "DRAFT"
  });
  let updateCount = 0;
  const client = {
    serviceMapEntry: { async findFirst() { return null; } },
    user: { async findUnique() { return null; } },
    preInquiry: {
      async findFirst() { return current; },
      async findUnique({ select }) {
        if (!select) return current;
        return Object.fromEntries(Object.keys(select).map((key) => [key, current[key] ?? null]));
      },
      async update() { updateCount += 1; return current; }
    },
    room: { async findFirst() { return null; } },
    async $executeRaw() { return 1; },
    async $transaction(callback) { return callback(client); }
  };

  const error = await updatePreInquiry(AUTHOR, current.id, {
    expectedUpdatedAt: current.updatedAt.toISOString(),
    recipientEntryId: "hidden-entry",
    selectedRecipientName: "Peidetud kontakt",
    selectedRecipientEmail: "hidden@example.test"
  }, { db: client }).then(() => null, (reason) => reason);

  assert.equal(error?.status, 404);
  assert.equal(error?.message, "api.common.not_found");
  assert.equal(updateCount, 0);
});

test("external send confirmation revalidates that the selected service-map entry is still published", async () => {
  const inquiry = createdRow({
    recipientEntryId: "entry-a",
    recipientType: "KOV_CONTACT",
    recipientOwnerId: null,
    deliveryChannel: "EXTERNAL_EMAIL",
    selectedRecipientEmail: "tartu@example.test",
    selectedRecipientName: "Tartu sotsiaalosakond",
    topic: "Eluase",
    situation: baseInput.situation,
    generatedDraft: "Mustand",
    userEditedDraft: "Mustand",
    status: "READY",
    recipientEntry: entry({ status: "HIDDEN" }),
    author: { id: AUTHOR, email: "author@example.test" }
  });
  let updates = 0;
  const db = {
    preInquiry: {
      async findFirst() { return inquiry; },
      async findUnique() { return inquiry; },
      async updateMany() { updates += 1; return { count: 1 }; }
    },
    serviceMapEntry: { async findFirst() { return null; } },
    room: { async findFirst() { return null; } },
    async $executeRaw() { return 1; },
    async $transaction(callback) { return callback(db); }
  };

  const error = await confirmExternalPreInquirySent(AUTHOR, inquiry.id, {
    expectedUpdatedAt: inquiry.updatedAt.toISOString(),
    db
  }).then(() => null, (reason) => reason);
  assert.equal(error?.status, 404);
  assert.equal(error?.message, "api.common.not_found");
  assert.equal(updates, 0);
});
