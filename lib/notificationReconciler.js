import prisma from "@/lib/prisma";
import { createNotificationEvent, NOTIFICATION_EVENT_TYPES } from "@/lib/notifications";
import {
  PROVIDER_RECIPIENT_SELECT,
  resolveProviderRecipientUserId
} from "@/lib/org/profileRecipient";

const DAY_MS = 24 * 60 * 60 * 1000;

function tallinnDate(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tallinn", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function roomWindow(now) {
  const size = 6 * 60 * 60 * 1000;
  return new Date(Math.floor(now.getTime() / size) * size).toISOString();
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function cursorWhere(cursors, key) {
  return cursors?.[key] ? { id: { gt: String(cursors[key]) } } : {};
}

export async function reconcileNotificationEvents({
  db = prisma, now = new Date(), batchSize = 50, dryRun = false,
  practiceOverdueDays = 7, availabilityFreshDays = 28, cursor = null
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || 50, 100));
  const today = tallinnDate(now);
  const roomSince = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const practiceCutoff = new Date(now.getTime() - Math.max(1, practiceOverdueDays) * DAY_MS);
  const availabilityCutoff = new Date(now.getTime() - Math.max(1, availabilityFreshDays) * DAY_MS);
  const counters = { considered: 0, created: 0, existing: 0, skipped: 0 };
  const cursors = decodeCursor(cursor);
  const page = (key, callback) => cursors?.[key] === null ? Promise.resolve([]) : callback();

  const emit = async (input) => {
    counters.considered += 1;
    if (dryRun) return;
    const result = await createNotificationEvent(input, { db, now });
    counters[result.created ? "created" : "existing"] += 1;
  };

  const [inquiries, dueInquiries, invites, roomMessages, matches, assignments, services] = await Promise.all([
    page("inquiries", () => db.preInquiry.findMany({
      where: { recipientOwnerId: { not: null }, sentAt: { not: null }, recalledAt: null, ...cursorWhere(cursors, "inquiries") },
      select: { id: true, authorId: true, recipientOwnerId: true, status: true, sentAt: true, openedAt: true, updatedAt: true },
      orderBy: { id: "asc" }, take
    })),
    page("due", () => db.preInquiry.findMany({
      where: { recipientOwnerId: { not: null }, recalledAt: null, nextContactOn: { lte: today }, status: { in: ["SENT", "READY"] }, ...cursorWhere(cursors, "due") },
      select: { id: true, recipientOwnerId: true, nextContactOn: true },
      orderBy: { id: "asc" }, take
    })),
    page("invites", () => db.invite.findMany({
      where: { status: "SENT", expiresAt: { gt: now }, ...cursorWhere(cursors, "invites") },
      select: { id: true, roomId: true, inviteeEmail: true, expiresAt: true },
      orderBy: { id: "asc" }, take
    })),
    page("rooms", () => db.roomMessage.findMany({
      where: { createdAt: { gt: roomSince }, deletedAt: null, ...cursorWhere(cursors, "rooms") },
      select: { id: true, roomId: true, authorId: true }, orderBy: { id: "asc" }, take
    })),
    page("matches", () => db.helpMatch.findMany({
      where: { roomId: { not: null }, ...cursorWhere(cursors, "matches") },
      select: { id: true, roomId: true, requesterId: true, offererId: true }, orderBy: { id: "asc" }, take
    })),
    page("assignments", () => db.effectivePracticeReviewAssignment.findMany({
      where: { reviewerId: { not: null }, status: "ASSIGNED", completedAt: null, ...cursorWhere(cursors, "assignments") },
      select: { id: true, practiceId: true, reviewerId: true, assignedAt: true },
      orderBy: { id: "asc" }, take
    })),
    page("services", () => db.serviceProviderService.findMany({
      where: { status: "PUBLISHED", OR: [{ availabilityCheckedAt: null }, { availabilityCheckedAt: { lt: availabilityCutoff } }], ...cursorWhere(cursors, "services") },
      select: { id: true, providerProfileId: true, availabilityCheckedAt: true, providerProfile: { select: PROVIDER_RECIPIENT_SELECT } },
      orderBy: { id: "asc" }, take
    }))
  ]);

  for (const inquiry of inquiries) {
    await emit({
      userId: inquiry.recipientOwnerId, type: NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_ARRIVED,
      sourceId: inquiry.id, targetId: inquiry.id,
      dedupeSuffix: `sent:${inquiry.sentAt.toISOString()}`, emailPolicy: "NONE"
    });
    if (inquiry.openedAt && ["READY", "ARCHIVED"].includes(inquiry.status)) {
      await emit({
        userId: inquiry.authorId, type: NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_STATUS_CHANGED,
        sourceId: inquiry.id, targetId: inquiry.id,
        dedupeSuffix: `${inquiry.status}:${inquiry.updatedAt.toISOString()}`, emailPolicy: "OPTIONAL"
      });
    }
  }
  for (const inquiry of dueInquiries) {
    await emit({
      userId: inquiry.recipientOwnerId, type: NOTIFICATION_EVENT_TYPES.NEXT_CONTACT_DUE,
      sourceId: inquiry.id, targetId: inquiry.id,
      dedupeSuffix: inquiry.nextContactOn, emailPolicy: "OPTIONAL"
    });
  }
  for (const invite of invites) {
    const user = await db.user.findUnique({ where: { email: invite.inviteeEmail }, select: { id: true } });
    if (!user) { counters.skipped += 1; continue; }
    await emit({
      userId: user.id, type: NOTIFICATION_EVENT_TYPES.ROOM_INVITE,
      sourceId: invite.id, targetId: invite.roomId, dedupeSuffix: "sent", emailPolicy: "NONE",
      expiresAt: invite.expiresAt
    });
  }

  const activeRooms = new Map();
  for (const message of roomMessages) {
    if (!activeRooms.has(message.roomId)) activeRooms.set(message.roomId, new Set());
    activeRooms.get(message.roomId).add(message.authorId);
  }
  for (const [roomId, authors] of activeRooms) {
    const members = await db.roomMember.findMany({
      where: { roomId, leftAt: null, userId: { notIn: [...authors] } }, select: { userId: true }
    });
    for (const member of members) {
      await emit({
        userId: member.userId, type: NOTIFICATION_EVENT_TYPES.ROOM_ACTIVITY,
        sourceId: roomId, targetId: roomId, dedupeSuffix: roomWindow(now), emailPolicy: "OPTIONAL"
      });
    }
  }
  for (const match of matches) {
    for (const userId of new Set([match.requesterId, match.offererId])) {
      await emit({
        userId, type: NOTIFICATION_EVENT_TYPES.HELP_MATCH_CREATED,
        sourceId: match.id, targetId: match.roomId, dedupeSuffix: "matched", emailPolicy: "NONE"
      });
    }
  }
  for (const assignment of assignments) {
    const overdue = assignment.assignedAt < practiceCutoff;
    await emit({
      userId: assignment.reviewerId,
      type: overdue ? NOTIFICATION_EVENT_TYPES.PRACTICE_REVIEW_OVERDUE : NOTIFICATION_EVENT_TYPES.PRACTICE_REVIEW_ASSIGNED,
      sourceId: assignment.id, targetId: assignment.practiceId,
      dedupeSuffix: overdue ? `overdue:${practiceOverdueDays}` : "assigned", emailPolicy: "OPTIONAL"
    });
  }
  for (const service of services) {
    /* ORGANIZATION-profiilil ei ole isiklikku adressaati: `ownerId` on seal
       ainult päritolu. Vananenud kättesaadavuse teavitus jäetakse vahele, mitte
       ei saadeta profiili endisele loojale (vt lib/org/profileRecipient.js).
       Organisatsiooni oma rütm on eraldi teema — parem vaikus kui vale postkast. */
    const recipientUserId = resolveProviderRecipientUserId(service.providerProfile);
    if (!recipientUserId) { counters.skipped += 1; continue; }
    const period = service.availabilityCheckedAt?.toISOString() || "never";
    await emit({
      userId: recipientUserId, type: NOTIFICATION_EVENT_TYPES.SERVICE_AVAILABILITY_STALE,
      sourceId: service.id, targetId: service.providerProfileId,
      dedupeSuffix: `stale:${period}`, emailPolicy: "NONE"
    });
  }
  const next = {
    inquiries: inquiries.length === take ? inquiries.at(-1).id : null,
    due: dueInquiries.length === take ? dueInquiries.at(-1).id : null,
    invites: invites.length === take ? invites.at(-1).id : null,
    rooms: roomMessages.length === take ? roomMessages.at(-1).id : null,
    matches: matches.length === take ? matches.at(-1).id : null,
    assignments: assignments.length === take ? assignments.at(-1).id : null,
    services: services.length === take ? services.at(-1).id : null
  };
  return {
    dryRun,
    ...counters,
    nextCursor: Object.values(next).some(Boolean) ? encodeCursor(next) : null
  };
}

export const notificationReconcilerInternals = Object.freeze({ tallinnDate, roomWindow, decodeCursor, encodeCursor });
