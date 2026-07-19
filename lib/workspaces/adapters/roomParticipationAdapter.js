import prisma from "@/lib/prisma";

import {
  assertParticipantDescriptor,
  InviteRelationship,
  InviteState,
  MembershipStatus,
  ParticipantRole
} from "../participation.js";
import { WorkspaceKind } from "../registry.js";

/* COLLAB-P0 — read-only osaleja-adapter Room+Invite pealt.
 *
 * Sama juurdepääsureegel mis K1 roomAdapter'il: osalejaid näeb ainult ruumi
 * praegune liige; omanikustaatus üksi EI ole alternatiivne ligipääsutee.
 * Võõras kasutaja saab tühja loendi, mitte vea — loendi kuju ei tohi lekitada
 * ruumi olemasolu. */

/* Sõnastiku täielikkus: iga DB-enumi väärtus kaardistub. Test lukustab need
 * tabelid Prisma skeemi vastu — uus DB-väärtus ilma kaardistuseta on
 * lepinguviga, mitte vaikimisi läbi kukkuv rida. */
export const ROOM_ROLE_TO_CONTRACT = Object.freeze({
  OWNER: ParticipantRole.OWNER,
  MODERATOR: ParticipantRole.MODERATOR,
  MEMBER: ParticipantRole.MEMBER
});

export const ROOM_INVITE_STATUS_TO_CONTRACT = Object.freeze({
  PENDING_PAYMENT: InviteState.PENDING,
  SENT: InviteState.PENDING,
  ACCEPTED: InviteState.ACCEPTED,
  EXPIRED: InviteState.EXPIRED,
  REVOKED: InviteState.REVOKED
});

export const ROOM_RELATIONSHIP_TO_CONTRACT = Object.freeze({
  COLLEAGUE: InviteRelationship.COLLEAGUE,
  CLIENT: InviteRelationship.CLIENT
});

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function memberDescriptor(roomId, member) {
  return assertParticipantDescriptor({
    workspaceRef: { kind: WorkspaceKind.ROOM, id: roomId },
    userId: normalizeId(member.userId) || null,
    role: ROOM_ROLE_TO_CONTRACT[member.role] || ParticipantRole.MEMBER,
    /* Liikme liitumistee (kutse) ei ole liikmesuse real hoitud — aus null,
     * mitte rekonstrueeritud oletus. */
    invite: null,
    membership: {
      status: member.leftAt ? MembershipStatus.LEFT : MembershipStatus.ACTIVE,
      since: toNullableIso(member.joinedAt),
      leftAt: toNullableIso(member.leftAt)
    },
    scope: { note: null }
  });
}

function inviteDescriptor(roomId, invite) {
  return assertParticipantDescriptor({
    workspaceRef: { kind: WorkspaceKind.ROOM, id: roomId },
    /* Kutse elab e-posti, mitte konto küljes — konto tekib alles liitumisel. */
    userId: null,
    role: ParticipantRole.MEMBER,
    invite: {
      status: ROOM_INVITE_STATUS_TO_CONTRACT[invite.status] || InviteState.PENDING,
      expiresAt: toNullableIso(invite.expiresAt),
      relationship:
        ROOM_RELATIONSHIP_TO_CONTRACT[invite.relationshipType] || InviteRelationship.COLLEAGUE
    },
    membership: {
      status: MembershipStatus.INVITED,
      since: toNullableIso(invite.createdAt),
      leftAt: null
    },
    scope: { note: null }
  });
}

/**
 * Ruumi osalejad vaataja jaoks: praegused ja lahkunud liikmed + ootel kutsed.
 * ACCEPTED kutsed on juba liikmete loendis — neid ei dubleerita; EXPIRED ja
 * REVOKED kutsed ei ole enam osalejad ega kuvata.
 *
 * @returns {Promise<import("../participation.js").ParticipantDescriptor[]>}
 */
export async function listParticipants(userId, roomId, { db = prisma } = {}) {
  const viewerId = normalizeId(userId);
  const id = normalizeId(roomId);
  if (!viewerId || !id) return [];

  const viewerMembership = await db.roomMember.findFirst({
    where: { roomId: id, userId: viewerId, leftAt: null },
    select: { id: true }
  });
  if (!viewerMembership) return [];

  const members = await db.roomMember.findMany({
    where: { roomId: id },
    select: { userId: true, role: true, joinedAt: true, leftAt: true },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    take: 200
  });
  const pendingInvites = await db.invite.findMany({
    where: { roomId: id, status: { in: ["PENDING_PAYMENT", "SENT"] } },
    select: { status: true, relationshipType: true, expiresAt: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200
  });

  return [
    ...(members || []).map((member) => memberDescriptor(id, member)),
    ...(pendingInvites || []).map((invite) => inviteDescriptor(id, invite))
  ];
}

/**
 * Kasutaja enda ruumiosalused (sh lahkutud — elutsükkel on lepingu osa).
 * Võõra kasutaja kohta ei saa küsida: loend on alati küsija enda oma.
 *
 * @returns {Promise<import("../participation.js").ParticipantDescriptor[]>}
 */
export async function listMyMemberships(userId, { db = prisma } = {}) {
  const viewerId = normalizeId(userId);
  if (!viewerId) return [];

  const memberships = await db.roomMember.findMany({
    where: { userId: viewerId },
    select: { roomId: true, userId: true, role: true, joinedAt: true, leftAt: true },
    orderBy: [{ joinedAt: "asc" }, { roomId: "asc" }],
    take: 200
  });

  return (memberships || []).map((member) => memberDescriptor(normalizeId(member.roomId), member));
}
