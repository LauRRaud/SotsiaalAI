#!/usr/bin/env node
/**
 * JTA-V1 (E7) / SOL-CW-14 — säilitustöö AJASTUSE runtime-sond.
 *
 * MIKS TA OLEMAS ON. `tests/casework/retentionSchedule.test.js` jookseb
 * fake-Prisma peal ja tõendab MEHHANISMI: lävi on ajas, kuiv käivitus ei kõlba
 * tõendiks, rida tekib enne tööd. Aga fake ei tõenda skeemi ega protsessi —
 * kaks `CHECK`-i, ajavööndi kokkulepe ja see, kas smoke päriselt LÕPEB koodiga 1,
 * paistavad välja alles päris PostgreSQL-is ja päris protsessis. Just seda kolme
 * asja nõuab auditi vastuvõtukriteerium ja just nende kohta on kõige lihtsam
 * uskuda „töötab küll" ilma tõendita.
 *
 * VISATAV ANDMEBAAS, MITTE ARENDUSBAAS. Sond loob oma andmebaasi, rakendab talle
 * kogu migratsiooniahela, mõõdab ja kustutab ta ära. Arendaja `.env` baasi ta ei
 * kirjuta — jooksulogi on väike tabel ja tema ridade segamine päris seisuga
 * teeks tulevase mõõtmise valelikuks. Koristust KONTROLLITAKSE, mitte ei eeldata
 * (A4 sondi õppetund: `SetNull` jättis toodangusse rea, mida keegi ei oodanud).
 *
 * MIDA TA NIMELISELT TÕENDAB:
 *
 *   A. migratsiooniahel rakendub ja mõlemad `CHECK`-id on päris andmebaasis
 *   B. rakenduse kirjutatud aeg ja andmebaasi UTC langevad kokku — ilma selleta
 *      mõõdaks kogu ülejäänud sond arendusmasina ajavööndit, mitte ajastust
 *   C. rida tekib ENNE tööd ja pooleli jäänud jooks EI OLE edukas
 *   D. `ok = true` ilma lõpuajata → andmebaas keeldub
 *   E. negatiivne loendur → andmebaas keeldub (päris kirjutusrajal)
 *   F. tervis mõlemast otsast: NEVER_RUN · OK · ALARM · TÄPSELT PIIRIL · ainult
 *      kuiv jooks · ainult tõrked
 *   G. päris säilitustöö: mustand ja juhtum tähtaja mõlemal poolel ning ühe
 *      rea tõrke järel taastumine järgmisel jooksul
 *   H. smoke PÄRIS PROTSESSINA: alarm = väljumiskood 1, korras = 0, värav väljas
 *      = 0, katkine skeem = 1
 *
 * NEGATIIVKONTROLL ON SISSE EHITATUD: F3/F4 (üle läve vs täpselt piiril) ja
 * G1/G2 (alarm vs korras) käivad SAMA koodi pealt vastupidise vastusega. Sond,
 * mille iga rida ütleb „OK", ei mõõda midagi.
 *
 * Käivitamine:
 *   npm run casework:retention:probe
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { addMonths, runRetention } from "../lib/casework/retention.js";
import {
  RETENTION_ALARM_MISSED_INTERVALS,
  RETENTION_HEALTH,
  RETENTION_INTERVAL_MINUTES,
  finishRetentionRun,
  getRetentionHealth,
  startRetentionRun
} from "../lib/casework/retentionRuns.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

/* TOOTMISKAITSE: sond LOOB ja KUSTUTAB andmebaasi. Sama värav mis
   `db:migrate:check`-il — `NODE_ENV` üksi ei ole piisav, sest tootmisbaasi võib
   ühendada ka seadistamata shellist. */
const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.RETENTION_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_retention_probe_${Date.now()}`;
if (!/^sotsiaal_ai_retention_probe_\d+$/.test(databaseName)) {
  throw new Error("Ebaturvaline ajutise andmebaasi nimi");
}

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const admin = new pg.Client({ connectionString: adminUrl.toString() });
const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const smokeScript = fileURLToPath(new URL("./casework-retention-smoke.mjs", import.meta.url));
/* `--import` VÕTAB URL-i, MITTE WINDOWSI TEED. `C:\…` läheb ESM-laaduris katki
   (draivitäht loetakse protokolliks) ja laps kukub enne esimest rida — smoke
   näeks välja nagu alarm, kuigi teda ei käivitatudki. */
const testLoader = pathToFileURL(fileURLToPath(new URL("./register-node-test-loader.mjs", import.meta.url))).href;

const MINUTE_MS = 60_000;
const THRESHOLD_MINUTES = RETENTION_INTERVAL_MINUTES * RETENTION_ALARM_MISSED_INTERVALS;

const lines = [];
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Ootab, et ANDMEBAAS lükkab kirje tagasi. Õnnestumine on siin ebaõnnestumine. */
async function expectRejected(label, fn) {
  try {
    await fn();
    check(label, false, "andmebaas VÕTTIS vastu, oleks pidanud keelduma");
  } catch (error) {
    const message = String(error?.message || error);
    const isConstraint = /constraint|chk|check/i.test(message);
    check(label, isConstraint, isConstraint ? "" : `vale veapõhjus: ${message.slice(0, 120)}`);
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
    throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}`);
  }
}

/**
 * Smoke PÄRIS PROTSESSINA.
 *
 * MIKS LAPSPROTSESS, MITTE FUNKTSIOONIKUTSE: leiu sisu on „järelevalve ei tea,
 * kas töö käib", ja järelevalve loeb VÄLJUMISKOODI. Sama failist funktsiooni
 * kutsudes jääks just see osa mõõtmata.
 */
function runSmoke({ gateOn }) {
  const env = { ...process.env, DATABASE_URL: probeUrl.toString() };
  if (gateOn) env.CASEWORK_V1_ENABLED = "1";
  else delete env.CASEWORK_V1_ENABLED;

  const result = spawnSync(process.execPath, ["--import", testLoader, smokeScript], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: "pipe",
    shell: false
  });
  if (result.error) throw result.error;
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  return {
    code: result.status,
    out,
    /* Kukkunud kontrolli juures peab NÄHTAMA, mida laps ütles — muidu on „kood 1"
       eristamatu käivitumata jäänud protsessist. */
    tail: out.trim().split("\n").slice(-1)[0]?.slice(0, 120) || "(vaikus)"
  };
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }) });

const minutesAgo = minutes => new Date(Date.now() - minutes * MINUTE_MS);

/** Jooksurida otse, et saaks vanandada. `startedAt` on tervise ainus ajatelg. */
function seedRun({ startedMinutesAgo, finishedMinutesAgo = null, ok = false, dryRun = false, failed = 0 }) {
  return db.caseWorkRetentionRun.create({
    data: {
      startedAt: minutesAgo(startedMinutesAgo),
      finishedAt: finishedMinutesAgo === null ? null : minutesAgo(finishedMinutesAgo),
      ok,
      dryRun,
      failed
    },
    select: { id: true }
  });
}

const clearRuns = () => db.caseWorkRetentionRun.deleteMany({});

async function seedTransferredDraft({ ownerUserId, transferredAt, marker }) {
  const caseWork = await db.caseWorkAssist.create({ data: { ownerUserId } });
  const draft = await db.caseWorkDraft.create({
    data: {
      caseWorkAssistId: caseWork.id,
      draftType: "POORDUMISE_KOKKUVOTE",
      transferState: "ULE_KANTUD",
      transferredAt
    }
  });
  await db.caseWorkDraftField.create({
    data: {
      draftId: draft.id,
      fieldKey: "SONDI_MARKER",
      text: marker,
      provenance: "TOOTAJA_SISESTUS"
    }
  });
  return draft;
}

async function seedArchivedCase({ ownerUserId, archivedAt }) {
  const caseWork = await db.caseWorkAssist.create({
    data: { ownerUserId, retentionState: "ARCHIVED" }
  });
  await db.caseWorkRetentionAudit.create({
    data: {
      caseWorkAssistId: caseWork.id,
      ownerUserId,
      actorUserId: ownerUserId,
      fromState: "READ_ONLY",
      toState: "ARCHIVED",
      reason: "SOL-CW-14 sünteetiline runtime-sond",
      createdAt: archivedAt
    }
  });
  return caseWork;
}

/** Ainult ühe sünteetilise rea kustutus kukub; kõik päringud lähevad endiselt
 * päris Prisma kliendi ja PostgreSQL-i vastu. */
function failCaseDeleteOnce({ caseWorkAssistId }) {
  const caseDelegate = new Proxy(db.caseWorkAssist, {
    get(target, property) {
      if (property === "deleteMany") {
        return async args => {
          if (args?.where?.id === caseWorkAssistId) {
            const error = new Error("synthetic retention row failure");
            error.name = "SyntheticRowFailure";
            throw error;
          }
          return target.deleteMany(args);
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });

  return new Proxy(db, {
    get(target, property) {
      if (property === "caseWorkAssist") return caseDelegate;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  lines.push(`  ···  ajutine andmebaas ${databaseName} loodud`);

  /* ── A. Skeem ─────────────────────────────────────────────────────────── */
  runPrisma(["migrate", "deploy"]);
  runPrisma(["migrate", "status"]);
  check("A1 migratsiooniahel rakendub tühjale PostgreSQL-ile", true);

  const constraints = await db.$queryRaw`
    SELECT conname FROM pg_constraint
    WHERE conrelid = '"CaseWorkRetentionRun"'::regclass AND contype = 'c'
    ORDER BY conname`;
  const names = constraints.map(row => row.conname);
  check(
    "A2 mõlemad CHECK-id on PÄRIS andmebaasis",
    names.includes("CaseWorkRetentionRun_counters_non_negative") &&
      names.includes("CaseWorkRetentionRun_ok_requires_finish"),
    names.join(", ") || "ühtegi CHECK-i ei leitud"
  );

  /* ── B. Ajavöönd ──────────────────────────────────────────────────────── */
  /* ILMA SELLETA MÕÕDAB KOGU ÜLEJÄÄNUD SOND ARENDUSMASINA AJAVÖÖNDIT. Masin on
     Europe/Tallinn (+3), server UTC; kui rakenduse kirjutatud hetk ja
     andmebaasi UTC lahkneksid, näeks kolme tunni vanune rida värskena või
     vastupidi — ja iga läve-mõõtmine allpool oleks väljamõeldis. */
  const marker = await seedRun({ startedMinutesAgo: 0 });
  const [{ drift }] = await db.$queryRaw`
    SELECT EXTRACT(EPOCH FROM ((NOW() AT TIME ZONE 'UTC') - "startedAt")) AS drift
    FROM "CaseWorkRetentionRun" WHERE "id" = ${marker.id}`;
  const driftSeconds = Math.abs(Number(drift));
  check(
    "B1 rakenduse kirjutatud aeg ja andmebaasi UTC langevad kokku",
    driftSeconds < 60,
    `nihe ${driftSeconds.toFixed(1)} s${driftSeconds >= 60 ? " — AJAVÖÖND LAHKNEB" : ""}`
  );
  await clearRuns();

  /* ── C. Rida tekib enne tööd ──────────────────────────────────────────── */
  const started = await startRetentionRun({ db });
  const openRow = await db.caseWorkRetentionRun.findUnique({
    where: { id: started.id },
    select: { finishedAt: true, ok: true }
  });
  check(
    "C1 rida tekib ENNE tööd ja on avatud (finishedAt null, ok false)",
    openRow?.finishedAt === null && openRow?.ok === false
  );
  const openHealth = await getRetentionHealth({ db });
  check(
    "C2 pooleli jäänud jooks EI OLE edukas jooks",
    openHealth.state === RETENTION_HEALTH.ALARM && openHealth.reason === "casework.retention.health.never_succeeded",
    `${openHealth.state} / ${openHealth.reason}`
  );

  /* Erindi TEADET ei salvestata, ainult klass ja kood. */
  const secret = "SALAJANE kirje sisu, mis EI TOHI jooksureale jõuda";
  const error = Object.assign(new Error(secret), { name: "PrismaClientKnownRequestError", code: "P2002" });
  await finishRetentionRun({ runId: started.id, result: { failed: 1 }, error, db });
  const closed = await db.caseWorkRetentionRun.findUnique({
    where: { id: started.id },
    select: { finishedAt: true, ok: true, failed: true, errorName: true, errorCode: true }
  });
  check(
    "C3 käivitaja sulgeb rea ka kukkumisel ja tõrgetega partii EI OLE edukas",
    closed?.finishedAt instanceof Date && closed?.ok === false && closed?.failed === 1
  );
  const stored = JSON.stringify(closed);
  check(
    "C4 erindi TEADET ei salvestata, ainult klass ja kood",
    !stored.includes("SALAJANE") && closed?.errorName === "PrismaClientKnownRequestError" && closed?.errorCode === "P2002"
  );
  await clearRuns();

  /* ── D/E. Andmebaas keeldub ───────────────────────────────────────────── */
  await expectRejected("D1 `ok = true` ilma lõpuajata → andmebaas keeldub", () =>
    db.caseWorkRetentionRun.create({ data: { ok: true, finishedAt: null } })
  );
  /* PEEGELPILT: „algas ja ei lõpetanud" PEAB olema võimalik, muidu ei saaks
     `startRetentionRun()` üldse kirjutada ja C1 tõendaks ainult iseennast. */
  const openAllowed = await db.caseWorkRetentionRun.create({ data: { ok: false, finishedAt: null }, select: { id: true } });
  check("D2 aga `ok = false` ilma lõpuajata on LUBATUD (rida enne tööd)", Boolean(openAllowed?.id));
  await clearRuns();

  const negative = await startRetentionRun({ db });
  await expectRejected("E1 negatiivne loendur → andmebaas keeldub päris kirjutusrajal", () =>
    finishRetentionRun({ runId: negative.id, result: { draftsPurged: -1 }, db })
  );
  await clearRuns();

  /* ── F. Tervis mõlemast otsast ────────────────────────────────────────── */
  const health = async () => getRetentionHealth({ db });

  const never = await health();
  check(
    "F1 ükski jooks kunagi → NEVER_RUN, mitte vaikne OK",
    never.state === RETENTION_HEALTH.NEVER_RUN && never.nextRunAt === null,
    never.state
  );

  await seedRun({ startedMinutesAgo: 5, finishedMinutesAgo: 4, ok: true });
  const fresh = await health();
  check(
    "F2 värske edukas jooks → OK ja ütleb VIIMASE ning JÄRGMISE jooksu välja",
    fresh.state === RETENTION_HEALTH.OK && Boolean(fresh.lastSuccessAt) && Boolean(fresh.nextRunAt),
    `${fresh.state} · järgmine ${fresh.nextRunAt?.toISOString?.() || "—"}`
  );
  await clearRuns();

  await seedRun({
    startedMinutesAgo: THRESHOLD_MINUTES + 60,
    finishedMinutesAgo: THRESHOLD_MINUTES + 59,
    ok: true
  });
  const stale = await health();
  check(
    "F3 üle läve vana õnnestumine → ALARM",
    stale.state === RETENTION_HEALTH.ALARM && stale.reason === "casework.retention.health.stale",
    `${stale.state} · ${stale.staleMinutes} min`
  );
  await clearRuns();

  /* TÄPSELT PIIRIL. Lävi on `>`, seega piiripealne jooks on veel korras. Ilma
     selle reata ei eristaks F3 „lävi töötab" ja „kõik vana on alarm".
     `now` on siin ANTUD, mitte `new Date()`: piir on millisekundi täpsusega ja
     mõõtmine ise võtab aega — kella liikumine mõõtmise vältel teeks piiripealse
     rea vaikselt üle-läve reaks ja test mõõdaks iseenda aeglust. */
  const boundary = new Date();
  const boundaryStamp = new Date(boundary.getTime() - THRESHOLD_MINUTES * MINUTE_MS);
  await db.caseWorkRetentionRun.create({
    data: { startedAt: boundaryStamp, finishedAt: boundaryStamp, ok: true }
  });
  const edge = await getRetentionHealth({ db, now: boundary });
  check(
    "F4 TÄPSELT piiril → veel OK (lävi on `>`, mitte `>=`)",
    edge.state === RETENTION_HEALTH.OK,
    `${edge.state} · ${edge.staleMinutes} min lävest ${THRESHOLD_MINUTES}`
  );
  /* ÜKS MILLISEKUND ÜLE — sama rida, sama kood, vastupidine vastus. Ilma selleta
     tõendaks F4 ainult seda, et miski annab „OK". */
  const overEdge = await getRetentionHealth({ db, now: new Date(boundary.getTime() + 1) });
  check(
    "F4b üks millisekund üle piiri → ALARM",
    overEdge.state === RETENTION_HEALTH.ALARM,
    overEdge.state
  );
  await clearRuns();

  await seedRun({ startedMinutesAgo: 5, finishedMinutesAgo: 4, ok: true, dryRun: true });
  const dry = await health();
  check(
    "F5 ainult KUIV jooks → ALARM (kuiv käivitus ei kirjuta midagi)",
    dry.state === RETENTION_HEALTH.ALARM && dry.reason === "casework.retention.health.never_succeeded",
    `${dry.state} / ${dry.reason}`
  );
  await clearRuns();

  await seedRun({ startedMinutesAgo: 90, finishedMinutesAgo: 89, ok: false, failed: 3 });
  await seedRun({ startedMinutesAgo: 30, finishedMinutesAgo: 29, ok: false, failed: 2 });
  const failing = await health();
  check(
    "F6 jooksud käivad, aga ükski ei õnnestu → ALARM",
    failing.state === RETENTION_HEALTH.ALARM && failing.lastRunOk === false,
    `${failing.state} / ${failing.reason}`
  );

  /* ── G. Säilitustöö päris PostgreSQL-is ──────────────────────────────── */
  process.env.CASEWORK_V1_ENABLED = "1";
  const retentionNow = new Date("2026-08-13T12:00:00.000Z");
  const cutoff = addMonths(retentionNow, -12);
  const owner = await db.user.create({
    data: { email: `casework.retention.probe.${Date.now()}@sotsiaalai.test`, role: "SOCIAL_WORKER" }
  });

  const draftBefore = await seedTransferredDraft({
    ownerUserId: owner.id,
    transferredAt: new Date(cutoff.getTime() + 1),
    marker: "tähtaja eel säiliv sünteetiline väli"
  });
  const draftDue = await seedTransferredDraft({
    ownerUserId: owner.id,
    transferredAt: cutoff,
    marker: "tähtajal kustuv sünteetiline väli"
  });
  const draftResult = await runRetention({ now: retentionNow, batch: 20, db, logger: { error() {} } });
  const [draftBeforeAfter, draftDueAfter, fieldsBefore, fieldsDue] = await Promise.all([
    db.caseWorkDraft.findUnique({ where: { id: draftBefore.id }, select: { contentPurgedAt: true } }),
    db.caseWorkDraft.findUnique({ where: { id: draftDue.id }, select: { contentPurgedAt: true } }),
    db.caseWorkDraftField.count({ where: { draftId: draftBefore.id } }),
    db.caseWorkDraftField.count({ where: { draftId: draftDue.id } })
  ]);
  check(
    "G1 mustand üks millisekund tähtaja eel → sisu säilib",
    draftBeforeAfter?.contentPurgedAt === null && fieldsBefore === 1
  );
  check(
    "G2 mustand täpselt tähtajal → sisu kustub, tõendirida säilib",
    draftResult.draftsPurged === 1 &&
      draftResult.draftFieldsDeleted === 1 &&
      draftDueAfter?.contentPurgedAt?.getTime() === retentionNow.getTime() &&
      fieldsDue === 0
  );

  const caseBefore = await seedArchivedCase({
    ownerUserId: owner.id,
    archivedAt: new Date(cutoff.getTime() + 1)
  });
  const caseDue = await seedArchivedCase({ ownerUserId: owner.id, archivedAt: cutoff });
  const caseResult = await runRetention({ now: retentionNow, batch: 20, db, logger: { error() {} } });
  const [caseBeforeAfter, caseDueAfter] = await Promise.all([
    db.caseWorkAssist.findUnique({ where: { id: caseBefore.id }, select: { id: true } }),
    db.caseWorkAssist.findUnique({ where: { id: caseDue.id }, select: { id: true } })
  ]);
  check(
    "G3 juhtum üks millisekund tähtaja eel → juhtum ja audit säilivad",
    Boolean(caseBeforeAfter) &&
      (await db.caseWorkRetentionAudit.count({ where: { caseWorkAssistId: caseBefore.id } })) === 1
  );
  check(
    "G4 juhtum täpselt tähtajal → päris DB-kaskaad kustutab juhtumi ja auditi",
    caseResult.casesDeleted === 1 &&
      caseDueAfter === null &&
      (await db.caseWorkRetentionAudit.count({ where: { caseWorkAssistId: caseDue.id } })) === 0
  );

  const retryCase = await seedArchivedCase({ ownerUserId: owner.id, archivedAt: cutoff });
  const failedResult = await runRetention({
    now: retentionNow,
    batch: 20,
    db: failCaseDeleteOnce({ caseWorkAssistId: retryCase.id }),
    logger: { error() {} }
  });
  check(
    "G5 ühe rea tõrge ei peata partiid ja rida jääb uuesti leitavaks",
    failedResult.failed === 1 &&
      Boolean(await db.caseWorkAssist.findUnique({ where: { id: retryCase.id }, select: { id: true } }))
  );
  const recoveredResult = await runRetention({ now: retentionNow, batch: 20, db, logger: { error() {} } });
  check(
    "G6 järgmine jooks taastab reatõrkest ja kustutab sama rea koos auditiga",
    recoveredResult.failed === 0 &&
      recoveredResult.casesDeleted === 1 &&
      (await db.caseWorkAssist.count({ where: { id: retryCase.id } })) === 0 &&
      (await db.caseWorkRetentionAudit.count({ where: { caseWorkAssistId: retryCase.id } })) === 0
  );

  /* ── H. Smoke päris protsessina ───────────────────────────────────────── */
  const alarmOn = runSmoke({ gateOn: true });
  check(
    "H1 ALARM + värav sees → VÄLJUMISKOOD 1",
    alarmOn.code === 1 && /ALARM/.test(alarmOn.out),
    `kood ${alarmOn.code} · ${alarmOn.tail}`
  );

  const alarmOff = runSmoke({ gateOn: false });
  check(
    "H2 sama ALARM + värav VÄLJAS → kood 0 ja ta ütleb selle välja",
    alarmOff.code === 0 && /värav on väljas/.test(alarmOff.out),
    `kood ${alarmOff.code} · ${alarmOff.tail}`
  );
  await clearRuns();

  await seedRun({ startedMinutesAgo: 5, finishedMinutesAgo: 4, ok: true });
  const okRun = runSmoke({ gateOn: true });
  check(
    "H3 korras seis + värav sees → kood 0 ja väljund nimetab kolme asja",
    okRun.code === 0 &&
      /viimane edukas jooks:/.test(okRun.out) &&
      /järgmine jooks:/.test(okRun.out) &&
      /seis: OK/.test(okRun.out),
    `kood ${okRun.code} · ${okRun.tail}`
  );

  /* KATKINE SKEEM EI TOHI VAIKIDA. Smoke, mis kukub päringu peal, peab jõudma
     samasse väljumiskoodi mis alarm — muidu tähendaks katkine migratsioon
     järelevalve jaoks „kõik hästi". */
  await db.$executeRawUnsafe('DROP TABLE "CaseWorkRetentionRun"');
  const broken = runSmoke({ gateOn: true });
  check(
    "H4 katkine skeem → kood 1, mitte vaikne 0",
    broken.code === 1 && /KUKKUS/.test(broken.out),
    `kood ${broken.code} · ${broken.tail}`
  );
} finally {
  await db.$disconnect().catch(() => {});
  await admin
    .query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [
      databaseName
    ])
    .catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});

  /* KORISTUST KONTROLLITAKSE, MITTE EI EELDATA. */
  const left = await admin
    .query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName])
    .catch(() => ({ rowCount: -1 }));
  check("I1 ajutine andmebaas on kustutatud", left.rowCount === 0, `pg_database ridu: ${left.rowCount}`);
  await admin.end().catch(() => {});

  console.log("\nSOL-CW-14 — säilitustöö ajastuse runtime-sond\n");
  console.log(lines.join("\n"));
  console.log(
    `\n  ${failures === 0 ? "KÕIK ROHELINE" : `${failures} VIGA`} · kontrolle: ${lines.filter(line => !line.startsWith("  ···")).length} · intervall ${RETENTION_INTERVAL_MINUTES} min · lävi ${THRESHOLD_MINUTES} min\n`
  );
  process.exitCode = failures === 0 ? 0 : 1;
}
