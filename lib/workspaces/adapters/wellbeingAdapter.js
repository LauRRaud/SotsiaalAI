import prisma from "@/lib/prisma";

import { assertWorkspaceDescriptor, WorkspaceLifecycle, WorkspaceVisibility } from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

/**
 * K1 read-adapter for the wellbeing space (doc ptk 7.1). Singleton per user:
 * there is no container table, so the owner's userId is the only stable id.
 *
 * Contentless by construction (W-INV-7): the descriptor never carries a
 * workflowType, signal, score or record count — only lifecycle + a reference.
 * The adapter reads two indexed timestamp columns and nothing else; it never
 * selects `standardizedFields`, `computedSignal`, `loadFactors` etc.
 *
 * Owner-only: `listWorkspaces(userId)` returns the descriptor solely to the
 * requesting owner; a foreign viewer — admin included — gets an empty list
 * (the query is keyed on that same userId, so it can only ever match self).
 *
 * `lifecycle` is the constant ACTIVE in V1. PAUSED ("rhythm switched off",
 * O-WB-5 (a)) becomes meaningful only after TO-2 builds the rhythm; the
 * descriptor shape already tolerates it. There is no CLOSED/ARCHIVED/DELETED —
 * the space is a fixture that disappears only with the account (schema cascade).
 *
 * Empty-room note: doc ptk 7.1 proposes returning a descriptor with
 * `lastMeaningfulActivityAt: null` even before the first record. The K1
 * descriptor validator (`descriptor.js`, the authoritative shared contract,
 * written after that proposal) requires a canonical ISO timestamp and rejects
 * null. So a user with no records and no drafts yields an empty list — the same
 * "no rows -> []" shape every other supported adapter uses. This leaks nothing:
 * the descriptor is owner-only anyway, and a foreign viewer already sees [].
 */
export function toWellbeingSpaceDescriptor({ userId, lastActivityAt }) {
  const ownerId = String(userId || "").trim();
  return assertWorkspaceDescriptor({
    ref: { kind: WorkspaceKind.WELLBEING_SPACE, id: ownerId },
    title: "workspace.kind.wellbeing_space",
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
    href: { action: "open_workspace", target: `${WorkspaceKind.WELLBEING_SPACE}:${ownerId}` }
  });
}

export async function listWorkspaces(userId, { db = prisma } = {}) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) return [];

  const [latestRecord, latestDraft] = await Promise.all([
    db.wellbeingRecord.findFirst({
      where: { ownerUserId },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" }
    }),
    db.wellbeingOutputDraft.findFirst({
      where: { userId: ownerUserId },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  const times = [latestRecord?.createdAt, latestDraft?.updatedAt]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));
  if (times.length === 0) return [];

  return [toWellbeingSpaceDescriptor({ userId: ownerUserId, lastActivityAt: Math.max(...times) })];
}

export const listWellbeingSpaceWorkspaces = listWorkspaces;
