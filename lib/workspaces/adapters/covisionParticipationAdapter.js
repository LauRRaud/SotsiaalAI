import prisma from "@/lib/prisma";

import {
  assertParticipantDescriptor,
  InviteRelationship,
  InviteState,
  MembershipStatus,
  ParticipantRole
} from "../participation.js";
import { WorkspaceKind } from "../registry.js";

/* COLLAB-P0 — read-only osaleja-adapter CovisionParticipant pealt.
 *
 * Kovisioon on metoodiliselt kaitstud konteiner (perekond B): adapter kaardistab
 * AINULT osaleja-elutsükli ühissõnastikku ega ava juhtumi sisu. Osalejaid näeb
 * juhtumi omanik või osaleja ise; võõras saab tühja loendi. */

export const COVISION_ROLE_TO_CONTRACT = Object.freeze({
  OWNER: ParticipantRole.OWNER,
  PARTICIPANT: ParticipantRole.MEMBER,
  OBSERVER: ParticipantRole.OBSERVER,
  CO_MODERATOR: ParticipantRole.MODERATOR,
  SUMMARY_REVIEWER: ParticipantRole.REVIEWER
});

export const COVISION_INVITE_STATUS_TO_CONTRACT = Object.freeze({
  INVITED: InviteState.PENDING,
  ACCEPTED: InviteState.ACCEPTED,
  DECLINED: InviteState.DECLINED,
  EXPIRED: InviteState.EXPIRED
});

/* DECLINED/EXPIRED osaleja EI jõudnud kunagi ACTIVE-sse — tema liikmesus jääb
 * ausalt INVITED-iks ja loo räägib invite.status (K1 4.6 elutsükkel: ACTIVE
 * algab alles vastuvõtmisest). */
export const COVISION_MEMBERSHIP_FROM_INVITE = Object.freeze({
  INVITED: MembershipStatus.INVITED,
  ACCEPTED: MembershipStatus.ACTIVE,
  DECLINED: MembershipStatus.INVITED,
  EXPIRED: MembershipStatus.INVITED
});

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function participantDescriptor(covisionCaseId, participant) {
  const inviteStatus =
    COVISION_INVITE_STATUS_TO_CONTRACT[participant.inviteStatus] || InviteState.PENDING;
  return assertParticipantDescriptor({
    workspaceRef: { kind: WorkspaceKind.COVISION_CASE, id: covisionCaseId },
    userId: normalizeId(participant.userId) || null,
    role: COVISION_ROLE_TO_CONTRACT[participant.role] || ParticipantRole.MEMBER,
    invite: {
      status: inviteStatus,
      /* CovisionParticipant kutsel ei ole aegumisaega — aus null, mitte
       * leiutatud tähtaeg. */
      expiresAt: null,
      /* Kovisioon on professionaalide vaheline metoodika — kliendisuhte kutset
       * selles mudelis ei eksisteeri. */
      relationship: InviteRelationship.COLLEAGUE
    },
    membership: {
      status:
        COVISION_MEMBERSHIP_FROM_INVITE[participant.inviteStatus] || MembershipStatus.INVITED,
      since: toNullableIso(participant.createdAt),
      leftAt: null
    },
    scope: { note: null }
  });
}

async function canViewParticipants(db, viewerId, covisionCaseId) {
  const ownedCase = await db.covisionCase.findFirst({
    where: { id: covisionCaseId, ownerId: viewerId },
    select: { id: true }
  });
  if (ownedCase) return true;
  const ownParticipation = await db.covisionParticipant.findFirst({
    where: { covisionCaseId, userId: viewerId, inviteStatus: "ACCEPTED" },
    select: { id: true }
  });
  return Boolean(ownParticipation);
}

/**
 * Kovisiooni juhtumi osalejad vaataja jaoks. Vaataja peab olema juhtumi omanik
 * või vastu võtnud osaleja; võõras → tühi loend (juhtumi olemasolu ei lekitata).
 *
 * @returns {Promise<import("../participation.js").ParticipantDescriptor[]>}
 */
export async function listParticipants(userId, covisionCaseId, { db = prisma } = {}) {
  const viewerId = normalizeId(userId);
  const caseId = normalizeId(covisionCaseId);
  if (!viewerId || !caseId) return [];

  const allowed = await canViewParticipants(db, viewerId, caseId);
  if (!allowed) return [];

  const participants = await db.covisionParticipant.findMany({
    where: { covisionCaseId: caseId },
    select: { userId: true, role: true, inviteStatus: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200
  });

  return (participants || []).map((participant) => participantDescriptor(caseId, participant));
}

/**
 * Kasutaja enda Kovisiooni osalused. Loend on alati küsija enda oma.
 *
 * @returns {Promise<import("../participation.js").ParticipantDescriptor[]>}
 */
export async function listMyMemberships(userId, { db = prisma } = {}) {
  const viewerId = normalizeId(userId);
  if (!viewerId) return [];

  const participations = await db.covisionParticipant.findMany({
    where: { userId: viewerId },
    select: {
      covisionCaseId: true,
      userId: true,
      role: true,
      inviteStatus: true,
      createdAt: true
    },
    orderBy: [{ createdAt: "asc" }, { covisionCaseId: "asc" }],
    take: 200
  });

  return (participations || []).map((participant) =>
    participantDescriptor(normalizeId(participant.covisionCaseId), participant)
  );
}
