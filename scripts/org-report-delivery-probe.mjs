#!/usr/bin/env node
/** SOL-ORG-16 — delivery kinnituse ja auditi aatomilisus PostgreSQL-is. */

import { createHash, randomUUID } from "node:crypto";

import prisma from "../lib/prisma.js";
import { confirmShareDelivery, createReportDeliveryToken } from "../lib/serviceLog/reportShare.js";

const runId = randomUUID().replaceAll("-", "");
const prefix = `sol_org16_${runId}`;
const env = { NODE_ENV: "test", REPORT_DELIVERY_SECRET: `${prefix}_secret` };
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

async function createShare(suffix) {
  const bytes = Buffer.from(`${suffix}\n`, "utf8");
  return prisma.serviceReportShare.create({
    data: {
      id: `${prefix}_${suffix}`,
      documentId: `${prefix}_document_${suffix}`,
      ownerUserId: userId,
      organizationId,
      recipientMembershipId: membershipId,
      month: "2026-08",
      storagePath: `${prefix}/${suffix}.csv`,
      fileName: `${suffix}.csv`,
      mime: "text/csv",
      sizeBytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      status: "SENT"
    }
  });
}

function tokenFor(share) {
  return createReportDeliveryToken(share, {
    actorUserId: userId,
    now: new Date("2026-08-12T10:00:00Z"),
    env
  });
}

function confirmationInput(share) {
  return { membershipIds: [membershipId], actorUserId: userId, shareId: share.id };
}

try {
  const user = await prisma.user.create({ data: { email: `${prefix}@example.test` } });
  userId = user.id;
  const organization = await prisma.organization.create({
    data: { displayName: `SOL-ORG-16 ${runId}`, legalKind: "MUNICIPALITY", status: "DRAFT" }
  });
  organizationId = organization.id;
  const membership = await prisma.organizationMembership.create({
    data: { organizationId, userId, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  membershipId = membership.id;

  const success = await createShare("success");
  await confirmShareDelivery(tokenFor(success), confirmationInput(success), {
    now: new Date("2026-08-12T10:01:00Z"),
    env
  });
  const successFresh = await prisma.serviceReportShare.findUnique({ where: { id: success.id } });
  expect("kehtiv delivery kinnitus märgib aruande avatuks", successFresh.status === "OPENED");

  const auditFailure = await createShare("audit_failure");
  const injectedDb = {
    $transaction: (callback) =>
      prisma.$transaction((tx) =>
        callback(
          new Proxy(tx, {
            get(target, property) {
              if (property === "dataAuditLog") {
                return { create: async () => { throw new Error("INJECTED_AUDIT_FAILURE"); } };
              }
              return target[property];
            }
          })
        )
      )
  };
  const failed = await Promise.allSettled([
    confirmShareDelivery(tokenFor(auditFailure), confirmationInput(auditFailure), {
      db: injectedDb,
      now: new Date("2026-08-12T10:01:00Z"),
      env
    })
  ]);
  expect("audititõrge jõuab kutsujani", failed[0].status === "rejected");
  const failureFresh = await prisma.serviceReportShare.findUnique({ where: { id: auditFailure.id } });
  expect("audititõrge keerab OPENED muutuse tagasi", failureFresh.status === "SENT" && !failureFresh.openedAt);

  const auditRows = await prisma.dataAuditLog.findMany({
    where: { action: "org.service_report_share_opened" },
    select: { id: true, resourceId: true, meta: true }
  });
  const ownAudits = auditRows.filter((row) => row.meta?.organizationId === organizationId);
  auditIdsToClean = ownAudits.map((row) => row.id);
  expect("eduka tarne audit on üks", ownAudits.filter((row) => row.resourceId === success.id).length === 1);
  expect("nurjunud auditi järel auditirida puudub", ownAudits.every((row) => row.resourceId !== auditFailure.id));
  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  if (organizationId) {
    const auditRows = await prisma.dataAuditLog.findMany({
      where: { action: "org.service_report_share_opened" },
      select: { id: true, meta: true }
    });
    auditIdsToClean = auditRows
      .filter((row) => row.meta?.organizationId === organizationId)
      .map((row) => row.id);
  }
  if (auditIdsToClean.length) await prisma.dataAuditLog.deleteMany({ where: { id: { in: auditIdsToClean } } });
  if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
  if (userId) await prisma.user.deleteMany({ where: { id: userId } });
  const [shares, audits, organizations, users] = await Promise.all([
    prisma.serviceReportShare.count({ where: { id: { startsWith: prefix } } }),
    auditIdsToClean.length ? prisma.dataAuditLog.count({ where: { id: { in: auditIdsToClean } } }) : 0,
    organizationId ? prisma.organization.count({ where: { id: organizationId } }) : 0,
    userId ? prisma.user.count({ where: { id: userId } }) : 0
  ]);
  if (shares || audits || organizations || users) {
    throw new Error(`PROBE_CLEANUP_FAIL shares=${shares} audits=${audits} org=${organizations} user=${users}`);
  }
  console.log("CLEANUP_OK shares=0 audits=0 org=0 user=0");
  await prisma.$disconnect();
}
