import { prisma } from "@/lib/prisma";

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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
      isInternal &&
      inquiry.status === "SENT" &&
      inquiry.sentAt &&
      !inquiry.openedAt &&
      !inquiry.recalledAt &&
      !hasCurrentReplacement &&
      !hasCanonicalRoom
    ),
    canCorrect: Boolean(
      isInternal &&
      inquiry.openedAt &&
      !inquiry.recalledAt &&
      !hasCurrentReplacement
    )
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

function serializeHelpListing(listing, kind) {
  return {
    id: listing.id,
    kind,
    title: listing.title || listing.structuredSummary || "",
    status: listing.status,
    publishedAt: iso(listing.userConfirmedAt),
    expiresAt: iso(listing.expiresAt),
    createdAt: iso(listing.createdAt)
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
    canRecall: Boolean(note.sharedAt && !note.recalledAt && !note.openedByOtherAt)
  };
}

function serializeFrameworkAcceptance(acceptance) {
  return {
    id: acceptance.id,
    frameworkKey: acceptance.frameworkKey,
    frameworkVersion: acceptance.frameworkVersion,
    acceptanceType: acceptance.acceptanceType,
    acceptedAt: iso(acceptance.acceptedAt)
  };
}

/**
 * COLLAB-P4: võrgustikujagamine, mille kohta OOTAB otsust see inimene ise.
 *
 * Suund on siin teistpidi kui ülejäänud „Minu jagamistel": need ei ole asjad,
 * mida inimene on jaganud, vaid ettepanek jagada tema KOHTA. Ühendav mõiste ei
 * ole suund, vaid „kus mu info liigub" — ja selle jaoks peab jääma üks koht.
 *
 * `direction` on siin selleks, et kuvakiht saaks suunad pealkirjaga eristada,
 * ilma et keegi peaks neid tüübi järgi ära arvama.
 */
function serializeNetworkShare(share) {
  const awaitingDecision = share.status === "AWAITING_CLIENT";
  return {
    id: share.id,
    direction: "INCOMING_REQUEST",
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
    roomId: share.roomId || null
  };
}

export async function loadMySharings(userId, { db = prisma, now = new Date() } = {}) {
  const ownerId = String(userId || "").trim();
  if (!ownerId) {
    const error = new Error("api.common.unauthorized");
    error.status = 401;
    throw error;
  }

  const [
    preInquiries, memberships, invites, helpRequests, helpOffers, frameworkAcceptances,
    mentoringPreparations, networkShares
  ] = await Promise.all([
      db.preInquiry.findMany({
        where: {
          authorId: ownerId,
          OR: [
            { sentAt: { not: null } },
            { status: "SENT" }
          ]
        },
        orderBy: [{ sentAt: "desc" }, { updatedAt: "desc" }],
        take: 250,
        select: {
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
        }
      }),
      db.roomMember.findMany({
        where: { userId: ownerId, leftAt: null },
        orderBy: { joinedAt: "desc" },
        take: 250,
        select: {
          role: true,
          joinedAt: true,
          room: {
            select: {
              id: true,
              title: true,
              ownerId: true,
              originType: true,
              originId: true
            }
          }
        }
      }),
      db.invite.findMany({
        where: {
          inviterId: ownerId,
          status: { in: ["PENDING_PAYMENT", "SENT"] },
          expiresAt: { gt: now }
        },
        orderBy: { createdAt: "desc" },
        take: 250,
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
      db.helpRequest.findMany({
        where: {
          userId: ownerId,
          userConfirmedAt: { not: null },
          status: { in: ["OPEN", "MATCHED"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: {
          id: true,
          title: true,
          structuredSummary: true,
          status: true,
          userConfirmedAt: true,
          expiresAt: true,
          createdAt: true
        }
      }),
      db.helpOffer.findMany({
        where: {
          userId: ownerId,
          userConfirmedAt: { not: null },
          status: { in: ["OPEN", "MATCHED"] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: {
          id: true,
          title: true,
          structuredSummary: true,
          status: true,
          userConfirmedAt: true,
          expiresAt: true,
          createdAt: true
        }
      }),
      db.frameworkAcceptance.findMany({
        where: { userId: ownerId },
        orderBy: { acceptedAt: "desc" },
        take: 20,
        select: {
          id: true,
          frameworkKey: true,
          frameworkVersion: true,
          acceptanceType: true,
          acceptedAt: true
        }
      }),
      db.mentoringPrivateNote.findMany({
        where: { ownerId, kind: "PREPARATION" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          relationId: true,
          sharedAt: true,
          openedByOtherAt: true,
          recalledAt: true,
          createdAt: true
        }
      }),
      // COLLAB-P4. Mustandit siia EI tooda: kuni töötaja ei ole jagamist
      // kliendile esitanud, ei ole kliendil millegi kohta otsustada ja pooleli
      // olev tekst ei ole tema info liikumine.
      db.networkShare.findMany({
        where: {
          clientUserId: ownerId,
          status: { in: ["AWAITING_CLIENT", "CONFIRMED", "DECLINED", "SENT", "OPENED", "RESPONDED", "RECALLED", "ENDED"] }
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 100,
        select: {
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
          roomId: true
        }
      })
    ]);

  const membershipRoleByRoomId = new Map(
    memberships.map((membership) => [membership.room.id, membership.role])
  );
  const canonicalRoomIds = new Set(
    memberships
      .filter((membership) =>
        ["PRE_INQUIRY", "SERVICE_PROVIDER_INQUIRY"].includes(membership.room.originType) &&
        membership.room.originId
      )
      .map((membership) => membership.room.originId)
  );
  const serializedInvites = invites.map((invite) => serializeInvite({
    ...invite,
    canRevoke:
      invite.room?.ownerId === ownerId ||
      ["OWNER", "MODERATOR"].includes(membershipRoleByRoomId.get(invite.roomId))
  }));

  return {
    preInquiries: preInquiries.map((inquiry) => serializeSentPreInquiry(inquiry, canonicalRoomIds)),
    rooms: memberships.map(serializeMembership),
    invites: serializedInvites,
    helpListings: [
      ...helpRequests.map((item) => serializeHelpListing(item, "request")),
      ...helpOffers.map((item) => serializeHelpListing(item, "offer"))
    ].sort((a, b) => String(b.publishedAt || b.createdAt).localeCompare(String(a.publishedAt || a.createdAt))),
    frameworkAcceptances: frameworkAcceptances.map(serializeFrameworkAcceptance),
    mentoringPreparations: mentoringPreparations.map(serializeMentoringPreparation),
    // Otsust ootavad kõige ees — need on ainsad read siin, mis nõuavad inimeselt
    // tegutsemist, ja nad ei tohi ülejäänud ajaloo sisse ära kaduda.
    networkShares: networkShares
      .map(serializeNetworkShare)
      .sort((a, b) => Number(b.awaitingDecision) - Number(a.awaitingDecision))
  };
}
