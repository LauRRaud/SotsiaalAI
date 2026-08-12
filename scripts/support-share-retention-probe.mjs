#!/usr/bin/env node
/** SOL-SHARE-07 — parent deletion, two-layer retention and old-CASCADE control. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { dataExportInternals } from "../lib/dataExport/service.js";
import { collectOwnerSharingHistory } from "../lib/mySharings.js";
import { purgeExpiredSupportShares } from "../lib/org/supportShare.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");
const parsed = new URL(sourceUrl);
if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname)) {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname})`);
}

const databaseName = `sotsiaal_ai_support_share_probe_${Date.now()}`;
if (!/^sotsiaal_ai_support_share_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline andmebaasinimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
let passed = 0;

function expect(label, condition) {
  if (!condition) throw new Error(`PROBE_FAIL ${label}`);
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} failed (${result.status})`);
}

async function graph(suffix) {
  const owner = await db.user.create({ data: { email: `share-owner-${suffix}@example.test` } });
  const recipientUser = await db.user.create({ data: { email: `share-recipient-${suffix}@example.test` } });
  const organization = await db.organization.create({
    data: { displayName: `Support probe ${suffix}`, legalKind: "MUNICIPALITY", status: "DRAFT" }
  });
  const ownerMembership = await db.organizationMembership.create({
    data: { organizationId: organization.id, userId: owner.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  const recipientMembership = await db.organizationMembership.create({
    data: { organizationId: organization.id, userId: recipientUser.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  return { owner, recipientUser, organization, ownerMembership, recipientMembership };
}

async function share(graphData, suffix, { opened = false, dueAt, receiptAt, holdUntil } = {}) {
  const sentAt = new Date("2026-08-13T09:00:00.000Z");
  return db.wellbeingSupportShare.create({
    data: {
      id: `support-probe-${suffix}`,
      ownerUserId: graphData.owner.id,
      organizationId: graphData.organization.id,
      recipientMembershipId: graphData.recipientMembership.id,
      sharedSnapshotJson: { summary: `sensitive-${suffix}` },
      snapshotSchemaVersion: "1.0",
      preShareNoticeVersion: "2026-08-13",
      retentionPolicyVersion: "2.0",
      ownerPseudonym: `owner-ref-${suffix}`,
      organizationPseudonym: `org-ref-${suffix}`,
      recipientPseudonym: `recipient-ref-${suffix}`,
      recipientRoleSnapshot: "DIRECT_MANAGER",
      contentHmac: `hmac-${suffix}`,
      contentDeletionDueAt: dueAt || new Date("2027-08-13T09:00:00.000Z"),
      receiptRetentionEndsAt: receiptAt || new Date("2029-08-13T09:00:00.000Z"),
      legalHoldUntil: holdUntil || null,
      status: opened ? "OPENED" : "SENT",
      openedAt: opened ? new Date("2026-08-13T10:00:00.000Z") : null,
      sentAt
    }
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runPrisma(["migrate", "deploy"]);

  const fkRows = await db.$queryRaw`
    SELECT att.attname::text AS column_name, con.confdeltype::text AS on_delete
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f' AND c.relname = 'WellbeingSupportShare'
       AND att.attname IN ('ownerUserId', 'organizationId', 'recipientMembershipId')`;
  expect("all three parent links use SET NULL", fkRows.length === 3 && fkRows.every(row => row.on_delete === "n"));

  const exportOwnerGraph = await graph("export-owner");
  const exportForeignGraph = await graph("export-foreign");
  const exportOwn = await share(exportOwnerGraph, "export-own");
  const exportForeign = await share(exportForeignGraph, "export-foreign");
  const ownerHistory = await collectOwnerSharingHistory(exportOwnerGraph.owner.id, { db });
  expect("real PostgreSQL history includes the owner's support share", ownerHistory.some(row => row.origin.id === exportOwn.id));
  expect("real PostgreSQL history excludes the foreign owner's share", !ownerHistory.some(row => row.origin.id === exportForeign.id));
  const exportBundle = await dataExportInternals.collectExportEntries(
    { id: "support-share-export-probe", userId: exportOwnerGraph.owner.id },
    { db, now: new Date("2026-08-13T10:00:00.000Z") }
  );
  const sharingFile = exportBundle.entries.find(entry => entry.name === "sharing-history.ndjson")?.content.toString("utf8") || "";
  expect("data copy contains the owner sharing receipt", sharingFile.includes(exportOwn.id));
  expect("data copy excludes foreign receipt and sensitive snapshot", !sharingFile.includes(exportForeign.id) && !sharingFile.includes("sensitive-export-own"));

  const unopenedGraph = await graph("owner-unopened");
  const unopened = await share(unopenedGraph, "owner-unopened");
  await db.user.delete({ where: { id: unopenedGraph.owner.id } });
  const unopenedAfter = await db.wellbeingSupportShare.findUnique({ where: { id: unopened.id } });
  expect("owner deletion preserves the unopened receipt", Boolean(unopenedAfter));
  expect("owner deletion auto-recalls and scrubs unopened content", unopenedAfter.ownerUserId === null && unopenedAfter.status === "RECALLED" && unopenedAfter.sharedSnapshotJson === null && unopenedAfter.contentDeletionReason === "OWNER_ACCOUNT_DELETED");

  const openedGraph = await graph("owner-opened");
  const opened = await share(openedGraph, "owner-opened", { opened: true });
  await db.user.delete({ where: { id: openedGraph.owner.id } });
  const openedAfter = await db.wellbeingSupportShare.findUnique({ where: { id: opened.id } });
  expect("opened delivered content survives owner deletion only until its short deadline", openedAfter.ownerUserId === null && openedAfter.sharedSnapshotJson?.summary === "sensitive-owner-opened" && openedAfter.contentDeletedAt === null);

  const recipientGraph = await graph("recipient-delete");
  const recipientShare = await share(recipientGraph, "recipient-delete", { opened: true });
  await db.organizationMembership.delete({ where: { id: recipientGraph.recipientMembership.id } });
  const recipientAfter = await db.wellbeingSupportShare.findUnique({ where: { id: recipientShare.id } });
  expect("recipient deletion ends access but keeps a contentless receipt", recipientAfter.recipientMembershipId === null && recipientAfter.sharedSnapshotJson === null && recipientAfter.recipientErasedAt !== null);

  const orgGraph = await graph("org-delete");
  const orgShare = await share(orgGraph, "org-delete", { opened: true });
  await db.organization.delete({ where: { id: orgGraph.organization.id } });
  const orgAfter = await db.wellbeingSupportShare.findUnique({ where: { id: orgShare.id } });
  expect("organisation deletion scrubs content without transferring it", orgAfter.organizationId === null && orgAfter.recipientMembershipId === null && orgAfter.sharedSnapshotJson === null && orgAfter.organizationErasedAt !== null);

  const sweepGraph = await graph("sweep");
  const dueContent = await share(sweepGraph, "due-content", { dueAt: new Date("2026-08-12T00:00:00.000Z") });
  const dueReceipt = await share(sweepGraph, "due-receipt", { receiptAt: new Date("2026-08-12T00:00:00.000Z") });
  await db.wellbeingSupportShare.update({
    where: { id: dueReceipt.id },
    data: { sharedSnapshotJson: null, contentDeletedAt: new Date("2026-08-11T00:00:00.000Z"), contentDeletionReason: "RETENTION_EXPIRED" }
  });
  const held = await share(sweepGraph, "held", {
    dueAt: new Date("2026-08-12T00:00:00.000Z"),
    receiptAt: new Date("2026-08-12T00:00:00.000Z"),
    holdUntil: new Date("2026-09-01T00:00:00.000Z")
  });
  const sweepResult = await purgeExpiredSupportShares({ db, now: new Date("2026-08-13T00:00:00.000Z") });
  const [contentAfter, receiptAfter, heldAfter] = await Promise.all([
    db.wellbeingSupportShare.findUnique({ where: { id: dueContent.id } }),
    db.wellbeingSupportShare.findUnique({ where: { id: dueReceipt.id } }),
    db.wellbeingSupportShare.findUnique({ where: { id: held.id } })
  ]);
  expect("content expires before its receipt", sweepResult.contentPurged >= 1 && contentAfter && contentAfter.sharedSnapshotJson === null && contentAfter.contentHmac === "hmac-due-content");
  expect("three-year receipt expiry deletes the whole row", receiptAfter === null && sweepResult.receiptsPurged >= 1);
  expect("active legal hold protects content and receipt", heldAfter?.sharedSnapshotJson?.summary === "sensitive-held");

  const oldGraph = await graph("old-cascade");
  const oldShare = await share(oldGraph, "old-cascade");
  await db.$executeRawUnsafe(`DROP TRIGGER "WellbeingSupportShare_owner_delete_scrub" ON "User"`);
  await db.$executeRawUnsafe(`ALTER TABLE "WellbeingSupportShare" DROP CONSTRAINT "WellbeingSupportShare_ownerUserId_fkey"`);
  await db.$executeRawUnsafe(`ALTER TABLE "WellbeingSupportShare" ADD CONSTRAINT "WellbeingSupportShare_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
  await db.user.delete({ where: { id: oldGraph.owner.id } });
  expect("negative control: old CASCADE silently loses the receipt", await db.wellbeingSupportShare.findUnique({ where: { id: oldShare.id } }) === null);

  console.log(`PROBE_OK ${passed}/${passed}`);
} finally {
  await db.$disconnect().catch(() => null);
  await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`, [databaseName]).catch(() => null);
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => null);
  await admin.end().catch(() => null);
  console.log("CLEANUP_OK temporary_database_removed");
}
