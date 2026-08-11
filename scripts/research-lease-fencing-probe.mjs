#!/usr/bin/env node
/**
 * SOL-RES-04 — lease'i kaotanud worker ei tohi enam kirjutada. Päris kaks workerit, kaks protsessi.
 *
 *   npm run research:lease:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Heartbeat uuendas rida tingimusel `workerId`, aga EI
 * VAADANUD `updateMany.count` väärtust ega katkestanud lokaalset tööd, kui lease kuulus juba
 * teisele workerile. Progressi kirjutus kasutas tingimusteta `update where id` ja kirjutas vana
 * `workerId`/`leaseUntil` tagasi. Terminalsiire nõudis ainult aktiivset staatust. Pausi või
 * heartbeat'i tõrke järel sai uus worker aegunud lease'i claim'ida, aga VANA worker jätkas
 * mudeli- ja RAG-kutseid ning võis terminaltulemuse esimesena commit'ida — topeltkulu ja vale
 * võitja tulemus.
 *
 * MÕÕDETAV VÄIDE: kui uus worker on töö üle võtnud, siis vana workeri kirjutus EI lähe läbi, ta
 * SAAB SELLEST TEADA (lease lost) ja andmebaasi jääb uue omaniku tulemus.
 *
 * Andmed: ainult `@sol-lease.invalid` sünteetiline konto; skript koristab lõpus.
 */

process.env.RESEARCH_JOB_MODE = "worker";

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import prisma from "../lib/prisma.js";

const { cancelResearchJob, claimNextResearchJob, createResearchJob, markResearchDone } = await import(
  "../lib/research/jobStore.js"
);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHILD = path.join(ROOT, "scripts", "probes", "research-job-child.mjs");
const LOADER = pathToFileURL(path.join(ROOT, "scripts", "register-node-test-loader.mjs")).href;
const SUFFIX = "@sol-lease.invalid";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

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

async function makeOwner(local = "owner") {
  return prisma.user.create({
    data: {
      email: `${local}-${Math.random().toString(36).slice(2, 8)}${SUFFIX}`,
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
  console.log("SOL-RES-04 — lease'i kaotanud worker ei kirjuta enam\n");
  await purge();

  // === 1. ÜLEVÕTMINE AEGUNUD LEASE'I PEALT ================================
  {
    const owner = await makeOwner();
    await createResearchJob({ userId: owner.id, payload: { query: "sondi päring" } });

    let childJobId = null;
    const childLines = await runChild(["worker-hold", "worker-A"], {
      onLine: async (line) => {
        if (!line.id || childJobId) return;
        childJobId = line.id;
        // Laps on külmunud. Aegunud lease → teine worker tohib üle võtta.
        await prisma.researchJob.update({
          where: { id: line.id },
          data: { leaseUntil: new Date(Date.now() - 60_000) }
        });
        const takeover = await claimNextResearchJob({ workerId: "worker-B" });
        expect("uus worker võtab aegunud lease'i pealt töö üle", takeover?.id === line.id, String(takeover?.id));
        expect("rea omanik on nüüd uus worker", takeover?.workerId === "worker-B", String(takeover?.workerId));
        // Uus omanik lõpetab töö oma tulemusega.
        await markResearchDone(takeover, { report: "UUE WORKERI TULEMUS" });
      }
    });

    const childResult = childLines.find((line) => line.leaseLost !== undefined) || {};
    expect("vana worker oli päris eraldi protsess", childLines.some((line) => Number(line.pid) !== process.pid));
    expect("vana worker SAI TEADA, et lease on kadunud", childResult.leaseLost === true, JSON.stringify(childResult));
    expect(
      "andmebaasi jäi UUE omaniku tulemus",
      childResult.dbResult === "UUE WORKERI TULEMUS",
      `sai "${String(childResult.dbResult)}"`
    );

    const record = await prisma.researchJob.findUnique({ where: { id: childJobId } });
    expect("töö on lõppenud täpselt ühe korra", record?.status === "done", String(record?.status));
    expect("lõppseisus ei ole enam omanikku", record?.workerId === null, String(record?.workerId));
  }

  // === 2. TÜHISTUS ON JUHTTOIMING, MITTE TULEMUS ==========================
  /* Kui ka tühistus oleks fence'itud praeguse workerId järgi, kukuks omaniku enda Stop
     worker-režiimis ALATI läbi: peatamise päring tuleb frontendist, kes ei ole kunagi omanik. */
  {
    const owner = await makeOwner("stopper");
    await createResearchJob({ userId: owner.id, payload: { query: "peatatav" } });
    const claimed = await claimNextResearchJob({ workerId: "worker-C" });
    expect("worker claim'is töö", claimed?.workerId === "worker-C", String(claimed?.workerId));

    // Frontend peatab: tal ei ole workerId-d, aga tal ON õigus peatada.
    const frontendView = { id: claimed.id, userId: owner.id, status: "running", events: [], subscribers: new Set() };
    await cancelResearchJob(frontendView, "research.error.cancelled");

    const record = await prisma.researchJob.findUnique({ where: { id: claimed.id } });
    expect("võõra protsessi Stop läheb läbi", record?.status === "cancelled", String(record?.status));
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
