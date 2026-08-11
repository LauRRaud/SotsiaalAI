#!/usr/bin/env node
/**
 * SOL-RES-02 — üks kavatsus = üks reservatsioon = üks töö, päris PostgreSQL-is.
 *
 *   npm run research:intent:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Vana kood reserveeris kasutuse kliendi võtmega, aga lõi
 * töö ALATI uue juhusliku UUID-ga: võtme ja `ResearchJob` vahel ei olnud mingit seost. Usage-teenus
 * tagastab sama võtme olemasoleva reservatsiooni — ka terminalse — `reused: true` vastusena, seega
 * sama võtit teadlikult korrates sai ühe kuulimiidi ühikuga käivitada järjest uusi täismahus
 * uuringuid. Idempotentsus toimis kahes kihis vastupidise tähendusega.
 *
 * MÕÕDETAV VÄIDE: sama võti + sama sisend → SAMA töö, ka pärast lõppu. Sama võti + teine sisend →
 * konflikt. Võtmeta töö käitub nagu enne.
 *
 * Andmed: ainult `@sol-intent.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { claimResearchJobForIntent } from "../lib/research/jobStore.js";

const SUFFIX = "@sol-intent.invalid";
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

function payloadFor(query) {
  return { query, profile: "standard", collection_ids: [], persist: true };
}

async function countJobs(userId) {
  return prisma.researchJob.count({ where: { userId } });
}

async function finishJob(jobId, status = "done") {
  await prisma.researchJob.update({
    where: { id: jobId },
    data: { status, endedAt: NOW, result: { report: "tulemus" } }
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
  console.log("SOL-RES-02 — kavatsuse võti seob töö\n");
  await purge();

  // === 1. KORDUS ENNE LOOMIST: SAMA VÕTI, SAMA TÖÖ ========================
  {
    const owner = await makeOwner();
    const first = await claimResearchJobForIntent({
      userId: owner.id,
      payload: payloadFor("sama küsimus"),
      clientIntentKey: "intent_1"
    });
    const retry = await claimResearchJobForIntent({
      userId: owner.id,
      payload: payloadFor("sama küsimus"),
      clientIntentKey: "intent_1"
    });

    expect("esimene kutse loob töö", first.outcome === "created", first.outcome);
    expect("kordus TAASKASUTAB sama tööd", retry.outcome === "reused", retry.outcome);
    expect("mõlemad viitavad samale id-le", retry.job.id === first.job.id, `${retry.job.id} vs ${first.job.id}`);
    expect("andmebaasi jäi täpselt üks töö", (await countJobs(owner.id)) === 1, String(await countJobs(owner.id)));
  }

  // === 2. KORDUS PÄRAST LÕPPU EI KÄIVITA UUT TASULIST TÖÖD ================
  /* See on leiu tuum: pärast esimese töö lõppu ei olnud enam aktiivse töö piirangut, seega sama
     võtmega sai luua uue täismahus job'i, mille lõpp-commit taaskasutas juba arvestatud ühikut. */
  for (const status of ["done", "error", "cancelled"]) {
    const owner = await makeOwner(`after-${status}`);
    const first = await claimResearchJobForIntent({
      userId: owner.id,
      payload: payloadFor("küsimus"),
      clientIntentKey: "intent_after"
    });
    await finishJob(first.job.id, status);

    const retry = await claimResearchJobForIntent({
      userId: owner.id,
      payload: payloadFor("küsimus"),
      clientIntentKey: "intent_after"
    });
    expect(`pärast ${status}: kordus taaskasutab, ei loo uut`, retry.outcome === "reused", retry.outcome);
    expect(`pärast ${status}: töid on ikka üks`, (await countJobs(owner.id)) === 1, String(await countJobs(owner.id)));
    expect(`pärast ${status}: tagastatakse LÕPPSEIS`, retry.job.status === status, String(retry.job.status));
  }

  // === 3. SAMA VÕTI, TEINE SISEND = KONFLIKT ==============================
  {
    const owner = await makeOwner("conflict");
    await claimResearchJobForIntent({
      userId: owner.id,
      payload: payloadFor("esimene küsimus"),
      clientIntentKey: "intent_c"
    });

    let code = null;
    try {
      await claimResearchJobForIntent({
        userId: owner.id,
        payload: payloadFor("HOOPIS TEINE küsimus"),
        clientIntentKey: "intent_c"
      });
    } catch (error) {
      code = error?.code;
    }
    expect("sama võti + teine sisend annab konflikti", code === "INTENT_CONFLICT", String(code));
    expect("konflikt ei loonud uut tööd", (await countJobs(owner.id)) === 1);
  }

  // === 4. ERI KASUTAJAD, SAMA VÕTI — EI SEGA TEINETEIST ===================
  {
    const a = await makeOwner("user-a");
    const b = await makeOwner("user-b");
    const first = await claimResearchJobForIntent({ userId: a.id, payload: payloadFor("q"), clientIntentKey: "shared" });
    const second = await claimResearchJobForIntent({ userId: b.id, payload: payloadFor("q"), clientIntentKey: "shared" });
    expect("teise kasutaja sama võti loob OMA töö", second.outcome === "created", second.outcome);
    expect("tööd on eri id-dega", second.job.id !== first.job.id);
  }

  // === 5. VÕTMETA TÖÖ KÄITUB NAGU ENNE ====================================
  {
    const owner = await makeOwner("keyless");
    const first = await claimResearchJobForIntent({ userId: owner.id, payload: payloadFor("q") });
    expect("võtmeta kutse loob töö", first.outcome === "created", first.outcome);
    await finishJob(first.job.id, "done");
    const second = await claimResearchJobForIntent({ userId: owner.id, payload: payloadFor("q") });
    expect("võtmeta teine kutse loob UUE töö", second.outcome === "created" && second.job.id !== first.job.id);
    expect("võtmeta töid on kaks", (await countJobs(owner.id)) === 2, String(await countJobs(owner.id)));
  }

  // === 6. NEGATIIVKONTROLL: VANA KÄITUMINE ================================
  /* Vana kood ei sidunud võtit tööga kuidagi — jäljendame seda otse ja nõuame, et tekiks KAKS
     tööd. Ilma selleta ei teaks me, kas ülemine „üks töö" on paranduse teene. */
  {
    const owner = await makeOwner("legacy");
    for (let i = 0; i < 2; i += 1) {
      const id = `sol-res-02-legacy-${Math.random().toString(36).slice(2, 10)}`;
      await prisma.researchJob.create({
        data: {
          id,
          userId: owner.id,
          payload: { ...payloadFor("q"), usageIdempotencyKey: "research.run:sama_votme" },
          status: "done",
          endedAt: NOW
        }
      });
    }
    expect(
      "negatiivkontroll: võtmeta sidumine annab sama võtme all KAKS tööd",
      (await countJobs(owner.id)) === 2,
      String(await countJobs(owner.id))
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
