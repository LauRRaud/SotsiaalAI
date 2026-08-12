#!/usr/bin/env node
/** SOL-ORG-14 — aktiivsete tööloendite täielikkus päris PostgreSQL-is. */

import { randomUUID } from "node:crypto";

import prisma from "../lib/prisma.js";
import { listInboxItemPage } from "../lib/org/inbox.js";
import { listReceivedSupportSharePage } from "../lib/org/supportShare.js";
import { listReceivedSharePage } from "../lib/serviceLog/reportShare.js";

const runId = randomUUID().replaceAll("-", "");
const prefix = `sol_org14_${runId}`;
let userId = null;
let organizationId = null;
let membershipId = null;
let passed = 0;

function expect(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

async function traverse(load) {
  const ids = [];
  let cursor = null;
  for (let pageNumber = 0; pageNumber < 30; pageNumber += 1) {
    const page = await load(cursor);
    ids.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor;
    if (!page.hasMore) return ids;
  }
  throw new Error("PROBE_FAIL pagination did not finish");
}

try {
  const user = await prisma.user.create({ data: { email: `${prefix}@example.test` } });
  userId = user.id;
  const organization = await prisma.organization.create({
    data: { displayName: `SOL-ORG-14 ${runId}`, legalKind: "MUNICIPALITY", status: "DRAFT" }
  });
  organizationId = organization.id;
  const membership = await prisma.organizationMembership.create({
    data: { organizationId, userId, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  membershipId = membership.id;

  const inboxIds = Array.from({ length: 201 }, (_, index) => `${prefix}_inbox_${String(index).padStart(3, "0")}`);
  const supportIds = Array.from({ length: 101 }, (_, index) => `${prefix}_support_${String(index).padStart(3, "0")}`);
  const reportIds = Array.from({ length: 201 }, (_, index) => `${prefix}_report_${String(index).padStart(3, "0")}`);

  await prisma.organizationInboxItem.createMany({
    data: inboxIds.map((id, index) => ({
      id,
      organizationId,
      sourceType: "PRE_INQUIRY",
      sourceId: `${prefix}_source_${index}`,
      status: "RECEIVED",
      receivedAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5))),
      lastTransitionAt: new Date("2026-08-12T12:00:00Z")
    }))
  });
  await prisma.wellbeingSupportShare.createMany({
    data: supportIds.map((id, index) => ({
      id,
      ownerUserId: userId,
      organizationId,
      recipientMembershipId: membershipId,
      sharedSnapshotJson: { summary: `synthetic ${index}`, needs: [] },
      status: "SENT",
      sentAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5)))
    }))
  });
  await prisma.serviceReportShare.createMany({
    data: reportIds.map((id, index) => ({
      id,
      documentId: `${prefix}_document_${index}`,
      ownerUserId: userId,
      organizationId,
      recipientMembershipId: membershipId,
      month: index < 101 ? "2026-08" : "2026-07",
      storagePath: `${prefix}/${index}.csv`,
      fileName: `${index}.csv`,
      mime: "text/csv",
      sizeBytes: 1,
      sha256: "0".repeat(64),
      status: "SENT",
      sentAt: new Date(Date.UTC(2026, 7, 12, 12, 0, Math.floor(index / 5)))
    }))
  });

  const context = {
    organization: { id: organizationId },
    capabilities: [{ capability: "INBOX_COORDINATOR", scopeType: "ORGANIZATION" }]
  };
  const inboxSeen = await traverse((cursor) => listInboxItemPage(context, { take: 37, cursor }));
  const supportSeen = await traverse((cursor) =>
    listReceivedSupportSharePage(membershipId, { take: 29, cursor, unopened: true })
  );
  const reportSeen = await traverse((cursor) =>
    listReceivedSharePage([membershipId], { take: 43, cursor, unopened: true })
  );

  expect("201 vastuvõturida läbiti täielikult", inboxSeen.length === 201);
  expect("vastuvõtt ei dubleerinud ridu", new Set(inboxSeen).size === 201);
  expect("101 avamata toeavaldust läbiti täielikult", supportSeen.length === 101);
  expect("toeavaldused ei dubleerinud ridu", new Set(supportSeen).size === 101);
  expect("201 avamata aruannet läbiti täielikult", reportSeen.length === 201);
  expect("aruanded ei dubleerinud ridu", new Set(reportSeen).size === 201);
  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  const remaining = await Promise.all([
    prisma.organizationInboxItem.count({ where: { id: { startsWith: prefix } } }),
    prisma.wellbeingSupportShare.count({ where: { id: { startsWith: prefix } } }),
    prisma.serviceReportShare.count({ where: { id: { startsWith: prefix } } })
  ]);
  if (remaining.some(Boolean)) throw new Error(`PROBE_CLEANUP_FAIL ${remaining.join("/")}`);
  console.log("CLEANUP_OK inbox=0 support=0 reports=0");
  await prisma.$disconnect();
}
