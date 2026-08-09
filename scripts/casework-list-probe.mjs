#!/usr/bin/env node
/**
 * JUHTUM-V1 / SOL-CW-20 — juhtumiloendi cursor PÄRIS PostgreSQL-i vastu.
 *
 * MIKS TA OLEMAS ON. `tests/casework/caseListCursor.test.js` kirjutab fake-poe,
 * mis hindab keyset-tingimust ise — ja just see on tema piir: fake tõendab, et
 * MINU where-puu loogika on õige, mitte seda, et **Prisma selle päringu vastu
 * võtab**. Pesastatud `AND`/`OR` koos `lt`/`lte` võrdlustega `DateTime` peal on
 * täpselt see koht, kus fake ütleb „roheline" ja päris andmebaas ütleb midagi
 * muud. Sama õppetund mis [[fake-prisma-ei-valideeri]].
 *
 * MIDA TA TÕENDAB:
 *   1. keyset-päring KÄIVITUB päris Prisma ja päris PostgreSQL-i peal
 *   2. lehitsemine annab iga rea TÄPSELT ÜKS KORD ja lõpeb
 *   3. sama millisekundi read järjestuvad stabiilselt (sortimisvõtme teine pool)
 *   4. vahepeal muudetud rida ei kordu ega katkesta lehitsemist
 *   5. loetamatu cursor annab 400, mitte 500
 *
 * VISATAV ANDMEBAAS, MITTE ARENDUSBAAS. Sama muster ja sama põhjus mis teistel
 * juhtumitöö sondidel; koristust kontrollitakse.
 *
 * Käivitamine:
 *   npm run casework:list:probe
 */

import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { listCaseWorkAssists } from "../lib/casework/caseWorkAssist.js";
import { CASEWORK_FLAG_KEYS } from "../lib/casework/flags.js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const sourceUrl = String(process.env.DATABASE_URL || "").trim();
if (!sourceUrl) throw new Error("DATABASE_URL puudub");

const parsed = new URL(sourceUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(parsed.hostname) && process.env.LIST_PROBE_ALLOW_REMOTE !== "true") {
  throw new Error(`Sond loob ajutise andmebaasi ainult localhostil (host: ${parsed.hostname || "tundmatu"})`);
}

const databaseName = `sotsiaal_ai_list_probe_${Date.now()}`;
if (!/^sotsiaal_ai_list_probe_\d+$/.test(databaseName)) throw new Error("Ebaturvaline ajutise andmebaasi nimi");

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
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} kukkus koodiga ${result.status}`);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: probeUrl.toString() }), log: [] });

const at = minutes => new Date(Date.UTC(2026, 7, 9, 12, minutes, 0));

/** Lehitseb lõpuni. `mutate` jookseb iga lehe järel. */
async function paginate(owner, { limit = 2, mutate = null } = {}) {
  const seen = [];
  let cursor = null;
  for (let page = 0; page < 20; page += 1) {
    const result = await listCaseWorkAssists({ ownerUserId: owner, cursor, limit, db });
    seen.push(...result.items.map(item => item.id));
    cursor = result.nextCursor;
    if (!cursor) break;
    if (mutate) await mutate(page);
  }
  return seen;
}

await admin.connect();
try {
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  lines.push(`  ···  ajutine andmebaas ${databaseName} loodud`);
  runPrisma(["migrate", "deploy"]);

  process.env[CASEWORK_FLAG_KEYS.ENABLED] = "1";

  const owner = await db.user.create({ data: { role: "SOCIAL_WORKER" }, select: { id: true } });

  /* `updatedAt` on `@updatedAt`, seega teda ei saa `create`-l valida — paneme
     ta paika toore SQL-iga, sest just tema on kogu leiu ese. */
  const ids = [];
  for (let index = 5; index >= 1; index -= 1) {
    const created = await db.caseWorkAssist.create({
      data: { ownerUserId: owner.id, clientDisplayName: `sond ${index}` },
      select: { id: true }
    });
    await db.$executeRaw`UPDATE "CaseWorkAssist" SET "updatedAt" = ${at(index * 10)} WHERE "id" = ${created.id}`;
    ids.push(created.id);
  }
  /* `ids` on loomise järjekorras (uusim `updatedAt` esimesena) = ootuspärane
     loendi järjekord. */

  const clean = await paginate(owner.id, { limit: 2 });
  check("1a keyset-päring käivitub päris Prisma ja PostgreSQL-i peal", clean.length > 0, `${clean.length} rida`);
  check("1b iga rida tuleb TÄPSELT ÜKS KORD ja õiges järjekorras", JSON.stringify(clean) === JSON.stringify(ids), clean.length === new Set(clean).size ? "" : "KORDUS");

  /* 2. sama millisekund — sortimisvõtme teine pool. */
  const tie = await db.user.create({ data: { role: "SOCIAL_WORKER" }, select: { id: true } });
  const tieIds = [];
  for (let index = 0; index < 4; index += 1) {
    const created = await db.caseWorkAssist.create({
      data: { ownerUserId: tie.id, clientDisplayName: `tie ${index}` },
      select: { id: true }
    });
    await db.$executeRaw`UPDATE "CaseWorkAssist" SET "updatedAt" = ${at(30)} WHERE "id" = ${created.id}`;
    tieIds.push(created.id);
  }
  const tieSeen = await paginate(tie.id, { limit: 2 });
  const expectedTie = [...tieIds].sort().reverse();
  check(
    "2a sama millisekundi read järjestuvad ID järgi ega kordu",
    JSON.stringify(tieSeen) === JSON.stringify(expectedTie),
    tieSeen.length === new Set(tieSeen).size ? `${tieSeen.length} rida` : "KORDUS"
  );

  /* 3. vahepeal üles hüpanud rida. */
  const bumped = await paginate(owner.id, {
    limit: 2,
    mutate: async page => {
      if (page !== 0) return;
      /* Esimese lehe viimane rida hüppab etteotsa — täpselt see, mida teeb
         lapse kirjutus paralleelses vahekaardis (`touchCase`). */
      await db.$executeRaw`UPDATE "CaseWorkAssist" SET "updatedAt" = ${at(59)} WHERE "id" = ${ids[1]}`;
    }
  });
  check("3a vahepeal muudetud cursor-rida ei kordu", bumped.length === new Set(bumped).size, bumped.join(",").slice(0, 60));
  check("3b lehitsemine ei katke ega jää lõputult käima", bumped.length === ids.length, `${bumped.length}/${ids.length}`);

  /* 4. vigane cursor. */
  let cursorStatus = null;
  try {
    await listCaseWorkAssists({ ownerUserId: owner.id, cursor: ids[0], db });
  } catch (error) {
    cursorStatus = error?.status || null;
  }
  check("4a vana kujuga (paljas ID) cursor annab 400, mitte 500", cursorStatus === 400, `status ${cursorStatus}`);
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
  check("5a ajutine andmebaas on kustutatud", left.rowCount === 0, `pg_database ridu: ${left.rowCount}`);
  await admin.end().catch(() => {});

  console.log("\nSOL-CW-20 — juhtumiloendi cursor päris PostgreSQL-i vastu\n");
  console.log(lines.join("\n"));
  console.log(`\n  ${failures === 0 ? "KÕIK ROHELINE" : `${failures} VIGA`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}
