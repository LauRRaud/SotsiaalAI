import prisma from "@/lib/prisma";

import { getReflectionActivityForUser } from "@/lib/reflection/records";
import { assertWorkspaceDescriptor, WorkspaceLifecycle, WorkspaceVisibility } from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

/**
 * K1 read-adapter for the practice reflection space (T21 P3, doc ptk 3).
 * Singleton per user, same shape as the wellbeing space: no container table,
 * the owner's userId is the only stable id.
 *
 * Contentless by construction (ptk 3.6 anti-tracking): the descriptor never
 * carries a method, an observation, an outcome or a record COUNT — only
 * lifecycle + the latest activity timestamp. Even the count is deliberate:
 * "mitu kirjet, millal" is exactly the existence fact ptk 3.6 p3 forbids
 * leaking, so the adapter reads a single timestamp and nothing else.
 *
 * Owner-only: the query is keyed on the requesting userId, so a foreign
 * viewer — admin included — can only ever get []. There is no cross-owner
 * variant of this adapter and none may be added (arhitektuuriline keeld).
 *
 * Empty space (0 reflections) yields [] — the same "no rows -> []" shape as
 * every other supported adapter; the descriptor validator requires a real
 * ISO timestamp anyway.
 */
export function toPracticeReflectionDescriptor({ userId, lastActivityAt }) {
  const ownerId = String(userId || "").trim();
  return assertWorkspaceDescriptor({
    ref: { kind: WorkspaceKind.PRACTICE_REFLECTION, id: ownerId },
    title: "workspace.kind.practice_reflection",
    ownerId,
    responsibleId: ownerId,
    lifecycle: WorkspaceLifecycle.ACTIVE,
    phase: null,
    goal: null,
    nextAction: null,
    progress: null,
    visibility: WorkspaceVisibility.PRIVATE,
    participants: { active: 1, invited: 0 },
    lastMeaningfulActivityAt: new Date(lastActivityAt).toISOString(),
    href: { action: "open_workspace", target: `${WorkspaceKind.PRACTICE_REFLECTION}:${ownerId}` }
  });
}

export async function listWorkspaces(userId, { db = prisma } = {}) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) return [];

  const activity = await getReflectionActivityForUser(ownerUserId, { prisma: db });
  if (!activity) return [];

  return [toPracticeReflectionDescriptor({
    userId: ownerUserId,
    lastActivityAt: activity.lastActivityAt
  })];
}

export const listPracticeReflectionWorkspaces = listWorkspaces;
