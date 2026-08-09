#!/usr/bin/env node
/**
 * JTA-V1 (E2) / SOL-CW-18 — laua KOORMUSSOND.
 *
 * MIKS TA OLEMAS ON. `npm test` jookseb fake-Prisma peal, mis ei ava ühtegi
 * ühendust — ja SOL-CW-18 sisu on täpselt see, mis juhtub ÜHENDUSTEGA pärast
 * seda, kui HTTP vastus on juba läinud. Lepingutest saab tõendada, et pesa
 * konfiguratsioonis SEISAB `statement_timeout`; ainult päris PostgreSQL saab
 * tõendada, et backend on pärast tähtaega KADUNUD.
 *
 * Auditi vastuvõtukriteerium sõna-sõnalt: „Koormustest peab hoidma ühe allika
 * rippumas, tegema korduvaid refresh'e ja tõendama, et lõpetatud HTTP järel
 * töö/ühendus ei jää elama." Kolm asja, kolm sektsiooni allpool.
 *
 * NEGATIIVKONTROLL ON SISSE EHITATUD JA TA ON SONDI KÕIGE TÄHTSAM OSA. Sama
 * rippuv päring käib läbi KAHE pesa: ilma statement-timeout'ita (leiu-eelne
 * seis) ja laua omaga. Kui esimene EI jäta backend'i elama, siis sond ei mõõda
 * midagi ja tema roheline on väärtusetu — seepärast on „vana rada jätab töö
 * elama" siin nõue, mitte tähelepanek.
 *
 * VISATAV ANDMEBAAS, MITTE ARENDUSBAAS. Sama muster ja sama põhjus mis
 * `casework-retention-probe.mjs`-il; koristust kontrollitakse.
 *
 * Käivitamine:
 *   npm run casework:workbench:probe
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCaseWorkbench, SECTION_STATE, WORKBENCH_SECTIONS } from "../lib/casework/workbench.js";
import { CASEWORK_FLAG_KEYS } from "../lib/casework/flags.js";
import { WORKBENCH_APPLICATION_NAME, workbenchPoolConfig } from "../lib/casework/workbenchDb.js";
import { WORKBENCH_DB_POOL_MAX, WORKBENCH_SECTION_DEADLINE_MS } from "../lib/casework/workbenchLimits.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.WORKBENCH_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_workbench_probe_${Date.now()}`;
if (!/^sotsiaal_ai_workbench_probe_\d+$/.test(databaseName)) {
  throw new Error("Ebaturvaline ajutise andmebaasi nimi");
}

const adminUrl = new URL(parsed);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const probeUrl = new URL(parsed);
probeUrl.pathname = `/${databaseName}`;

const CONTROL_APPLICATION_NAME = "sotsiaalai-workbench-probe-control";
/** Piisavalt pikk, et 2,5 s tähtaeg jõuaks kindlalt enne teda. */
const HANG_SECONDS = 20;
/** Kui kaua pärast tähtaega backend'i otsida. Katkestus ei ole hetkeline. */
const GRACE_MS = 1500;

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
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}`);
}

/** Vaatleja on ERALDI ühendus: laua pesa võib olla just täis ja siis ei saaks ta iseennast mõõta. */
let observer = null;

async function activeBackends(applicationName) {
  const { rows } = await observer.query(
    `SELECT count(*)::int AS live
       FROM pg_stat_activity
      WHERE datname = $1 AND application_name = $2 AND state = 'active' AND query LIKE '%pg_sleep%'`,
    [databaseName, applicationName]
  );
  return rows[0]?.live ?? -1;
}

/**
 * „HTTP vastus" — täpselt see, mida laud teeb: oota tähtajani ja mine edasi.
 * Päringu enda lubadus jäetakse teadlikult rippuma, sest just tema saatust
 * mõõdame. `.catch()` hoiab ära `unhandledRejection`-i.
 */
function hangingQuery(client) {
  const promise = client.$queryRawUnsafe(`SELECT pg_sleep(${HANG_SECONDS})`).catch(error => error);
  return promise;
}

await admin.connect();
let control = null;
let workbench = null;

try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  lines.push(`  ···  ajutine andmebaas ${databaseName} loodud`);
  runPrisma(["migrate", "deploy"]);

  observer = new pg.Client({ connectionString: probeUrl.toString(), application_name: "sotsiaalai-workbench-probe-observer" });
  await observer.connect();

  /* VANA RADA: pesa ilma statement-timeout'ita. */
  control = new PrismaClient({
    adapter: new PrismaPg({ connectionString: probeUrl.toString(), application_name: CONTROL_APPLICATION_NAME, max: 5 }),
    log: []
  });

  /* LAUA RADA: PÄRIS konfiguratsioon lib-ist, mitte koopia. Koopia mõõdaks
     sondi enda arusaama, mitte seda, mis toodangus jookseb. */
  workbench = new PrismaClient({
    adapter: new PrismaPg(workbenchPoolConfig(probeUrl.toString())),
    log: []
  });

  /* ── A. NEGATIIVKONTROLL: vana rada JÄTAB töö elama ───────────────────── */
  const controlHang = hangingQuery(control);
  await delay(WORKBENCH_SECTION_DEADLINE_MS + GRACE_MS);
  const controlLive = await activeBackends(CONTROL_APPLICATION_NAME);
  check(
    "A1 ILMA statement-timeout'ita jääb töö pärast tähtaega ELAMA (leiu-eelne seis)",
    controlLive > 0,
    `aktiivseid backend'e: ${controlLive}`
  );

  /* ── B. LAUA RADA: töö on pärast tähtaega KADUNUD ─────────────────────── */
  const workbenchHang = hangingQuery(workbench);
  await delay(WORKBENCH_SECTION_DEADLINE_MS + GRACE_MS);
  const workbenchLive = await activeBackends(WORKBENCH_APPLICATION_NAME);
  check(
    "B1 laua pesas on töö pärast tähtaega KADUNUD",
    workbenchLive === 0,
    `aktiivseid backend'e: ${workbenchLive}`
  );

  const hangResult = await workbenchHang;
  const driverCause = hangResult?.meta?.driverAdapterError?.cause;
  check(
    "B2 katkestus tuleb PostgreSQL-ilt koodiga 57014, mitte kliendi ajapiirist",
    driverCause?.code === "57014" || driverCause?.originalCode === "57014",
    `${hangResult?.name || typeof hangResult} / ${hangResult?.code || "—"}`
  );

  /* ── C. KORDUVAD REFRESH'ID ───────────────────────────────────────────── */
  /* Kriteeriumi teine pool: „korduvad refresh'id kuhjavad nähtamatu
     taustakoormuse". Viis vooru à kümme päringut = viiskümmend tööd, mis vanas
     maailmas oleksid kõik veel elus. */
  const ROUNDS = 5;
  const PER_ROUND = WORKBENCH_DB_POOL_MAX;
  let peak = 0;
  const pending = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    for (let index = 0; index < PER_ROUND; index += 1) pending.push(hangingQuery(workbench));
    await delay(250);
    peak = Math.max(peak, await activeBackends(WORKBENCH_APPLICATION_NAME));
  }

  check(
    "C1 pesa ülempiir peab ka refresh-tulva ajal (backend'e ei kasva üle max)",
    peak > 0 && peak <= WORKBENCH_DB_POOL_MAX,
    `tipp ${peak}, ülempiir ${WORKBENCH_DB_POOL_MAX}`
  );

  await Promise.allSettled(pending);
  await delay(GRACE_MS);
  const afterStorm = await activeBackends(WORKBENCH_APPLICATION_NAME);
  check(
    "C2 pärast 50 päringut ei jää ÜHTEGI tööd elama",
    afterStorm === 0,
    `aktiivseid backend'e: ${afterStorm}`
  );

  /* Ja vana rada on ikka veel elus — tõend, et C2 roheline ei tule sellest, et
     `pg_sleep` juhtumisi lõppes. */
  const controlStillLive = await activeBackends(CONTROL_APPLICATION_NAME);
  check(
    "C3 samal ajal on vana raja töö ikka veel elus (C2 ei tule aja möödumisest)",
    controlStillLive > 0,
    `aktiivseid backend'e: ${controlStillLive}`
  );

  /* ── D. Laud ise päris PostgreSQL-i vastu ─────────────────────────────── */
  process.env[CASEWORK_FLAG_KEYS.ENABLED] = "1";
  const board = await getCaseWorkbench({
    userId: "sond-kasutaja",
    roleState: { effectiveRole: "SOCIAL_WORKER" },
    db: workbench
  });
  const states = WORKBENCH_SECTIONS.map(key => `${key}=${board.sections[key]?.state}`);
  const bad = states.filter(entry => /ERROR|TIMEOUT/.test(entry));
  check(
    "D1 kõik kümme sektsiooni vastavad päris andmebaasis (EMPTY/OK, mitte ERROR)",
    bad.length === 0,
    bad.length ? bad.join(", ") : `${WORKBENCH_SECTIONS.length} sektsiooni`
  );
  check(
    "D2 tühjal andmestikul on iga sektsioon EMPTY",
    WORKBENCH_SECTIONS.every(key => board.sections[key]?.state === SECTION_STATE.EMPTY),
    states.join(", ").slice(0, 160)
  );

  await controlHang;
} finally {
  await workbench?.$disconnect().catch(() => {});
  await control?.$disconnect().catch(() => {});
  await observer?.end().catch(() => {});

  await admin
    .query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()", [
      databaseName
    ])
    .catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`).catch(() => {});

  const left = await admin
    .query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName])
    .catch(() => ({ rowCount: -1 }));
  check("E1 ajutine andmebaas on kustutatud", left.rowCount === 0, `pg_database ridu: ${left.rowCount}`);
  await admin.end().catch(() => {});

  console.log("\nSOL-CW-18 — laua koormussond\n");
  console.log(lines.join("\n"));
  console.log(
    `\n  ${failures === 0 ? "KÕIK ROHELINE" : `${failures} VIGA`} · tähtaeg ${WORKBENCH_SECTION_DEADLINE_MS} ms · pesa max ${WORKBENCH_DB_POOL_MAX}\n`
  );
  process.exitCode = failures === 0 ? 0 : 1;
}
