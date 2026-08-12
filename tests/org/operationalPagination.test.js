import test from "node:test";
import assert from "node:assert/strict";

import { listInboxItemPage } from "../../lib/org/inbox.js";
import { listInvitePage } from "../../lib/org/inviteService.js";
import { listClientSponsorshipPage } from "../../lib/org/sponsorship.js";
import { listReceivedSupportSharePage } from "../../lib/org/supportShare.js";
import { listReceivedSharePage } from "../../lib/serviceLog/reportShare.js";

function compareValue(left, right) {
  const a = left instanceof Date ? left.getTime() : left;
  const b = right instanceof Date ? right.getTime() : right;
  return a === b ? 0 : a < b ? -1 : 1;
}

function model(rows, keys) {
  const ordered = [...rows].sort((left, right) => {
    for (const key of keys) {
      const comparison = compareValue(right[key], left[key]);
      if (comparison) return comparison;
    }
    return 0;
  });
  return {
    findMany: async ({ where, take }) => {
      const cursorClause = where?.AND?.find((entry) => Array.isArray(entry?.OR));
      const last = cursorClause?.OR?.at(-1);
      const cursor = last
        ? Object.fromEntries(keys.map((key) => [key, last[key]?.lt ?? last[key]]))
        : null;
      const remaining = cursor
        ? ordered.filter((row) => {
            for (const key of keys) {
              const comparison = compareValue(row[key], cursor[key]);
              if (comparison) return comparison < 0;
            }
            return false;
          })
        : ordered;
      return remaining.slice(0, take);
    }
  };
}

async function traverse(load) {
  const ids = [];
  let cursor = null;
  for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
    const page = await load(cursor);
    ids.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor;
    if (!page.hasMore) return ids;
  }
  throw new Error("pagination did not finish");
}

function timedRows(count, prefix, fields) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}_${String(index + 1).padStart(3, "0")}`,
    ...fields(index)
  }));
}

test("SOL-ORG-14: 201 inbox rows remain discoverable without duplicates", async () => {
  const rows = timedRows(201, "inbox", (index) => ({
    organizationId: "org_1",
    status: "RECEIVED",
    sourceType: "REFERRAL",
    sourceId: `source_${index}`,
    receivedAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5))),
    lastTransitionAt: new Date("2026-08-12T00:00:00Z"),
    dueAt: null,
    urgencyDeclaredBySender: null,
    unit: null,
    assignments: []
  }));
  const db = { organizationInboxItem: model(rows, ["receivedAt", "id"]) };
  const context = {
    organization: { id: "org_1" },
    capabilities: [{ capability: "INBOX_COORDINATOR", scopeType: "ORGANIZATION" }]
  };
  const ids = await traverse((cursor) => listInboxItemPage(context, { db, take: 37, cursor }));
  assert.equal(ids.length, 201);
  assert.equal(new Set(ids).size, 201);
});

test("SOL-ORG-14: 101 received support shares remain discoverable without duplicates", async () => {
  const rows = timedRows(101, "support", (index) => ({
    recipientMembershipId: "member_1",
    status: "SENT",
    sentAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5))),
    openedAt: null,
    correctedAt: null,
    closedAt: null,
    sharedSnapshotJson: { summary: `share ${index}`, needs: [] },
    snapshotSchemaVersion: 1,
    supersedesShareId: null,
    owner: { email: "synthetic@example.test", profile: null }
  }));
  const db = { wellbeingSupportShare: model(rows, ["sentAt", "id"]) };
  const ids = await traverse((cursor) =>
    listReceivedSupportSharePage("member_1", { db, take: 29, cursor, unopened: true })
  );
  assert.equal(ids.length, 101);
  assert.equal(new Set(ids).size, 101);
});

test("SOL-ORG-14: 201 unopened reports remain discoverable without duplicates", async () => {
  const rows = timedRows(201, "report", (index) => ({
    recipientMembershipId: "member_1",
    month: index < 101 ? "2026-08" : "2026-07",
    note: null,
    status: "SENT",
    sentAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5))),
    openedAt: null,
    recalledAt: null,
    fileName: "report.csv",
    sizeBytes: 10,
    kovName: null,
    entryCount: 1,
    owner: { email: "synthetic@example.test", profile: null }
  }));
  const db = { serviceReportShare: model(rows, ["month", "sentAt", "id"]) };
  const ids = await traverse((cursor) =>
    listReceivedSharePage(["member_1"], { db, take: 43, cursor, unopened: true })
  );
  assert.equal(ids.length, 201);
  assert.equal(new Set(ids).size, 201);
});

test("SOL-ORG-14: pending invites and sponsorships page beyond the old 200-row cap", async () => {
  const rows = timedRows(201, "row", (index) => ({
    organizationId: "org_1",
    status: "PENDING",
    createdAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5)))
  }));
  const inviteIds = await traverse((cursor) =>
    listInvitePage("org_1", { db: { organizationInvite: model(rows, ["createdAt", "id"]) }, take: 61, cursor })
  );
  const sponsorshipIds = await traverse((cursor) =>
    listClientSponsorshipPage("org_1", {
      db: { organizationClientSponsorship: model(rows, ["createdAt", "id"]) },
      take: 61,
      cursor
    })
  );
  assert.equal(inviteIds.length, 201);
  assert.equal(new Set(inviteIds).size, 201);
  assert.equal(sponsorshipIds.length, 201);
  assert.equal(new Set(sponsorshipIds).size, 201);
});

test("SOL-ORG-14: status, sender-declared urgency, overdue and unopened filters stay server-side", async () => {
  const seen = {};
  const capture = (key) => ({
    findMany: async ({ where }) => {
      seen[key] = where;
      return [];
    }
  });
  const context = {
    organization: { id: "org_1" },
    capabilities: [{ capability: "INBOX_COORDINATOR", scopeType: "ORGANIZATION" }]
  };

  await listInboxItemPage(context, {
    db: { organizationInboxItem: capture("inbox") },
    status: "REVIEWING",
    priority: "overdue",
    now: new Date("2026-08-12T12:00:00Z")
  });
  await listInboxItemPage(context, {
    db: { organizationInboxItem: capture("inboxDeclared") },
    priority: "declared"
  });
  await listReceivedSupportSharePage("member_1", {
    db: { wellbeingSupportShare: capture("support") },
    unopened: true
  });
  await listReceivedSharePage(["member_1"], {
    db: { serviceReportShare: capture("report") },
    unopened: true
  });
  await listInvitePage("org_1", {
    db: { organizationInvite: capture("invite") },
    status: "REVOKED"
  });
  await listClientSponsorshipPage("org_1", {
    db: { organizationClientSponsorship: capture("sponsorship") },
    status: "ACCEPTED"
  });

  assert.equal(seen.inbox.status, "REVIEWING");
  assert.deepEqual(seen.inbox.dueAt, { lt: new Date("2026-08-12T12:00:00Z") });
  assert.deepEqual(seen.inbox.AND[0].status, {
    in: ["RECEIVED", "REVIEWING", "ASSIGNMENT_PENDING", "ASSIGNED", "ACCEPTED"]
  });
  assert.deepEqual(seen.inboxDeclared.urgencyDeclaredBySender, { not: null });
  assert.equal(seen.support.openedAt, null);
  assert.equal(seen.report.openedAt, null);
  assert.equal(seen.invite.status, "REVOKED");
  assert.equal(seen.sponsorship.status, "ACCEPTED");
});
