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

/**
 * Idempotently returns the shared room for a pre-inquiry, de-duplicated by the
 * structured (originType, originId) origin rather than the old description text
 * marker. Backward compatible: existing pre-inquiry rooms already carry
 * originId = inquiry.id, so no backfill is needed.
 *
 * This is APP-LEVEL de-duplication, not an absolute guarantee: concurrent opens
 * for the same pre-inquiry are serialised with a transaction-scoped Postgres
 * advisory lock keyed on the inquiry id. A partial UNIQUE index on
 * (originType, originId) is a deferred hardening step, to be added after
 * existing duplicate origin rooms have been audited.
 *
 * @returns {Promise<{ room: { id: string, title: string|null }, created: boolean }>}
 */
export async function ensureRoomForPreInquiry({ userId, inquiry, participantIds = [] }, { db = prisma } = {}) {
  const originId = String(inquiry?.id || "").trim();
  const originType = preInquiryRoomOriginType(inquiry);
  const uniqueParticipantIds = [
    ...new Set(participantIds.map((value) => String(value || "")).filter(Boolean))
  ];

  return db.$transaction(async (tx) => {
    // Serialise concurrent "open room" clicks for the same pre-inquiry so the
    // find-then-create below cannot race into two rooms.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`preInquiryRoom:${originId}`}))`;

    const existing = await tx.room.findFirst({
      where: {
        originType: { in: PRE_INQUIRY_ROOM_ORIGIN_TYPES },
        originId,
        members: {
          some: {
            userId,
            leftAt: null
          }
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    if (existing) {
      return { room: existing, created: false };
    }

    const room = await tx.room.create({
      data: {
        ownerId: userId,
        title: buildPreInquiryRoomTitle(inquiry),
        description: `preInquiry:${originId}\nSotsiaalAI eelpoordumise vestlusruum.`,
        ...buildRoomOrigin({
          originType,
          originId,
          originMeta: {
            recipientType: inquiry?.recipientType || "",
            selectedRecipientName: inquiry?.selectedRecipientName || ""
          }
        }),
        members: {
          create: uniqueParticipantIds.map((memberId) => ({
            userId: memberId,
            role: memberId === userId ? "OWNER" : "MEMBER",
            billingSource: "SELF"
          }))
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    return { room, created: true };
  });
}
