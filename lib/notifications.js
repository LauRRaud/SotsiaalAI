import crypto from "node:crypto";
import prisma from "@/lib/prisma";

export const NOTIFICATION_EVENT_TYPES = Object.freeze({
  PRE_INQUIRY_ARRIVED: "PRE_INQUIRY_ARRIVED",
  PRE_INQUIRY_STATUS_CHANGED: "PRE_INQUIRY_STATUS_CHANGED",
  ROOM_INVITE: "ROOM_INVITE",
  ROOM_ACTIVITY: "ROOM_ACTIVITY",
  HELP_MATCH_CREATED: "HELP_MATCH_CREATED",
  HELP_MATCH_CONSENT_REQUEST: "HELP_MATCH_CONSENT_REQUEST",
  NEXT_CONTACT_DUE: "NEXT_CONTACT_DUE",
  PRACTICE_REVIEW_ASSIGNED: "PRACTICE_REVIEW_ASSIGNED",
  PRACTICE_REVIEW_OVERDUE: "PRACTICE_REVIEW_OVERDUE",
  SERVICE_AVAILABILITY_STALE: "SERVICE_AVAILABILITY_STALE"
});

const EVENT_SPECS = Object.freeze({
  PRE_INQUIRY_ARRIVED: Object.freeze({
    sourceType: "PRE_INQUIRY",
    targetKind: "PRE_INQUIRY",
    labelKey: "notifications.events.pre_inquiry_arrived",
    badgeKey: "pre_inquiries"
  }),
  PRE_INQUIRY_STATUS_CHANGED: Object.freeze({
    sourceType: "PRE_INQUIRY",
    targetKind: "PRE_INQUIRY",
    labelKey: "notifications.events.pre_inquiry_status_changed",
    badgeKey: "pre_inquiries"
  }),
  ROOM_INVITE: Object.freeze({
    sourceType: "INVITE",
    targetKind: "ROOM",
    labelKey: "notifications.events.room_invite",
    badgeKey: "add_person"
  }),
  ROOM_ACTIVITY: Object.freeze({
    sourceType: "ROOM",
    targetKind: "ROOM",
    labelKey: "notifications.events.room_activity",
    badgeKey: "add_person"
  }),
  HELP_MATCH_CREATED: Object.freeze({
    sourceType: "HELP_MATCH",
    targetKind: "ROOM",
    labelKey: "notifications.events.help_match_created",
    badgeKey: "add_person"
  }),
  HELP_MATCH_CONSENT_REQUEST: Object.freeze({
    sourceType: "HELP_MATCH",
    targetKind: "SERVICE_MAP",
    labelKey: "notifications.events.help_match_consent_request",
    badgeKey: "add_person"
  }),
  NEXT_CONTACT_DUE: Object.freeze({
    sourceType: "PRE_INQUIRY",
    targetKind: "PRE_INQUIRY",
    labelKey: "notifications.events.next_contact_due",
    badgeKey: "pre_inquiries"
  }),
  PRACTICE_REVIEW_ASSIGNED: Object.freeze({
    sourceType: "PRACTICE_ASSIGNMENT",
    targetKind: "PRACTICE",
    labelKey: "notifications.events.practice_review_assigned",
    badgeKey: "effective_practices"
  }),
  PRACTICE_REVIEW_OVERDUE: Object.freeze({
    sourceType: "PRACTICE_ASSIGNMENT",
    targetKind: "PRACTICE",
    labelKey: "notifications.events.practice_review_overdue",
    badgeKey: "effective_practices"
  }),
  SERVICE_AVAILABILITY_STALE: Object.freeze({
    sourceType: "SERVICE",
    targetKind: "SERVICE_PROFILE",
    labelKey: "notifications.events.service_availability_stale",
    badgeKey: "service_profile"
  })
});

const EMAIL_POLICIES = new Set(["NONE", "OPTIONAL", "TRANSACTIONAL"]);
const SOURCE_TYPES = new Set(Object.values(EVENT_SPECS).map((spec) => spec.sourceType));
const SAFE_ID = /^[A-Za-z0-9._:-]+$/u;

function notificationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeId(value, field, { optional = false, maxLength = 240 } = {}) {
  const normalized = String(value || "").trim();
  if (!normalized && optional) return null;
  if (!normalized || normalized.length > maxLength || !SAFE_ID.test(normalized)) {
    throw notificationError(`api.notifications.invalid_${field}`, 400);
  }
  return normalized;
}

function targetHref(targetKind, targetId) {
  const encoded = encodeURIComponent(targetId || "");
  switch (targetKind) {
    case "PRE_INQUIRY":
      return `/eelpoordumised?openInquiry=${encoded}`;
    case "ROOM":
      return `/vestlus?roomId=${encoded}`;
    case "PRACTICE":
      return `/parimad-praktikad?practice=${encoded}`;
    case "SERVICE_PROFILE":
      return `/teenuseprofiil?profileId=${encoded}`;
    case "SERVICE_MAP":
      return `/teenusekaart?match=${encoded}`;
    default:
      throw notificationError("api.notifications.invalid_target", 400);
  }
}

export function notificationSpec(type) {
  return EVENT_SPECS[String(type || "").trim()] || null;
}

async function assertNotificationRecipient(db, { type, userId, sourceId, targetId }) {
  let allowed = false;
  if (type === NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_ARRIVED) {
    allowed = Boolean(await db.preInquiry.findFirst({
      where: { id: sourceId, recipientOwnerId: userId, recalledAt: null }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_STATUS_CHANGED) {
    allowed = Boolean(await db.preInquiry.findFirst({
      where: { id: sourceId, authorId: userId }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.NEXT_CONTACT_DUE) {
    allowed = Boolean(await db.preInquiry.findFirst({
      where: { id: sourceId, recipientOwnerId: userId, recalledAt: null, nextContactOn: { not: null } },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.ROOM_INVITE) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    const invite = user?.email ? await db.invite.findFirst({
      where: { id: sourceId, roomId: targetId, inviteeEmail: user.email, status: "SENT" }, select: { id: true }
    }) : null;
    allowed = Boolean(invite);
  } else if (type === NOTIFICATION_EVENT_TYPES.ROOM_ACTIVITY) {
    allowed = Boolean(await db.roomMember.findFirst({
      where: { roomId: sourceId, userId, leftAt: null }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.HELP_MATCH_CREATED) {
    allowed = Boolean(await db.helpMatch.findFirst({
      where: { id: sourceId, roomId: targetId, OR: [{ requesterId: userId }, { offererId: userId }] },
      select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.HELP_MATCH_CONSENT_REQUEST) {
    allowed = Boolean(await db.helpMatch.findFirst({
      where: {
        id: sourceId,
        status: "PENDING",
        initiatedByUserId: { not: userId },
        OR: [{ requesterId: userId }, { offererId: userId }]
      },
      select: { id: true }
    }));
  } else if (
    type === NOTIFICATION_EVENT_TYPES.PRACTICE_REVIEW_ASSIGNED ||
    type === NOTIFICATION_EVENT_TYPES.PRACTICE_REVIEW_OVERDUE
  ) {
    allowed = Boolean(await db.effectivePracticeReviewAssignment.findFirst({
      where: { id: sourceId, practiceId: targetId, reviewerId: userId }, select: { id: true }
    }));
  } else if (type === NOTIFICATION_EVENT_TYPES.SERVICE_AVAILABILITY_STALE) {
    allowed = Boolean(await db.serviceProviderService.findFirst({
      where: { id: sourceId, providerProfileId: targetId, providerProfile: { ownerId: userId } },
      select: { id: true }
    }));
  }
  if (!allowed) throw notificationError("api.common.not_found", 404);
}

export function serializeNotificationEvent(event) {
  if (!event) return null;
  const spec = notificationSpec(event.type);
  if (!spec || event.targetKind !== spec.targetKind) return null;
  return {
    id: event.id,
    type: event.type,
    href: targetHref(event.targetKind, event.targetId),
    labelKey: spec.labelKey,
    badgeKey: spec.badgeKey,
    createdAt: event.createdAt,
    readAt: event.readAt || null
  };
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

export async function createNotificationEvent(
  input = {},
  { db = prisma, now = new Date(), verifyRecipient = true } = {}
) {
  const type = String(input.type || "").trim();
  const spec = notificationSpec(type);
  if (!spec) throw notificationError("api.notifications.invalid_type", 400);

  const userId = normalizeId(input.userId, "user");
  const sourceType = String(input.sourceType || spec.sourceType).trim();
  if (sourceType !== spec.sourceType) {
    throw notificationError("api.notifications.invalid_source", 400);
  }
  const sourceId = normalizeId(input.sourceId, "source");
  const targetKind = String(input.targetKind || spec.targetKind).trim();
  if (targetKind !== spec.targetKind) {
    throw notificationError("api.notifications.invalid_target", 400);
  }
  const targetId = normalizeId(input.targetId, "target");
  targetHref(targetKind, targetId);
  if (verifyRecipient) {
    await assertNotificationRecipient(db, { type, userId, sourceId, targetId });
  }
  const dedupeSuffix = normalizeId(input.dedupeSuffix || "v1", "dedupe", { maxLength: 160 });
  const dedupeKey = `${type}:${sourceId}:${userId}:${dedupeSuffix}`;
  if (dedupeKey.length > 500) throw notificationError("api.notifications.invalid_dedupe", 400);

  const emailPolicy = String(input.emailPolicy || "NONE").trim().toUpperCase();
  if (!EMAIL_POLICIES.has(emailPolicy)) {
    throw notificationError("api.notifications.invalid_email_policy", 400);
  }
  let emailRequested = emailPolicy === "TRANSACTIONAL";
  if (emailPolicy === "OPTIONAL") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { notificationEmailEnabled: true }
    });
    if (!user) throw notificationError("api.common.not_found", 404);
    emailRequested = user.notificationEmailEnabled === true;
  }

  const data = {
    userId,
    type,
    sourceType,
    sourceId,
    dedupeKey,
    targetKind,
    targetId,
    expiresAt: input.expiresAt || null,
    emailPolicy,
    emailStatus: emailRequested ? "PENDING" : "NOT_REQUESTED",
    emailNextAttemptAt: emailRequested ? now : null,
    emailMessageId: emailRequested
      ? `notification.${crypto.createHash("sha256").update(dedupeKey).digest("hex").slice(0, 40)}@sotsiaal.ai`
      : null
  };

  try {
    const event = await db.notificationEvent.create({ data });
    return { created: true, event };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const event = await db.notificationEvent.findUnique({ where: { dedupeKey } });
    if (!event) throw error;
    return { created: false, event };
  }
}

export async function listNotificationEvents(
  userId,
  { db = prisma, limit = 30, unreadOnly = false, now = new Date() } = {}
) {
  const normalizedUserId = normalizeId(userId, "user");
  const take = Math.max(1, Math.min(Number(limit) || 30, 100));
  const rows = await db.notificationEvent.findMany({
    where: {
      userId: normalizedUserId,
      ...(unreadOnly ? { readAt: null } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(take * 2, 200)
  });
  const visible = [];
  for (const row of rows) {
    try {
      await assertNotificationRecipient(db, {
        type: row.type,
        userId: normalizedUserId,
        sourceId: row.sourceId,
        targetId: row.targetId
      });
      const serialized = serializeNotificationEvent(row);
      if (serialized) visible.push(serialized);
      if (visible.length >= take) break;
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
  return visible;
}

export async function markNotificationRead(userId, eventId, { db = prisma, now = new Date() } = {}) {
  const normalizedUserId = normalizeId(userId, "user");
  const normalizedEventId = normalizeId(eventId, "event");
  const visible = await db.notificationEvent.findFirst({
    where: { id: normalizedEventId, userId: normalizedUserId },
    select: { id: true }
  });
  if (!visible) throw notificationError("api.common.not_found", 404);
  await db.notificationEvent.updateMany({
    where: { id: normalizedEventId, userId: normalizedUserId, readAt: null },
    data: { readAt: now }
  });
  return { ok: true };
}

export async function markNotificationSourceRead(
  userId,
  { sourceType, sourceId },
  { db = prisma, now = new Date() } = {}
) {
  const normalizedUserId = normalizeId(userId, "user");
  const normalizedSourceType = normalizeId(sourceType, "source");
  if (!SOURCE_TYPES.has(normalizedSourceType)) {
    throw notificationError("api.notifications.invalid_source", 400);
  }
  const normalizedSourceId = normalizeId(sourceId, "source");
  const result = await db.notificationEvent.updateMany({
    where: {
      userId: normalizedUserId,
      sourceType: normalizedSourceType,
      sourceId: normalizedSourceId,
      readAt: null
    },
    data: { readAt: now }
  });
  return { updated: result.count };
}

export async function getNotificationPreference(userId, { db = prisma } = {}) {
  const normalizedUserId = normalizeId(userId, "user");
  const user = await db.user.findUnique({
    where: { id: normalizedUserId },
    select: {
      notificationEmailEnabled: true,
      notificationPreferenceVersion: true
    }
  });
  if (!user) throw notificationError("api.common.not_found", 404);
  return {
    emailEnabled: user.notificationEmailEnabled,
    version: user.notificationPreferenceVersion
  };
}

export async function updateNotificationPreference(
  userId,
  { emailEnabled, expectedVersion },
  { db = prisma } = {}
) {
  const normalizedUserId = normalizeId(userId, "user");
  if (typeof emailEnabled !== "boolean" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw notificationError("api.notifications.invalid_preference", 400);
  }
  const result = await db.user.updateMany({
    where: {
      id: normalizedUserId,
      notificationPreferenceVersion: expectedVersion
    },
    data: {
      notificationEmailEnabled: emailEnabled,
      notificationPreferenceVersion: { increment: 1 }
    }
  });
  if (result.count !== 1) throw notificationError("api.notifications.preference_conflict", 409);
  return getNotificationPreference(normalizedUserId, { db });
}

export function notificationBadges(events = []) {
  const counts = new Map();
  for (const event of events) {
    if (!event || event.readAt || !event.badgeKey) continue;
    counts.set(event.badgeKey, (counts.get(event.badgeKey) || 0) + 1);
  }
  return Object.fromEntries([...counts].map(([key, count]) => [key, {
    type: "number",
    value: count,
    label: String(count)
  }]));
}
