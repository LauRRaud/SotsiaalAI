import { prisma } from "@/lib/prisma";
import { ROOM_ORIGIN_TYPES, buildRoomOrigin } from "./origin.js";

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

export function buildPreInquiryRoomTitle(inquiry) {
  const topic = String(inquiry?.topic || "").trim();
  if (topic) return `Eelpoordumine: ${topic.slice(0, 72)}`;
  const authorEmail = String(inquiry?.author?.email || "").trim();
  if (authorEmail) return `Eelpoordumine: ${authorEmail}`;
  return "Eelpoordumine";
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

  async function reactivateMembership(client, roomId) {
    const membership = await client.roomMember.findFirst({
      where: { roomId, userId: requesterId },
      select: { id: true, leftAt: true }
    });
    if (!membership) return false;
    if (membership.leftAt) {
      await client.roomMember.update({ where: { id: membership.id }, data: { leftAt: null } });
    }
    return true;
  }

  // Resolve (reactivating an existing membership) or, when allowed, create the
  // canonical room from the AUTHORITATIVE inquiry state read under the lock.
  async function resolveOrCreate(client, { allowCreate }) {
    const fresh = await client.preInquiry.findUnique({
      where: { id: originId },
      select: {
        authorId: true,
        recipientOwnerId: true,
        recipientType: true,
        topic: true,
        selectedRecipientName: true,
        openedAt: true,
        recalledAt: true
      }
    });
    if (!fresh) throw httpError("api.common.not_found", 404);
    if (fresh.recalledAt) throw httpError("api.common.not_found", 404);

    const authorId = String(fresh.authorId || "").trim();
    const recipientOwnerId = String(fresh.recipientOwnerId || "").trim();
    const isParty = Boolean(requesterId) && (requesterId === authorId || requesterId === recipientOwnerId);
    const markRecipientOpened = async () => {
      if (requesterId !== recipientOwnerId || fresh.openedAt) return;
      const result = await client.preInquiry.updateMany({
        where: {
          id: originId,
          recipientOwnerId: requesterId,
          openedAt: null,
          recalledAt: null
        },
        data: { openedAt: new Date() }
      });
      if (result.count !== 1) throw httpError("pre_inquiries.errors.open_conflict", 409);
    };

    const room = await client.room.findFirst({ where: canonicalWhere, select: { id: true, title: true } });
    if (room) {
      const rejoined = await reactivateMembership(client, room.id);
      if (!rejoined) throw httpError("api.common.forbidden", 403);
      await markRecipientOpened();
      return { room, created: false };
    }

    if (!allowCreate) return null;
    if (!isParty) throw httpError("api.common.forbidden", 403);

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
        description: `preInquiry:${originId}\nSotsiaalAI eelpoordumise vestlusruum.`,
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

    await markRecipientOpened();
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
