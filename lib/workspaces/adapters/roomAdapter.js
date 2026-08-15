import prisma from "@/lib/prisma";
import { hasRoomBillingAccess } from "@/lib/rooms/access";

import {
  assertWorkspaceDescriptor,
  WorkspaceLifecycle,
  WorkspaceVisibility
} from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

function normalizeUserId(userId) {
  return typeof userId === "string" ? userId.trim() : "";
}

function toIsoTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Room workspace descriptor requires last activity");
  }
  return date.toISOString();
}

/**
 * Maps a membership-scoped Room row to the shared K1 descriptor. The current
 * Room model has no lifecycle or phase fields, so it truthfully reports ACTIVE
 * with null phase/progress/next action rather than inventing future states.
 */
export function toRoomWorkspaceDescriptor(membership) {
  const room = membership?.room;
  const roomId = String(room?.id || membership?.roomId || "").trim();
  const ownerId = String(room?.ownerId || "").trim();
  const descriptor = {
    ref: { kind: WorkspaceKind.ROOM, id: roomId },
    title: String(room?.title || "").trim() || "workspace.kind.room",
    ownerId,
    responsibleId: ownerId,
    lifecycle: WorkspaceLifecycle.ACTIVE,
    phase: null,
    goal: null,
    nextAction: null,
    progress: null,
    visibility: WorkspaceVisibility.SHARED_PARTICIPANTS,
    participants: {
      active: Math.max(1, Array.isArray(room?.members) ? room.members.length : 0),
      invited: 0
    },
    lastMeaningfulActivityAt: toIsoTimestamp(room?.updatedAt || room?.createdAt),
    href: {
      action: "open_workspace",
      target: `${WorkspaceKind.ROOM}:${roomId}`
    }
  };
  return assertWorkspaceDescriptor(descriptor);
}

const ROOM_MEMBERSHIP_SELECT = Object.freeze({
  roomId: true,
  billingSource: true,
  room: {
    select: {
      id: true,
      ownerId: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      helpMatch: {
        select: { id: true }
      },
      members: {
        where: { leftAt: null },
        select: { id: true }
      }
    }
  }
});

/**
 * Read-only K1 adapter. A descriptor exists only when a current RoomMember
 * also passes the Room module's billing gate; ownership alone is deliberately
 * not an alternative access path.
 */
export async function listWorkspaces(userId, { db = prisma } = {}) {
  const viewerId = normalizeUserId(userId);
  if (!viewerId) return [];

  const user = await db.user.findUnique({
    where: { id: viewerId },
    select: { role: true }
  });
  if (!user) return [];

  const isAdmin = user.role === "ADMIN";
  const activeSubscription = isAdmin ? true : Boolean(await db.subscription.findFirst({
    where: {
      userId: viewerId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
    },
    select: { id: true }
  }));

  const memberships = await db.roomMember.findMany({
    where: { userId: viewerId, leftAt: null },
    select: ROOM_MEMBERSHIP_SELECT,
    orderBy: [{ joinedAt: "asc" }, { roomId: "asc" }],
    take: 100
  });

  return (memberships || [])
    .filter((membership) => membership?.room && hasRoomBillingAccess({
      userRole: user.role,
      membership,
      hasActiveSubscription: activeSubscription,
      room: membership.room
    }).ok)
    .map(toRoomWorkspaceDescriptor);
}

export const listRoomWorkspaces = listWorkspaces;
