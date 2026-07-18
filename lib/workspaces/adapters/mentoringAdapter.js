import prisma from "@/lib/prisma";

import {
  assertWorkspaceDescriptor,
  WorkspaceLifecycle,
  WorkspaceVisibility
} from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

function normalizeUserId(userId) {
  return typeof userId === "string" ? userId.trim() : "";
}

function toIsoTimestamp(value, field) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Mentoring workspace descriptor requires ${field}`);
  }
  return date.toISOString();
}

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function mentoringLifecycle(relation) {
  const status = String(relation?.status || "").toUpperCase();
  if (status === "DRAFT") return WorkspaceLifecycle.DRAFT;
  if (status === "ACTIVE") return WorkspaceLifecycle.ACTIVE;
  if (status === "PAUSED") return WorkspaceLifecycle.PAUSED;
  if (status === "CLOSED") {
    return relation?.purgedAt ? WorkspaceLifecycle.PURGED : WorkspaceLifecycle.CLOSED;
  }
  throw new Error(`Unsupported mentoring relation status: ${status || "missing"}`);
}

function mentoringNextAction(relation, lifecycle) {
  if (lifecycle === WorkspaceLifecycle.CLOSED || lifecycle === WorkspaceLifecycle.PURGED) return null;
  if (lifecycle === WorkspaceLifecycle.DRAFT) {
    return {
      labelKey: "mentoring.next_action.agreement",
      dueOn: null,
      assigneeId: relation.menteeUserId || relation.mentorUserId
    };
  }
  const upcoming = (relation.meetings || [])[0];
  if (upcoming) {
    return {
      labelKey: "mentoring.next_action.meeting",
      dueOn: toDateOnly(upcoming.occurredAt),
      assigneeId: relation.menteeUserId || relation.mentorUserId
    };
  }
  return null;
}

/**
 * Kaardistab suhte K1 descriptor'iks. Ei vali ega tagasta ühtegi sisuteksti:
 * eesmärki, kokkulepet, kokkuvõtteid ega märkmeid (ainult faktid ja koodid).
 * Omanik = mentee (suhe algab tema taotlusest); vastutaja = mentee.
 */
export function toMentoringWorkspaceDescriptor(relation) {
  const lifecycle = mentoringLifecycle(relation);
  const ownerId = String(relation?.menteeUserId || relation?.mentorUserId || "").trim();
  const descriptor = {
    ref: { kind: WorkspaceKind.MENTORING_PROCESS, id: String(relation?.id || "").trim() },
    title: "workspace.kind.mentoring_process",
    ownerId,
    responsibleId: ownerId,
    lifecycle,
    phase: null,
    goal: null,
    nextAction: mentoringNextAction(relation, lifecycle),
    progress: null,
    visibility: WorkspaceVisibility.SHARED_PARTICIPANTS,
    participants: {
      active: [relation?.mentorUserId, relation?.menteeUserId].filter(Boolean).length,
      invited: 0
    },
    lastMeaningfulActivityAt: toIsoTimestamp(
      relation?.lastActivityAt || relation?.updatedAt,
      "last activity"
    ),
    href: {
      action: "open_workspace",
      target: `${WorkspaceKind.MENTORING_PROCESS}:${String(relation?.id || "").trim()}`
    }
  };
  return assertWorkspaceDescriptor(descriptor);
}

const MENTORING_DESCRIPTOR_SELECT = Object.freeze({
  id: true,
  mentorUserId: true,
  menteeUserId: true,
  status: true,
  purgedAt: true,
  lastActivityAt: true,
  updatedAt: true,
  meetings: {
    where: { status: "PLANNED" },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    take: 1,
    select: { occurredAt: true }
  }
});

/**
 * Read-only K1 adapter: AINULT osaleja-skoobitud read (K1 4.9 — ükski adapter
 * ei tohi lekitada teise kasutaja ruume).
 */
export async function listWorkspaces(userId, { db = prisma } = {}) {
  const viewerId = normalizeUserId(userId);
  if (!viewerId) return [];
  const relations = await db.mentoringRelation.findMany({
    where: {
      OR: [{ mentorUserId: viewerId }, { menteeUserId: viewerId }]
    },
    select: MENTORING_DESCRIPTOR_SELECT,
    orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
    take: 100
  });
  return (relations || []).map(toMentoringWorkspaceDescriptor);
}

export const listMentoringWorkspaces = listWorkspaces;
