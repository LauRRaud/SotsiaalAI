#!/usr/bin/env node
/**
 * SOL-DOC-03 — artefakti muutmine ja kinnitamine paralleelselt, päris PostgreSQL-is.
 *
 *   npm run artifact:race:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Leid ei ole „unustatud kontroll" — kontroll OLI
 * olemas, ta luges seisu mälus ja oli õige LUGEMISE hetkel. Katki oli see, et kirjutus toimus
 * hiljem ja tingimusteta. Sellist viga saab tõendada ainult päris rea lukk ja READ COMMITTED
 * uuestihindamine: `UPDATE ... WHERE` ootab lukku ära ja hindab tingimuse UUE rea vastu.
 * Fake-klient ei modelleeri ühtki neist — tema all läheks ka vana kood roheliseks.
 *
 * VÕISTLUS ON DETERMINISTLIK, MITTE „mahtusid ühte millisekundisse". Retsept on sama, mida
 * kasutab `org-seat-race-probe.mjs`:
 *   1. kolmas tehing võtab artefaktirea luku ja HOIAB seda;
 *   2. mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad;
 *   3. lukk lastakse lahti — Postgres annab ta ootejärjekorra järjekorras;
 *   4. mõõdetakse lõppseisu.
 *
 * INVARIANT, mida ükski ajastus rikkuda ei tohi:
 *   **kinnitatud (FINAL) artefakti sisu ei muutu enam kunagi.**
 * Just seda vana kood rikkus: kui PATCH luges `DRAFT`, approve commit'is vahepeal `FINAL` ja
 * PATCH siis jätkas, muutis ta juba kinnitatud dokumendi sisu — allalaaditav „lõplik" fail
 * ei olnud enam see, mida kasutaja kinnitas.
 *
 * Andmed: ainult `@sol-artifact.invalid` sünteetiline konto; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { approveArtifact, updateDraftArtifact } from "../lib/documents/artifactMutation.js";

const SUFFIX = "@sol-artifact.invalid";
const MARK = "(artefakti-võistlus)";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Hoiab tehingut lahti, kuni `release()` kutsutakse. */
function holdOpen(work) {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const done = prisma.$transaction(async (tx) => {
    const value = await work(tx);
    await held;
    return value;
  }, { timeout: 30000 });
  return { release: () => release(), done };
}

function watch(promise) {
  const state = { settled: false, value: null, error: null };
  const wrapped = promise.then(
    (value) => { state.settled = true; state.value = value; return state; },
    (error) => { state.settled = true; state.error = error; return state; }
  );
  return { state, wrapped };
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

async function freshArtifact(owner) {
  return prisma.agentArtifact.create({
    data: {
      ownerId: owner.id,
      type: "LETTER_DRAFT",
      title: `Kiri ${MARK}`,
      status: "DRAFT",
      content: "algne sisu"
    }
  });
}

/** Käivitab kaks võistlejat nii, et lukujärjekord on meie valitud. */
async function race(label, artifactId, first, second) {
  const holder = holdOpen(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "AgentArtifact" WHERE "id" = ${artifactId} FOR UPDATE`;
  });
  await sleep(80);

  const a = watch(first());
  await sleep(120);
  const b = watch(second());
  await sleep(120);

  expect(`${label}: esimene võistleja OOTAB artefaktirea lukku`, a.state.settled === false);
  expect(`${label}: teine võistleja OOTAB artefaktirea lukku`, b.state.settled === false);

  holder.release();
  await holder.done;
  const [resultA, resultB] = await Promise.all([a.wrapped, b.wrapped]);
  return { resultA, resultB };
}

const isConflict = (state, key) =>
  state.error?.status === 409 && (!key || state.error?.message === key);

/** FINAL-i sisu peab olema täpselt see, mis kinnitati. */
async function assertFinalImmutable(label, artifactId, expectedContent) {
  const row = await prisma.agentArtifact.findUnique({ where: { id: artifactId } });
  expect(`${label}: rida on FINAL`, row.status === "FINAL", row.status);
  expect(
    `${label}: FINAL sisu on TÄPSELT see, mis kinnitati`,
    row.content === expectedContent,
    `sai "${row.content}", ootasin "${expectedContent}"`
  );
}

async function purge() {
  const owners = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true }
  });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    await prisma.agentArtifact.deleteMany({ where: { ownerId: { in: ownerIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-DOC-03 — artefakti muutmise ja kinnitamise võistlused päris PostgreSQL-is\n");
  await purge();
  const owner = await makeOwner();

  // === 1. APPROVE EES, PATCH JÄREL — LEID ISE ==============================
  /* Vana kood: PATCH luges `DRAFT`, approve tegi `FINAL`, ja PATCH kirjutas seejärel
     `where: { id }` järgi kinnitatud rea sisu ümber. */
  {
    const artifact = await freshArtifact(owner);
    const version = artifact.updatedAt;
    const { resultA, resultB } = await race(
      "approve→patch",
      artifact.id,
      () => approveArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "kinnitatud sisu" },
        { db: prisma }
      ),
      () => updateDraftArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "hiline muudatus" },
        { db: prisma }
      )
    );
    expect("approve→patch: kinnitus õnnestub", resultA.value?.artifact?.status === "FINAL", String(resultA.error?.message));
    expect(
      "approve→patch: hiline muutmine KUKUB kinnitatud rea vastu",
      isConflict(resultB, "documents.artifacts.errors.final_read_only"),
      String(resultB.error?.message || resultB.value?.content)
    );
    await assertFinalImmutable("approve→patch", artifact.id, "kinnitatud sisu");
  }

  // === 2. PATCH EES, APPROVE JÄREL =========================================
  {
    const artifact = await freshArtifact(owner);
    const version = artifact.updatedAt;
    const { resultA, resultB } = await race(
      "patch→approve",
      artifact.id,
      () => updateDraftArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "salvestatud sisu" },
        { db: prisma }
      ),
      () => approveArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "vana vaate sisu" },
        { db: prisma }
      )
    );
    expect("patch→approve: muutmine õnnestub", resultA.value?.content === "salvestatud sisu", String(resultA.error?.message));
    /* Kinnitaja nägi VANA versiooni. Kui ta ikkagi kinnitaks, saaks kasutaja lõpliku
       dokumendi, mille sisu ta ei näinud — seepärast peab ta kaotama. */
    expect(
      "patch→approve: vana versiooni kinnitamine KUKUB",
      isConflict(resultB, "documents.artifacts.errors.version_conflict"),
      String(resultB.error?.message || resultB.value?.artifact?.status)
    );
    const row = await prisma.agentArtifact.findUnique({ where: { id: artifact.id } });
    expect("patch→approve: rida jääb DRAFT-iks", row.status === "DRAFT", row.status);
    expect("patch→approve: sisu on võitja oma", row.content === "salvestatud sisu", row.content);
  }

  // === 3. KAKS MUUTMIST SAMA VERSIOONI PEALE ===============================
  {
    const artifact = await freshArtifact(owner);
    const version = artifact.updatedAt;
    const { resultA, resultB } = await race(
      "patch→patch",
      artifact.id,
      () => updateDraftArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "esimese vahekaardi sisu" },
        { db: prisma }
      ),
      () => updateDraftArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "teise vahekaardi sisu" },
        { db: prisma }
      )
    );
    expect("patch→patch: esimene võidab", resultA.value?.content === "esimese vahekaardi sisu", String(resultA.error?.message));
    expect(
      "patch→patch: teine KUKUB vananenud versiooni vastu (kadunud uuendust ei teki)",
      isConflict(resultB, "documents.artifacts.errors.version_conflict"),
      String(resultB.error?.message || resultB.value?.content)
    );
    const row = await prisma.agentArtifact.findUnique({ where: { id: artifact.id } });
    expect("patch→patch: sisu on võitja oma", row.content === "esimese vahekaardi sisu", row.content);
  }

  // === 4. KAKS KINNITUST SAMA SISUGA — KORDUS ON EDU =======================
  {
    const artifact = await freshArtifact(owner);
    const version = artifact.updatedAt;
    const { resultA, resultB } = await race(
      "approve→approve (sama sisu)",
      artifact.id,
      () => approveArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "üks ja sama sisu" },
        { db: prisma }
      ),
      () => approveArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "üks ja sama sisu" },
        { db: prisma }
      )
    );
    expect("approve→approve: esimene kinnitab", resultA.value?.alreadyFinal === false, String(resultA.error?.message));
    expect(
      "approve→approve: teine saab idempotentse edu, mitte viga",
      resultB.value?.alreadyFinal === true,
      String(resultB.error?.message)
    );
    await assertFinalImmutable("approve→approve", artifact.id, "üks ja sama sisu");
  }

  // === 5. KAKS KINNITUST ERI SISUGA — TEINE ON KONFLIKT ====================
  {
    const artifact = await freshArtifact(owner);
    const version = artifact.updatedAt;
    const { resultA, resultB } = await race(
      "approve→approve (eri sisu)",
      artifact.id,
      () => approveArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "esimese kinnitus" },
        { db: prisma }
      ),
      () => approveArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: version, content: "teise kinnitus" },
        { db: prisma }
      )
    );
    expect("approve→approve eri sisu: esimene kinnitab", resultA.value?.alreadyFinal === false, String(resultA.error?.message));
    /* „Juba FINAL" ei tähenda automaatselt, et MINU töö on tehtud. */
    expect(
      "approve→approve eri sisu: teine KUKUB, mitte ei teeskle edu",
      isConflict(resultB, "documents.artifacts.errors.version_conflict"),
      String(resultB.error?.message || resultB.value?.alreadyFinal)
    );
    await assertFinalImmutable("approve→approve eri sisu", artifact.id, "esimese kinnitus");
  }

  // === 6. KINNITATUD RIDA HILJEM — MITTE VÕISTLUSES, VAID ÜLDSE ===========
  {
    const artifact = await freshArtifact(owner);
    const approved = await approveArtifact(
      { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: artifact.updatedAt, content: "lõplik sisu" },
      { db: prisma }
    );
    let conflicted = false;
    try {
      await updateDraftArtifact(
        { artifactId: artifact.id, ownerId: owner.id, expectedUpdatedAt: approved.artifact.updatedAt, content: "hiljem muudetud" },
        { db: prisma }
      );
    } catch (error) {
      conflicted = error?.status === 409;
    }
    expect("FINAL: hilisem muutmine annab 409 ka õige versiooniga", conflicted);
    await assertFinalImmutable("FINAL", artifact.id, "lõplik sisu");
  }

  // === 7. NEGATIIVKONTROLL: VANA MUSTER SAMA VÕISTLUSE ALL ================
  /* Ilma selleta ei teaks me, kas ülemised rohelised on tõend või lihtsalt see, et võistlust
     ei tekkinud. Siin jäljendatakse VANA koodi täpselt: loe seis eraldi päringuga, kontrolli
     mälus, kirjuta hiljem `where: { id }` järgi. Kui see samas harnessis FINAL-i ära rikub,
     siis on harness päris — ja ülemised rohelised on paranduse teene. */
  {
    const artifact = await freshArtifact(owner);

    const legacyPatch = async () => {
      const seen = await prisma.agentArtifact.findFirst({ where: { id: artifact.id, ownerId: owner.id } });
      if (seen.status === "FINAL") throw new Error("legacy guard hit");
      // Vana rida: tingimus on ainult id, kuigi otsus tehti ammu loetud seisu peal.
      return prisma.agentArtifact.update({
        where: { id: artifact.id },
        data: { content: "hiline muudatus" }
      });
    };
    const legacyApprove = async () => {
      const seen = await prisma.agentArtifact.findFirst({ where: { id: artifact.id, ownerId: owner.id } });
      if (seen.status === "FINAL") return seen;
      return prisma.agentArtifact.update({
        where: { id: artifact.id },
        data: { status: "FINAL", approvedAt: new Date(), content: "kinnitatud sisu" }
      });
    };

    // Mõlemad LOEVAD enne lukustamist — täpselt nagu vana kood tegi.
    const holder = holdOpen(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AgentArtifact" WHERE "id" = ${artifact.id} FOR UPDATE`;
    });
    await sleep(80);
    const a = watch(legacyApprove());
    await sleep(120);
    const b = watch(legacyPatch());
    await sleep(120);
    holder.release();
    await holder.done;
    await Promise.all([a.wrapped, b.wrapped]);

    const row = await prisma.agentArtifact.findUnique({ where: { id: artifact.id } });
    expect(
      "negatiivkontroll: vana muster RIKUB kinnitatud sisu (võistlus on päris)",
      row.status === "FINAL" && row.content === "hiline muudatus",
      `status=${row.status} content="${row.content}" — kui siin on "kinnitatud sisu", ei tekkinud võistlust ja ülemised rohelised ei tõenda midagi`
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
