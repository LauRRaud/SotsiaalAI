#!/usr/bin/env node
/**
 * SOL-DOC-06 — sama helifaili paralleelne transkribeerimine, päris PostgreSQL-is.
 *
 *   npm run transcribe:claim:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Vana kood kontrollis „kas transkript on juba olemas",
 * ja kui ei olnud, lõi job'i ning kutsus teenusepakkujat. Kahel paralleelsel esmakutsel nägid
 * MÕLEMAD tühja lauda. Sellist viga saab tõendada ainult päris samaaegsus päris andmebaasis.
 *
 * MÕÕDETAV VÄIDE: neljast korraga saabuvast päringust tohib teenusepakkujani jõuda TÄPSELT ÜKS
 * ja alles jääda TÄPSELT ÜKS transkript; ülejäänud saavad kas valmis tulemuse või „töö käib".
 *
 * Andmed: ainult `@sol-transcribe.invalid` sünteetiline konto; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  TRANSCRIPTION_CLAIM_STALE_MS,
  claimTranscription
} from "../lib/documents/transcriptionClaim.js";

const SUFFIX = "@sol-transcribe.invalid";
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

async function makeAudioSource(owner) {
  return prisma.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Sondi helifail",
      originalName: "salvestis.webm",
      kind: "UPLOADED_AUDIO_SOURCE",
      agentAllowed: true,
      mime: "audio/webm",
      size: 1024,
      sha256: "0".repeat(64),
      storagePath: `uploads/sol-doc-06-${Math.random().toString(36).slice(2, 10)}.webm`
    }
  });
}

async function countTranscripts(sourceDocumentId) {
  return prisma.userDocument.count({
    where: { sourceDocumentId, kind: { in: ["AUDIO_TRANSCRIPT", "CALL_TRANSCRIPT"] } }
  });
}

async function purge() {
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    const docs = await prisma.userDocument.findMany({ where: { ownerId: { in: ownerIds } }, select: { id: true } });
    const docIds = docs.map((row) => row.id);
    if (docIds.length) {
      await prisma.transcriptionJob.deleteMany({ where: { sourceDocumentId: { in: docIds } } });
    }
    await prisma.userDocument.deleteMany({ where: { ownerId: { in: ownerIds }, sourceDocumentId: { not: null } } });
    await prisma.userDocument.deleteMany({ where: { ownerId: { in: ownerIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-DOC-06 — ühe allika transkriptsioon paralleelsete päringute all\n");
  await purge();
  const owner = await makeOwner();

  // === 1. NELI ESMAKUTSET — TÄPSELT ÜKS TOHIB TÖÖLE HAKATA ================
  {
    const source = await makeAudioSource(owner);
    const claims = await Promise.all(
      Array.from({ length: 4 }, () => claimTranscription({
        sourceDocumentId: source.id,
        ownerId: owner.id,
        provider: "mock"
      }))
    );

    const claimed = claims.filter((claim) => claim.outcome === "claimed");
    const busy = claims.filter((claim) => claim.outcome === "busy");
    expect("neli esmakutset: TÄPSELT ÜKS saab töö", claimed.length === 1, `claimed=${claimed.length}`);
    expect("neli esmakutset: ülejäänud kolm saavad „töö käib\"", busy.length === 3, `busy=${busy.length}`);

    const jobs = await prisma.transcriptionJob.count({ where: { sourceDocumentId: source.id } });
    expect("neli esmakutset: job'e on täpselt üks", jobs === 1, String(jobs));
  }

  // === 2. TÄISVOOG VÕLTSPAKKUJAGA — ÜKS KUTSE, ÜKS TRANSKRIPT ============
  {
    const source = await makeAudioSource(owner);
    let providerCalls = 0;

    const worker = async () => {
      const claim = await claimTranscription({
        sourceDocumentId: source.id,
        ownerId: owner.id,
        provider: "mock"
      });
      if (claim.outcome !== "claimed") return claim.outcome;

      providerCalls += 1;
      const transcript = await prisma.userDocument.create({
        data: {
          ownerId: owner.id,
          title: "Transkript",
          originalName: "transkript.txt",
          kind: "AUDIO_TRANSCRIPT",
          agentAllowed: true,
          mime: "text/plain",
          size: 10,
          sha256: "1".repeat(64),
          storagePath: `uploads/sol-doc-06-${Math.random().toString(36).slice(2, 10)}.txt`,
          sourceDocumentId: source.id,
          content: "transkribeeritud tekst"
        }
      });
      await prisma.transcriptionJob.update({
        where: { id: claim.job.id },
        data: { status: "COMPLETED", transcriptDocumentId: transcript.id, completedAt: new Date() }
      });
      return "claimed";
    };

    const outcomes = await Promise.all(Array.from({ length: 4 }, () => worker()));

    expect("täisvoog: teenusepakkujat kutsutakse TÄPSELT ÜKS kord", providerCalls === 1, String(providerCalls));
    expect("täisvoog: transkripte on täpselt üks", (await countTranscripts(source.id)) === 1);
    expect("täisvoog: ülejäänud kolm ei kutsunud kedagi", outcomes.filter((o) => o === "claimed").length === 1);
  }

  // === 3. VALMIS TRANSKRIPT — UUT TÖÖD EI TEHTA ==========================
  {
    const source = await makeAudioSource(owner);
    await prisma.userDocument.create({
      data: {
        ownerId: owner.id,
        title: "Olemasolev transkript",
        originalName: "olemas.txt",
        kind: "AUDIO_TRANSCRIPT",
        agentAllowed: true,
        mime: "text/plain",
        size: 5,
        sha256: "2".repeat(64),
        storagePath: `uploads/sol-doc-06-${Math.random().toString(36).slice(2, 10)}.txt`,
        sourceDocumentId: source.id,
        content: "olemas"
      }
    });

    const claim = await claimTranscription({ sourceDocumentId: source.id, ownerId: owner.id, provider: "mock" });
    expect("valmis transkript: vastus on „taaskasutus\"", claim.outcome === "reused", claim.outcome);
    expect("valmis transkript: uut job'i ei tekkinud", (await prisma.transcriptionJob.count({ where: { sourceDocumentId: source.id } })) === 0);
  }

  // === 4. HÜLJATUD TÖÖ EI LUKUSTA ALLIKAT IGAVESEKS ======================
  /* Protsessi surm jätab PROCESSING rea alles. Ilma vananemisaknata ei saaks seda faili enam
     kunagi transkribeerida — parandus oleks siis leiust hullem. */
  {
    const source = await makeAudioSource(owner);
    const stale = await prisma.transcriptionJob.create({
      data: {
        sourceDocumentId: source.id,
        requestedByUserId: owner.id,
        provider: "mock",
        status: "PROCESSING",
        startedAt: new Date(NOW.getTime() - TRANSCRIPTION_CLAIM_STALE_MS - 60_000)
      }
    });
    // `updatedAt` on @updatedAt, seega surume ta otse vanaks.
    await prisma.$executeRaw`UPDATE "TranscriptionJob" SET "updatedAt" = ${new Date(NOW.getTime() - TRANSCRIPTION_CLAIM_STALE_MS - 60_000)} WHERE "id" = ${stale.id}`;

    const claim = await claimTranscription({ sourceDocumentId: source.id, ownerId: owner.id, provider: "mock" });
    expect("hüljatud töö: uus katse saab töö", claim.outcome === "claimed", claim.outcome);

    const old = await prisma.transcriptionJob.findUnique({ where: { id: stale.id } });
    expect("hüljatud töö märgitakse ausalt ebaõnnestunuks", old.status === "FAILED", old.status);
    expect("hüljatud töö: põhjus on kirjas", old.error === "documents.errors.transcription_abandoned", String(old.error));
  }

  // === 5. VÄRSKE TÖÖ EI OLE HÜLJATUD =====================================
  {
    const source = await makeAudioSource(owner);
    await claimTranscription({ sourceDocumentId: source.id, ownerId: owner.id, provider: "mock" });
    const second = await claimTranscription({ sourceDocumentId: source.id, ownerId: owner.id, provider: "mock" });
    expect("värske töö: teine päring saab „töö käib\"", second.outcome === "busy", second.outcome);
  }

  // === 6. NEGATIIVKONTROLL: VANA MUSTER SAMA SAMAAEGSUSE ALL =============
  {
    const source = await makeAudioSource(owner);
    let providerCalls = 0;

    const legacyWorker = async () => {
      const existing = await prisma.userDocument.findFirst({
        where: { sourceDocumentId: source.id, kind: { in: ["AUDIO_TRANSCRIPT", "CALL_TRANSCRIPT"] } }
      });
      if (existing) return "reused";
      // Vana rida: job luuakse tingimusteta ja pakkuja kutsutakse kohe.
      await prisma.transcriptionJob.create({
        data: { sourceDocumentId: source.id, requestedByUserId: owner.id, provider: "mock", status: "PROCESSING" }
      });
      providerCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 30));
      await prisma.userDocument.create({
        data: {
          ownerId: owner.id,
          title: "Transkript",
          originalName: "transkript.txt",
          kind: "AUDIO_TRANSCRIPT",
          agentAllowed: true,
          mime: "text/plain",
          size: 10,
          sha256: "3".repeat(64),
          storagePath: `uploads/sol-doc-06-${Math.random().toString(36).slice(2, 10)}.txt`,
          sourceDocumentId: source.id,
          content: "topelt"
        }
      });
      return "claimed";
    };

    await Promise.all(Array.from({ length: 4 }, () => legacyWorker()));
    const transcripts = await countTranscripts(source.id);
    expect(
      "negatiivkontroll: vana muster teeb MITU kutset ja MITU transkripti (samaaegsus on päris)",
      providerCalls > 1 && transcripts > 1,
      `kutseid ${providerCalls}, transkripte ${transcripts} — kui siin on 1 ja 1, ei tekkinud samaaegsust`
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
