#!/usr/bin/env node
/**
 * SOL-RAGADMIN-03 — ingest'i claim ja lease PÄRIS PostgreSQL-i vastu.
 *
 * MIKS TA OLEMAS ON. `tests/admin/ragIngestClaim.test.js` kirjutab fake-delegaadi,
 * mis hindab `where`-tingimust ise — ja just see on tema piir. Kogu leid ON
 * paralleelsus: „kaks päringut läbivad mõlemad eelkontrolli". Fake käivitab kaks
 * kutset JÄRJEST, seega ta tõendab minu tingimuse loogikat, MITTE seda, et
 * PostgreSQL kahe samaaegse `UPDATE ... WHERE` vahel võitja välja valib. Sama
 * õppetund mis [[fake-prisma-ei-valideeri]] ja SOL-CW-20 sond.
 *
 * MIDA TA TÕENDAB:
 *   1. Prisma võtab `updateMany` tingimusliku `where`-i (OR + `lt` DateTime peal) vastu
 *   2. KAKS SAMAAEGSET claim'i → täpselt ÜKS võidab
 *   3. elus lease blokeerib, aegunud lease on varastatav
 *   4. enne migratsiooni tekkinud ummik (`claimedAt IS NULL`) on varastatav ILMA backfill'ita
 *   5. lõppseisu kirjutab ainult claim'i omanik; varastatud claim annab `claim_lost`
 *   6. DB CHECK ei luba pool-lease'i (id ilma ajata)
 *   7. lepitus: present → INGESTED · missing → ERROR/ingest_interrupted · unknown → EI OTSUSTA
 *
 * VISATAV ANDMEBAAS, MITTE ARENDUSBAAS. Sama muster ja sama põhjus mis teistel
 * sondidel; koristust kontrollitakse.
 *
 * Käivitamine:
 *   npm run kov:claim:probe
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  claimIngestLease,
  finishIngestClaim,
  hasLiveIngestClaim,
  INGEST_LANES,
  INGEST_LEASE_MS,
  releaseIngestClaimWithError
} from "../lib/admin/rag/ingestClaim.js";
import { INGEST_INTERRUPTED, RAG_PRESENCE, reconcileStaleIngestClaim } from "../lib/admin/rag/ingestReconcile.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.CLAIM_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_claim_probe_${Date.now()}`;
if (!/^sotsiaal_ai_claim_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));

const lines = [];
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}: ${String(result.stderr || "")}`);
  }
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });
const lane = INGEST_LANES.KOV_WEB;
const DOC_ID = "kov-sond-vald";

async function readRow(id) {
  return db.municipalityKovAdmin.findUnique({ where: { id } });
}

/** Viib rea etteantud seisu toore SQL-iga — sond peab saama iga seisu ehitada. */
async function setState(id, { status, claimId = null, claimedAt = null }) {
  await db.$executeRaw`
    UPDATE "MunicipalityKovAdmin"
    SET "ingestStatus" = ${status}::"KovIngestStatus",
        "ingestClaimId" = ${claimId},
        "ingestClaimedAt" = ${claimedAt},
        "ragDocId" = ${DOC_ID}
    WHERE "id" = ${id}`;
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  lines.push(`  ···  ajutine andmebaas ${databaseName} loodud`);
  runPrisma(["migrate", "deploy"]);

  const municipality = await db.municipality.create({
    data: { slug: "sond-vald", baseName: "Sond", type: "VALD", displayName: "Sond vald" },
    select: { id: true }
  });
  const row = await db.municipalityKovAdmin.create({
    data: { municipalityId: municipality.id, ragDocId: DOC_ID },
    select: { id: true }
  });
  const id = row.id;

  /* ── 1. tingimuslik claim käivitub päris Prisma ja PostgreSQL-i peal ───── */
  const first = await claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID });
  check("1a tingimuslik claim käivitub (OR + lt DateTime peal)", first.ok === true, `claimId ${String(first.claimId).slice(0, 8)}…`);
  const claimed = await readRow(id);
  check(
    "1b claim kirjutas seisu, omaniku ja lease'i alguse",
    claimed.ingestStatus === "INGESTING" && claimed.ingestClaimId === first.claimId && Boolean(claimed.ingestClaimedAt),
    `${claimed.ingestStatus} / claimedAt ${claimed.ingestClaimedAt ? "olemas" : "PUUDUB"}`
  );

  /* ── 2. elus lease blokeerib ─────────────────────────────────────────────── */
  const second = await claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID });
  check("2a elus lease blokeerib teise claim'i", second.ok === false && second.reason === "ingest_in_progress", String(second.reason || "ok"));
  check("2b eelkontroll näeb elusat claim'i", hasLiveIngestClaim(await readRow(id), lane) === true);

  /* ── 3. KAKS SAMAAEGSET claim'i — kogu leiu ese ─────────────────────────── */
  await setState(id, { status: "READY" });
  const race = await Promise.all([
    claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID }),
    claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID })
  ]);
  const winners = race.filter(result => result.ok === true);
  check(
    "3a kaks SAMAAEGSET claim'i → täpselt üks võidab",
    winners.length === 1,
    `võitjaid ${winners.length}, kaotajad ${race.filter(r => !r.ok).map(r => r.reason).join("/") || "-"}`
  );
  const afterRace = await readRow(id);
  check("3b reale jäi VÕITJA claim, mitte kaotaja oma", afterRace.ingestClaimId === winners[0]?.claimId);

  /* Suurem korpus: 8 samaaegset katset, ikka üks võitja. */
  await setState(id, { status: "READY" });
  const crowd = await Promise.all(
    Array.from({ length: 8 }, () => claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID }))
  );
  check("3c kaheksa samaaegset katset → ikka täpselt üks võitja", crowd.filter(r => r.ok).length === 1, `võitjaid ${crowd.filter(r => r.ok).length}`);

  /* ── 4. aegunud ja omanikuta lease ──────────────────────────────────────── */
  const stale = new Date(Date.now() - INGEST_LEASE_MS - 60_000);
  await setState(id, { status: "INGESTING", claimId: "vana-claim", claimedAt: stale });
  check("4a aegunud lease ei ole eelkontrolli jaoks elus", hasLiveIngestClaim(await readRow(id), lane) === false);
  const stolen = await claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID });
  check("4b aegunud lease on VARASTATAV", stolen.ok === true);

  /* Enne migratsiooni tekkinud ummik: INGESTING ilma lease'ita. */
  await setState(id, { status: "INGESTING", claimId: null, claimedAt: null });
  const legacy = await claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID });
  check("4c omanikuta INGESTING (vana rida) on varastatav ilma backfill'ita", legacy.ok === true);

  /* ── 5. lõppseisu kirjutab ainult omanik ────────────────────────────────── */
  const finished = await finishIngestClaim({ delegate: db.municipalityKovAdmin, id, lane, claimId: legacy.claimId, docId: DOC_ID });
  const finishedRow = await readRow(id);
  check(
    "5a omanik kirjutab lõppseisu ja vabastab lease'i",
    finished.ok === true && finishedRow.ingestStatus === "INGESTED" && finishedRow.ingestClaimId === null && finishedRow.ingestClaimedAt === null,
    `${finishedRow.ingestStatus} / claim ${finishedRow.ingestClaimId || "vabastatud"}`
  );

  const ownerClaim = await claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID });
  await setState(id, { status: "INGESTING", claimId: "keegi-teine", claimedAt: new Date() });
  const lost = await finishIngestClaim({ delegate: db.municipalityKovAdmin, id, lane, claimId: ownerClaim.claimId, docId: DOC_ID });
  const lostRow = await readRow(id);
  check("5b varastatud claim annab `claim_lost`", lost.ok === false && lost.reason === "claim_lost", String(lost.reason));
  check("5c zombi EI kirjutanud üle uue omaniku tööd", lostRow.ingestStatus === "INGESTING" && lostRow.ingestClaimId === "keegi-teine");

  const lostError = await releaseIngestClaimWithError({
    delegate: db.municipalityKovAdmin,
    id,
    lane,
    claimId: ownerClaim.claimId,
    message: "zombi tõrge"
  });
  check("5d zombi tõrge ei märgi teise omaniku tööd ERROR-iks", lostError.ok === false && (await readRow(id)).ingestStatus === "INGESTING");

  /* ── 6. DB CHECK ei luba pool-lease'i ──────────────────────────────────── */
  let checkViolation = "";
  try {
    await db.$executeRaw`UPDATE "MunicipalityKovAdmin" SET "ingestClaimId" = 'pool', "ingestClaimedAt" = NULL WHERE "id" = ${id}`;
  } catch (error) {
    checkViolation = String(error?.message || "");
  }
  check("6a CHECK keelab pool-lease'i (id ilma ajata)", /ingest_claim_pair|violates check constraint/i.test(checkViolation), checkViolation ? "CHECK andis vea" : "KIRJUTUS LÄKS LÄBI");

  /* ── 7. lepitus küsib RAG-ist tõe ──────────────────────────────────────── */
  const presenceFake = presence => async () => ({ presence, lastIngested: null });

  await setState(id, { status: "INGESTING", claimId: "surnud-1", claimedAt: stale });
  const present = await reconcileStaleIngestClaim({
    delegate: db.municipalityKovAdmin,
    row: await readRow(id),
    lane,
    readPresence: presenceFake(RAG_PRESENCE.PRESENT)
  });
  const presentRow = await readRow(id);
  check(
    "7a present → INGESTED (töö oli tehtud, ainult kinnitus jäi kirjutamata)",
    present.reconciled === true && presentRow.ingestStatus === "INGESTED" && presentRow.ingestClaimId === null && Boolean(presentRow.lastIngestedAt),
    presentRow.ingestStatus
  );

  await setState(id, { status: "INGESTING", claimId: "surnud-2", claimedAt: stale });
  await reconcileStaleIngestClaim({
    delegate: db.municipalityKovAdmin,
    row: await readRow(id),
    lane,
    readPresence: presenceFake(RAG_PRESENCE.MISSING)
  });
  const missingRow = await readRow(id);
  check(
    "7b missing → ERROR koodiga ingest_interrupted",
    missingRow.ingestStatus === "ERROR" && missingRow.lastIngestError === INGEST_INTERRUPTED && missingRow.ingestClaimId === null,
    `${missingRow.ingestStatus} / ${missingRow.lastIngestError}`
  );

  await setState(id, { status: "INGESTING", claimId: "surnud-3", claimedAt: stale });
  const unknown = await reconcileStaleIngestClaim({
    delegate: db.municipalityKovAdmin,
    row: await readRow(id),
    lane,
    readPresence: presenceFake(RAG_PRESENCE.UNKNOWN)
  });
  const unknownRow = await readRow(id);
  check(
    "7c unknown EI OTSUSTA midagi (rida jääb INGESTING, claim alles)",
    unknown.reconciled === false && unknownRow.ingestStatus === "INGESTING" && unknownRow.ingestClaimId === "surnud-3",
    unknownRow.ingestStatus
  );
  const stealAfterUnknown = await claimIngestLease({ delegate: db.municipalityKovAdmin, id, lane, docId: DOC_ID });
  check("7d ...aga lukk EI OLE ummik: aegunud claim on ikka varastatav", stealAfterUnknown.ok === true);

  await setState(id, { status: "INGESTING", claimId: "elus", claimedAt: new Date() });
  const live = await reconcileStaleIngestClaim({
    delegate: db.municipalityKovAdmin,
    row: await readRow(id),
    lane,
    readPresence: presenceFake(RAG_PRESENCE.MISSING)
  });
  check("7e ELUSAT ingest'i lepitus ei puutu", live.reconciled === false && live.reason === "claim_live", String(live.reason));
} finally {
  await db.$disconnect().catch(() => {});
  await admin
    .query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [
      databaseName
    ])
    .catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});
  const left = await admin
    .query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName])
    .catch(() => ({ rowCount: -1 }));
  check("8a ajutine andmebaas on kustutatud", left.rowCount === 0, `pg_database ridu: ${left.rowCount}`);
  await admin.end().catch(() => {});

  console.log("\nSOL-RAGADMIN-03 — ingest'i claim ja lease päris PostgreSQL-i vastu\n");
  console.log(lines.join("\n"));
  console.log(`\n  ${failures === 0 ? "KÕIK ROHELINE" : `${failures} VIGA`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}
