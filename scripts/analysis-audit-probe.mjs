#!/usr/bin/env node
/**
 * SOL-DOC-09 — salvestatud analüüsi audit päris PostgreSQL-is.
 *
 *   npm run analysis:audit:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Leid oli VAIKNE: kutse `logDocumentsAudit("analysis.saved")`
 * oli koodis olemas, aga sündmust ei olnud auditikaardis, seega tagastas kirjeehitaja `null` ja
 * logifunktsioon lõpetas kirjutamata. Funktsioonikutse olemasolu kontrolliv test oleks olnud
 * roheline kogu selle aja. Ainus aus mõõt on PÄRIS `DocumentAudit` rida päris andmebaasis — koos
 * enum-väärtusega, mida ilma migratsioonita ei ole olemas.
 *
 * Andmed: ainult `@sol-analysis.invalid` sünteetiline konto; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { createSavedAnalysis, deleteSavedAnalysisForOwner } from "../lib/documents/savedAnalysis.js";
import { writeDocumentAudit } from "../lib/documents/audit.js";

const SUFFIX = "@sol-analysis.invalid";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function makeOwner() {
  return prisma.user.create({
    data: {
      email: `owner-${Math.random().toString(36).slice(2, 8)}${SUFFIX}`,
      role: "SOCIAL_WORKER",
      emailVerified: NOW
    }
  });
}

async function auditRows(ownerId, action) {
  return prisma.documentAudit.findMany({ where: { ownerId, action }, orderBy: { createdAt: "asc" } });
}

async function purge() {
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    await prisma.documentAudit.deleteMany({ where: { ownerId: { in: ownerIds } } });
    await prisma.savedAnalysis.deleteMany({ where: { ownerId: { in: ownerIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-DOC-09 — analüüsi salvestuse ja kustutuse auditijälg\n");
  await purge();
  const owner = await makeOwner();

  // === 1. SALVESTUS JÄTAB PÄRIS RIDA =====================================
  const saved = await createSavedAnalysis({
    userId: owner.id,
    role: "SOCIAL_WORKER",
    title: "Sondi analüüs",
    content: "See on AI selgitus, mitte ametlik otsus.",
    sourceDocumentIds: []
  });

  const savedRows = await auditRows(owner.id, "ANALYSIS_SAVE");
  expect("salvestus loob TÄPSELT ÜHE auditirea", savedRows.length === 1, `ridu ${savedRows.length}`);
  expect("auditirida kannab sündmuse nime", savedRows[0]?.meta?.event === "analysis.saved", JSON.stringify(savedRows[0]?.meta));
  expect("auditirida viitab analüüsile", savedRows[0]?.meta?.analysisId === saved.id, JSON.stringify(savedRows[0]?.meta));

  // === 2. KUSTUTUS JÄTAB OMA RIDA ========================================
  const deleted = await deleteSavedAnalysisForOwner({ userId: owner.id, id: saved.id });
  expect("kustutus õnnestub", deleted === true);

  const deletedRows = await auditRows(owner.id, "ANALYSIS_DELETE");
  expect("kustutus loob TÄPSELT ÜHE auditirea", deletedRows.length === 1, `ridu ${deletedRows.length}`);
  expect("kustutuse rida viitab samale analüüsile", deletedRows[0]?.meta?.analysisId === saved.id);
  expect("analüüs on päriselt kadunud", (await prisma.savedAnalysis.count({ where: { id: saved.id } })) === 0);

  // === 3. OLEMATU ANALÜÜS EI JÄTA KUSTUTUSJÄLGE ==========================
  const noop = await deleteSavedAnalysisForOwner({ userId: owner.id, id: "does_not_exist_sol_doc_09" });
  expect("olematu analüüsi kustutus tagastab false", noop === false);
  expect(
    "olematu kustutus ei loo auditirida",
    (await auditRows(owner.id, "ANALYSIS_DELETE")).length === 1,
    "jälg tekkis olematu objekti kohta"
  );

  // === 4. KAARDISTAMATA SÜNDMUS VISKAB, MITTE EI TEESKLE EDU ==============
  /* Vaikus oli leiu tuum: kutse nägi välja nagu audit, aga rida ei tekkinud. Kohustuslik tee
     peab kaardistamata sündmuse peale KUKKUMA. */
  let threw = false;
  try {
    await writeDocumentAudit("analysis.invented_event", { userId: owner.id });
  } catch (error) {
    threw = error?.code === "DOCUMENTS_AUDIT_UNMAPPED";
  }
  expect("kaardistamata sündmus kukub kohustuslikul teel", threw);
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
