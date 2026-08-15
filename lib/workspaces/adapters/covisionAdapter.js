import prisma from "@/lib/prisma";
import { canUseCovisionRole } from "@/lib/covision";

import {
  assertWorkspaceDescriptor,
  WorkspaceLifecycle,
  WorkspaceVisibility
} from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

const COVISION_STAGE_TOTAL = 8;

function normalizeUserId(userId) {
  return typeof userId === "string" ? userId.trim() : "";
}

function toIsoTimestamp(value, field) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (!Number.isFinite(date.getTime())) {
    throw new Error(`Covision workspace descriptor requires ${field}`);
  }
  return date.toISOString();
}

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function covisionLifecycle(caseRow) {
  const status = String(caseRow?.status || "").toUpperCase();
  if (status === "DRAFT") return WorkspaceLifecycle.DRAFT;
  if (status === "ACTIVE" || status === "SUMMARY_READY") {
    return caseRow?.sessionState?.pausedAt
      ? WorkspaceLifecycle.PAUSED
      : WorkspaceLifecycle.ACTIVE;
  }
  if (status === "CLOSED") {
    return caseRow?.closure?.retentionStatus === "DELETED"
      ? WorkspaceLifecycle.PURGED
      : WorkspaceLifecycle.CLOSED;
  }
  if (status === "ARCHIVED") return WorkspaceLifecycle.ARCHIVED;
  throw new Error(`Unsupported Covision case status: ${status || "missing"}`);
}

function covisionNextAction(closure, lifecycle, responsibleId) {
  if (!closure || lifecycle === WorkspaceLifecycle.ARCHIVED || lifecycle === WorkspaceLifecycle.PURGED) {
    return null;
  }

  const scheduledFollowUp = (closure.followUps || []).find(
    (followUp) => followUp?.status === "SCHEDULED"
  );
  if (scheduledFollowUp) {
    return {
      labelKey: "covision.next_action.follow_up",
      dueOn: toDateOnly(scheduledFollowUp.scheduledFor),
      assigneeId: scheduledFollowUp.assignedToUserId || responsibleId
    };
  }

  const labelKeyByStatus = {
    FOLLOW_UP_PENDING: "covision.next_action.follow_up",
    DECISION_PENDING: "covision.next_action.decision_required",
    CONTINUATION_PENDING: "covision.next_action.continuation_required"
  };
  const labelKey = labelKeyByStatus[closure.lifecycleStatus];
  return labelKey ? { labelKey, dueOn: null, assigneeId: responsibleId } : null;
}

function covisionParticipants(participants) {
  const rows = Array.isArray(participants) ? participants : [];
  const accepted = rows.filter((participant) => participant?.inviteStatus === "ACCEPTED").length;
  return {
    active: Math.max(1, accepted),
    invited: rows.filter((participant) => participant?.inviteStatus === "INVITED").length
  };
}

function covisionPhase(sessionState) {
  if (!sessionState) return null;
  return {
    stage: sessionState.stage,
    key: sessionState.phase,
    labelKey: `covision.stage.${sessionState.stage}`
  };
}

/**
 * Maps a pre-scoped Covision row to the shared K1 descriptor. No case title,
 * summary, central question, work-item, private-state, message, or closure
 * text is selected or returned.
 */
export function toCovisionWorkspaceDescriptor(caseRow) {
  const lifecycle = covisionLifecycle(caseRow);
  const ownerId = String(caseRow?.ownerId || "").trim();
  const responsibleId = String(caseRow?.closure?.assignedFollowUpUserId || ownerId).trim();
  const descriptor = {
    ref: { kind: WorkspaceKind.COVISION_CASE, id: String(caseRow?.id || "").trim() },
    title: "workspace.kind.covision_case",
    ownerId,
    responsibleId,
    lifecycle,
    phase: covisionPhase(caseRow?.sessionState),
    goal: null,
    nextAction: covisionNextAction(caseRow?.closure, lifecycle, responsibleId),
    progress: caseRow?.sessionState
      ? { current: caseRow.sessionState.stage, total: COVISION_STAGE_TOTAL }
      : null,
    visibility: lifecycle === WorkspaceLifecycle.DRAFT
      ? WorkspaceVisibility.PRIVATE
      : WorkspaceVisibility.SHARED_PARTICIPANTS,
    participants: covisionParticipants(caseRow?.participants),
    lastMeaningfulActivityAt: toIsoTimestamp(
      caseRow?.closure?.updatedAt || caseRow?.closure?.closedAt || caseRow?.lastActivityAt || caseRow?.updatedAt,
      "last activity"
    ),
    href: {
      action: "open_workspace",
      target: `${WorkspaceKind.COVISION_CASE}:${String(caseRow?.id || "").trim()}`
    }
  };
  return assertWorkspaceDescriptor(descriptor);
}

const COVISION_DESCRIPTOR_SELECT = Object.freeze({
  id: true,
  ownerId: true,
  status: true,
  lastActivityAt: true,
  updatedAt: true,
  participants: {
    select: {
      inviteStatus: true
    }
  },
  sessionState: {
    select: {
      stage: true,
      phase: true,
      pausedAt: true
    }
  },
  closure: {
    select: {
      assignedFollowUpUserId: true,
      lifecycleStatus: true,
      retentionStatus: true,
      closedAt: true,
      updatedAt: true,
      followUps: {
        where: { status: "SCHEDULED" },
        orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
        take: 1,
        select: {
          status: true,
          scheduledFor: true,
          assignedToUserId: true
        }
      }
    }
  }
});

/**
 * Read-only K1 adapter. The viewer must pass the Covision module role gate and
 * be the current owner or an accepted participant; invited, declined, and
 * expired records do not produce a descriptor.
 */
export async function listWorkspaces(userId, { db = prisma } = {}) {
  const viewerId = normalizeUserId(userId);
  if (!viewerId) return [];

  const user = await db.user.findUnique({
    where: { id: viewerId },
    select: { role: true, isAdmin: true }
  });
  if (!user || !canUseCovisionRole(user.role, user.isAdmin)) return [];

  const cases = await db.covisionCase.findMany({
    where: {
      OR: [
        { ownerId: viewerId },
        { participants: { some: { userId: viewerId, inviteStatus: "ACCEPTED" } } }
      ]
    },
    select: COVISION_DESCRIPTOR_SELECT,
    orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
    take: 100
  });

  return (cases || []).map(toCovisionWorkspaceDescriptor);
}

export const listCovisionWorkspaces = listWorkspaces;
