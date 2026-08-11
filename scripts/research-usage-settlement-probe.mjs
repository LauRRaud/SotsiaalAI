#!/usr/bin/env node
/**
 * SOL-RES-06 — kasutuse lõplik arveldus ei tohi tulemusest lahkneda. Päris PostgreSQL.
 *
 *   npm run research:settle:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. `markResearchDone()` muutis rea esmalt `done`-iks ja
 * kutsus alles siis kasutuse commit'i, mille vead NEELATI. Research-reservatsiooni TTL on 24 tundi,
 * seega edukaks märgitud töö võis commit'i vea järel jääda RESERVED-iks ja üldine reaper vabastas
 * ta hiljem kui KASUTAMATA ühiku — töö tulemust see enam tagasi ei pööranud. Teine pool: tühistatud
 * töö arveldust ei saanud DB-snapshotist üldse teha, sest võtit otsiti payload'ist, mida snapshot
 * ei säilita.
 *
 * MÕÕDETAV VÄIDE: ajutine arveldusviga jätab reale MÄRKE, kordus lõpetab arvelduse ära, ja
 * snapshot'ist (ilma payload'ita) tehtud tühistus leiab võtme ikkagi üles.
 *
 * Andmed: ainult `@sol-settle.invalid` sünteetiline konto; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  cancelResearchJob,
  createResearchJob,
  getResearchJobSnapshot,
  markResearchDone,
  retryPendingResearchUsageSettlements
} from "../lib/research/jobStore.js";

const SUFFIX = "@sol-settle.invalid";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function makeOwner(local = "owner") {
  return prisma.user.create({
    data: {
      email: `${local}-${Math.random().toString(36).slice(2, 8)}${SUFFIX}`,
      role: "SOCIAL_WORKER",
      emailVerified: NOW
    }
  });
}

/** Töö, mille payload kannab kasutusvõtit — täpselt nagu marsruut ta loob. */
async function makeJobWithUsageKey(owner, key) {
  return createResearchJob({
    userId: owner.id,
    payload: { query: "sondi päring", usageIdempotencyKey: key }
  });
}

async function payloadOf(jobId) {
  const record = await prisma.researchJob.findUnique({ where: { id: jobId }, select: { payload: true } });
  return record?.payload || {};
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
  console.log("SOL-RES-06 — arvelduse püsivus ja kordus\n");
  await purge();

  // === 1. ÕNNESTUNUD ARVELDUS JÄÄB REALE KIRJA ============================
  {
    const owner = await makeOwner();
    const job = await makeJobWithUsageKey(owner, "research.run:settle_ok");
    await markResearchDone(job, { report: "tulemus" });

    const payload = await payloadOf(job.id);
    expect("edukas töö on lõppenud", (await getResearchJobSnapshot(job.id))?.status === "done");
    // Päris teenus ei tunne seda võtit, seega arveldus EI õnnestu ja peab jääma märkega.
    expect(
      "tundmatu reservatsioon jätab POOLELI märke, mitte vaikuse",
      Boolean(payload.usageSettlePending?.action),
      JSON.stringify(payload.usageSettlePending || null)
    );
    expect("märge kannab toimingut", payload.usageSettlePending?.action === "commit", JSON.stringify(payload.usageSettlePending));
  }

  // === 2. KORDUS LÕPETAB ARVELDUSE ÄRA ====================================
  {
    const owner = await makeOwner("retry");
    const job = await makeJobWithUsageKey(owner, "research.run:settle_retry");
    await markResearchDone(job, { report: "tulemus" });
    const before = await payloadOf(job.id);
    expect("enne kordust on märge olemas", Boolean(before.usageSettlePending?.action));

    // Kordus töötava teenusega: nüüd peab märge kaduma ja arveldus kirja saama.
    const service = {
      async commit() { return { ok: true }; },
      async release() { return { ok: true }; }
    };
    const result = await retryPendingResearchUsageSettlements({ service, limit: 50 });
    expect("kordus leidis pooleli arvelduse", result.scanned >= 1, JSON.stringify(result));
    expect("kordus lõpetas arvelduse", result.settled >= 1, JSON.stringify(result));

    const after = await payloadOf(job.id);
    expect("pooleli märge on kadunud", !after.usageSettlePending, JSON.stringify(after.usageSettlePending || null));
    expect("arveldus on reale kirjas", Boolean(after.usageSettledAt), JSON.stringify(after.usageSettledAt || null));
    expect("kirjas on ka toiming", after.usageSettledAction === "commit", String(after.usageSettledAction));
  }

  // === 3. SNAPSHOT ILMA PAYLOAD'ITA LEIAB VÕTME IKKAGI ====================
  /* Vana kood otsis võtit `job.payload` seest; DB-snapshot seda ei säilita, seega tühistatud töö
     reservatsioon jäi kuni TTL-ini kinni. */
  {
    const owner = await makeOwner("snapshot");
    const job = await makeJobWithUsageKey(owner, "research.run:settle_snapshot");
    const snapshot = await getResearchJobSnapshot(job.id);
    expect("snapshot ei kanna payload'i", snapshot?.payload === undefined, JSON.stringify(Object.keys(snapshot || {})));

    // Tühistus AINULT snapshoti pealt — nagu teeb peatamise marsruut teises protsessis.
    await cancelResearchJob({ id: job.id, userId: owner.id, status: "running", events: [], subscribers: new Set() });

    const payload = await payloadOf(job.id);
    expect("tühistus jõudis arvelduseni", Boolean(payload.usageSettlePending || payload.usageSettledAt), JSON.stringify(payload));
    expect(
      "arveldus käis RELEASE toiminguna",
      (payload.usageSettlePending?.action || payload.usageSettledAction) === "release",
      JSON.stringify(payload.usageSettlePending || payload.usageSettledAction)
    );
  }

  // === 4. KORDUS ON OHUTU KA SIIS, KUI MIDAGI POOLELI EI OLE ==============
  {
    const result = await retryPendingResearchUsageSettlements({
      service: { async commit() { return {}; }, async release() { return {}; } },
      limit: 5
    });
    expect("tühja järjekorra kordus ei kuku", Number.isFinite(result.scanned), JSON.stringify(result));
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
