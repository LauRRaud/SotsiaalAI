#!/usr/bin/env node
/**
 * SOL-RES-03 — kas töö loonud protsess näeb teise protsessi tehtud lõppu? Päris kaks protsessi.
 *
 *   npm run research:worker:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Leid on PROTSESSIDEÜLENE: töö loonud frontend pani iga
 * uue töö oma lokaalsesse Map'i, worker-režiimis aga jooksutab tööd hoopis teine protsess, kes
 * uuendab oma runtime-objekti. Kuna snapshot, result ja SSE eelistasid Map'i andmebaasile, võis töö
 * DB-s edukalt lõppeda, samal ajal kui teda loonud protsess andis lõputult `queued`. Ühe protsessi
 * sees seda ei saa mõõta — kogu viga ongi selles, et kaks protsessi hoiavad eri tõde.
 *
 * MÕÕDETAV VÄIDE: worker-režiimis loodud tööl EI OLE loonud protsessis runtime-objekti, seega teise
 * protsessi tehtud lõpp on kohe nähtav. Negatiivkontroll näitab sama harnessi all, et inline-režiimi
 * runtime-objekt PÄRISELT varjutab andmebaasi — seega mehhanism, mille vastu parandus käib, on päris.
 *
 * Andmed: ainult `@sol-worker.invalid` sünteetiline konto; skript koristab lõpus.
 */

process.env.RESEARCH_JOB_MODE = "worker";

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import prisma from "../lib/prisma.js";

const { createResearchJob, getResearchJobSnapshot, getResearchJobResult } = await import(
  "../lib/research/jobStore.js"
);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHILD = path.join(ROOT, "scripts", "probes", "research-job-child.mjs");
// Windowsis peab `--import` saama file:// URL-i, mitte ketta-tee.
const LOADER = pathToFileURL(path.join(ROOT, "scripts", "register-node-test-loader.mjs")).href;
const SUFFIX = "@sol-worker.invalid";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

/** Käivitab abilise päris eraldi protsessina ja tagastab tema JSON-read. */
function runChild(args, { onLine } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", LOADER, CHILD, ...args], {
      cwd: ROOT,
      env: { ...process.env, RESEARCH_JOB_MODE: "" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const lines = [];
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      buffer += String(chunk);
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const raw = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            lines.push(parsed);
            onLine?.(parsed);
          } catch {}
        }
        index = buffer.indexOf("\n");
      }
    });
    child.stderr.on("data", () => {});
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve(lines) : reject(new Error(`child exited ${code}`))));
  });
}

async function makeOwner() {
  return prisma.user.create({
    data: {
      email: `owner-${Math.random().toString(36).slice(2, 8)}${SUFFIX}`,
      role: "SOCIAL_WORKER",
      emailVerified: NOW
    }
  });
}

async function purge() {
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    await prisma.researchJob.deleteMany({ where: { userId: { in: ownerIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-RES-03 — teise protsessi lõpetatud töö nähtavus\n");
  await purge();

  // === 1. WORKER-REŽIIM: LOONUD PROTSESS NÄEB TEISE PROTSESSI LÕPPU ======
  {
    const owner = await makeOwner();
    const job = await createResearchJob({
      userId: owner.id,
      payload: { query: "sondi päring", profile: "standard" }
    });

    expect("worker-režiimis loodud tööl ei ole selles protsessis runtime-objekti", job.ownedByThisProcess === false);

    const before = await getResearchJobSnapshot(job.id);
    expect("enne lõppu on seis queued", before?.status === "queued", String(before?.status));

    const childLines = await runChild(["finish", job.id]);
    expect("teine protsess lõpetas töö", childLines.some((line) => line.finished === true));
    expect(
      "teine protsess oli PÄRIS eraldi protsess",
      childLines.some((line) => Number(line.pid) > 0 && Number(line.pid) !== process.pid),
      "sama pid — siis ei olnud tegu teise protsessiga"
    );

    const after = await getResearchJobSnapshot(job.id);
    expect("loonud protsess NÄEB lõppu kohe", after?.status === "done", String(after?.status));

    const result = await getResearchJobResult(job.id);
    expect("ka tulemus tuleb andmebaasist", Boolean(result?.result), JSON.stringify(result?.result || null));
  }

  // === 2. NEGATIIVKONTROLL: INLINE-RUNTIME VARJUTAB ANDMEBAASI ============
  /* Sama harness, teine režiim: laps loob töö INLINE-režiimis (seega jääb tal runtime-objekt),
     vanem lõpetab töö andmebaasis, ja laps ütleb, mida TEMA arvab seisuks. Kui ta ütleb `queued`,
     siis mehhanism on päris — ja just seda tegi worker-režiimis kogu aeg ka frontend. */
  {
    const owner = await makeOwner();
    let childJobId = null;
    const lines = await runChild(["inline-hold", owner.id], {
      onLine: (line) => {
        if (line.id && !childJobId) {
          childJobId = line.id;
          // Vanem lõpetab töö andmebaasis, kuni laps ootab.
          prisma.researchJob
            .update({ where: { id: line.id }, data: { status: "done", endedAt: new Date() } })
            .catch(() => {});
        }
      }
    });

    const seen = lines.find((line) => line.seenStatus !== undefined)?.seenStatus;
    const dbStatus = (await prisma.researchJob.findUnique({ where: { id: childJobId } }))?.status;
    expect("negatiivkontroll: andmebaasis ON töö lõppenud", dbStatus === "done", String(dbStatus));
    expect(
      "negatiivkontroll: oma runtime-objektiga protsess näeb ikka VANA seisu",
      seen === "queued",
      `laps nägi "${String(seen)}" — kui ta nägi 'done', ei varjuta Map andmebaasi ja ülemine ei tõenda midagi`
    );
  }
}

async function cleanup() {
  console.log("\ncleanup");
  await purge();
  const left = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  console.log(`  leftovers: ${left} users`);
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error("\nUNCAUGHT", error);
} finally {
  await cleanup();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
