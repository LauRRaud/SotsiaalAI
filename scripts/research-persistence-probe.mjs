#!/usr/bin/env node
/**
 * SOL-RES-05 — vestlusse salvestamine on lubaduse osa, mitte kõrvaltoiming. Päris PostgreSQL.
 *
 *   npm run research:persist:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. `persistInit/Append/Done` neelasid kõik DB-vead ja
 * `persistDone()` tagastas vea korral `null`. Pipeline ei vaadanud tagastusväärtust ja märkis
 * ResearchJob'i ikkagi `done`, mille järel kasutus commit'iti. Kasutaja nägi jooksva voo ajal
 * tulemust ja kulutas uuringuühiku, aga pärast navigeerimist avanes vestlus ILMA raportita.
 *
 * MÕÕDETAV VÄIDE: (1) sama töö kirjutus on idempotentne — kaks katset või kaks workerit ei tekita
 * vestlusse kahte raportit; (2) DB-vea korral tuleb `null`, seega pipeline'il ON mille peale
 * reageerida (ja ta reageerib: lähtekoodi-leping mõõdab, et `done` jääb tegemata).
 *
 * Andmed: ainult `@sol-persist.invalid` sünteetiline konto; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { persistDone } from "../lib/chat/persistence.js";

const SUFFIX = "@sol-persist.invalid";
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

async function makeConversation(owner) {
  return prisma.conversation.create({
    data: { userId: owner.id, role: "SOCIAL_WORKER", title: "Sondi vestlus" }
  });
}

async function assistantCount(conversationId) {
  return prisma.conversationMessage.count({ where: { conversationId, role: "ASSISTANT" } });
}

async function purge() {
  const owners = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ownerIds = owners.map((row) => row.id);
  if (ownerIds.length) {
    const conversations = await prisma.conversation.findMany({
      where: { userId: { in: ownerIds } },
      select: { id: true }
    });
    const ids = conversations.map((row) => row.id);
    if (ids.length) {
      await prisma.conversationMessage.deleteMany({ where: { conversationId: { in: ids } } });
      await prisma.conversation.deleteMany({ where: { id: { in: ids } } });
    }
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-RES-05 — uuringu raporti püsikoopia vestluses\n");
  await purge();
  const owner = await makeOwner();

  // === 1. SAMA TÖÖ KIRJUTUS ON IDEMPOTENTNE ===============================
  {
    const conversation = await makeConversation(owner);
    const args = {
      convId: conversation.id,
      userId: owner.id,
      status: "COMPLETED",
      finalText: "Uuringu raport",
      sources: [],
      attachments: [],
      isCrisis: false,
      persistKey: "research:job_1",
      metadataExtra: { researchJobId: "job_1" }
    };

    const first = await persistDone(args);
    const second = await persistDone(args);

    expect("esimene kirjutus loob sõnumi", Boolean(first?.assistantMessageId), JSON.stringify(first));
    expect("teine kirjutus TAASKASUTAB sama sõnumit", second?.reused === true, JSON.stringify(second));
    expect("mõlemad viitavad samale sõnumile", second?.assistantMessageId === first?.assistantMessageId);
    expect("vestluses on täpselt üks raport", (await assistantCount(conversation.id)) === 1, String(await assistantCount(conversation.id)));
  }

  // === 2. TEINE TÖÖ ON TEINE SÕNUM ========================================
  /* Idempotentsuse valvur ei tohi olla liiga lai: eri töödel on eri võti ja eri raport. */
  {
    const conversation = await makeConversation(owner);
    for (const jobId of ["job_a", "job_b"]) {
      await persistDone({
        convId: conversation.id,
        userId: owner.id,
        status: "COMPLETED",
        finalText: `Raport ${jobId}`,
        sources: [],
        attachments: [],
        isCrisis: false,
        persistKey: `research:${jobId}`,
        metadataExtra: { researchJobId: jobId }
      });
    }
    expect("kaks eri tööd annavad kaks raportit", (await assistantCount(conversation.id)) === 2, String(await assistantCount(conversation.id)));
  }

  // === 3. VÕTMETA KIRJUTUS KÄITUB NAGU ENNE ===============================
  {
    const conversation = await makeConversation(owner);
    for (let i = 0; i < 2; i += 1) {
      await persistDone({
        convId: conversation.id,
        userId: owner.id,
        status: "COMPLETED",
        finalText: "Tavaline vestlusvastus",
        sources: [],
        attachments: [],
        isCrisis: false
      });
    }
    expect("võtmeta kirjutus ei ole idempotentne (vana käitumine säilib)", (await assistantCount(conversation.id)) === 2);
  }

  // === 4. DB-VIGA ANNAB null — SIGNAAL, MILLE PEALE PIPELINE REAGEERIB ====
  {
    const conversation = await makeConversation(owner);
    const failingPrisma = {
      async $transaction() {
        throw new Error("süstitud DB viga");
      }
    };
    const result = await persistDone(
      {
        convId: conversation.id,
        userId: owner.id,
        status: "COMPLETED",
        finalText: "Raport, mida ei õnnestu salvestada",
        sources: [],
        attachments: [],
        isCrisis: false,
        persistKey: "research:job_fail"
      },
      { prisma: failingPrisma }
    );

    expect("DB-viga tagastab null, mitte vaikselt edu", result === null, JSON.stringify(result));
    expect("vestlusse ei jäänud midagi", (await assistantCount(conversation.id)) === 0);
  }

  // === 5. VÕÕRA VESTLUSE ALLA EI KIRJUTATA ================================
  {
    const stranger = await makeOwner();
    const conversation = await makeConversation(stranger);
    const result = await persistDone({
      convId: conversation.id,
      userId: owner.id,
      status: "COMPLETED",
      finalText: "Ei tohi jõuda kohale",
      sources: [],
      attachments: [],
      isCrisis: false,
      persistKey: "research:job_foreign"
    });
    expect("võõra vestluse alla kirjutamine ei õnnestu", !result?.assistantMessageId, JSON.stringify(result));
    expect("võõras vestlus jääb tühjaks", (await assistantCount(conversation.id)) === 0);
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
