#!/usr/bin/env node
/**
 * SOL-RES-01 — uuringu kustutamine ja peatamine päris PostgreSQL-is.
 *
 *   npm run research:delete:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Vana DELETE kutsus ainult `cancelResearchJob()`.
 * Terminaltöö puhul tagastas see kohe midagi muutmata ja marsruut vastas ikkagi eduga
 * `status: "cancelled"` — kasutajale öeldi „kustutatud", aga **rida jäi andmebaasi alles** ja
 * ilmus kohe uuesti nimekirja. Ainus aus mõõt on päris rida päris andmebaasis: kas ta on pärast
 * kustutamist kadunud või mitte.
 *
 * MÕÕDETAV VÄIDE olekute kaupa: `done`/`error`/`cancelled` → rida KAOB; `queued`/`running` →
 * kustutus keeldub („peata enne"), sest muidu jääks tasuline töö rippuma.
 *
 * Andmed: ainult `@sol-research.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { deleteResearchJobForOwner } from "../lib/research/jobStore.js";

const SUFFIX = "@sol-research.invalid";
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

async function makeJob(owner, status) {
  const terminal = ["done", "error", "cancelled"].includes(status);
  return prisma.researchJob.create({
    data: {
      id: `sol-res-01-${Math.random().toString(36).slice(2, 10)}`,
      userId: owner.id,
      payload: { query: "sondi päring" },
      status,
      ...(terminal ? { endedAt: NOW, result: { report: "tulemus" } } : {})
    }
  });
}

async function rowExists(id) {
  return (await prisma.researchJob.count({ where: { id } })) > 0;
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
  console.log("SOL-RES-01 — uuringu kustutamine olekute kaupa\n");
  await purge();
  const owner = await makeOwner();

  // === 1. TERMINAALSED OLEKUD: RIDA KAOB PÄRISELT =========================
  for (const status of ["done", "error", "cancelled"]) {
    const job = await makeJob(owner, status);
    const outcome = await deleteResearchJobForOwner({ jobId: job.id, userId: owner.id });
    expect(`${status}: kustutus õnnestub`, outcome === "deleted", outcome);
    expect(`${status}: RIDA ON ANDMEBAASIST KADUNUD`, (await rowExists(job.id)) === false, "rida jäi alles");
  }

  // === 2. AKTIIVSED OLEKUD: KUSTUTUS KEELDUB ==============================
  // Iga aktiivse oleku jaoks oma konto: andmebaasis on unikaalne indeks „üks aktiivne töö
  // kasutaja kohta", seega queued ja running ei mahu sama omaniku alla korraga.
  for (const status of ["queued", "running"]) {
    const activeOwner = await makeOwner(`active-${status}`);
    const job = await makeJob(activeOwner, status);
    const outcome = await deleteResearchJobForOwner({ jobId: job.id, userId: activeOwner.id });
    expect(`${status}: kustutus keeldub („peata enne")`, outcome === "active", outcome);
    expect(`${status}: rida on alles`, (await rowExists(job.id)) === true);
  }

  // === 3. KORDUS EI VALETA ================================================
  {
    const job = await makeJob(owner, "done");
    await deleteResearchJobForOwner({ jobId: job.id, userId: owner.id });
    const again = await deleteResearchJobForOwner({ jobId: job.id, userId: owner.id });
    expect("teine kustutus ütleb ausalt: ei ole", again === "missing", again);
  }

  // === 4. VÕÕRAS TÖÖ ON SAMA VASTUS MIS OLEMATU ===========================
  /* Olemasolu-oraaklit ei tohi tekkida: võõra id kohta ei tohi vastus erineda olematust. */
  {
    const stranger = await makeOwner("stranger");
    const job = await makeJob(stranger, "done");
    const outcome = await deleteResearchJobForOwner({ jobId: job.id, userId: owner.id });
    expect("võõra töö kustutus annab: ei ole", outcome === "missing", outcome);
    expect("võõra töö rida jääb puutumata", (await rowExists(job.id)) === true);

    const nonExistent = await deleteResearchJobForOwner({ jobId: "sol-res-01-ei-ole-olemas", userId: owner.id });
    expect("olematu ja võõras annavad SAMA vastuse", nonExistent === outcome, `${nonExistent} vs ${outcome}`);
  }

  // === 5. NEGATIIVKONTROLL: VANA KÄITUMINE ================================
  /* Vana DELETE kutsus terminaltööl `cancelResearchJob()`, mis väljus kohe. Jäljendame: rida peab
     alles jääma — see ongi leid. Ilma selle kontrollita ei teaks me, kas ülemine „kadunud" on
     paranduse teene või oleks rida niikuinii kadunud. */
  {
    const job = await makeJob(owner, "done");
    // `cancelResearchJob` terminaltööl = `if (terminalStatus(job.status)) return;`
    const stillThere = await rowExists(job.id);
    expect(
      "negatiivkontroll: vana tee jättis terminaltöö rea alles",
      stillThere === true,
      "rida oli juba kadunud — siis ei tõenda ülemine midagi"
    );
    await prisma.researchJob.delete({ where: { id: job.id } });
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
