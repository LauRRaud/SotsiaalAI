#!/usr/bin/env node
/** SOL-SLOG-15…16 — aruandekoopia tehingu ja vanemkaskaadide PostgreSQL-i sond. */

import prisma from "../lib/prisma.js";
import { recallShare, shareMonthlyReport } from "../lib/serviceLog/reportShare.js";

const SUFFIX = "@slog-share.invalid";
const MARK = "slog-share-synthetic";
const NOW = new Date();
const files = new Set();
let passed = 0;
let failed = 0;

function expect(label, condition) {
  if (condition) { passed += 1; console.log(`  PASS  ${label}`); }
  else { failed += 1; console.error(`  FAIL  ${label}`); }
}

async function dropAuditTrigger() {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "slog_share_probe_reject_audit" ON "DataAuditLog"');
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS "slog_share_probe_reject_audit"()');
}

async function installAuditTrigger(action) {
  await dropAuditTrigger();
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION "slog_share_probe_reject_audit"() RETURNS TRIGGER AS $$
    BEGIN
      IF NEW."action" = '${action}' THEN RAISE EXCEPTION 'slog probe audit failure'; END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER "slog_share_probe_reject_audit"
    BEFORE INSERT ON "DataAuditLog"
    FOR EACH ROW EXECUTE FUNCTION "slog_share_probe_reject_audit"()
  `);
}

async function purge() {
  await dropAuditTrigger().catch(() => {});
  await prisma.serviceReportShare.deleteMany({ where: { fileName: { contains: MARK } } });
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const userIds = users.map((row) => row.id);
  if (userIds.length) {
    await prisma.serviceReportShare.deleteMany({
      where: { OR: [{ ownerUserId: { in: userIds } }, { recipient: { userId: { in: userIds } } }] }
    });
  }
  await prisma.organization.deleteMany({ where: { displayName: { contains: MARK } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  files.clear();
}

const storage = {
  readDocument: async () => Buffer.from("synthetic report bytes"),
  makeStoragePath: (() => { let seq = 0; return (name) => `uploads/${MARK}-${++seq}-${name}`; })(),
  storeBuffer: async (buffer, path) => {
    files.add(path);
    return { size: buffer.length, sha256: "b".repeat(64) };
  },
  promoteFile: async (from, to) => { files.delete(from); files.add(to); },
  deleteFile: async (path) => { files.delete(path); }
};

async function main() {
  console.log("SOL-SLOG-15…16 — aruande jagamise päris-DB sond\n");
  await purge();
  const owner = await prisma.user.create({ data: { email: `owner${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: NOW } });
  const lead = await prisma.user.create({ data: { email: `lead${SUFFIX}`, role: "SERVICE_PROVIDER", emailVerified: NOW } });
  const org = await prisma.organization.create({
    data: { displayName: `Org ${MARK}`, legalKind: "COMPANY", status: "ACTIVE", verifiedAt: NOW, activatedAt: NOW }
  });
  await prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: owner.id, status: "ACTIVE", seatRole: "SERVICE_PROVIDER" }
  });
  const leadMembership = await prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: lead.id, status: "ACTIVE", seatRole: "SERVICE_PROVIDER" }
  });
  await prisma.organizationCapabilityGrant.create({
    data: {
      membershipId: leadMembership.id,
      capability: "ORG_OWNER",
      scopeType: "ORGANIZATION",
      validFrom: new Date(NOW.getTime() - 60_000)
    }
  });
  const document = await prisma.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Synthetic report",
      originalName: `${MARK}.csv`,
      kind: "SERVICE_LOG_REPORT",
      mime: "text/csv",
      size: 8,
      sha256: "a".repeat(64),
      storagePath: `uploads/${MARK}-source.csv`,
      metadata: { month: "2026-08", retentionEndsAt: "2033-12-31T23:59:59.999Z", retentionBasis: "RPS_12" }
    }
  });

  const input = { ownerUserId: owner.id, documentId: document.id, recipientMembershipId: leadMembership.id };
  const sent = await shareMonthlyReport(input, { db: prisma, now: NOW, ...storage });
  let share = await prisma.serviceReportShare.findUnique({ where: { id: sent.id } });
  const audit = await prisma.dataAuditLog.findFirst({
    where: { action: "org.service_report_share_sent", resourceId: sent.id }
  });
  expect("SENT ja kohustuslik audit commitisid koos", share?.status === "SENT" && Boolean(audit));
  expect("staging-viide kadus alles pärast promote'i", share?.stagingStoragePath === null && files.has(share.storagePath));

  const storesBeforeDuplicate = files.size;
  const duplicate = await shareMonthlyReport(input, { db: prisma, now: NOW, ...storage }).catch((error) => error);
  expect("P2002 tagastab 409 enne uut faili", duplicate?.status === 409 && files.size === storesBeforeDuplicate);

  await installAuditTrigger("org.service_report_share_recalled");
  const recallError = await recallShare(sent.id, { ownerUserId: owner.id }, { db: prisma, now: NOW }).catch((error) => error);
  share = await prisma.serviceReportShare.findUnique({ where: { id: sent.id } });
  expect("tagasivõtmise auditivea korral RECALLED rollbackis", Boolean(recallError) && share?.status === "SENT" && share?.recalledAt === null);
  await dropAuditTrigger();

  await prisma.user.delete({ where: { id: owner.id } });
  share = await prisma.serviceReportShare.findUnique({ where: { id: sent.id } });
  expect("omaniku kustutus säilitab rea ja märgib erased-at", share?.ownerUserId === null && Boolean(share?.ownerErasedAt));
  await prisma.organizationMembership.delete({ where: { id: leadMembership.id } });
  share = await prisma.serviceReportShare.findUnique({ where: { id: sent.id } });
  expect("saajaliikmesuse kustutus säilitab rea ja märgib erased-at", share?.recipientMembershipId === null && Boolean(share?.recipientErasedAt));
  await prisma.organization.delete({ where: { id: org.id } });
  share = await prisma.serviceReportShare.findUnique({ where: { id: sent.id } });
  expect("organisatsiooni kustutus säilitab rea ja märgib erased-at", share?.organizationId === null && Boolean(share?.organizationErasedAt));
  expect("külmutatud faili räsi ja retention jäid alles", share?.sha256 === "b".repeat(64) && share?.retentionEndsAt > NOW);
}

try {
  await main();
} finally {
  await purge().catch(() => {});
  await prisma.$disconnect();
}
console.log(`\n${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
