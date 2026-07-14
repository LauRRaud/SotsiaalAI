import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  listVisiblePreInquiries,
  serializePreInquiry
} from "../../lib/preInquiries.js";

const AUTHOR = "author-1";
const RECIPIENT = "recipient-1";

function fixture() {
  return {
    id: "inquiry-1",
    authorId: AUTHOR,
    recipientOwnerId: RECIPIENT,
    recipientEntryId: "entry-1",
    recipientType: "SERVICE_PROVIDER",
    deliveryChannel: "INTERNAL",
    selectedRecipientEmail: "public-service@example.test",
    selectedRecipientName: "Public service",
    topic: "Housing support",
    situation: "General situation",
    assessmentState: null,
    generatedDraft: "Draft",
    userEditedDraft: "Edited draft",
    receiverNote: "Receiver private note",
    receiverChecklist: [{ id: "review", label: "Review", checked: true }],
    status: "READY",
    sentAt: new Date("2026-07-14T10:00:00.000Z"),
    openedAt: new Date("2026-07-14T10:05:00.000Z"),
    recalledAt: null,
    supersededById: null,
    externalSendConfirmedAt: null,
    createdAt: new Date("2026-07-14T09:00:00.000Z"),
    updatedAt: new Date("2026-07-14T10:05:00.000Z"),
    recipientEntry: {
      id: "entry-1",
      type: "SERVICE_PROVIDER",
      title: "Public service",
      address: null,
      phone: null,
      email: "public-service@example.test",
      website: null,
      providerProfileId: "profile-1"
    },
    author: { id: AUTHOR, email: "author-account@example.test", role: "CLIENT" },
    recipientOwner: {
      id: RECIPIENT,
      email: "recipient-account@example.test",
      role: "SERVICE_PROVIDER"
    }
  };
}

test("author view omits receiver-private workflow and the recipient account email", () => {
  const result = serializePreInquiry(fixture(), { viewerId: AUTHOR });

  assert.equal("receiverNote" in result, false);
  assert.equal("receiverChecklist" in result, false);
  assert.equal(result.author.email, "author-account@example.test");
  assert.equal("email" in result.recipientOwner, false);
  assert.equal(result.recipientEntry.email, "public-service@example.test");
});

test("recipient view includes its workflow but omits the author's account email", () => {
  const result = serializePreInquiry(fixture(), { viewerId: RECIPIENT });

  assert.equal(result.receiverNote, "Receiver private note");
  assert.ok(Array.isArray(result.receiverChecklist));
  assert.ok(result.receiverChecklist.length > 0);
  assert.equal("email" in result.author, false);
  assert.equal(result.recipientOwner.email, "recipient-account@example.test");
});

test("missing or unrelated audience fails closed", () => {
  for (const options of [undefined, { viewerId: "other-user" }]) {
    const result = serializePreInquiry(fixture(), options);
    assert.equal("receiverNote" in result, false);
    assert.equal("receiverChecklist" in result, false);
    assert.equal("email" in result.author, false);
    assert.equal("email" in result.recipientOwner, false);
  }
});

test("list service applies the authenticated viewer to every serialized row", async () => {
  const db = {
    preInquiry: {
      async findMany() {
        return [fixture()];
      }
    }
  };

  const [authorResult] = await listVisiblePreInquiries(AUTHOR, { db });
  const [recipientResult] = await listVisiblePreInquiries(RECIPIENT, { db });

  assert.equal("receiverNote" in authorResult, false);
  assert.equal("email" in authorResult.recipientOwner, false);
  assert.equal(recipientResult.receiverNote, "Receiver private note");
  assert.equal("email" in recipientResult.author, false);
});

test("detail route and workflow client pass their viewer/version boundary explicitly", async () => {
  const detailRoute = await readFile(
    new URL("../../app/api/pre-inquiries/[id]/route.js", import.meta.url),
    "utf8"
  );
  const workspace = await readFile(
    new URL("../../components/workspace/WorkspaceFeaturePage.jsx", import.meta.url),
    "utf8"
  );

  assert.match(detailRoute, /serializePreInquiry\(inquiry, \{ viewerId: auth\.userId \}\)/u);
  assert.match(workspace, /expectedUpdatedAt:\s*inquiry\.updatedAt/u);
});
