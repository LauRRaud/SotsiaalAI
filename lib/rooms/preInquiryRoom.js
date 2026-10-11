import { prisma } from "@/lib/prisma";
import {
  OrganizationInboxSourceType,
  OrganizationInboxStatus,
  OrganizationMembershipStatus,
  OrganizationWorkAssignmentStatus,
  isTerminalInboxStatus
} from "@/lib/org/constants";
import { isOrgInboxEnabled } from "@/lib/org/flags";
import { ROOM_ARCHIVE_REASONS, markRoomArchivedWithin } from "./archive.js";
import { ROOM_ORIGIN_TYPES, buildRoomOrigin } from "./origin.js";
import { lockRoom } from "./ownership.js";
import { preInquiryRoomTitle } from "./roomTitle.js";
import { copyRoomSummariesToParticipants } from "./summaryHandover.js";

// Origin types that a pre-inquiry room can carry. A pre-inquiry keeps the same
// originId (the inquiry id) regardless of which of these types was recorded, so
// de-duplication matches on originId within this set — this also survives a
// recipientType edit between two "open room" clicks.
export const PRE_INQUIRY_ROOM_ORIGIN_TYPES = Object.freeze([
  ROOM_ORIGIN_TYPES.PRE_INQUIRY,
  ROOM_ORIGIN_TYPES.SERVICE_PROVIDER_INQUIRY
]);

export function preInquiryRoomOriginType(inquiry) {
  return inquiry?.recipientType === "SERVICE_PROVIDER"
    ? ROOM_ORIGIN_TYPES.SERVICE_PROVIDER_INQUIRY
    : ROOM_ORIGIN_TYPES.PRE_INQUIRY;
}

/* Teemata pöördumise ruum kannab ainult sõna „Eelpöördumine”: varem läks nimesse
   autori e-posti aadress ja ruumi nimi on näha igale liikmele. */
export function buildPreInquiryRoomTitle(inquiry) {
  return preInquiryRoomTitle(inquiry?.topic);
}

export function preInquiryRoomLockKey(inquiryId) {
  return `preInquiryRoom:${String(inquiryId || "").trim()}`;
}

/**
 * Runs `callback(tx)` inside a transaction that first takes the pre-inquiry room
 * advisory lock. Room creation AND recipient reassignment share this key and
 * transaction, so they can never interleave: whichever acquires the lock first
 * runs to completion before the other observes any state.
 */
export async function withPreInquiryRoomLock(inquiryId, callback, { db = prisma } = {}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${preInquiryRoomLockKey(inquiryId)}))`;
    return callback(tx);
  });
}

/**
 * ASUTUSE VASTUVÕTULAUA PÖÖRDUMISE TEINE OSAPOOL.
 *
 * Asutusele saadetud pöördumisel ei ole `recipientOwnerId`-d: postkast ei kuulu ühelegi
 * inimesele. Ruumi teine osapool on töötaja, kelle ELAV töömääramine sellele postkastikirjele
 * on `ACCEPTED`. Koordinaator, vastust ootav (`PENDING`) töötaja, endine vastutaja ja muu
 * liige ei ole osapool.
 *
 * Vastus loetakse andmebaasist, postkastikirje REA LUKU all. Sama rea lukustavad vastuvõtmine,
 * üleandmine ja sulgemine (`lib/org/inbox.js`), seega on ruumi avamine nendega järjestatud:
 * kumbki näeb teise lõpetatud seisu. LUKUJÄRJEKORD: eelpöördumise ruumi nõuandelukk, siis
 * postkastikirje rida, siis ruumi lukk. Tagasivõtmine võtab kaks esimest samas järjekorras;
 * postkasti rajad võtavad ainult kaks viimast.
 *
 * Lipp, asutuse seis ja moodul on samad väravad, mis saatmisel (`lib/preInquiries.js`).
 *
 * @returns {Promise<string>} töötaja kasutaja-ID või tühi tekst
 */
async function readOrganizationWorkerId(client, { organizationId, inquiryId }) {
  if (!organizationId || !inquiryId || !isOrgInboxEnabled()) return "";
  const found = await client.organizationInboxItem.findFirst({
    where: { organizationId, sourceType: OrganizationInboxSourceType.PRE_INQUIRY, sourceId: inquiryId },
    select: { id: true }
  });
  if (!found) return "";
  if (typeof client.$queryRaw === "function") {
    await client.$queryRaw`SELECT "id" FROM "OrganizationInboxItem" WHERE "id" = ${found.id} FOR UPDATE`;
  }
  const item = await client.organizationInboxItem.findFirst({
    where: {
      id: found.id,
      organization: { status: "ACTIVE", modules: { some: { moduleKey: "KOV_INTAKE", status: "ACTIVE" } } }
    },
    select: {
      status: true,
      assignments: {
        where: { status: OrganizationWorkAssignmentStatus.ACCEPTED },
        select: { assignee: { select: { userId: true, status: true, organizationId: true } } }
      }
    }
  });
  if (!item || isTerminalInboxStatus(item.status)) return "";
  const assignee = item.assignments?.[0]?.assignee;
  if (!assignee || assignee.status !== OrganizationMembershipStatus.ACTIVE) return "";
  if (assignee.organizationId !== organizationId) return "";
  return String(assignee.userId || "").trim();
}

/**
 * Teeb liikmesuse aktiivseks. Olemasolev (ka lahkunud) rida võetakse uuesti kasutusele;
 * uus rida tekib ainult siis, kui kutsuja seda sõnaselgelt lubab (`mint`).
 */
async function activateRoomMembership(client, roomId, userId, { mint = false } = {}) {
  const membership = await client.roomMember.findFirst({
    where: { roomId, userId },
    select: { id: true, leftAt: true }
  });
  if (!membership) {
    if (!mint) return false;
    await client.roomMember.create({
      data: { roomId, userId, role: "MEMBER", billingSource: "SELF" }
    });
    return true;
  }
  if (membership.leftAt) {
    await client.roomMember.update({ where: { id: membership.id }, data: { leftAt: null } });
  }
  return true;
}

/**
 * Idempotently returns the single CANONICAL room for a pre-inquiry, keyed by the
 * structured (originType, originId) origin. Exactly one canonical room may exist
 * per origin — guaranteed at the DB by the partial UNIQUE index
 * "Room_origin_singleton_unique" (migration 20260713193000); the advisory lock
 * (shared with recipient reassignment) is the first line of defence.
 *
 * Under the lock the AUTHORITATIVE inquiry parties (authorId, recipientOwnerId,
 * recipientType) are re-read from the DB — never trusted from the route's
 * pre-lock snapshot — so a concurrent recipient change is either fully before or
 * fully after room creation:
 *  - room created first  -> a later recipient change is rejected (409);
 *  - recipient changed first -> the room is created with the FRESH recipient.
 *
 * Access is authorised per requester:
 *  - a requester who ALREADY has a membership row (active or previously left)
 *    rejoins; a left membership is reactivated (leftAt = null). No fresh
 *    membership is ever minted in an existing room — not even for the current
 *    recipient — so a reassigned recipient cannot inherit the previous
 *    recipient's room and history;
 *  - anyone without a prior membership gets a generic 403 and is not told the
 *    room exists.
 * The canonical room is first created with the author and recipient together;
 * only a pre-inquiry party may create it.
 *
 * ORGANISATION INTAKE DESK (`recipientOrganizationId`): the second party is the
 * worker whose live work assignment is ACCEPTED (`readOrganizationWorkerId`).
 * Two rules differ from a named recipient, both by the owner's decision of
 * 11.10.2026 ("the worker who took the work over sees the earlier conversation"):
 *  - the current worker joins an existing room even without an earlier
 *    membership row, so the conversation follows the work;
 *  - nobody else rejoins: a former worker's left membership is NOT reactivated,
 *    and the coordinator, a pending assignee and other members get the same 403.
 *
 * @returns {Promise<{ room: { id: string, title: string|null }, created: boolean }>}
 */
export async function ensureRoomForPreInquiry({ userId, inquiry }, { db = prisma } = {}) {
  const requesterId = String(userId || "").trim();
  const originId = String(inquiry?.id || "").trim();

  const canonicalWhere = {
    originType: { in: PRE_INQUIRY_ROOM_ORIGIN_TYPES },
    originId
  };

  const httpError = (message, status) => {
    const error = new Error(message);
    error.status = status;
    return error;
  };

  // Resolve (reactivating an existing membership) or, when allowed, create the
  // canonical room from the AUTHORITATIVE inquiry state read under the lock.
  async function resolveOrCreate(client, { allowCreate }) {
    const fresh = await client.preInquiry.findUnique({
      where: { id: originId },
      select: {
        authorId: true,
        recipientOwnerId: true,
        recipientOrganizationId: true,
        recipientType: true,
        deliveryChannel: true,
        status: true,
        sentAt: true,
        topic: true,
        selectedRecipientName: true,
        openedAt: true,
        recalledAt: true
      }
    });
    if (!fresh) throw httpError("api.common.not_found", 404);
    if (fresh.recalledAt) throw httpError("api.common.not_found", 404);

    const authorId = String(fresh.authorId || "").trim();
    const organizationId = String(fresh.recipientOrganizationId || "").trim();
    const workerId = organizationId
      ? await readOrganizationWorkerId(client, { organizationId, inquiryId: originId })
      : "";
    const recipientOwnerId = organizationId ? workerId : String(fresh.recipientOwnerId || "").trim();
    const isParty = Boolean(requesterId) && (requesterId === authorId || requesterId === recipientOwnerId);
    const room = await client.room.findFirst({ where: canonicalWhere, select: { id: true, title: true } });
    if (room) {
      if (organizationId && !isParty) throw httpError("api.common.forbidden", 403);
      const rejoined = await activateRoomMembership(client, room.id, requesterId, {
        mint: Boolean(organizationId) && requesterId === workerId
      });
      if (!rejoined) throw httpError("api.common.forbidden", 403);
      return { room, created: false };
    }

    if (!allowCreate) return null;
    if (!isParty) throw httpError("api.common.forbidden", 403);
    if (fresh.deliveryChannel !== "INTERNAL" || !fresh.sentAt) {
      throw httpError("pre_inquiries.errors.not_sent", 409);
    }
    /* Nimeline saaja võtab pöördumise vastu ise (READY). Asutuse laual on vastuvõtmine
       töömääramise seis: pöördumise enda `status` jääb SENT-iks ja `openedAt` märgib kirje
       avamine (`getInboxItem`). */
    const accepted = organizationId
      ? Boolean(workerId && fresh.openedAt)
      : fresh.status === "READY" && Boolean(fresh.openedAt);
    if (!accepted) {
      throw httpError("pre_inquiries.errors.room_requires_acceptance", 409);
    }

    // A shared room needs two DISTINCT platform users (author + recipient). If the
    // fresh state has no platform recipient (or author == recipient), refuse with
    // a controlled 409 rather than creating a single-member "shared" room.
    const freshParties = [...new Set([authorId, recipientOwnerId].filter(Boolean))];
    if (freshParties.length < 2) {
      throw httpError("pre_inquiries.errors.room_requires_platform_recipient", 409);
    }

    const originType = fresh.recipientType === "SERVICE_PROVIDER"
      ? ROOM_ORIGIN_TYPES.SERVICE_PROVIDER_INQUIRY
      : ROOM_ORIGIN_TYPES.PRE_INQUIRY;

    const created = await client.room.create({
      data: {
        ownerId: authorId,
        title: buildPreInquiryRoomTitle({ topic: fresh.topic, author: inquiry?.author }),
        description: `preInquiry:${originId}\nSotsiaal.pro eelpoordumise vestlusruum.`,
        ...buildRoomOrigin({
          originType,
          originId,
          originMeta: {
            recipientType: fresh.recipientType || "",
            selectedRecipientName: fresh.selectedRecipientName || ""
          }
        }),
        members: {
          create: freshParties.map((memberId) => ({
            userId: memberId,
            role: memberId === authorId ? "OWNER" : "MEMBER",
            billingSource: "SELF"
          }))
        }
      },
      select: { id: true, title: true }
    });

    return { room: created, created: true };
  }

  try {
    return await withPreInquiryRoomLock(originId, (tx) => resolveOrCreate(tx, { allowCreate: true }), { db });
  } catch (error) {
    // The DB partial-unique guarantees one canonical room per origin. If a racing
    // insert lost that race (P2002), resolve the now-existing canonical room with
    // the same authorisation — never a second room, never a leak.
    if (error?.code === "P2002") {
      const resolved = await resolveOrCreate(db, { allowCreate: false });
      if (resolved) return resolved;
    }
    throw error;
  }
}

/**
 * Returns the canonical room for a pre-inquiry (by origin) or null. Used to lock
 * recipient reassignment once a shared room already exists.
 */
export async function findPreInquiryCanonicalRoom(originId, { db = prisma } = {}) {
  const id = String(originId || "").trim();
  if (!id) return null;
  return db.room.findFirst({
    where: { originType: { in: PRE_INQUIRY_ROOM_ORIGIN_TYPES }, originId: id },
    select: { id: true }
  });
}

/** Pöördumise ruum ainult siis, kui see inimene on selle aktiivne liige. */
export async function findPreInquiryRoomForMember(originId, userId, { db = prisma } = {}) {
  const id = String(originId || "").trim();
  const memberId = String(userId || "").trim();
  if (!id || !memberId) return null;
  return db.room.findFirst({
    where: {
      originType: { in: PRE_INQUIRY_ROOM_ORIGIN_TYPES },
      originId: id,
      members: { some: { userId: memberId, leftAt: null } }
    },
    select: { id: true }
  });
}

/**
 * Asutuse töötaja, kelle päringus nimetatud pöördumine on tema vastu võetud töö.
 *
 * See on marsruudi EELKONTROLL, mitte otsus: töötaja ei ole pöördumise nimeline saaja ja
 * `getVisiblePreInquiry` teda ei tunne. Otsuse teeb `ensureRoomForPreInquiry` luku all
 * uuesti. Kes siit läbi ei tule, saab marsruudilt sama 404 mis olematu pöördumise korral.
 */
export async function findOrganizationInquiryForWorker(userId, inquiryId, { db = prisma } = {}) {
  const workerId = String(userId || "").trim();
  const id = String(inquiryId || "").trim();
  if (!workerId || !id || !isOrgInboxEnabled()) return null;
  const item = await db.organizationInboxItem.findFirst({
    where: {
      sourceType: OrganizationInboxSourceType.PRE_INQUIRY,
      sourceId: id,
      assignments: {
        some: {
          status: OrganizationWorkAssignmentStatus.ACCEPTED,
          assignee: { userId: workerId, status: OrganizationMembershipStatus.ACTIVE }
        }
      }
    },
    select: { organizationId: true }
  });
  return item ? { id, recipientOrganizationId: item.organizationId } : null;
}

/**
 * Töö vastu võtnud töötaja liitub pöördumise ruumiga, kui ruum on juba olemas.
 *
 * Omaniku otsus 11.10.2026: töö üle võtnud töötaja näeb varasemat vestlust pöördujaga.
 * Liitumine käib vastuvõtmisega samas tehingus, mitte alles nupuvajutusel: muidu ei loeks
 * pöörduja järgmist sõnumit asutuse poolel keegi enne, kui uus töötaja ruumi ise avab.
 * Ruumi ei looda; esimese ruumi teeb `ensureRoomForPreInquiry`.
 *
 * @returns {Promise<{ roomId: string, userId: string } | null>}
 */
export async function joinPreInquiryRoomWithin(tx, { inquiryId, userId }) {
  const memberId = String(userId || "").trim();
  if (!memberId) return null;
  const room = await findPreInquiryCanonicalRoom(inquiryId, { db: tx });
  if (!room) return null;
  await activateRoomMembership(tx, room.id, memberId, { mint: true });
  return { roomId: room.id, userId: memberId };
}

/**
 * Töötaja, kelle töö selle pöördumisega lõppes (üleandmine, sulgemine), lahkub ruumist.
 *
 * Ligipääs vestlusele tuleb töömääramisest. Kui määramine lõpeb ja liikmesus jääks alles,
 * loeks endine vastutaja pöörduja sõnumeid edasi, ka pärast asutusest lahkumist.
 *
 * Pöörduja ise ei lahku kunagi, ka siis, kui ta on sama asutuse töötaja. Kui pöörduja andis
 * ruumi omaniku rolli töötajale, läheb see lahkumisel pöördujale tagasi: ruumil peab olema
 * aktiivne omanik (SOL-ROOM-04, vt `ownership.js`).
 *
 * @returns {Promise<{ roomId: string, userId: string } | null>} lõpetatud liikmesus
 */
export async function endPreInquiryRoomMembershipWithin(tx, { inquiryId, userId, now = new Date() }) {
  const memberId = String(userId || "").trim();
  const originId = String(inquiryId || "").trim();
  if (!memberId || !originId) return null;
  const found = await findPreInquiryCanonicalRoom(originId, { db: tx });
  if (!found) return null;
  const inquiry = await tx.preInquiry.findUnique({ where: { id: originId }, select: { authorId: true } });
  const authorId = String(inquiry?.authorId || "").trim();
  if (authorId === memberId) return null;

  if (typeof tx.$executeRaw === "function") await lockRoom(tx, found.id);
  const membership = await tx.roomMember.findFirst({
    where: { roomId: found.id, userId: memberId, leftAt: null },
    select: { id: true, role: true }
  });
  if (!membership) return null;

  if (String(membership.role || "").toUpperCase() === "OWNER") {
    if (!authorId) return null;
    await tx.room.update({ where: { id: found.id }, data: { ownerId: authorId } });
    const restored = await tx.roomMember.updateMany({
      where: { roomId: found.id, userId: authorId },
      data: { role: "OWNER", leftAt: null }
    });
    if (restored.count < 1) {
      await tx.roomMember.create({
        data: { roomId: found.id, userId: authorId, role: "OWNER", billingSource: "SELF" }
      });
    }
  }
  await tx.roomMember.update({ where: { id: membership.id }, data: { leftAt: now, role: "MEMBER" } });
  return { roomId: found.id, userId: memberId };
}

/**
 * ASUTUS LÕPETAS TÖÖ: pöördumise ruum jääb ainult loetavaks (omaniku otsus 11.10.2026).
 *
 * Enne seda sammu lahkus sulgemisel ruumist ainult vastutaja. Ruum jäi pöördujale lahti ja ta
 * sai sinna edasi kirjutada, aga asutuse poolel ei lugenud seda enam keegi.
 *
 * Ruum arhiveeritakse SAMA märkega, mida kasutab omaniku arhiveerimine
 * (`markRoomArchivedWithin`): ajalugu jääb loetavaks, kirjutusele vastab ligipääsuvärav 409-ga.
 * See kehtib kõigile liikmetele, ka pöörduja kutsutud kolmandale inimesele: ruum oli vestlus
 * asutusega ja see vestlus on läbi. Liikmesus jääb neile alles, et ajalugu oleks loetav.
 *
 * Tehakse töö sulgemisega SAMAS tehingus, postkastikirje rea luku all (kutsuja võtab selle).
 * Nii ei ole hetke, kus töö on suletud, aga ruumi saab veel kirjutada, ja ruumi avamine
 * (`ensureRoomForPreInquiry`, sama rea lukk) ei saa sulgemise kõrvalt uut ruumi teha.
 *
 * Järjekord:
 *   1. kokkuvõtete üleandmine, kuni vastutaja on veel liige (sama reegel mis omaniku
 *      arhiveerimisel: ruumi lõpus saab iga liige oma koopia). Ainult andmebaasi kirjutused;
 *   2. vastutaja liikmesus lõpeb;
 *   3. arhiivimärge ja auditirida.
 * Käimasoleva kõne lõpetab kutsuja PÄRAST tehingut: see kutsub välist teenust.
 *
 * Suletud tööd uuesti ei avata (`CLOSED` ja `REJECTED` on seisumasina lõppseisud). Kui
 * pöörduja vajab veel abi, saadab ta uue pöördumise: see on uus kirje laual ja uus ruum.
 *
 * @returns {Promise<{ roomId: string, archived: boolean, left: { roomId: string, userId: string } | null } | null>}
 *          `null`, kui pöördumisel ei ole ruumi
 */
export async function closePreInquiryRoomWithin(
  tx,
  { inquiryId, workerUserId = null, actorUserId = null, now = new Date() }
) {
  const originId = String(inquiryId || "").trim();
  if (!originId) return null;
  const room = await tx.room.findFirst({
    where: { originType: { in: PRE_INQUIRY_ROOM_ORIGIN_TYPES }, originId },
    select: { id: true, title: true, originType: true }
  });
  if (!room) return null;

  if (typeof tx.$executeRaw === "function") await lockRoom(tx, room.id);
  await copyRoomSummariesToParticipants({ db: tx, roomId: room.id, now });
  const left = workerUserId
    ? await endPreInquiryRoomMembershipWithin(tx, { inquiryId: originId, userId: workerUserId, now })
    : null;
  const archived = await markRoomArchivedWithin(tx, {
    room,
    actorUserId,
    now,
    reason: ROOM_ARCHIVE_REASONS.ORG_WORK_CLOSED
  });
  return { roomId: room.id, archived, left };
}

/** Miks ruumi saab ainult lugeda. Läheb vestlusaknale (`GET /api/rooms/<roomId>/messages`). */
export const ROOM_READ_ONLY_REASONS = Object.freeze({
  /** Omanik arhiveeris ruumi või ruumi alus lõppes muul põhjusel. */
  ARCHIVED: "ARCHIVED",
  /** Asutus lõpetas vastuvõtulaual töö, millest see ruum sündis. */
  ORG_WORK_CLOSED: "ORG_WORK_CLOSED"
});

/**
 * Kas ruumi saab ainult lugeda ja miks? Kirjutatav ruum annab `null`.
 *
 * „Asutus lõpetas töö" loetakse postkastikirje seisust, mitte ruumi küljest: suletud töö ei
 * avane enam, seega teist koopiat samast faktist ei ole vaja hoida. Lisapäring tehakse ainult
 * arhiveeritud pöördumise ruumi kohta.
 *
 * @param room `{ archivedAt, originType, originId }`
 * @returns {Promise<string|null>} üks `ROOM_READ_ONLY_REASONS` väärtustest või `null`
 */
export async function readRoomReadOnlyReason(room, { db = prisma } = {}) {
  if (!room?.archivedAt) return null;
  const originId = String(room.originId || "").trim();
  if (!originId || !PRE_INQUIRY_ROOM_ORIGIN_TYPES.includes(room.originType)) return ROOM_READ_ONLY_REASONS.ARCHIVED;
  const closed = await db.organizationInboxItem.findFirst({
    where: {
      sourceType: OrganizationInboxSourceType.PRE_INQUIRY,
      sourceId: originId,
      status: { in: [OrganizationInboxStatus.CLOSED, OrganizationInboxStatus.REJECTED] }
    },
    select: { id: true }
  });
  return closed ? ROOM_READ_ONLY_REASONS.ORG_WORK_CLOSED : ROOM_READ_ONLY_REASONS.ARCHIVED;
}
