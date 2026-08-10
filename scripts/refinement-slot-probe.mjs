#!/usr/bin/env node
/**
 * SOL-DOC-05 — lubatud kolme paranduse piir paralleelsete päringute all, päris PostgreSQL-is.
 *
 *   npm run refine:slot:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Vana piir oli LOENDUS enne AI-kutset ja auditirida
 * lisandus alles pärast. Kaks samaaegset päringut lugesid seega sama arvu, mõlemad nägid ruumi
 * ja mõlemad said läbi. Sellist viga saab tõendada ainult päris samaaegsus päris andmebaasis:
 * fake-kliendi all on „loe → otsusta → kirjuta" alati järjestikune ja vana kood oleks roheline.
 *
 * MÕÕDETAV VÄIDE: kui kolmest kohast on kaks võetud, tohib NELJAST võistlevast päringust võita
 * TÄPSELT ÜKS. Ja kui kohti on vabu rohkem, siis võidab täpselt nii mitu, kui neid on — piir ei
 * tohi olla ka liiga range.
 *
 * Andmed: ainult `@sol-refine.invalid` sünteetiline konto; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  ARTIFACT_REFINEMENT_LIMIT,
  claimRefinementSlot,
  confirmRefinementSlot,
  releaseRefinementSlot
} from "../lib/documents/refinementSlots.js";

const SUFFIX = "@sol-refine.invalid";
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

async function makeArtifact(owner) {
  return prisma.agentArtifact.create({
    data: {
      ownerId: owner.id,
      type: "LETTER_DRAFT",
      title: "Sondi mustand",
      status: "DRAFT",
      content: "algne sisu"
    }
  });
}

/** Võtab `count` kohta ära ja kinnitab nad päris auditijäljeks. */
async function consumeSlots(owner, artifact, count) {
  for (let index = 0; index < count; index += 1) {
    const slot = await claimRefinementSlot({ artifactId: artifact.id, ownerId: owner.id });
    await confirmRefinementSlot({ auditId: slot.auditId, meta: { used: slot.used } });
  }
}

async function countRefineRows(artifactId) {
  return prisma.documentAudit.count({ where: { artifactId, action: "ARTIFACT_REFINE" } });
}

/** `n` võistlejat korraga; tagastab õnnestunute ja 429-de arvu. */
async function compete(owner, artifact, n) {
  const results = await Promise.allSettled(
    Array.from({ length: n }, () => claimRefinementSlot({ artifactId: artifact.id, ownerId: owner.id }))
  );
  const won = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  const limited = rejected.filter((result) => result.reason?.status === 429);
  return { won, rejected, limited };
}

async function purge() {
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    await prisma.documentAudit.deleteMany({ where: { ownerId: { in: ownerIds } } });
    await prisma.agentArtifact.deleteMany({ where: { ownerId: { in: ownerIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-DOC-05 — refinement'i kohad paralleelsete päringute all\n");
  await purge();
  const owner = await makeOwner();

  // === 1. VIIMANE KOHT, NELI VÕISTLEJAT — TÄPSELT ÜKS VÕIDAB ==============
  {
    const artifact = await makeArtifact(owner);
    await consumeSlots(owner, artifact, ARTIFACT_REFINEMENT_LIMIT - 1);

    const { won, limited } = await compete(owner, artifact, 4);

    expect("2/3 täis, 4 võistlejat: võidab TÄPSELT ÜKS", won.length === 1, `võitis ${won.length}`);
    expect("2/3 täis: ülejäänud kolm saavad 429", limited.length === 3, `429: ${limited.length}`);
    expect(
      "2/3 täis: ridu on täpselt limiidi jagu",
      (await countRefineRows(artifact.id)) === ARTIFACT_REFINEMENT_LIMIT,
      String(await countRefineRows(artifact.id))
    );
  }

  // === 2. TÜHI ARTEFAKT, KUUS VÕISTLEJAT — VÕIDAB TÄPSELT KOLM ============
  /* Piir ei tohi olla ka liiga range: kui kohti on, peavad nad kõik ära minema. */
  {
    const artifact = await makeArtifact(owner);
    const { won, limited } = await compete(owner, artifact, 6);

    expect("0/3 täis, 6 võistlejat: võidab täpselt kolm", won.length === ARTIFACT_REFINEMENT_LIMIT, `võitis ${won.length}`);
    expect("0/3 täis: ülejäänud kolm saavad 429", limited.length === 3, `429: ${limited.length}`);
    expect(
      "0/3 täis: ridu on täpselt limiidi jagu",
      (await countRefineRows(artifact.id)) === ARTIFACT_REFINEMENT_LIMIT,
      String(await countRefineRows(artifact.id))
    );
  }

  // === 3. VABASTATUD KOHT LÄHEB TAGASI RINGI =============================
  {
    const artifact = await makeArtifact(owner);
    await consumeSlots(owner, artifact, ARTIFACT_REFINEMENT_LIMIT - 1);
    const slot = await claimRefinementSlot({ artifactId: artifact.id, ownerId: owner.id });

    const blocked = await compete(owner, artifact, 1);
    expect("täis limiit: uus katse saab 429", blocked.limited.length === 1);

    // AI-kutse kukkus → koht vabastatakse.
    const released = await releaseRefinementSlot(slot.auditId);
    expect("vabastus eemaldab kinnitamata koha", released === 1, String(released));

    const retry = await compete(owner, artifact, 1);
    expect("vabastatud koht on jälle võetav", retry.won.length === 1);
    expect(
      "vabastuse järel ei ole ridu rohkem kui limiit",
      (await countRefineRows(artifact.id)) === ARTIFACT_REFINEMENT_LIMIT,
      String(await countRefineRows(artifact.id))
    );
  }

  // === 4. KINNITATUD AUDITIJÄLGE EI SAA VABASTUSEGA KUSTUTADA ============
  {
    const artifact = await makeArtifact(owner);
    const slot = await claimRefinementSlot({ artifactId: artifact.id, ownerId: owner.id });
    await confirmRefinementSlot({ auditId: slot.auditId, meta: { used: slot.used } });

    const removed = await releaseRefinementSlot(slot.auditId);
    expect("kinnitatud auditirida jääb vabastuse peale alles", removed === 0, `kustutas ${removed}`);
    expect("kinnitatud rida on endiselt loetav", (await countRefineRows(artifact.id)) === 1);
  }

  // === 5. NEGATIIVKONTROLL: VANA MUSTER SAMA VÕISTLUSE ALL ===============
  /* Ilma selleta ei teaks me, kas ülemised rohelised on tõend või lihtsalt see, et päringud ei
     jooksnud päriselt korraga. Vana muster: loe arv, otsusta, kirjuta hiljem. */
  {
    const artifact = await makeArtifact(owner);
    await consumeSlots(owner, artifact, ARTIFACT_REFINEMENT_LIMIT - 1);

    const legacyClaim = async () => {
      const used = await prisma.documentAudit.count({
        where: { ownerId: owner.id, artifactId: artifact.id, action: "ARTIFACT_REFINE" }
      });
      if (used >= ARTIFACT_REFINEMENT_LIMIT) {
        const error = new Error("limit");
        error.status = 429;
        throw error;
      }
      // Vana rida: kirjutus toimus alles pärast AI-kutset, seega kaua pärast lugemist.
      await new Promise((resolve) => setTimeout(resolve, 40));
      return prisma.documentAudit.create({
        data: { ownerId: owner.id, artifactId: artifact.id, action: "ARTIFACT_REFINE", meta: { event: "artifact.refined" } }
      });
    };

    const results = await Promise.allSettled(Array.from({ length: 4 }, () => legacyClaim()));
    const won = results.filter((result) => result.status === "fulfilled").length;
    const rows = await countRefineRows(artifact.id);
    expect(
      "negatiivkontroll: vana muster LASEB limiidist üle (võistlus on päris)",
      won > 1 && rows > ARTIFACT_REFINEMENT_LIMIT,
      `võitis ${won}, ridu ${rows} — kui siin on 1 ja ${ARTIFACT_REFINEMENT_LIMIT}, ei tekkinud võistlust`
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
