#!/usr/bin/env node
/**
 * SOL-CHAT-01 ja SOL-CHAT-02 — pöörde terminalseis ja tema arveldus, päris PostgreSQL-is.
 *
 *   npm run chat:settle:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Väide on ROLLBACK: arveldus antakse `persistDone`-i
 * TEHINGUSSE, seega arvelduse viga peab kustutama ka juba kirjutatud assistendisõnumi — ja
 * vastupidi, kirjutuse viga ei tohi jätta arvestatud ühikut. Fake-Prisma `$transaction` on lihtsalt
 * funktsioonikutse: seal „rollback" ei eksisteeri ja mõlemad suunad näeksid rohelised välja ka siis,
 * kui parandust ei oleks. Sellepärast käib see sond päris andmebaasi vastu.
 *
 * MÕÕDETAVAD VÄITED:
 *   1. COMPLETED: sõnum on kettal JA reservatsioon on COMMITTED — mõlemad või mitte kumbki.
 *   2. arvelduse viga tehingus → sõnumit EI OLE (rollback) ja reservatsioon jääb RESERVED-iks.
 *   3. võõra omaniku vestlus → sõnumit ei teki JA ühikut ei arvestata.
 *   4. ABORTED/ERROR marker + release on üks tehing.
 *   5. NEGATIIVKONTROLL: vana järjekord (commit enne püsistust) tekitab keelatud seisu —
 *      arvestatud ühik ilma vestlusse jõudnud vastuseta. Kui see kontroll ei kuku, ei mõõda sond
 *      midagi.
 *
 * Andmed: ainult `@sol-chat-settle.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { persistDone } from "../lib/chat/persistence.js";
import { usageService, UsageServiceError } from "../lib/usage/service.js";

const SUFFIX = "@sol-chat-settle.invalid";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

async function makeUser() {
  const user = await prisma.user.create({
    data: {
      email: `chat-${Math.random().toString(36).slice(2, 10)}${SUFFIX}`,
      role: "CLIENT",
      emailVerified: NOW
    }
  });
  // Kvoodiõigus tuleb otse ülekirjutusest, et sond ei sõltuks paketiseemnetest.
  await prisma.userEntitlementOverride.create({
    data: {
      userId: user.id,
      metric: "CHAT_ASSISTANT_REPLY",
      enabled: true,
      hardLimit: 10n,
      period: "DAILY",
      reason: "SOL-CHAT-01 sond",
      createdByAdminId: user.id
    }
  });
  return user;
}

async function makeConversation(userId) {
  return prisma.conversation.create({
    data: { userId, role: "CLIENT", title: "Sondi vestlus" },
    select: { id: true }
  });
}

async function reserve(userId, key) {
  return usageService.reserve({
    userId,
    metric: "CHAT_ASSISTANT_REPLY",
    amount: 1,
    idempotencyKey: key,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
  });
}

async function readReservation(userId, key) {
  return prisma.usageReservation.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
    include: { bucket: true }
  });
}

async function countAssistantMessages(conversationId) {
  return prisma.conversationMessage.count({
    where: { conversationId, role: "ASSISTANT" }
  });
}

async function purge() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true }
  });
  const ids = users.map((row) => row.id);
  if (ids.length) {
    await prisma.usageEvent.deleteMany({ where: { userId: { in: ids } } });
    await prisma.usageReservation.deleteMany({ where: { userId: { in: ids } } });
    await prisma.usageBucket.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userEntitlementOverride.deleteMany({ where: { userId: { in: ids } } });
    await prisma.conversation.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-CHAT-01/-02 — pöörde arveldus ja terminalmarker ühes tehingus\n");
  await purge();

  // === 1. COMPLETED: SÕNUM JA COMMIT KOOS ==================================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const key = "chat.reply:probe-1";
    await reserve(user.id, key);

    const result = await persistDone({
      convId: conv.id,
      userId: user.id,
      status: "COMPLETED",
      finalText: "Täisvastus, mis peab jääma leitavaks.",
      settleUsage: (tx) => usageService.commit({ userId: user.id, idempotencyKey: key, tx })
    });

    const reservation = await readReservation(user.id, key);
    const messages = await countAssistantMessages(conv.id);

    expect("COMPLETED: püsistus õnnestus", !!result?.assistantMessageId);
    expect("COMPLETED: assistendisõnum on kettal", messages === 1, `messages=${messages}`);
    expect("COMPLETED: reservatsioon on COMMITTED", reservation?.status === "COMMITTED", reservation?.status);
    expect(
      "COMPLETED: ämber loeb ühiku kasutatuks ja reserv on null",
      BigInt(reservation?.bucket?.used ?? -1n) === 1n && BigInt(reservation?.bucket?.reserved ?? -1n) === 0n,
      `used=${reservation?.bucket?.used} reserved=${reservation?.bucket?.reserved}`
    );
  }

  // === 2. ARVELDUSE VIGA TEHINGUS KUSTUTAB KA SÕNUMI =======================
  /* SEE ON SONDI TUUM. Kui arveldus kukub, ei tohi kettale jääda „valmis vastust", mille eest
     kunagi ei maksta ja mis lubab kasutajale lõpetatud pöörde. Rollback peab viima mõlemad. */
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const key = "chat.reply:probe-2";
    await reserve(user.id, key);

    const result = await persistDone({
      convId: conv.id,
      userId: user.id,
      status: "COMPLETED",
      finalText: "Vastus, mida ei tohi alles jääda.",
      settleUsage: async () => {
        throw new Error("arveldus kukkus tehingus");
      }
    });

    const reservation = await readReservation(user.id, key);
    const messages = await countAssistantMessages(conv.id);

    expect("arvelduse viga: persistDone tagastab null", result === null, String(result));
    expect("arvelduse viga: assistendisõnumit EI OLE (rollback)", messages === 0, `messages=${messages}`);
    expect("arvelduse viga: reservatsioon jääb RESERVED", reservation?.status === "RESERVED", reservation?.status);
    expect(
      "arvelduse viga: ühikut ei arvestatud",
      BigInt(reservation?.bucket?.used ?? -1n) === 0n,
      `used=${reservation?.bucket?.used}`
    );
  }

  // === 3. AEGUNUD/VABASTATUD RESERVATSIOON EI COMMIT'I VAIKSELT ============
  /* Päris commit-viga, mitte visatud erand: reservatsioon on juba vabastatud, seega
     `commitWithin` viskab USAGE_RESERVATION_STATE_CONFLICT sama tehingu sees. */
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const key = "chat.reply:probe-3";
    await reserve(user.id, key);
    await usageService.release({ userId: user.id, idempotencyKey: key, reason: "sond" });

    const result = await persistDone({
      convId: conv.id,
      userId: user.id,
      status: "COMPLETED",
      finalText: "Vastus vabastatud reservatsiooni peal.",
      settleUsage: (tx) => usageService.commit({ userId: user.id, idempotencyKey: key, tx })
    });

    const messages = await countAssistantMessages(conv.id);
    const reservation = await readReservation(user.id, key);
    expect("päris commit-viga: püsistus kukub kaasa", result === null, String(result));
    expect("päris commit-viga: sõnumit ei jää kettale", messages === 0, `messages=${messages}`);
    expect("päris commit-viga: reservatsioon jääb RELEASED", reservation?.status === "RELEASED", reservation?.status);
  }

  // === 4. VÕÕRA OMANIKU VESTLUS: EI SÕNUMIT EGA ARVELDUST ==================
  {
    const owner = await makeUser();
    const stranger = await makeUser();
    const conv = await makeConversation(owner.id);
    const key = "chat.reply:probe-4";
    await reserve(stranger.id, key);

    let settleCalls = 0;
    const result = await persistDone({
      convId: conv.id,
      userId: stranger.id,
      status: "COMPLETED",
      finalText: "Võõrasse vestlusse ei tohi midagi jõuda.",
      settleUsage: async (tx) => {
        settleCalls += 1;
        return usageService.commit({ userId: stranger.id, idempotencyKey: key, tx });
      }
    });

    const reservation = await readReservation(stranger.id, key);
    const messages = await countAssistantMessages(conv.id);
    expect("võõras vestlus: püsistus ei õnnestu", result === null, String(result));
    expect("võõras vestlus: sõnumit ei teki", messages === 0, `messages=${messages}`);
    expect("võõras vestlus: arveldust ei kutsuta", settleCalls === 0, `settleCalls=${settleCalls}`);
    expect("võõras vestlus: ühik jääb reserveerituks", reservation?.status === "RESERVED", reservation?.status);
  }

  // === 5. ABORTED MARKER JA VABASTUS ÜHES TEHINGUS =========================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const key = "chat.reply:probe-5";
    await reserve(user.id, key);

    const result = await persistDone({
      convId: conv.id,
      userId: user.id,
      status: "ABORTED",
      finalText: "Osaline tekst, mille kasutaja juba nägi",
      settleUsage: (tx) => usageService.release({
        userId: user.id,
        idempotencyKey: key,
        reason: "chat_stream_aborted",
        tx
      })
    });

    const reservation = await readReservation(user.id, key);
    const marker = await prisma.conversationMessage.findFirst({
      where: { conversationId: conv.id, role: "ASSISTANT" },
      select: { content: true, metadata: true }
    });

    expect("ABORTED: marker kirjutati", !!result?.assistantMessageId);
    expect("ABORTED: marker kannab lõppseisu", marker?.metadata?.completionStatus === "ABORTED", String(marker?.metadata?.completionStatus));
    expect("ABORTED: salvestati ainult kuvatud osaline tekst", marker?.content === "Osaline tekst, mille kasutaja juba nägi");
    expect("ABORTED: reservatsioon on RELEASED", reservation?.status === "RELEASED", reservation?.status);
    expect(
      "ABORTED: ühikut ei arvestatud ja reserv on tagasi",
      BigInt(reservation?.bucket?.used ?? -1n) === 0n && BigInt(reservation?.bucket?.reserved ?? -1n) === 0n,
      `used=${reservation?.bucket?.used} reserved=${reservation?.bucket?.reserved}`
    );
  }

  // === 6. VABASTUSE VIGA JÄTAB MARKERI KIRJUTAMATA =========================
  /* Teine suund: kui vabastus kukub, ei tohi jääda ABORTED marker, mille kõrval ühik on ikka
     kinni — kutsuja peab saama teada, et pööre ei ole lõpetatud. */
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const key = "chat.reply:probe-6";
    await reserve(user.id, key);
    await usageService.commit({ userId: user.id, idempotencyKey: key });

    const result = await persistDone({
      convId: conv.id,
      userId: user.id,
      status: "ABORTED",
      finalText: "Osaline",
      settleUsage: (tx) => usageService.release({
        userId: user.id,
        idempotencyKey: key,
        reason: "chat_stream_aborted",
        tx
      })
    });

    const messages = await countAssistantMessages(conv.id);
    expect("vabastuse viga: persistDone tagastab null", result === null, String(result));
    expect("vabastuse viga: markerit ei jää kettale", messages === 0, `messages=${messages}`);
  }

  // === 7. NEGATIIVKONTROLL: VANA JÄRJEKORD TEKITAB KEELATUD SEISU ==========
  /* Vana kood: `commit` OMA tehingus enne püsistust. Sond jäljendab teda siin samas harnessis ja
     NÕUAB, et keelatud seis tekiks. Kui see kontroll läheb roheliseks, ei mõõda ülejäänud sond
     midagi — siis on „arvestatud ühik ilma vastuseta" niikuinii võimatu. */
  {
    const user = await makeUser();
    const owner = await makeUser();
    const foreignConv = await makeConversation(owner.id);
    const key = "chat.reply:probe-7";
    await reserve(user.id, key);

    // 1) vana järjekord commit'ib kohe pärast providerit …
    await usageService.commit({ userId: user.id, idempotencyKey: key });
    // 2) … ja püsistus kukub alles pärast seda.
    const result = await persistDone({
      convId: foreignConv.id,
      userId: user.id,
      status: "COMPLETED",
      finalText: "Vastus, mida kasutaja nägi, aga mida vestluses ei ole."
    });

    const reservation = await readReservation(user.id, key);
    const messages = await countAssistantMessages(foreignConv.id);
    const forbidden = reservation?.status === "COMMITTED" && messages === 0;
    expect(
      "NEGATIIVKONTROLL: vana järjekord annab arvestatud ühiku ilma vastuseta",
      forbidden,
      `status=${reservation?.status} messages=${messages} persisted=${String(result)}`
    );
  }

  await purge();

  console.log(`\n${failed === 0 ? "PROBE_OK" : "PROBE_FAIL"} ${passed}/${passed + failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof UsageServiceError ? `${error.code}: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
