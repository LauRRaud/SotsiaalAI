#!/usr/bin/env node
/**
 * SOL-MEET-02 — kokkuvõttedokument ja tema ühik peavad sündima ÜHES tehingus. Päris PostgreSQL.
 *
 *   npm run meeting:summary:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Vana kood commit'is `DOCUMENT_GENERATE` ühiku ENNE
 * dokumendi loomist ja seadis samal hetkel `workCompleted` tõeseks. Kui dokument siis kukkus,
 * keeldus `settleMeetingSummaryUsage()` release'ist just `workCompleted` tõttu — kasutaja oli ühiku
 * kulutanud ja dokumenti ei olnud kuskilt leida. `npm test` saab mõõta järjekorda ja olekuid, aga
 * MITTE seda, kas andmebaas päriselt tagasi kerib: fake-Prisma `$transaction` ei oska rollback'i.
 *
 * MÕÕDETAV VÄIDE: dokumendirida, salvestuskvoot ja ühiku commit maanduvad kas KÕIK või MITTE ÜKSKI.
 *
 * Andmed: ainult `@sol-meet.invalid` sünteetilised kontod; failid ajutises kataloogis; koristab
 * lõpus mõlemad.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import prisma from "../lib/prisma.js";

const SUFFIX = "@sol-meet.invalid";

let passed = 0;
let failed = 0;
const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function purge() {
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ids = owners.map(row => row.id);
  if (ids.length) {
    await prisma.userDocument.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.usageEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.usageReservation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.usageBucket.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function makeOwner(local) {
  return prisma.user.create({
    data: {
      email: `${local}-${Math.random().toString(36).slice(2, 8)}${SUFFIX}`,
      role: "SOCIAL_WORKER",
      emailVerified: new Date(),
    },
  });
}

/** Reserveeritud DOCUMENT_GENERATE ühik — täpselt see kuju, mille marsruut enne tööd loob. */
async function reserveDocumentUnit(userId, idempotencyKey, { hardLimit = 100n } = {}) {
  const periodStart = new Date(Date.UTC(2026, 0, 1));
  const periodEnd = new Date(Date.UTC(2030, 0, 1));
  const bucket = await prisma.usageBucket.create({
    data: {
      userId,
      metric: "DOCUMENT_GENERATE",
      period: "MONTHLY",
      periodStart,
      periodEnd,
      hardLimit,
      used: 0n,
      reserved: 1n,
    },
  });
  await prisma.usageReservation.create({
    data: {
      userId,
      bucketId: bucket.id,
      metric: "DOCUMENT_GENERATE",
      idempotencyKey,
      reservedAmount: 1n,
      status: "RESERVED",
    },
  });
  return bucket;
}

async function countUploads(uploadsDir) {
  try {
    return (await fs.readdir(uploadsDir)).length;
  } catch {
    return 0;
  }
}

async function main() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sol-meet-docs-"));
  process.env.DOCS_STORAGE_DIR = storageRoot;
  const uploadsDir = path.join(storageRoot, "uploads");

  // Import ALLES pärast env-i seadmist: teed loetakse kutse ajal, aga hoiame selle ilmselgena.
  const { persistMeetingSummaryDocument } = await import("../lib/documents/meetingSummaryJobs.js");

  await purge();

  try {
    // ---------------------------------------------------------------- A: kõik kolm maanduvad
    {
      const owner = await makeOwner("ok");
      const key = `meet-probe-ok-${owner.id}`;
      const bucket = await reserveDocumentUnit(owner.id, key);

      const document = await persistMeetingSummaryDocument({
        userId: owner.id,
        role: "SOCIAL_WORKER",
        locale: "et",
        text: "Kohtumise kokkuvõte.",
        usageCommit: { idempotencyKey: key },
      });

      const row = await prisma.userDocument.findUnique({ where: { id: document.id } });
      const reservation = await prisma.usageReservation.findUnique({
        where: { userId_idempotencyKey: { userId: owner.id, idempotencyKey: key } },
      });
      const after = await prisma.usageBucket.findUnique({ where: { id: bucket.id } });

      expect("A1 dokumendirida on andmebaasis", Boolean(row), "rida puudub");
      expect("A2 reservatsioon on COMMITTED", reservation?.status === "COMMITTED", `status=${reservation?.status}`);
      expect("A3 ühik läks kasutusse (used=1, reserved=0)",
        after?.used === 1n && after?.reserved === 0n,
        `used=${after?.used} reserved=${after?.reserved}`);
      expect("A4 fail on kettal", await fs.readFile(path.join(storageRoot, row.storagePath), "utf8")
        .then(text => text.includes("Kohtumise kokkuvõte")).catch(() => false), "faili ei õnnestunud lugeda");
    }

    // ------------------------------------------- B: commit kukub → KOGU tehing keritakse tagasi
    {
      const owner = await makeOwner("rollback");
      const before = await prisma.userDocument.count({ where: { ownerId: owner.id } });
      const filesBefore = await countUploads(uploadsDir);

      let threw = null;
      try {
        await persistMeetingSummaryDocument({
          userId: owner.id,
          role: "SOCIAL_WORKER",
          locale: "et",
          text: "See rida ei tohi ellu jääda.",
          usageCommit: { idempotencyKey: "reservatsiooni-ei-ole-olemas" },
        });
      } catch (error) {
        threw = error;
      }

      const after = await prisma.userDocument.count({ where: { ownerId: owner.id } });
      const filesAfter = await countUploads(uploadsDir);

      expect("B1 kutse kukub, mitte ei teeskle edu", Boolean(threw), "erindit ei tulnud");
      expect("B2 dokumendirida EI JÄÄNUD alles (päris ROLLBACK)", after === before, `enne=${before} pärast=${after}`);
      expect("B3 poolik fail on kettalt koristatud", filesAfter === filesBefore,
        `enne=${filesBefore} pärast=${filesAfter}`);
    }

    // ------------------------------------------------- C: kvoot täis → ühikut EI võeta ära
    {
      const owner = await makeOwner("quota");
      const key = `meet-probe-quota-${owner.id}`;
      const bucket = await reserveDocumentUnit(owner.id, key);

      // Suur olemasolev maht: `getUserStorageUsageBytes` summeerib `size` veeru, seega päris faili
      // ei ole vaja — kvoot on sellest summast tuletatud. SOCIAL_WORKER piir on 100 MB ja
      // `UserDocument.size` on `Int`, seega 200 MB on korraga üle piiri ja mahub tüüpi.
      await prisma.userDocument.create({
        data: {
          ownerId: owner.id,
          title: "Suur vana fail",
          originalName: "suur.txt",
          kind: "MATERIAL",
          agentAllowed: false,
          mime: "text/plain",
          size: 200 * 1024 * 1024,
          sha256: "0".repeat(64),
          storagePath: "uploads/puudub.txt",
        },
      });

      let threw = null;
      try {
        await persistMeetingSummaryDocument({
          userId: owner.id,
          role: "SOCIAL_WORKER",
          locale: "et",
          text: "Üle kvoodi.",
          usageCommit: { idempotencyKey: key },
        });
      } catch (error) {
        threw = error;
      }

      const reservation = await prisma.usageReservation.findUnique({
        where: { userId_idempotencyKey: { userId: owner.id, idempotencyKey: key } },
      });
      const after = await prisma.usageBucket.findUnique({ where: { id: bucket.id } });
      const docs = await prisma.userDocument.count({ where: { ownerId: owner.id } });

      expect("C1 kvoot jõustub", String(threw?.message || "").includes("storage_quota_exceeded"),
        `viga=${threw?.message}`);
      expect("C2 ühikut EI võetud — reservatsioon on endiselt RESERVED",
        reservation?.status === "RESERVED", `status=${reservation?.status}`);
      expect("C3 kasutus ei liikunud", after?.used === 0n, `used=${after?.used}`);
      expect("C4 uut dokumendirida ei tekkinud", docs === 1, `ridu=${docs}`);
    }

    // ------------------------------------- D: juba commit'itud võti ei võta teist korda tasu
    {
      const owner = await makeOwner("idem");
      const key = `meet-probe-idem-${owner.id}`;
      const bucket = await reserveDocumentUnit(owner.id, key);

      await persistMeetingSummaryDocument({
        userId: owner.id, role: "SOCIAL_WORKER", locale: "et",
        text: "Esimene.", usageCommit: { idempotencyKey: key },
      });
      await persistMeetingSummaryDocument({
        userId: owner.id, role: "SOCIAL_WORKER", locale: "et",
        text: "Teine sama võtmega.", usageCommit: { idempotencyKey: key },
      });

      const after = await prisma.usageBucket.findUnique({ where: { id: bucket.id } });
      expect("D1 sama võtmega teine commit ei võta teist ühikut", after?.used === 1n, `used=${after?.used}`);
    }
  } finally {
    await purge();
    await fs.rm(storageRoot, { recursive: true, force: true });
    await prisma.$disconnect();
  }

  console.log(`\n${failed === 0 ? "PROBE_OK" : "PROBE_FAIL"} ${passed}/${passed + failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("[meeting-summary-probe] ootamatu viga", error);
  try { await purge(); } catch {}
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
