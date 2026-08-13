import { prisma } from "@/lib/prisma";
import { classifyHelpMapVisibility } from "@/lib/help/mapEntries";
import {
  SHARING_EXPORT_TYPES,
  SHARING_SECTION_KEYS,
  sharingType
} from "@/lib/sharings/registry";
import {
  decodePreInquiryCursor,
  encodePreInquiryCursor,
  preInquiryCursorWhere
} from "@/lib/preInquiryPagination";

export const SHARING_SECTION_STATUS = Object.freeze({
  READY: "READY",
  EMPTY: "EMPTY",
  UNAVAILABLE: "UNAVAILABLE",
  TIMEOUT: "TIMEOUT"
});

export const MY_SHARINGS_SECTION_DEADLINE_MS = 8_000;

const SECURITY_ERROR_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "AUTH_REQUIRED",
  "ACCESS_DENIED",
  "api.common.unauthorized",
  "api.common.forbidden"
]);

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function personLabel(person) {
  const firstName = String(person?.profile?.firstName || "").trim();
  const lastName = String(person?.profile?.lastName || "").trim();
  return [firstName, lastName].filter(Boolean).join(" ") || String(person?.email || "").trim();
}

function recipientLabel(inquiry) {
  return String(
    inquiry?.selectedRecipientName ||
    inquiry?.recipientEntry?.title ||
    inquiry?.recipientOwner?.email ||
    inquiry?.selectedRecipientEmail ||
    ""
  ).trim();
}

function paging(rows, limit) {
  const list = Array.isArray(rows) ? rows : [];
  const hasMore = list.length > limit;
  return {
    items: hasMore ? list.slice(0, limit) : list,
    paging: { limit, hasMore, complete: !hasMore }
  };
}

function ready(items, page = { limit: null, hasMore: false, complete: true }) {
  const list = Array.isArray(items) ? items : [];
  return {
    items: list,
    status: list.length ? SHARING_SECTION_STATUS.READY : SHARING_SECTION_STATUS.EMPTY,
    errorCode: null,
    paging: page
  };
}

function unavailable(status, errorCode) {
  return {
    items: [],
    status,
    errorCode,
    paging: { limit: null, hasMore: false, complete: false }
  };
}

function errorStatus(error) {
  const value = Number(error?.status || error?.statusCode || 0);
  return Number.isFinite(value) ? value : 0;
}

function errorCode(error) {
  return String(error?.code || error?.messageKey || error?.message || "").trim();
}

function isSecurityError(error) {
  const status = errorStatus(error);
  const code = errorCode(error);
  return status === 401 || status === 403 || SECURITY_ERROR_CODES.has(code);
}

function isMissingSchema(error) {
  return ["P2021", "P2022"].includes(String(error?.code || "").trim());
}

async function loadSectionSafely(key, load, deadlineMs) {
  let timer = null;
  const task = Promise.resolve()
    .then(load)
    .then((value) => ({ ok: true, value }))
    .catch((error) => ({ ok: false, error }));
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timeout: true }), deadlineMs);
  });

  try {
    const result = await Promise.race([task, timeout]);
    if (result?.timeout) {
      console.warn("[my-sharings] section timeout", { section: key, code: "SOURCE_TIMEOUT" });
      return unavailable(SHARING_SECTION_STATUS.TIMEOUT, "SOURCE_TIMEOUT");
    }
    if (result.ok) return result.value;
    if (isSecurityError(result.error)) throw result.error;
    if (isMissingSchema(result.error)) {
      const code = String(result.error.code);
      console.error("[my-sharings] section schema unavailable", { section: key, code });
      return unavailable(SHARING_SECTION_STATUS.UNAVAILABLE, code);
    }
    console.error("[my-sharings] section failed", {
      section: key,
      error: result.error?.name || "Error",
      code: result.error?.code || result.error?.messageKey || null
    });
    return unavailable(SHARING_SECTION_STATUS.UNAVAILABLE, "SOURCE_ERROR");
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function serializeSentPreInquiry(inquiry, canonicalRoomIds) {
  const isInternal = inquiry.deliveryChannel === "INTERNAL";
  const hasCurrentReplacement = Boolean(inquiry.supersededById);
  const hasCanonicalRoom = canonicalRoomIds.has(inquiry.id);
  return {
    id: inquiry.id,
    topic: inquiry.topic || "",
    situation: inquiry.situation || "",
    sharedText: inquiry.userEditedDraft || inquiry.generatedDraft || inquiry.situation || "",
    recipientLabel: recipientLabel(inquiry),
    deliveryChannel: inquiry.deliveryChannel,
    status: inquiry.status,
    sentAt: iso(inquiry.sentAt),
    openedAt: iso(inquiry.openedAt),
    recalledAt: iso(inquiry.recalledAt),
    supersededById: inquiry.supersededById || null,
    supersedesId: inquiry.supersedes?.id || null,
    updatedAt: iso(inquiry.updatedAt),
    canRecall: Boolean(
      isInternal && inquiry.status === "SENT" && inquiry.sentAt && !inquiry.openedAt &&
      !inquiry.recalledAt && !hasCurrentReplacement && !hasCanonicalRoom
    ),
    canCorrect: Boolean(isInternal && inquiry.openedAt && !inquiry.recalledAt && !hasCurrentReplacement)
  };
}

function serializeMembership(membership) {
  return {
    id: membership.room.id,
    title: membership.room.title || "",
    role: membership.role,
    joinedAt: iso(membership.joinedAt),
    canLeave: membership.role !== "OWNER"
  };
}

function serializeRoomSummary(summary) {
  return {
    id: summary.id,
    roomId: summary.roomId,
    roomTitle: summary.room?.title || "",
    title: summary.title || "",
    status: "SHARED",
    sharedAt: iso(summary.sharedAt)
  };
}

function serializeInvite(invite) {
  return {
    id: invite.id,
    roomId: invite.roomId,
    roomTitle: invite.room?.title || "",
    inviteeEmail: invite.inviteeEmail,
    status: invite.status,
    createdAt: iso(invite.createdAt),
    expiresAt: iso(invite.expiresAt),
    canRevoke: Boolean(invite.canRevoke)
  };
}

function serializeHelpListing(listing, kind, now) {
  return {
    id: listing.id,
    kind,
    title: listing.title || listing.structuredSummary || "",
    status: listing.status,
    publishedAt: iso(listing.userConfirmedAt),
    expiresAt: iso(listing.expiresAt),
    createdAt: iso(listing.createdAt),
    mapVisibility: classifyHelpMapVisibility({
      listingStatus: listing.status,
      listingExpiresAt: listing.expiresAt,
      mapEntry: listing.mapEntry,
      now
    })
  };
}

function serializeMentoringPreparation(note) {
  return {
    id: note.id,
    relationId: note.relationId || null,
    sharedAt: iso(note.sharedAt),
    openedAt: iso(note.openedByOtherAt),
    recalledAt: iso(note.recalledAt),
    createdAt: iso(note.createdAt),
    canRecall: Boolean(note.relationId && note.sharedAt && !note.recalledAt && !note.openedByOtherAt)
  };
}

function serializePrivateRecord(record) {
  if (record.privateType === "FRAMEWORK_ACCEPTANCE") {
    return {
      id: record.id,
      privateType: record.privateType,
      frameworkKey: record.frameworkKey,
      frameworkVersion: record.frameworkVersion,
      acceptanceType: record.acceptanceType,
      createdAt: iso(record.acceptedAt)
    };
  }
  return {
    id: record.id,
    privateType: record.privateType,
    relationId: record.relationId || null,
    createdAt: iso(record.createdAt)
  };
}

function serializeUrgentRequest(request) {
  const awaitingAnswer = ["SENT", "READ"].includes(request.status);
  return {
    id: request.id,
    direction: "OUTGOING_URGENT",
    status: request.status,
    situationVerbatim: request.situationVerbatim,
    readingTimePromise: request.readingTimePromise,
    awaitingAnswer,
    sentAt: iso(request.sentAt),
    readAt: iso(request.readAt),
    takenAt: iso(request.takenAt),
    declinedAt: iso(request.declinedAt),
    declineReason: request.declineReason || null,
    resolvedAt: iso(request.resolvedAt),
    expiresAt: iso(request.expiresAt),
    recalledAt: iso(request.recalledAt),
    convertedPreInquiryId: request.convertedPreInquiryId || null,
    canRecall: Boolean(request.status === "SENT" && !request.readAt && !request.recalledAt)
  };
}

function serializeNetworkShare(share, direction) {
  const awaitingDecision = share.status === "AWAITING_CLIENT";
  return {
    id: share.id,
    direction,
    summaryText: share.summaryText,
    purpose: share.purpose,
    sharingBoundary: share.sharingBoundary,
    participationEndsOn: iso(share.participationEndsOn),
    status: share.status,
    awaitingDecision,
    confirmedAt: iso(share.clientConfirmedAt),
    declinedAt: iso(share.clientDeclinedAt),
    sentAt: iso(share.sentAt),
    openedAt: iso(share.openedAt),
    recalledAt: iso(share.recalledAt),
    respondedAt: iso(share.respondedAt),
    roomId: share.roomId || null,
    recipientLabel: personLabel(share.recipient)
  };
}

function serializeSupportShare(share) {
  const recipient = share.recipient || {};
  const label = [personLabel(recipient.user), recipient.jobTitle].filter(Boolean).join(" · ");
  return {
    id: share.id,
    status: share.status,
    recipientLabel: label,
    organizationName: share.organization?.displayName || "",
    sentAt: iso(share.sentAt),
    openedAt: iso(share.openedAt),
    recalledAt: iso(share.recalledAt),
    correctedAt: iso(share.correctedAt),
    closedAt: iso(share.closedAt),
    canRecall: Boolean(share.status === "SENT" && !share.openedAt && !share.recalledAt)
  };
}

function serializeServiceReportShare(share) {
  const label = [personLabel(share.recipient?.user), share.recipient?.jobTitle].filter(Boolean).join(" · ");
  return {
    id: share.id,
    month: share.month,
    status: share.status,
    recipientLabel: label,
    sentAt: iso(share.sentAt),
    openedAt: iso(share.openedAt),
    recalledAt: iso(share.recalledAt),
    canRecall: Boolean(share.status === "SENT" && !share.openedAt && !share.recalledAt)
  };
}

const PRE_INQUIRY_SELECT = Object.freeze({
  id: true,
  topic: true,
  situation: true,
  generatedDraft: true,
  userEditedDraft: true,
  selectedRecipientName: true,
  selectedRecipientEmail: true,
  deliveryChannel: true,
  status: true,
  sentAt: true,
  openedAt: true,
  recalledAt: true,
  supersededById: true,
  updatedAt: true,
  recipientEntry: { select: { title: true } },
  recipientOwner: { select: { email: true } },
  supersedes: { select: { id: true } }
});

const NETWORK_SHARE_SELECT = Object.freeze({
  id: true,
  summaryText: true,
  purpose: true,
  sharingBoundary: true,
  participationEndsOn: true,
  status: true,
  clientConfirmedAt: true,
  clientDeclinedAt: true,
  sentAt: true,
  openedAt: true,
  recalledAt: true,
  respondedAt: true,
  roomId: true,
  recipient: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
});

function buildSectionLoaders({ db, ownerId, now, cursors = {} }) {
  const membershipPromise = db.roomMember.findMany({
    where: { userId: ownerId, leftAt: null },
    orderBy: { joinedAt: "desc" },
    take: 251,
    select: {
      role: true,
      joinedAt: true,
      room: { select: { id: true, title: true, ownerId: true, originType: true, originId: true } }
    }
  });

  return {
    preInquiries: async () => {
      const baseWhere = { authorId: ownerId, OR: [{ sentAt: { not: null } }, { status: "SENT" }] };
      const cursorWhere = preInquiryCursorWhere(decodePreInquiryCursor(cursors.preInquiries));
      const where = cursorWhere ? { ...baseWhere, AND: [cursorWhere] } : baseWhere;
      const [rows, total] = await Promise.all([
        db.preInquiry.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 251,
          select: PRE_INQUIRY_SELECT
        }),
        db.preInquiry.count({ where: baseWhere })
      ]);
      const page = paging(rows, 250);
      const memberships = page.items.length ? await db.roomMember.findMany({
        where: {
          userId: ownerId,
          leftAt: null,
          room: {
            originType: { in: ["PRE_INQUIRY", "SERVICE_PROVIDER_INQUIRY"] },
            originId: { in: page.items.map((row) => row.id) }
          }
        },
        select: { room: { select: { originType: true, originId: true } } }
      }) : [];
      const canonicalRoomIds = new Set(
        memberships
          .filter((membership) => ["PRE_INQUIRY", "SERVICE_PROVIDER_INQUIRY"].includes(membership.room.originType) && membership.room.originId)
          .map((membership) => membership.room.originId)
      );
      return ready(page.items.map((row) => serializeSentPreInquiry(row, canonicalRoomIds)), {
        ...page.paging,
        total,
        nextCursor: page.paging.hasMore ? encodePreInquiryCursor(page.items.at(-1)) : null
      });
    },
    rooms: async () => {
      const page = paging(await membershipPromise, 250);
      return ready(page.items.map(serializeMembership), page.paging);
    },
    roomSummaries: async () => {
      const page = paging(await db.roomSharedSummary.findMany({
        where: { sharedByUserId: ownerId },
        orderBy: [{ sharedAt: "desc" }, { id: "desc" }],
        take: 101,
        select: { id: true, roomId: true, title: true, sharedAt: true, room: { select: { title: true } } }
      }), 100);
      return ready(page.items.map(serializeRoomSummary), page.paging);
    },
    invites: async () => {
      const [rows, memberships] = await Promise.all([
        db.invite.findMany({
          where: { inviterId: ownerId, status: { in: ["PENDING_PAYMENT", "SENT"] }, expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
          take: 251,
          select: {
            id: true,
            roomId: true,
            inviteeEmail: true,
            status: true,
            createdAt: true,
            expiresAt: true,
            room: { select: { title: true, ownerId: true } }
          }
        }),
        membershipPromise
      ]);
      const roleByRoom = new Map(memberships.map((membership) => [membership.room.id, membership.role]));
      const page = paging(rows, 250);
      return ready(page.items.map((invite) => serializeInvite({
        ...invite,
        canRevoke: invite.room?.ownerId === ownerId || ["OWNER", "MODERATOR"].includes(roleByRoom.get(invite.roomId))
      })), page.paging);
    },
    helpListings: async () => {
      const where = {
        userId: ownerId,
        userConfirmedAt: { not: null },
        status: { not: "DRAFT" }
      };
      const [requests, offers] = await Promise.all([
        db.helpRequest.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 251,
          select: {
            id: true, title: true, structuredSummary: true, status: true,
            userConfirmedAt: true, expiresAt: true, createdAt: true,
            mapEntry: { select: { mapVisible: true, status: true, expiresAt: true } }
          }
        }),
        db.helpOffer.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 251,
          select: {
            id: true, title: true, structuredSummary: true, status: true,
            userConfirmedAt: true, expiresAt: true, createdAt: true,
            mapEntry: { select: { mapVisible: true, status: true, expiresAt: true } }
          }
        })
      ]);
      const rows = [
        ...requests.map((row) => serializeHelpListing(row, "request", now)),
        ...offers.map((row) => serializeHelpListing(row, "offer", now))
      ].sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt)));
      return ready(rows, {
        limit: 500,
        hasMore: requests.length > 250 || offers.length > 250,
        complete: requests.length <= 250 && offers.length <= 250
      });
    },
    mentoringPreparations: async () => {
      const page = paging(await db.mentoringPrivateNote.findMany({
        where: { ownerId, kind: "PREPARATION", sharedAt: { not: null } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 51,
        select: { id: true, relationId: true, sharedAt: true, openedByOtherAt: true, recalledAt: true, createdAt: true }
      }), 50);
      return ready(page.items.map(serializeMentoringPreparation), page.paging);
    },
    privateRecords: async () => {
      const [acceptances, preparations] = await Promise.all([
        db.frameworkAcceptance.findMany({
          where: { userId: ownerId },
          orderBy: { acceptedAt: "desc" },
          take: 21,
          select: { id: true, frameworkKey: true, frameworkVersion: true, acceptanceType: true, acceptedAt: true }
        }),
        db.mentoringPrivateNote.findMany({
          where: { ownerId, kind: "PREPARATION", sharedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 51,
          select: { id: true, relationId: true, createdAt: true }
        })
      ]);
      const rows = [
        ...acceptances.slice(0, 20).map((row) => serializePrivateRecord({ ...row, privateType: "FRAMEWORK_ACCEPTANCE" })),
        ...preparations.slice(0, 50).map((row) => serializePrivateRecord({ ...row, privateType: "MENTORING_PREPARATION" }))
      ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
      const hasMore = acceptances.length > 20 || preparations.length > 50;
      return ready(rows, { limit: 70, hasMore, complete: !hasMore });
    },
    networkShares: async () => {
      const page = paging(await db.networkShare.findMany({
        where: {
          clientUserId: ownerId,
          status: { in: ["AWAITING_CLIENT", "CONFIRMED", "DECLINED", "SENT", "OPENED", "RESPONDED", "RECALLED", "ENDED"] }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 101,
        select: NETWORK_SHARE_SELECT
      }), 100);
      return ready(page.items
        .map((row) => serializeNetworkShare(row, "INCOMING_REQUEST"))
        .sort((a, b) => Number(b.awaitingDecision) - Number(a.awaitingDecision)), page.paging);
    },
    outgoingNetworkShares: async () => {
      const page = paging(await db.networkShare.findMany({
        where: {
          workerId: ownerId,
          status: { in: ["AWAITING_CLIENT", "CONFIRMED", "DECLINED", "SENT", "OPENED", "RESPONDED", "RECALLED", "ENDED"] }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 101,
        select: NETWORK_SHARE_SELECT
      }), 100);
      return ready(page.items.map((row) => serializeNetworkShare(row, "OUTGOING_NETWORK")), page.paging);
    },
    urgentRequests: async () => {
      const page = paging(await db.urgentRequest.findMany({
        where: { authorId: ownerId },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: 101,
        select: {
          id: true,
          status: true,
          situationVerbatim: true,
          readingTimePromise: true,
          sentAt: true,
          readAt: true,
          takenAt: true,
          declinedAt: true,
          declineReason: true,
          resolvedAt: true,
          expiresAt: true,
          recalledAt: true,
          convertedPreInquiryId: true
        }
      }), 100);
      return ready(page.items
        .map(serializeUrgentRequest)
        .sort((a, b) => Number(b.awaitingAnswer) - Number(a.awaitingAnswer)), page.paging);
    },
    wellbeingSupportShares: async () => {
      const page = paging(await db.wellbeingSupportShare.findMany({
        where: { ownerUserId: ownerId },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: 51,
        select: {
          id: true,
          status: true,
          sentAt: true,
          openedAt: true,
          recalledAt: true,
          correctedAt: true,
          closedAt: true,
          organization: { select: { displayName: true } },
          recipient: {
            select: {
              jobTitle: true,
              user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
            }
          }
        }
      }), 50);
      return ready(page.items.map(serializeSupportShare), page.paging);
    },
    serviceReportShares: async () => {
      const page = paging(await db.serviceReportShare.findMany({
        where: { ownerUserId: ownerId, status: { not: "PREPARING" } },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: 101,
        select: {
          id: true,
          month: true,
          status: true,
          sentAt: true,
          openedAt: true,
          recalledAt: true,
          recipient: {
            select: {
              jobTitle: true,
              user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
            }
          }
        }
      }), 100);
      return ready(page.items.map(serializeServiceReportShare), page.paging);
    }
  };
}

function normalizeRequestedSections(sections) {
  if (sections == null) return SHARING_SECTION_KEYS;
  const requested = Array.isArray(sections) ? sections : [sections];
  const unique = [...new Set(requested.map((value) => String(value || "").trim()).filter(Boolean))];
  if (!unique.length || unique.some((key) => !SHARING_SECTION_KEYS.includes(key))) {
    const error = new Error("my_sharings.errors.invalid_section");
    error.status = 400;
    throw error;
  }
  return unique;
}

export async function loadMySharings(
  userId,
  { db = prisma, now = new Date(), sections = null, cursors = {}, deadlineMs = MY_SHARINGS_SECTION_DEADLINE_MS } = {}
) {
  const ownerId = String(userId || "").trim();
  if (!ownerId) {
    const error = new Error("api.common.unauthorized");
    error.status = 401;
    throw error;
  }

  const requested = normalizeRequestedSections(sections);
  const loaders = buildSectionLoaders({ db, ownerId, now, cursors });
  const values = await Promise.all(requested.map((key) => loadSectionSafely(key, loaders[key], deadlineMs)));
  return Object.fromEntries(requested.map((key, index) => [key, values[index]]));
}

function historyRecord(type, {
  id,
  status,
  recipientKind,
  recipientLabel: label,
  sentAt,
  openedAt,
  recalledAt,
  expiresAt,
  validUntil,
  originType,
  originId
}) {
  const definition = sharingType(type);
  if (!definition) throw new Error(`my_sharings.unknown_type:${type}`);
  return {
    type,
    direction: definition.direction,
    status: status || null,
    recipient: {
      kind: recipientKind || null,
      label: String(label || "").trim() || null
    },
    sentAt: iso(sentAt),
    openedAt: iso(openedAt),
    recalledAt: iso(recalledAt),
    expiresAt: iso(expiresAt),
    validUntil: iso(validUntil),
    origin: {
      type: originType || definition.sourceModel,
      id: String(originId || id || "") || null
    }
  };
}

const EXPORT_PERSON_SELECT = Object.freeze({
  email: true,
  profile: { select: { firstName: true, lastName: true } }
});

const EXPORT_COLLECTORS = Object.freeze({
  PRE_INQUIRY: async ({ db, ownerId }) => (await db.preInquiry.findMany({
    where: { authorId: ownerId, OR: [{ sentAt: { not: null } }, { status: "SENT" }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      selectedRecipientName: true,
      selectedRecipientEmail: true,
      deliveryChannel: true,
      status: true,
      sentAt: true,
      openedAt: true,
      recalledAt: true,
      recipientEntry: { select: { title: true } },
      recipientOwner: { select: { email: true } }
    }
  })).map((row) => historyRecord("PRE_INQUIRY", {
    id: row.id,
    status: row.status,
    recipientKind: row.deliveryChannel === "EXTERNAL_EMAIL" ? "EXTERNAL_EMAIL" : "PLATFORM_RECIPIENT",
    recipientLabel: recipientLabel(row),
    sentAt: row.sentAt,
    openedAt: row.openedAt,
    recalledAt: row.recalledAt
  })),
  ROOM_MEMBERSHIP: async ({ db, ownerId }) => (await db.roomMember.findMany({
    where: { userId: ownerId },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: { id: true, role: true, joinedAt: true, leftAt: true, room: { select: { id: true, title: true } } }
  })).map((row) => historyRecord("ROOM_MEMBERSHIP", {
    id: row.id,
    status: row.leftAt ? "LEFT" : "ACTIVE",
    recipientKind: "ROOM",
    recipientLabel: row.room?.title,
    sentAt: row.joinedAt,
    validUntil: row.leftAt,
    originType: "Room",
    originId: row.room?.id || row.id
  })),
  ROOM_SHARED_SUMMARY: async ({ db, ownerId }) => (await db.roomSharedSummary.findMany({
    where: { sharedByUserId: ownerId },
    orderBy: [{ sharedAt: "asc" }, { id: "asc" }],
    select: { id: true, sharedAt: true, room: { select: { title: true } } }
  })).map((row) => historyRecord("ROOM_SHARED_SUMMARY", {
    id: row.id,
    status: "SHARED",
    recipientKind: "ROOM_MEMBERS",
    recipientLabel: row.room?.title,
    sentAt: row.sharedAt
  })),
  ROOM_INVITE: async ({ db, ownerId }) => (await db.invite.findMany({
    where: { inviterId: ownerId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, inviteeEmail: true, status: true, createdAt: true, expiresAt: true, room: { select: { title: true } } }
  })).map((row) => historyRecord("ROOM_INVITE", {
    id: row.id,
    status: row.status,
    recipientKind: "EMAIL_INVITEE",
    recipientLabel: row.inviteeEmail,
    sentAt: row.createdAt,
    expiresAt: row.expiresAt,
    originType: "RoomInvite",
    originId: row.id
  })),
  HELP_REQUEST: async ({ db, ownerId }) => (await db.helpRequest.findMany({
    where: { userId: ownerId, userConfirmedAt: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, status: true, userConfirmedAt: true, expiresAt: true }
  })).map((row) => historyRecord("HELP_REQUEST", {
    id: row.id,
    status: row.status,
    recipientKind: "PUBLIC_HELP_SURFACE",
    recipientLabel: "public_help_surface",
    sentAt: row.userConfirmedAt,
    expiresAt: row.expiresAt
  })),
  HELP_OFFER: async ({ db, ownerId }) => (await db.helpOffer.findMany({
    where: { userId: ownerId, userConfirmedAt: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, status: true, userConfirmedAt: true, expiresAt: true }
  })).map((row) => historyRecord("HELP_OFFER", {
    id: row.id,
    status: row.status,
    recipientKind: "PUBLIC_HELP_SURFACE",
    recipientLabel: "public_help_surface",
    sentAt: row.userConfirmedAt,
    expiresAt: row.expiresAt
  })),
  MENTORING_PREPARATION: async ({ db, ownerId }) => (await db.mentoringPrivateNote.findMany({
    where: { ownerId, kind: "PREPARATION", sharedAt: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, relationId: true, sharedAt: true, openedByOtherAt: true, recalledAt: true }
  })).map((row) => historyRecord("MENTORING_PREPARATION", {
    id: row.id,
    status: row.recalledAt ? "RECALLED" : row.openedByOtherAt ? "OPENED" : "SHARED",
    recipientKind: "MENTORING_RELATION",
    recipientLabel: row.relationId ? "mentoring_relation" : "recipient_unavailable",
    sentAt: row.sharedAt,
    openedAt: row.openedByOtherAt,
    recalledAt: row.recalledAt
  })),
  NETWORK_SHARE_CLIENT: async ({ db, ownerId }) => (await db.networkShare.findMany({
    where: { clientUserId: ownerId, status: { not: "DRAFT" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      clientConfirmedAt: true,
      sentAt: true,
      openedAt: true,
      recalledAt: true,
      participationEndsOn: true,
      recipient: { select: EXPORT_PERSON_SELECT }
    }
  })).map((row) => historyRecord("NETWORK_SHARE_CLIENT", {
    id: row.id,
    status: row.status,
    recipientKind: "PLATFORM_USER",
    recipientLabel: personLabel(row.recipient),
    sentAt: row.sentAt || row.clientConfirmedAt,
    openedAt: row.openedAt,
    recalledAt: row.recalledAt,
    validUntil: row.participationEndsOn
  })),
  NETWORK_SHARE_WORKER: async ({ db, ownerId }) => (await db.networkShare.findMany({
    where: { workerId: ownerId, status: { not: "DRAFT" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      clientConfirmedAt: true,
      sentAt: true,
      openedAt: true,
      recalledAt: true,
      participationEndsOn: true,
      recipient: { select: EXPORT_PERSON_SELECT }
    }
  })).map((row) => historyRecord("NETWORK_SHARE_WORKER", {
    id: row.id,
    status: row.status,
    recipientKind: "PLATFORM_USER",
    recipientLabel: personLabel(row.recipient),
    sentAt: row.sentAt || row.clientConfirmedAt,
    openedAt: row.openedAt,
    recalledAt: row.recalledAt,
    validUntil: row.participationEndsOn
  })),
  URGENT_REQUEST: async ({ db, ownerId }) => (await db.urgentRequest.findMany({
    where: { authorId: ownerId },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
    select: { id: true, status: true, recipientType: true, municipalityId: true, sentAt: true, readAt: true, recalledAt: true, expiresAt: true }
  })).map((row) => historyRecord("URGENT_REQUEST", {
    id: row.id,
    status: row.status,
    recipientKind: row.recipientType || "URGENT_DESK",
    recipientLabel: row.municipalityId ? "municipality_urgent_desk" : "urgent_desk",
    sentAt: row.sentAt,
    openedAt: row.readAt,
    recalledAt: row.recalledAt,
    expiresAt: row.expiresAt
  })),
  WELLBEING_SUPPORT_SHARE: async ({ db, ownerId }) => (await db.wellbeingSupportShare.findMany({
    where: { ownerUserId: ownerId },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      sentAt: true,
      openedAt: true,
      recalledAt: true,
      closedAt: true,
      organization: { select: { displayName: true } },
      recipient: { select: { jobTitle: true, user: { select: EXPORT_PERSON_SELECT } } }
    }
  })).map((row) => historyRecord("WELLBEING_SUPPORT_SHARE", {
    id: row.id,
    status: row.status,
    recipientKind: "ORGANIZATION_SUPPORT_CONTACT",
    recipientLabel: [personLabel(row.recipient?.user), row.recipient?.jobTitle, row.organization?.displayName].filter(Boolean).join(" · "),
    sentAt: row.sentAt,
    openedAt: row.openedAt,
    recalledAt: row.recalledAt,
    validUntil: row.closedAt
  })),
  SERVICE_REPORT_SHARE: async ({ db, ownerId }) => (await db.serviceReportShare.findMany({
    where: { ownerUserId: ownerId, status: { not: "PREPARING" } },
    orderBy: [{ sentAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      sentAt: true,
      openedAt: true,
      recalledAt: true,
      retentionEndsAt: true,
      recipient: { select: { jobTitle: true, user: { select: EXPORT_PERSON_SELECT } } }
    }
  })).map((row) => historyRecord("SERVICE_REPORT_SHARE", {
    id: row.id,
    status: row.status,
    recipientKind: "ORGANIZATION_REPORT_RECIPIENT",
    recipientLabel: [personLabel(row.recipient?.user), row.recipient?.jobTitle].filter(Boolean).join(" · "),
    sentAt: row.sentAt,
    openedAt: row.openedAt,
    recalledAt: row.recalledAt,
    validUntil: row.retentionEndsAt
  }))
});

export async function collectOwnerSharingHistory(userId, { db = prisma } = {}) {
  const ownerId = String(userId || "").trim();
  if (!ownerId) {
    const error = new Error("api.common.unauthorized");
    error.status = 401;
    throw error;
  }
  const missingCollector = SHARING_EXPORT_TYPES.find((type) => typeof EXPORT_COLLECTORS[type] !== "function");
  if (missingCollector) throw new Error(`my_sharings.export_collector_missing:${missingCollector}`);
  const groups = await Promise.all(
    SHARING_EXPORT_TYPES.map((type) => EXPORT_COLLECTORS[type]({ db, ownerId }))
  );
  return groups.flat().sort((a, b) => {
    const time = String(a.sentAt || a.openedAt || "").localeCompare(String(b.sentAt || b.openedAt || ""));
    return time || String(a.origin?.id || "").localeCompare(String(b.origin?.id || ""));
  });
}

export const mySharingsInternals = Object.freeze({
  isSecurityError,
  loadSectionSafely,
  normalizeRequestedSections,
  EXPORT_COLLECTORS
});
