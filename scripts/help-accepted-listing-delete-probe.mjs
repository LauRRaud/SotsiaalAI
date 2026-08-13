#!/usr/bin/env node
/** SOL-HELP-09 — päris PostgreSQL-i RESTRICT-, säilitamis- ja rollback-tõend. */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { deleteHelpOffer } from "../lib/help/offers.js";
import { deleteHelpRequest } from "../lib/help/requests.js";
import { createHelpMatchAndRoom, decideHelpMatch } from "../lib/help/matches.js";

const DEFAULT_LOCAL_URL = "postgresql://sotsiaal_user:sotsiaalai@localhost:5432/sotsiaal_ai?schema=public";
const sourceUrl = String(process.env.DATABASE_URL || DEFAULT_LOCAL_URL).trim();
const parsed = new URL(sourceUrl);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)) {
  throw new Error(`HELP delete sond loob ajutise andmebaasi ainult localhostil (host=${parsed.hostname})`);
}

const databaseName = `sotsiaal_ai_help_delete_probe_${Date.now()}`;
if (!/^sotsiaal_ai_help_delete_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");
const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

const lines = [];
let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function runMigrations() {
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma migrate deploy kukkus koodiga ${result.status}`);
}

async function installAuditFailureTrigger() {
  await db.$executeRawUnsafe("CREATE OR REPLACE FUNCTION help_delete_audit_failure_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'HELP_DELETE_AUDIT_FAILURE'; END $$");
  await db.$executeRawUnsafe('CREATE TRIGGER "help_delete_audit_failure" BEFORE INSERT ON "DataAuditLog" FOR EACH ROW EXECUTE FUNCTION help_delete_audit_failure_fn()');
}

async function dropAuditFailureTrigger() {
  await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS "help_delete_audit_failure" ON "DataAuditLog"');
  await db.$executeRawUnsafe("DROP FUNCTION IF EXISTS help_delete_audit_failure_fn()");
}

let sequence = 0;
async function seedPair() {
  sequence += 1;
  const suffix = String(sequence).padStart(3, "0");
  const requester = await db.user.create({ data: { email: `help-delete-requester-${suffix}@sotsiaalai.test` } });
  const offerer = await db.user.create({ data: { email: `help-delete-offerer-${suffix}@sotsiaalai.test` } });
  const category = await db.helpCategory.create({
    data: { code: `HELP_DELETE_${suffix}`, labelEt: `Probe ${suffix}`, labelEn: `Probe ${suffix}`, labelRu: `Probe ${suffix}` }
  });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const request = await db.helpRequest.create({
    data: { userId: requester.id, primaryCategoryId: category.id, description: `Soov ${suffix}`, status: "OPEN", expiresAt }
  });
  const offer = await db.helpOffer.create({
    data: { userId: offerer.id, primaryCategoryId: category.id, description: `Pakkumine ${suffix}`, status: "OPEN", expiresAt }
  });
  return { requester, offerer, request, offer };
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  runMigrations();

  const pair = await seedPair();
  await db.helpMapEntry.create({
    data: { kind: "HELP_REQUEST", requestId: pair.request.id, mapVisible: true, status: "PUBLISHED" }
  });
  await db.helpMapEntry.create({
    data: { kind: "HELP_OFFER", offerId: pair.offer.id, mapVisible: true, status: "PUBLISHED" }
  });
  const pending = await createHelpMatchAndRoom({
    requestId: pair.request.id,
    offerId: pair.offer.id,
    initiatedByUserId: pair.requester.id
  }, db);
  const accepted = await decideHelpMatch({
    matchId: pending.id,
    decidedByUserId: pair.offerer.id,
    decision: "ACCEPT"
  }, db);
  check("lähte-eeldus on ACCEPTED sobitus ruumiga", accepted.status === "ACCEPTED" && Boolean(accepted.roomId));
  check("lähte-eeldus on kahe liikmega ruum", await db.roomMember.count({ where: { roomId: accepted.roomId } }) === 2);

  let rawDeleteBlocked = false;
  try {
    await db.$executeRawUnsafe('DELETE FROM "HelpRequest" WHERE "id" = $1', pair.request.id);
  } catch (error) {
    rawDeleteBlocked = error?.code === "P2010" || error?.code === "P2003" || String(error?.message || "").includes("foreign key");
  }
  check("DB RESTRICT blokeerib accepted-allika toore kõvakustutuse", rawDeleteBlocked);
  check("RESTRICT säilitab nõusolekutõendi", await db.helpMatch.count({ where: { id: accepted.id, status: "ACCEPTED" } }) === 1);

  await installAuditFailureTrigger();
  let auditFailureObserved = false;
  try {
    await deleteHelpRequest(pair.request.id, {
      actorUserId: pair.requester.id,
      ipAddress: "127.0.0.1"
    }, db);
  } catch (error) {
    auditFailureObserved = String(error?.message || "").includes("HELP_DELETE_AUDIT_FAILURE");
  }
  await dropAuditFailureTrigger();
  check("auditivea süst jõuab kutsujani", auditFailureObserved);
  check("auditivea rollback säilitab kuulutuse eelmise oleku", (await db.helpRequest.findUnique({ where: { id: pair.request.id } }))?.status === "OPEN");
  check("auditivea rollback säilitab avaliku kaardikirje", (await db.helpMapEntry.findUnique({ where: { requestId: pair.request.id } }))?.status === "PUBLISHED");
  check("auditivea rollback säilitab match'i, ruumi ja liikmesused", (
    await db.helpMatch.count({ where: { id: accepted.id, status: "ACCEPTED" } }) === 1
    && await db.room.count({ where: { id: accepted.roomId } }) === 1
    && await db.roomMember.count({ where: { roomId: accepted.roomId } }) === 2
  ));
  check("auditivea rollback ei jäta vale eduauditit", await db.dataAuditLog.count({ where: { action: "HELP_REQUEST_CLOSE_ACCEPTED_MATCH" } }) === 0);

  const closedRequest = await deleteHelpRequest(pair.request.id, {
    actorUserId: pair.requester.id,
    ipAddress: "127.0.0.1"
  }, db);
  check("accepted request muutub kõvakustutuse asemel CLOSED", closedRequest.disposition === "CLOSED_ACCEPTED_MATCH" && (await db.helpRequest.findUnique({ where: { id: pair.request.id } }))?.status === "CLOSED");
  check("request kaardikirje peidetakse", (await db.helpMapEntry.findUnique({ where: { requestId: pair.request.id } }))?.mapVisible === false);
  check("request sulgemine säilitab match'i, ruumi ja liikmesused", (
    await db.helpMatch.count({ where: { id: accepted.id, status: "ACCEPTED" } }) === 1
    && await db.room.count({ where: { id: accepted.roomId } }) === 1
    && await db.roomMember.count({ where: { roomId: accepted.roomId } }) === 2
  ));
  check("request sulgemine kirjutab ühe atomaarse auditi", await db.dataAuditLog.count({ where: { action: "HELP_REQUEST_CLOSE_ACCEPTED_MATCH", resourceId: pair.request.id } }) === 1);
  await deleteHelpRequest(pair.request.id, { actorUserId: pair.requester.id }, db);
  check("request sulgemise kordus ei dubleeri auditit", await db.dataAuditLog.count({ where: { action: "HELP_REQUEST_CLOSE_ACCEPTED_MATCH", resourceId: pair.request.id } }) === 1);

  let rawOfferDeleteBlocked = false;
  try {
    await db.$executeRawUnsafe('DELETE FROM "HelpOffer" WHERE "id" = $1', pair.offer.id);
  } catch (error) {
    rawOfferDeleteBlocked = error?.code === "P2010" || error?.code === "P2003" || String(error?.message || "").includes("foreign key");
  }
  check("DB RESTRICT blokeerib ka accepted offer'i toore kõvakustutuse", rawOfferDeleteBlocked);
  const closedOffer = await deleteHelpOffer(pair.offer.id, { actorUserId: pair.offerer.id }, db);
  check("accepted offer muutub CLOSED ja säilitab sama ruumi", closedOffer.disposition === "CLOSED_ACCEPTED_MATCH" && await db.room.count({ where: { id: accepted.roomId } }) === 1);
  check("offer sulgemine kirjutab täpselt ühe auditi", await db.dataAuditLog.count({ where: { action: "HELP_OFFER_CLOSE_ACCEPTED_MATCH", resourceId: pair.offer.id } }) === 1);

  const unmatched = await seedPair();
  const hardDeleted = await deleteHelpRequest(unmatched.request.id, { actorUserId: unmatched.requester.id }, db);
  check("sobituseta kuulutuse varasem kõvakustutus jääb alles", hardDeleted.disposition === "HARD_DELETED" && await db.helpRequest.count({ where: { id: unmatched.request.id } }) === 0);

  const accountPair = await seedPair();
  const accountPending = await createHelpMatchAndRoom({
    requestId: accountPair.request.id,
    offerId: accountPair.offer.id,
    initiatedByUserId: accountPair.requester.id
  }, db);
  await decideHelpMatch({
    matchId: accountPending.id,
    decidedByUserId: accountPair.offerer.id,
    decision: "ACCEPT"
  }, db);
  let accountDeleteSucceeded = true;
  try {
    await db.user.delete({ where: { id: accountPair.requester.id } });
  } catch {
    accountDeleteSucceeded = false;
  }
  check("HelpMatch RESTRICT ei blokeeri kasutaja olemasolevat konto-kustutuse kaskaadi", accountDeleteSucceeded);

  for (const line of lines) console.log(line);
  console.log(`HELP_ACCEPTED_LISTING_DELETE_PROBE ${passed}/${passed + failed}`);
  if (failed) process.exitCode = 1;
} finally {
  await db.$disconnect().catch(() => {});
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [databaseName]).catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  await admin.end().catch(() => {});
}
