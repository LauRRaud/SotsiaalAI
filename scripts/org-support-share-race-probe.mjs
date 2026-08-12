#!/usr/bin/env node
/** SOL-ORG-15 — toeavalduse terminalse olekumasina võidujooksud PostgreSQL-is. */

import { randomUUID } from "node:crypto";

import prisma from "../lib/prisma.js";
import {
  closeSupportShare,
  correctSupportShare,
  openSupportShare,
  recallSupportShare
} from "../lib/org/supportShare.js";

const runId = randomUUID().replaceAll("-", "");
const prefix = `sol_org15_${runId}`;
let userId = null;
let organizationId = null;
let membershipId = null;
let auditIdsToClean = [];
let passed = 0;

function expect(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function raceShape(results) {
  const won = results.filter((result) => result.status === "fulfilled");
  const lost = results.filter((result) => result.status === "rejected");
  return {
    oneWinner: won.length === 1,
    oneConflict: lost.length === 1 && lost[0].reason?.status === 409
  };
}

async function auditCount(shareId) {
  const rows = await prisma.dataAuditLog.findMany({
    where: {
      action: {
        in: [
          "org.support_share_opened",
          "org.support_share_recalled",
          "org.support_share_corrected",
          "org.support_share_closed"
        ]
      }
    },
    select: { meta: true }
  });
  return rows.filter((row) => row.meta?.organizationId === organizationId && row.meta?.shareId === shareId).length;
}

async function createShare(suffix, status) {
  return prisma.wellbeingSupportShare.create({
    data: {
      id: `${prefix}_${suffix}`,
      ownerUserId: userId,
      organizationId,
      recipientMembershipId: membershipId,
      sharedSnapshotJson: { summary: `${suffix} synthetic`, needs: [] },
      status,
      openedAt: status === "OPENED" ? new Date("2026-08-12T10:00:00Z") : null,
      sentAt: new Date("2026-08-12T09:00:00Z")
    }
  });
}

try {
  const user = await prisma.user.create({ data: { email: `${prefix}@example.test` } });
  userId = user.id;
  const organization = await prisma.organization.create({
    data: { displayName: `SOL-ORG-15 ${runId}`, legalKind: "MUNICIPALITY", status: "DRAFT" }
  });
  organizationId = organization.id;
  const membership = await prisma.organizationMembership.create({
    data: { organizationId, userId, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  membershipId = membership.id;

  const openRecall = await createShare("open_recall", "SENT");
  const openRecallRace = await Promise.allSettled([
    openSupportShare(openRecall.id, { recipientMembershipId: membershipId }),
    recallSupportShare(openRecall.id, { ownerUserId: userId })
  ]);
  const openRecallShape = raceShape(openRecallRace);
  const openRecallFinal = await prisma.wellbeingSupportShare.findUnique({ where: { id: openRecall.id } });
  expect("open-vs-recall annab ühe võitja", openRecallShape.oneWinner);
  expect("open-vs-recall kaotaja saab 409", openRecallShape.oneConflict);
  expect("open-vs-recall lõpeb terminalse või avatud seisuga", ["OPENED", "RECALLED"].includes(openRecallFinal.status));
  expect("open-vs-recall kirjutab ainult võitja auditi", (await auditCount(openRecall.id)) === 1);

  const closeCorrect = await createShare("close_correct", "OPENED");
  const closeCorrectRace = await Promise.allSettled([
    closeSupportShare(closeCorrect.id, { recipientMembershipId: membershipId, actorUserId: userId }),
    correctSupportShare(closeCorrect.id, {
      ownerUserId: userId,
      snapshot: { summary: "corrected synthetic", needs: [] },
      userConfirmed: true
    })
  ]);
  const closeCorrectShape = raceShape(closeCorrectRace);
  const closeCorrectFinal = await prisma.wellbeingSupportShare.findUnique({ where: { id: closeCorrect.id } });
  expect("close-vs-correct annab ühe võitja", closeCorrectShape.oneWinner);
  expect("close-vs-correct kaotaja saab 409", closeCorrectShape.oneConflict);
  expect("close-vs-correct jääb terminalseks", ["CLOSED", "CORRECTED"].includes(closeCorrectFinal.status));
  expect("close-vs-correct kirjutab ainult võitja auditi", (await auditCount(closeCorrect.id)) === 1);

  const doubleClose = await createShare("double_close", "OPENED");
  const doubleCloseRace = await Promise.allSettled([
    closeSupportShare(doubleClose.id, { recipientMembershipId: membershipId, actorUserId: userId }),
    closeSupportShare(doubleClose.id, { recipientMembershipId: membershipId, actorUserId: userId })
  ]);
  const doubleCloseShape = raceShape(doubleCloseRace);
  const doubleCloseFinal = await prisma.wellbeingSupportShare.findUnique({ where: { id: doubleClose.id } });
  expect("topelt-close annab ühe võitja", doubleCloseShape.oneWinner);
  expect("topelt-close kaotaja saab 409", doubleCloseShape.oneConflict);
  expect("topelt-close lõpeb CLOSED seisus", doubleCloseFinal.status === "CLOSED");
  expect("topelt-close kirjutab ühe auditi", (await auditCount(doubleClose.id)) === 1);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  if (organizationId) {
    const auditRows = await prisma.dataAuditLog.findMany({
      where: {
        action: {
          in: [
            "org.support_share_opened",
            "org.support_share_recalled",
            "org.support_share_corrected",
            "org.support_share_closed"
          ]
        }
      },
      select: { id: true, meta: true }
    });
    auditIdsToClean = auditRows
      .filter((row) => row.meta?.organizationId === organizationId)
      .map((row) => row.id);
    if (auditIdsToClean.length) {
      await prisma.dataAuditLog.deleteMany({ where: { id: { in: auditIdsToClean } } });
    }
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  }
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  const [remainingShares, remainingAudits, remainingOrganizations, remainingUsers] = await Promise.all([
    prisma.wellbeingSupportShare.count({ where: { id: { startsWith: prefix } } }),
    auditIdsToClean.length ? prisma.dataAuditLog.count({ where: { id: { in: auditIdsToClean } } }) : 0,
    organizationId ? prisma.organization.count({ where: { id: organizationId } }) : 0,
    userId ? prisma.user.count({ where: { id: userId } }) : 0
  ]);
  if (remainingShares || remainingAudits || remainingOrganizations || remainingUsers) {
    throw new Error(
      `PROBE_CLEANUP_FAIL shares=${remainingShares} audits=${remainingAudits} org=${remainingOrganizations} user=${remainingUsers}`
    );
  }
  console.log("CLEANUP_OK shares=0 audits=0 org=0 user=0");
  await prisma.$disconnect();
}
