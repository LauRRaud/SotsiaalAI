#!/usr/bin/env node
/**
 * JTA-V1 / SOL-CW-19 — MIDA töötaja konto kustutamine juhtumitööst kaasa võtab.
 *
 * MIKS TA OLEMAS ON. Leid tugineb skeemi lugemisele: `CaseWorkAssist.ownerUserId`
 * kannab `onDelete: Cascade` ja lapsed ripuvad juhtumi küljes samamoodi. Enne kui
 * omanik otsustab, KAS juhtumitöö on isiklik mustand või organisatsiooni
 * ametialane töö, peab tal olema **mõõdetud plahvatusraadius**, mitte hinnang:
 * millised tabelid kaovad, kas midagi jääb alles ja kas kadumine jätab jälje.
 *
 * SEE SOND EI PARANDA MIDAGI ega eelda otsust. Ta mõõdab praegust käitumist.
 *
 * KAKS MÕÕTMIST, sest kumbki üksi eksitaks:
 *
 *   1. STRUKTUURNE — `pg_constraint` päris andmebaasis. Ta katab KÕIK lapsed,
 *      ka need, mida sond ei seemenda; üksik reatest tõendaks ainult seda ahelat,
 *      mille ma juhtumisi valisin.
 *   2. LÄBIV — päris read: kasutaja → juhtum → märge → märkme kirje. Struktuur
 *      ütleb, mis PEAKS juhtuma; read ütlevad, mis juhtub.
 *
 * SOL-CW-15 SEOS, mis on siin kõige olulisem: märkme kirje sisu tehti
 * muutumatuks (`BEFORE UPDATE` trigger) ja kõva kustutus võeti teenuskihist ära.
 * `DELETE`-i trigger EI blokeeri ja see oli teadlik — „sisu ei saa muuta, ta
 * saab kaduda ainult koos juhtumiga". SOL-CW-19 küsimus on täpselt see, kas
 * „koos juhtumiga" tohib tähendada „koos töötaja kontoga, silmapilkselt".
 *
 * Käivitamine:
 *   npm run casework:deletion:probe
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.DELETION_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_deletion_probe_${Date.now()}`;
if (!/^sotsiaal_ai_deletion_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");

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

function note(text) {
  lines.push(`  ···  ${text}`);
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: probeUrl.toString() },
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}`);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  note(`ajutine andmebaas ${databaseName} loodud`);
  runPrisma(["migrate", "deploy"]);

  /* ── 1. STRUKTUUR: kes kelle küljes ripub ja millise kustutusreegliga ─── */
  /* `::text` EI OLE ILU. `pg_class.relname` on tüüpi `name` ja
     `pg_constraint.confdeltype` on `char`; Prisma `$queryRaw` kukub mõlema peal
     `UnsupportedNativeDataType`-ga. Sama pere lõks mis nõuandeluku `void`
     (vt mälu `prisma-advisory-lock`). */
  const casework = await db.$queryRaw`
    SELECT c.relname::text AS child,
           p.relname::text AS parent,
           con.conname::text AS constraint_name,
           con.confdeltype::text AS on_delete
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_class p ON p.oid = con.confrelid
     WHERE con.contype = 'f'
       AND (c.relname LIKE 'CaseWork%' OR p.relname LIKE 'CaseWork%')
     ORDER BY p.relname, c.relname`;

  const ownerFk = casework.find(row => row.child === "CaseWorkAssist" && row.parent === "User" && row.on_delete === "c");
  check(
    "1a juhtumi omaniku FK on päris andmebaasis KASKAAD",
    Boolean(ownerFk),
    ownerFk ? ownerFk.constraint_name : "kaskaadi ei leitud — leid võib olla aegunud"
  );

  const children = casework.filter(row => row.parent === "CaseWorkAssist");
  const cascading = children.filter(row => row.on_delete === "c");
  check(
    "1b juhtumi KÕIK lapsed kaovad juhtumiga koos",
    children.length > 0 && cascading.length === children.length,
    `${cascading.length}/${children.length}: ${children.map(row => row.child).join(", ")}`
  );

  /* Terve alampuu: mis kaob, kui üks User-rida läheb. Loend on see, mille peal
     omanik otsustab — „juhtumitöö kaob" on liiga üldine, et otsustada. */
  const subtree = new Set(["CaseWorkAssist"]);
  for (let pass = 0; pass < 5; pass += 1) {
    for (const row of casework) {
      if (row.on_delete === "c" && subtree.has(row.parent)) subtree.add(row.child);
    }
  }
  note(`kaskaadi alampuu (${subtree.size} tabelit): ${[...subtree].sort().join(", ")}`);

  /* ── 2. LÄBIV: päris read ─────────────────────────────────────────────── */
  const worker = await db.user.create({ data: { role: "SOCIAL_WORKER" }, select: { id: true } });
  const kase = await db.caseWorkAssist.create({
    data: { ownerUserId: worker.id, clientDisplayName: "sondi klient" },
    select: { id: true }
  });
  const meetingNote = await db.caseWorkMeetingNote.create({
    data: { caseWorkAssistId: kase.id },
    select: { id: true }
  });
  const entry = await db.caseWorkMeetingNoteEntry.create({
    data: {
      meetingNoteId: meetingNote.id,
      layer: "KOKKULEPE",
      text: "Kliendiga kokku lepitud: järgmine kohtumine 2. septembril.",
      provenance: "WORKER"
    },
    select: { id: true }
  });

  check("2a seemned on kohal (kasutaja, juhtum, märge, märkme kirje)", Boolean(entry.id));

  /* SOL-CW-15 lubadus: seda teksti EI SAA muuta. */
  let immutable = false;
  try {
    await db.$executeRaw`UPDATE "CaseWorkMeetingNoteEntryRevision" SET "reason" = 'x' WHERE false`;
    await db.caseWorkMeetingNoteEntry.update({ where: { id: entry.id }, data: { text: "muudetud" } });
  } catch {
    immutable = true;
  }
  note(`SOL-CW-15 muutumatus kirje enda peal: ${immutable ? "trigger keelab" : "teenuskiht keelab, DB lubab"}`);

  /* ── 3. KUSTUTUS ──────────────────────────────────────────────────────── */
  await db.user.delete({ where: { id: worker.id } });

  const survivors = {
    juhtum: await db.caseWorkAssist.count({ where: { id: kase.id } }),
    märge: await db.caseWorkMeetingNote.count({ where: { id: meetingNote.id } }),
    kirje: await db.caseWorkMeetingNoteEntry.count({ where: { id: entry.id } })
  };

  check(
    "3a töötaja konto kustutamine viib kogu juhtumitöö kaasa",
    survivors.juhtum === 0 && survivors.märge === 0 && survivors.kirje === 0,
    JSON.stringify(survivors)
  );

  /* KAS JÄÄB JÄLG? Orkestreerija loob `DataDeletionJob` ridu failide ja
     artefaktide kohta; juhtumitöö kohta ei loo ta ühtegi. Kui vastus on „ei",
     siis ei saa organisatsioon ega järelevalve hiljem isegi tuvastada, ET
     midagi oli. */
  const trace = await db.dataDeletionJob.count({ where: { resourceType: { startsWith: "CaseWork" } } });
  check(
    "3b kustutamine EI JÄTA juhtumitööst mingit jälge (leiu tuum)",
    trace === 0,
    `CaseWork-jälgi: ${trace}`
  );

  /* NEGATIIVKONTROLL: sond peab suutma jälge NÄHA, kui ta oleks olemas. Ilma
     selleta tõendaks 3b ainult seda, et ma otsin valest kohast. */
  await db.dataDeletionJob.create({
    data: {
      targetUserId: worker.id,
      action: "CASEWORK_PROBE_CONTROL",
      resourceType: "CaseWorkProbeControl",
      resourceId: kase.id,
      status: "SKIPPED"
    }
  });
  const traceAfter = await db.dataDeletionJob.count({ where: { resourceType: { startsWith: "CaseWork" } } });
  check("3c NEGATIIVKONTROLL — sond NÄEKS jälge, kui ta oleks olemas", traceAfter === 1, `jälgi: ${traceAfter}`);
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
  check("4a ajutine andmebaas on kustutatud", left.rowCount === 0, `pg_database ridu: ${left.rowCount}`);
  await admin.end().catch(() => {});

  console.log("\nSOL-CW-19 — konto kustutamise plahvatusraadius juhtumitöös\n");
  console.log(lines.join("\n"));
  console.log(`\n  ${failures === 0 ? "KÕIK ROHELINE" : `${failures} VIGA`}\n`);
  console.log("  See sond MÕÕDAB praegust käitumist. Kas ta on õige, on omaniku otsus (SOL-CW-19).\n");
  process.exitCode = failures === 0 ? 0 : 1;
}
