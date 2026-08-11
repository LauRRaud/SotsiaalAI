#!/usr/bin/env node
/**
 * SOL-CHAT-03 ja SOL-CHAT-04 — vestluspöörde identiteet ja samaaegsus, päris PostgreSQL-is.
 *
 *   npm run chat:turn:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa. Mõlemad leiud on VÕIDUJOOKSUD: kaks päringut lugesid
 * mõlemad vana seisu ja kirjutasid mõlemad. Fake-Prisma all on „loe → otsusta → kirjuta" alati
 * järjestikune, seega seal ei ole midagi mõõta. Siin käivad võistlejad `Promise.all`-iga päris
 * andmebaasi vastu ja lukk on päris `pg_advisory_xact_lock`.
 *
 * MÕÕDETAVAD VÄITED:
 *   1. Sama kavatsuse võti kahes samaaegses päringus → TÄPSELT ÜKS pööre saab töö; teine saab
 *      „juba töös" (mitte teist tasulist tööd).
 *   2. Lõpetatud kavatsuse kordus → tulemus mängitakse tagasi, uut pööret ei looda.
 *   3. Ebaõnnestunud pöörde kordus SAMA võtmega → sama rida, `attempt` kasvab (kordus jääb
 *      kavatsusega seotuks, ei muutu uueks tööks).
 *   4. Sessioonipiir: kui vabu kohti on täpselt üks, siis neljast samaaegsest pöördest saab
 *      töö TÄPSELT ÜKS ja piiri ei ületata.
 *   5. Kaks eri kavatsust samas vestluses korraga → teine saab „vestlus on hõivatud".
 *   6. Rippuma jäänud RUNNING pööre (aegunud lease) EI luku vestlust igaveseks.
 *   7. NEGATIIVKONTROLL: vana muster (loe loendur → kirjuta ilma lukuta) ületab sama
 *      samaaegsuse all piiri. Kui see kontroll ei kuku, ei mõõda sond midagi.
 *
 * Andmed: ainult `@sol-chat-turn.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { claimChatTurn, CHAT_TURN_OUTCOME } from "../lib/chat/turnRegistry.js";
import { writeUserTurn } from "../lib/chat/persistence.js";

const SUFFIX = "@sol-chat-turn.invalid";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const claim = (input) => claimChatTurn(input, { writeUserTurn });

async function makeUser() {
  return prisma.user.create({
    data: {
      email: `turn-${Math.random().toString(36).slice(2, 10)}${SUFFIX}`,
      role: "CLIENT",
      emailVerified: NOW
    }
  });
}

async function makeConversation(userId) {
  return prisma.conversation.create({
    data: { userId, role: "CLIENT", title: "Sondi vestlus" },
    select: { id: true }
  });
}

function tally(results) {
  const counts = {};
  for (const result of results) {
    const key = result.status === "fulfilled" ? result.value.outcome : `rejected:${result.reason?.code || result.reason?.message}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function purge() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true }
  });
  const ids = users.map((row) => row.id);
  if (ids.length) {
    await prisma.chatTurn.deleteMany({ where: { userId: { in: ids } } });
    await prisma.conversation.deleteMany({ where: { userId: { in: ids } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-CHAT-03/-04 — pöörde identiteet ja samaaegsus\n");
  await purge();

  // === 1. SAMA KAVATSUSE VÕTI KAHES SAMAAEGSES PÄRINGUS ====================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const input = {
      userId: user.id,
      conversationId: conv.id,
      clientTurnKey: "intent-1",
      role: "CLIENT",
      userMessage: "Sama küsimus kaks korda"
    };

    const results = await Promise.allSettled([claim(input), claim(input)]);
    const counts = tally(results);
    const turns = await prisma.chatTurn.count({ where: { conversationId: conv.id } });
    const userMessages = await prisma.conversationMessage.count({
      where: { conversationId: conv.id, role: "USER" }
    });

    expect("sama võti korraga: täpselt üks saab töö", counts[CHAT_TURN_OUTCOME.CLAIMED] === 1, JSON.stringify(counts));
    expect("sama võti korraga: teine saab „juba töös\"", counts[CHAT_TURN_OUTCOME.IN_FLIGHT] === 1, JSON.stringify(counts));
    expect("sama võti korraga: pöördeid on üks", turns === 1, `turns=${turns}`);
    expect("sama võti korraga: kasutaja küsimus kirjutati ÜKS kord", userMessages === 1, `messages=${userMessages}`);
  }

  // === 2. LÕPETATUD KAVATSUSE KORDUS MÄNGITAKSE TAGASI ======================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const input = {
      userId: user.id,
      conversationId: conv.id,
      clientTurnKey: "intent-2",
      role: "CLIENT",
      userMessage: "Küsimus, millele on vastatud"
    };
    const first = await claim(input);
    const assistant = await prisma.conversationMessage.create({
      data: {
        conversationId: conv.id,
        role: "ASSISTANT",
        content: "Valmis vastus",
        metadata: { completionStatus: "COMPLETED", sources: [] }
      }
    });
    await prisma.chatTurn.update({
      where: { id: first.turn.id },
      data: { status: "COMPLETED", assistantMessageId: assistant.id, endedAt: new Date() }
    });

    const repeat = await claim(input);
    const turns = await prisma.chatTurn.count({ where: { conversationId: conv.id } });
    const userMessages = await prisma.conversationMessage.count({
      where: { conversationId: conv.id, role: "USER" }
    });

    expect("lõpetatud kordus: tulemus mängitakse tagasi", repeat.outcome === CHAT_TURN_OUTCOME.REPLAYED, repeat.outcome);
    expect("lõpetatud kordus: tagasi tuleb sama vastus", repeat.replay?.content === "Valmis vastus", repeat.replay?.content);
    expect("lõpetatud kordus: uut pööret ei looda", turns === 1, `turns=${turns}`);
    expect("lõpetatud kordus: uut kasutajasõnumit ei teki", userMessages === 1, `messages=${userMessages}`);
  }

  // === 3. EBAÕNNESTUNUD PÖÖRDE KORDUS ON SAMA RIDA ==========================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const input = {
      userId: user.id,
      conversationId: conv.id,
      clientTurnKey: "intent-3",
      role: "CLIENT",
      userMessage: "Küsimus, mis kukkus"
    };
    const first = await claim(input);
    await prisma.chatTurn.update({
      where: { id: first.turn.id },
      data: { status: "ERROR", endedAt: new Date() }
    });

    const retry = await claim(input);
    const turns = await prisma.chatTurn.count({ where: { conversationId: conv.id } });

    expect("kordus pärast viga: sama rida", retry.turn?.id === first.turn.id, `${retry.turn?.id} vs ${first.turn.id}`);
    expect("kordus pärast viga: katse number kasvas", retry.turn?.attempt === 2, String(retry.turn?.attempt));
    expect("kordus pärast viga: teist pööret ei teki", turns === 1, `turns=${turns}`);
  }

  // === 4. SESSIOONIPIIR ON ATOMAARNE ========================================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    // Kaks kohta kokku, üks juba kasutatud → vabu kohti täpselt üks.
    await prisma.conversationMessage.create({
      data: { conversationId: conv.id, authorId: user.id, role: "USER", content: "Esimene" }
    });

    const results = await Promise.allSettled(
      Array.from({ length: 4 }, (_, index) => claim({
        userId: user.id,
        conversationId: conv.id,
        clientTurnKey: `limit-${index}`,
        role: "CLIENT",
        userMessage: `Võistleja ${index}`,
        sessionTurnLimit: 2
      }))
    );
    const counts = tally(results);
    const userMessages = await prisma.conversationMessage.count({
      where: { conversationId: conv.id, role: "USER" }
    });

    expect("piir: vabu kohti üks, võitjaid täpselt üks", counts[CHAT_TURN_OUTCOME.CLAIMED] === 1, JSON.stringify(counts));
    expect("piir: kasutajasõnumeid kokku täpselt kaks", userMessages === 2, `messages=${userMessages}`);
    expect(
      "piir: ülejäänud kolm said kas piiri- või hõivatud-vastuse",
      (counts[CHAT_TURN_OUTCOME.SESSION_LIMIT] || 0) + (counts[CHAT_TURN_OUTCOME.CONVERSATION_BUSY] || 0) === 3,
      JSON.stringify(counts)
    );
  }

  // === 5. KAKS ERI KAVATSUST KORRAGA SAMAS VESTLUSES ========================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const results = await Promise.allSettled([
      claim({ userId: user.id, conversationId: conv.id, clientTurnKey: "tab-a", role: "CLIENT", userMessage: "Vahekaart A" }),
      claim({ userId: user.id, conversationId: conv.id, clientTurnKey: "tab-b", role: "CLIENT", userMessage: "Vahekaart B" })
    ]);
    const counts = tally(results);
    const running = await prisma.chatTurn.count({ where: { conversationId: conv.id, status: "RUNNING" } });

    expect("kaks vahekaarti: töö saab täpselt üks", counts[CHAT_TURN_OUTCOME.CLAIMED] === 1, JSON.stringify(counts));
    expect("kaks vahekaarti: teine saab „vestlus on hõivatud\"", counts[CHAT_TURN_OUTCOME.CONVERSATION_BUSY] === 1, JSON.stringify(counts));
    expect("kaks vahekaarti: aktiivseid pöördeid on üks", running === 1, `running=${running}`);
  }

  // === 6. RIPPUMA JÄÄNUD PÖÖRE EI LUKUSTA VESTLUST IGAVESEKS ================
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    const stuck = await claim({
      userId: user.id, conversationId: conv.id, clientTurnKey: "stuck", role: "CLIENT", userMessage: "Rippuma jäänud"
    });
    // Süda ei löö enam: viime südamelöögi lease'ist tahapoole.
    await prisma.$executeRaw`UPDATE "ChatTurn" SET "updatedAt" = NOW() - INTERVAL '60 minutes' WHERE "id" = ${stuck.turn.id}`;

    const next = await claim({
      userId: user.id, conversationId: conv.id, clientTurnKey: "after-stuck", role: "CLIENT", userMessage: "Uus pööre"
    });
    const closed = await prisma.chatTurn.findUnique({ where: { id: stuck.turn.id } });

    expect("aegunud pööre: uus pööre saab töö", next.outcome === CHAT_TURN_OUTCOME.CLAIMED, next.outcome);
    expect("aegunud pööre: vana suletakse ausalt ERROR-iks", closed?.status === "ERROR", closed?.status);
  }

  // === 7. NEGATIIVKONTROLL: VANA MUSTER ÜLETAB PIIRI ========================
  /* Vana kood luges loenduri väljaspool lukku ja kirjutas hiljem. Sama samaaegsus siin peab
     piiri ÜLETAMA — muidu ei mõõdaks punkt 4 midagi. */
  {
    const user = await makeUser();
    const conv = await makeConversation(user.id);
    await prisma.conversationMessage.create({
      data: { conversationId: conv.id, authorId: user.id, role: "USER", content: "Esimene" }
    });

    const legacyClaim = async (index) => {
      const used = await prisma.conversationMessage.count({
        where: { conversationId: conv.id, role: "USER", conversation: { userId: user.id } }
      });
      if (used >= 2) return "limit";
      await prisma.conversationMessage.create({
        data: { conversationId: conv.id, authorId: user.id, role: "USER", content: `Vana muster ${index}` }
      });
      return "claimed";
    };
    await Promise.allSettled(Array.from({ length: 4 }, (_, index) => legacyClaim(index)));
    const userMessages = await prisma.conversationMessage.count({
      where: { conversationId: conv.id, role: "USER" }
    });

    expect(
      "NEGATIIVKONTROLL: vana muster ületab sessioonipiiri",
      userMessages > 2,
      `messages=${userMessages} (piir oli 2)`
    );
  }

  await purge();

  console.log(`\n${failed === 0 ? "PROBE_OK" : "PROBE_FAIL"} ${passed}/${passed + failed}`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
