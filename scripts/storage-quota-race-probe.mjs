#!/usr/bin/env node
/**
 * SOL-DOC-07 — salvestus- ja päevakvoot paralleelsete kirjutuste all, päris PostgreSQL-is.
 *
 *   npm run storage:quota:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Vana kood luges kasutaja senise mahu agregaatpäringuga
 * ja lõi rea ALLES HILJEM. Kaks päringut mahtusid seega mõlemad VANA summa järgi ära ja ületasid
 * koos limiidi. Sellist viga saab tõendada ainult päris samaaegsus päris andmebaasis: fake-kliendi
 * all on „loe summa → kirjuta" alati järjestikune.
 *
 * MÕÕDETAV VÄIDE: kui limiiti mahub veel täpselt KAKS kirjet, tohib neljast korraga saabuvast
 * kirjutusest õnnestuda TÄPSELT KAKS ja lõppsumma ei tohi limiiti ületada.
 *
 * Andmed: ainult `@sol-quota.invalid` sünteetiline konto; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { withStorageQuota } from "../lib/documents/storageQuota.js";
import { getUserStorageUsageBytes } from "../lib/storageUsage.js";

const SUFFIX = "@sol-quota.invalid";
const NOW = new Date();
const CHUNK = 1000;

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

/** Üks „üleslaadimine": `bytes` baiti dokumendina. */
async function writeDocument(tx, ownerId, bytes) {
  return tx.userDocument.create({
    data: {
      ownerId,
      title: "Sondi fail",
      originalName: "fail.bin",
      kind: "MATERIAL",
      agentAllowed: false,
      mime: "application/octet-stream",
      size: bytes,
      sha256: "0".repeat(64),
      storagePath: `uploads/sol-doc-07-${Math.random().toString(36).slice(2, 10)}.bin`
    },
    select: { id: true, size: true }
  });
}

async function purge() {
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    await prisma.savedAnalysis.deleteMany({ where: { ownerId: { in: ownerIds } } });
    await prisma.agentArtifact.deleteMany({ where: { ownerId: { in: ownerIds } } });
    await prisma.userDocument.deleteMany({ where: { ownerId: { in: ownerIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

function summarize(results) {
  const won = results.filter((result) => result.status === "fulfilled").length;
  const over = results.filter((result) => result.status === "rejected" && result.reason?.status === 413).length;
  const daily = results.filter((result) => result.status === "rejected" && result.reason?.status === 429).length;
  return { won, over, daily };
}

async function main() {
  console.log("SOL-DOC-07 — salvestuskvoot paralleelsete kirjutuste all\n");
  await purge();

  // === 1. RUUMI ON KAHELE, VÕISTLEJAID NELI ===============================
  {
    const owner = await makeOwner();
    const quotaBytes = 2 * CHUNK;

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => withStorageQuota(
        { userId: owner.id, addBytes: CHUNK, quotaBytes },
        {},
        (tx) => writeDocument(tx, owner.id, CHUNK)
      ))
    );
    const { won, over } = summarize(results);
    const usage = await getUserStorageUsageBytes(owner.id);

    expect("ruumi kahele, neli võistlejat: õnnestub TÄPSELT KAKS", won === 2, `won=${won}`);
    expect("ruumi kahele: ülejäänud kaks saavad 413", over === 2, `413=${over}`);
    expect("lõppsumma EI ÜLETA limiiti", usage.totalBytes <= quotaBytes, `${usage.totalBytes} > ${quotaBytes}`);
  }

  // === 2. PÄEVANE ÜLESLAADIMISPIIR SAMA REEGLI ALL ========================
  {
    const owner = await makeOwner();
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () => withStorageQuota(
        {
          userId: owner.id,
          addBytes: CHUNK,
          quotaBytes: 100 * CHUNK,
          dailyAddBytes: CHUNK,
          dailyQuotaBytes: 2 * CHUNK,
          dayStart: new Date(NOW.getTime() - 60 * 60 * 1000)
        },
        {},
        (tx) => writeDocument(tx, owner.id, CHUNK)
      ))
    );
    const { won, daily } = summarize(results);
    expect("päevapiir: õnnestub täpselt kaks", won === 2, `won=${won}`);
    expect("päevapiir: ülejäänud kaks saavad 429", daily === 2, `429=${daily}`);
  }

  // === 3. ASENDUS VABASTAB OMA SENISE MAHU ================================
  /* Muutmine ei tohi olla „lisamine": kui 900-baidine sisu asendatakse 900-baidisega, peab ta
     täis kvoodi all ikka mahtuma. */
  {
    const owner = await makeOwner();
    const quotaBytes = 1000;
    await withStorageQuota(
      { userId: owner.id, addBytes: 900, quotaBytes },
      {},
      (tx) => writeDocument(tx, owner.id, 900)
    );

    let replaced = true;
    try {
      await withStorageQuota(
        { userId: owner.id, addBytes: 900, releaseBytes: 900, quotaBytes },
        {},
        async () => true
      );
    } catch {
      replaced = false;
    }
    expect("asendus mahub, sest ta vabastab oma senise mahu", replaced);

    let grew = false;
    try {
      await withStorageQuota(
        { userId: owner.id, addBytes: 1100, releaseBytes: 900, quotaBytes },
        {},
        async () => true
      );
      grew = true;
    } catch {}
    expect("kasvav asendus EI mahu", grew === false);
  }

  // === 4. SOL-DOC-08: SALVESTATUD ANALÜÜSID ON KANOONILISES SUMMAS ========
  /* Vana summa luges dokumendid, materjalid ja artefaktid — analüüse mitte. Seetõttu ei muutnud
     ükski salvestatud analüüs järgmise kvoodikontrolli sisendit ja neid sai järjest salvestada
     piiramatult, ilma 413-ta. */
  {
    const owner = await makeOwner();
    const before = await getUserStorageUsageBytes(owner.id);
    expect("analüüsideta on analüüsimaht null", before.analysisBytes === 0, String(before.analysisBytes));

    const first = await prisma.savedAnalysis.create({
      data: { ownerId: owner.id, title: "Analüüs 1", content: "x".repeat(CHUNK), sourceDocumentIds: [] }
    });
    await prisma.savedAnalysis.create({
      data: { ownerId: owner.id, title: "Analüüs 2", content: "x".repeat(CHUNK), sourceDocumentIds: [] }
    });

    const after = await getUserStorageUsageBytes(owner.id);
    expect("analüüsid loetakse eraldi potis", after.analysisBytes === 2 * CHUNK, String(after.analysisBytes));
    expect("analüüsid on KOGUsummas", after.totalBytes === 2 * CHUNK, String(after.totalBytes));

    // Kolmas ei mahu enam, sest kaks eelmist on nüüd summas.
    let rejected = false;
    try {
      await withStorageQuota(
        { userId: owner.id, addBytes: CHUNK, quotaBytes: 2 * CHUNK },
        {},
        (tx) => tx.savedAnalysis.create({
          data: { ownerId: owner.id, title: "Analüüs 3", content: "x".repeat(CHUNK), sourceDocumentIds: [] }
        })
      );
    } catch (error) {
      rejected = error?.status === 413;
    }
    expect("täis kvoodi all järgmine analüüs saab 413", rejected);

    // Kustutamine vabastab mahu — kanoonilisest summast iseenesest.
    await prisma.savedAnalysis.delete({ where: { id: first.id } });
    let acceptedAfterDelete = false;
    try {
      await withStorageQuota(
        { userId: owner.id, addBytes: CHUNK, quotaBytes: 2 * CHUNK },
        {},
        (tx) => tx.savedAnalysis.create({
          data: { ownerId: owner.id, title: "Analüüs 4", content: "x".repeat(CHUNK), sourceDocumentIds: [] }
        })
      );
      acceptedAfterDelete = true;
    } catch {}
    expect("kustutamine vabastab mahu", acceptedAfterDelete);
  }

  // === 5. NEGATIIVKONTROLL: VANA MUSTER SAMA SAMAAEGSUSE ALL ==============
  {
    const owner = await makeOwner();
    const quotaBytes = 2 * CHUNK;

    const legacyWrite = async () => {
      const usage = await getUserStorageUsageBytes(owner.id);
      if (usage.totalBytes + CHUNK > quotaBytes) {
        const error = new Error("quota");
        error.status = 413;
        throw error;
      }
      // Vana rida: kirjutus toimus alles hiljem, kaua pärast summa lugemist.
      await new Promise((resolve) => setTimeout(resolve, 30));
      return writeDocument(prisma, owner.id, CHUNK);
    };

    const results = await Promise.allSettled(Array.from({ length: 4 }, () => legacyWrite()));
    const { won } = summarize(results);
    const usage = await getUserStorageUsageBytes(owner.id);
    expect(
      "negatiivkontroll: vana muster ÜLETAB limiidi (samaaegsus on päris)",
      won > 2 && usage.totalBytes > quotaBytes,
      `won=${won}, kokku=${usage.totalBytes}, limiit=${quotaBytes} — kui siin on 2 ja ${quotaBytes}, ei tekkinud samaaegsust`
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
