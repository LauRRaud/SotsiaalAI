import { prisma } from "@/lib/prisma";

/**
 * VESTLUSPÖÖRDE SERVERIPOOLNE IDENTITEET (SOL-CHAT-03 ja SOL-CHAT-04).
 *
 * MIS OLI VALESTI — üks juur, kaks leidu.
 *
 *  - **SOL-CHAT-03.** Klient ei saatnud ühtegi stabiilset võtit, seega `routeAdapter` genereeris
 *    IGA HTTP-katse jaoks uue UUID-i. Brauseri kordus, vahendaja kordus või kasutaja „Proovi
 *    uuesti" tegi seega uue tasulise töö, uue sõnumipaari ja uue kasutusühiku SAMA kavatsuse eest.
 *    `retryOf` viitas kohalikule sõnumi-ID-le (arv), mille marsruut nõudis stringina ja seega
 *    lihtsalt viskas ära.
 *  - **SOL-CHAT-04.** Sessioonipiir luges olemasolevad USER-sõnumid ja otsustas ENNE uue loomist,
 *    ilma vestluse lukuta. Kaks vahekaarti läbisid mõlemad viimase lubatud pöörde kontrolli.
 *    Kliendipoolne `isGeneratingRef` piirab ühte hook'i instantsi, mitte teist vahekaarti.
 *
 * MIKS ÜKS PARANDUS. Mõlema kriteerium algab samast puuduvast asjast: pöördel ei olnud rida, mille
 * külge kinnituda. `ChatTurn` on see rida. Unikaalsus `(userId, clientTurnKey)` lõpetab korduse;
 * vestlusepõhine nõuandelukk + „üks aktiivne pööre" lõpetab võistluse; sessioonipiiri lugemine ja
 * USER-sõnumi kirjutamine käivad SAMAS tehingus, seega piir on atomaarne.
 *
 * MIKS NÕUANDELUKK, MITTE OSALINE UNIKAALNE INDEKS „üks RUNNING vestluse kohta". Aegunud pööre
 * tuleb üle võtta ja sessioonipiir tuleb lugeda samas tehingus; osaline indeks jõustaks ainult ühe
 * neist ja teine jääks ikka võistlema. Lukk katab mõlemad ja vabaneb tehingu lõpus.
 * `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu — `$queryRaw` kukub `void` tüübi
 * deserialiseerimisel (vt [[prisma-advisory-lock]]).
 */

const TURN_LOCK_NAMESPACE = 4712;

/** Rippuma jäänud RUNNING pööre. Sama suurusjärk kui vestluse kasutusreservatsiooni TTL. */
const DEFAULT_TURN_LEASE_MS = readPositiveNumber(process.env.CHAT_TURN_LEASE_MS, 15 * 60 * 1000);

const MAX_CLIENT_TURN_KEY_LENGTH = 100;

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

export const CHAT_TURN_OUTCOME = Object.freeze({
  CLAIMED: "claimed",
  REPLAYED: "replayed",
  IN_FLIGHT: "in_flight",
  CONVERSATION_BUSY: "conversation_busy",
  SESSION_LIMIT: "session_limit",
  CONVERSATION_UNAVAILABLE: "conversation_unavailable"
});

export function normalizeClientTurnKey(value) {
  const key = String(value || "").trim();
  if (!key) return null;
  if (key.length > MAX_CLIENT_TURN_KEY_LENGTH) return null;
  // Kliendi võti läheb ka kasutusarvestuse idempotentsusvõtmesse, seega hoia ta lihtsana.
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) return null;
  return key;
}

function isStale(turn, now, leaseMs) {
  const beat = turn?.updatedAt ? new Date(turn.updatedAt).getTime() : 0;
  return !Number.isFinite(beat) || now.getTime() - beat > leaseMs;
}

/**
 * Võtab pöörde omale. Kutsutakse ENNE providerit ja ENNE kasutuse reserveerimist.
 *
 * @returns `{ outcome, turn?, replay?, limit?, used? }`
 */
export async function claimChatTurn({
  userId,
  conversationId,
  clientTurnKey,
  role,
  userMessage,
  sessionTurnLimit = null,
  leaseMs = DEFAULT_TURN_LEASE_MS,
  now = new Date()
}, deps = {}) {
  const db = deps.prisma || prisma;
  const writeUserTurn = deps.writeUserTurn;
  if (typeof writeUserTurn !== "function") {
    throw new TypeError("writeUserTurn is required");
  }
  const key = normalizeClientTurnKey(clientTurnKey);
  if (!key) throw new TypeError("clientTurnKey is required");

  return db.$transaction(async tx => {
    // Vestlusepõhine serialiseerimine: sama vestluse pöörded järjestuvad, teiste omad mitte.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${TURN_LOCK_NAMESPACE}::int4, hashtext(${conversationId})::int4)`;

    const existing = await tx.chatTurn.findUnique({
      where: { userId_clientTurnKey: { userId, clientTurnKey: key } }
    });

    if (existing) {
      if (existing.conversationId !== conversationId) {
        // Sama kavatsuse võti teise vestluse all ei ole kordus, vaid viga.
        return { outcome: CHAT_TURN_OUTCOME.CONVERSATION_UNAVAILABLE };
      }
      if (existing.status === "COMPLETED") {
        /* Kordus lõpetatud pöörde peal: tulemus on juba olemas ja kuulub kasutajale. Uut
           providerikutset ega uut ühikut ei tehta — see ongi idempotentsuse mõte. */
        const replay = existing.assistantMessageId
          ? await tx.conversationMessage.findUnique({
              where: { id: existing.assistantMessageId }
            })
          : null;
        return { outcome: CHAT_TURN_OUTCOME.REPLAYED, turn: existing, replay };
      }
      if (existing.status === "RUNNING" && !isStale(existing, now, leaseMs)) {
        return { outcome: CHAT_TURN_OUTCOME.IN_FLIGHT, turn: existing };
      }
      /* ERROR/ABORTED või rippuma jäänud RUNNING: sama kavatsust tohib uuesti proovida. Rida jääb
         samaks, katse number kasvab — nii jääb kordus kavatsusega seotuks, mitte ei muutu uueks
         tasuliseks tööks. Kasutuse reservatsioon elab sama võtme all ja `usageService.reserve`
         äratab RELEASED rea sama perioodi sees ise üles. */
      const claimed = await tx.chatTurn.updateMany({
        where: { id: existing.id, status: existing.status, updatedAt: existing.updatedAt },
        data: {
          status: "RUNNING",
          attempt: existing.attempt + 1,
          assistantMessageId: null,
          endedAt: null,
          updatedAt: now
        }
      });
      if (claimed.count !== 1) {
        // Keegi teine jõudis ette — see ongi „juba töös".
        return { outcome: CHAT_TURN_OUTCOME.IN_FLIGHT, turn: existing };
      }
      const written = await writeUserTurn(tx, { conversationId, userId, role, userMessage, now });
      if (!written?.ok) {
        return { outcome: CHAT_TURN_OUTCOME.CONVERSATION_UNAVAILABLE, reason: written?.reason || null };
      }
      const turn = await tx.chatTurn.update({
        where: { id: existing.id },
        data: { userMessageId: written.userMessageId || null }
      });
      return { outcome: CHAT_TURN_OUTCOME.CLAIMED, turn };
    }

    /* Uus kavatsus. Enne kirjutamist kaks küsimust, mis mõlemad said varem vale vastuse, sest neid
       küsiti väljaspool lukku. */
    const active = await tx.chatTurn.findFirst({
      where: { conversationId, status: "RUNNING" },
      orderBy: { updatedAt: "desc" }
    });
    if (active && !isStale(active, now, leaseMs)) {
      return { outcome: CHAT_TURN_OUTCOME.CONVERSATION_BUSY, turn: active };
    }
    if (active) {
      // Rippuma jäänud pööre suletakse ausalt, mitte ei jäeta vaikselt RUNNING-uks.
      await tx.chatTurn.updateMany({
        where: { id: active.id, status: "RUNNING" },
        data: { status: "ERROR", endedAt: now }
      });
    }

    if (Number.isFinite(sessionTurnLimit) && sessionTurnLimit > 0) {
      const used = await tx.conversationMessage.count({
        where: { conversationId, role: "USER", conversation: { userId } }
      });
      if (used >= sessionTurnLimit) {
        return { outcome: CHAT_TURN_OUTCOME.SESSION_LIMIT, limit: sessionTurnLimit, used };
      }
    }

    const written = await writeUserTurn(tx, { conversationId, userId, role, userMessage, now });
    if (!written?.ok) {
      return { outcome: CHAT_TURN_OUTCOME.CONVERSATION_UNAVAILABLE, reason: written?.reason || null };
    }

    const turn = await tx.chatTurn.create({
      data: {
        userId,
        conversationId,
        clientTurnKey: key,
        userMessageId: written.userMessageId || null
      }
    });
    return { outcome: CHAT_TURN_OUTCOME.CLAIMED, turn };
  });
}

/**
 * Pöörde lõpp. Kutsutakse `persistDone`-i TEHINGUST, seega terminalseis, assistendisõnum ja
 * kasutuse arveldus jõuavad kettale koos või mitte üldse (vt SOL-CHAT-01).
 */
export async function closeChatTurn(tx, {
  turnId,
  status,
  assistantMessageId = null,
  now = new Date()
}) {
  if (!turnId) return false;
  const result = await tx.chatTurn.updateMany({
    where: { id: turnId },
    data: {
      status,
      ...(assistantMessageId ? { assistantMessageId } : {}),
      endedAt: now
    }
  });
  return result.count === 1;
}

/** Südamelöök pika pöörde ajal, et voog ei paistaks aegununa (vt SOL-MEET-04 sama õppetund). */
export async function touchChatTurn(turnId, deps = {}) {
  if (!turnId) return false;
  const db = deps.prisma || prisma;
  try {
    const result = await db.chatTurn.updateMany({
      where: { id: turnId, status: "RUNNING" },
      data: { updatedAt: new Date() }
    });
    return result.count === 1;
  } catch {
    return false;
  }
}
