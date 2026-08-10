#!/usr/bin/env node
/**
 * SOL-DOC-04 — transkripti fail ja andmebaas osalise vea järel, päris PostgreSQL + päris ketas.
 *
 *   npm run doc:staging:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa: siin on korraga PÄRIS rida ja PÄRIS fail hoidlas.
 * Leid on täpselt nende kahe JÄRJEKORRA kohta — vana kood kirjutas faili esimesena, ja DB-vea
 * korral luges allalaadimine juba uut sisu, samal ajal kui API ja AI-kokkuvõte lugesid
 * andmebaasist vana teksti. Ühiktest ajutise kaustaga tõendab helperit; see siin tõendab, et ka
 * päris hoidlas ja päris tehinguga jääb alles täpselt üks tõde.
 *
 * KOLM VEASÜSTI:
 *   1. DB update kukub ENNE avaldamist  → vana fail alles, ajutist ei jää;
 *   2. tehing kukub PÄRAST avaldamist   → vana fail tuleb tagasi (see on kitsaim aken);
 *   3. loomine kukub                     → orbfaili ei teki üldse.
 *
 * Andmed: ainult `@sol-staging.invalid` sünteetiline konto; skript koristab lõpus nii read kui
 * failid.
 */

import fs from "node:fs/promises";

import prisma from "../lib/prisma.js";
import {
  ensureDocumentsStorage,
  getStoredDocumentPath,
  resolveAbsoluteDocumentPath,
  writeStoredTextDocument
} from "../lib/documents/server.js";
import {
  createDocumentWithStagedText,
  updateDocumentWithStagedText
} from "../lib/documents/transcriptContent.js";

const SUFFIX = "@sol-staging.invalid";
const NOW = new Date();

let passed = 0;
let failed = 0;
const createdPaths = new Set();

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function readFileOr(storagePath, fallback = null) {
  try {
    return await fs.readFile(resolveAbsoluteDocumentPath(storagePath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

/** Kas hoidlasse jäi selle dokumendi ajutisi või varukoopia-faile? */
async function siblingLeftovers(storagePath) {
  const absolute = resolveAbsoluteDocumentPath(storagePath);
  const dir = absolute.slice(0, absolute.lastIndexOf("/") + 1) || absolute.slice(0, absolute.lastIndexOf("\\") + 1);
  const base = absolute.slice(dir.length);
  const entries = await fs.readdir(dir);
  return entries.filter((name) => name.startsWith(`${base}.`));
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

async function makeTranscript(owner, content) {
  await ensureDocumentsStorage();
  const storagePath = getStoredDocumentPath("transkript.txt");
  const stored = await writeStoredTextDocument(content, storagePath);
  createdPaths.add(storagePath);
  const row = await prisma.userDocument.create({
    data: {
      ownerId: owner.id,
      title: "Sond-transkript",
      originalName: "transkript.txt",
      kind: "AUDIO_TRANSCRIPT",
      agentAllowed: true,
      mime: "text/plain",
      size: stored.size,
      sha256: stored.sha256,
      storagePath,
      content
    }
  });
  return { row, storagePath };
}

const documentSelect = { id: true, content: true, size: true, sha256: true };

async function main() {
  console.log("SOL-DOC-04 — transkripti ketas ja andmebaas päris hoidlas\n");
  const owner = await makeOwner();

  // === 1. EDU: rida ja fail kannavad SAMA sisu =============================
  {
    const { row, storagePath } = await makeTranscript(owner, "algne sisu");
    const updated = await updateDocumentWithStagedText({
      where: { id: row.id },
      storagePath,
      content: "parandatud sisu",
      data: { title: "Sond-transkript" },
      select: documentSelect
    });

    const onDisk = await readFileOr(storagePath);
    expect("edu: rea sisu on uus", updated.content === "parandatud sisu", updated.content);
    expect("edu: faili sisu on uus", onDisk === "parandatud sisu", String(onDisk));
    expect("edu: suurus vastab failile", updated.size === Buffer.byteLength(onDisk, "utf8"), String(updated.size));
    expect("edu: hoidlasse ei jäänud ajutisi faile", (await siblingLeftovers(storagePath)).length === 0);
  }

  // === 2. DB-VIGA ENNE AVALDAMIST =========================================
  {
    const { row, storagePath } = await makeTranscript(owner, "algne sisu");
    const failingBeforePublish = {
      async $transaction(run) {
        return prisma.$transaction(async (tx) => run({
          ...tx,
          userDocument: {
            ...tx.userDocument,
            async update() {
              throw new Error("süstitud DB viga");
            }
          }
        }));
      }
    };

    let threw = false;
    try {
      await updateDocumentWithStagedText(
        { where: { id: row.id }, storagePath, content: "ei tohi jõuda kettale", select: documentSelect },
        { db: failingBeforePublish }
      );
    } catch {
      threw = true;
    }

    const dbRow = await prisma.userDocument.findUnique({ where: { id: row.id }, select: documentSelect });
    const onDisk = await readFileOr(storagePath);
    expect("viga enne avaldamist: kutse kukub", threw);
    expect("viga enne avaldamist: rida on muutumatu", dbRow.content === "algne sisu", dbRow.content);
    expect("viga enne avaldamist: fail on muutumatu", onDisk === "algne sisu", String(onDisk));
    expect("viga enne avaldamist: ajutist faili ei jää", (await siblingLeftovers(storagePath)).length === 0);
  }

  // === 3. TEHING KUKUB PÄRAST AVALDAMIST — KITSAIM AKEN ====================
  /* Siin on fail juba `rename`-tud, aga tehing kukub veel. Ilma varukoopiata jääks ketas uue
     sisuga ja andmebaas vanaga — täpselt see kaks tõde, mida leid kirjeldab. */
  {
    const { row, storagePath } = await makeTranscript(owner, "algne sisu");
    const failingAfterPublish = {
      async $transaction(run) {
        return prisma.$transaction(async (tx) => {
          await run(tx);
          throw new Error("süstitud viga pärast avaldamist");
        });
      }
    };

    let threw = false;
    try {
      await updateDocumentWithStagedText(
        { where: { id: row.id }, storagePath, content: "avaldatud, aga tehing kukkus", select: documentSelect },
        { db: failingAfterPublish }
      );
    } catch {
      threw = true;
    }

    const dbRow = await prisma.userDocument.findUnique({ where: { id: row.id }, select: documentSelect });
    const onDisk = await readFileOr(storagePath);
    expect("viga pärast avaldamist: kutse kukub", threw);
    expect("viga pärast avaldamist: rida jäi vanaks (tehing pöördus tagasi)", dbRow.content === "algne sisu", dbRow.content);
    expect("viga pärast avaldamist: FAIL TULI TAGASI vanaks", onDisk === "algne sisu", String(onDisk));
    expect("viga pärast avaldamist: varukoopiat ega ajutist ei jää", (await siblingLeftovers(storagePath)).length === 0);
  }

  // === 4. LOOMINE KUKUB — ORBFAILI EI TEKI ================================
  {
    await ensureDocumentsStorage();
    const storagePath = getStoredDocumentPath("orb.txt");
    createdPaths.add(storagePath);

    let threw = false;
    try {
      await createDocumentWithStagedText({
        storagePath,
        content: "tundlik tekst, mis ei tohi kettale jääda",
        data: {
          // Olematu omanik → võõrvõtme viga tehingu sees.
          ownerId: "user_does_not_exist_sol_doc_04",
          title: "Orb",
          originalName: "orb.txt",
          kind: "AUDIO_TRANSCRIPT",
          agentAllowed: true,
          mime: "text/plain"
        },
        select: documentSelect
      });
    } catch {
      threw = true;
    }

    const onDisk = await readFileOr(storagePath);
    expect("loomine kukub: kutse kukub", threw);
    expect("loomine kukub: ORBFAILI EI OLE", onDisk === null, "fail jäi kettale ilma omaniku- ja retention-reata");
    expect("loomine kukub: ajutist faili ei jää", (await siblingLeftovers(storagePath)).length === 0);
  }

  // === 5. LOOMINE ÕNNESTUB: rida ja fail on kohe koos =====================
  {
    await ensureDocumentsStorage();
    const storagePath = getStoredDocumentPath("uus.txt");
    createdPaths.add(storagePath);
    const created = await createDocumentWithStagedText({
      storagePath,
      content: "uus transkript",
      data: {
        ownerId: owner.id,
        title: "Uus",
        originalName: "uus.txt",
        kind: "AUDIO_TRANSCRIPT",
        agentAllowed: true,
        mime: "text/plain"
      },
      select: documentSelect
    });

    const onDisk = await readFileOr(storagePath);
    expect("loomine õnnestub: rida ja fail kannavad sama sisu", created.content === onDisk, `${created.content} vs ${onDisk}`);
    expect("loomine õnnestub: ajutist faili ei jää", (await siblingLeftovers(storagePath)).length === 0);
  }
}

async function cleanup() {
  console.log("\ncleanup");
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    const docs = await prisma.userDocument.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { storagePath: true }
    });
    for (const doc of docs) createdPaths.add(doc.storagePath);
    await prisma.userDocument.deleteMany({ where: { ownerId: { in: ownerIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });

  let removed = 0;
  for (const storagePath of createdPaths) {
    try {
      await fs.unlink(resolveAbsoluteDocumentPath(storagePath));
      removed += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") console.error("  cleanup failed", storagePath, error?.message);
    }
  }
  console.log(`  removed ${removed} files, ${ownerIds.length} owners`);
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
