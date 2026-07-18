import prisma from "@/lib/prisma";

import {
  FIELD_VISIT_K1_LIFECYCLE,
  FIELD_VISIT_K1_PHASE
} from "@/lib/field/constants";
import { assertWorkspaceDescriptor, WorkspaceVisibility } from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

/**
 * K1 read-adapter for field visits (doc ptk 3.4). Owner-scoped and
 * descriptor-only: goal text is the worker's own workspace text; note bodies,
 * location and safety contact details never leave the module through this
 * surface.
 */
export function toFieldVisitWorkspaceDescriptor(row) {
  const ownerId = String(row?.ownerUserId || "").trim();
  const id = String(row?.id || "").trim();
  const status = String(row?.status || "DRAFT");
  const phase = FIELD_VISIT_K1_PHASE[status] || null;
  return assertWorkspaceDescriptor({
    ref: { kind: WorkspaceKind.FIELD_VISIT, id },
    title: String(row?.goal || "workspace.kind.field_visit").trim() || "workspace.kind.field_visit",
    ownerId,
    responsibleId: ownerId,
    lifecycle: FIELD_VISIT_K1_LIFECYCLE[status] || "DRAFT",
    phase: phase ? { stage: phase.stage, key: phase.key, labelKey: phase.labelKey } : null,
    goal: row?.goal ? String(row.goal) : null,
    nextAction: null,
    progress: null,
    visibility: WorkspaceVisibility.PRIVATE,
    participants: { active: 1, invited: 0 },
    lastMeaningfulActivityAt: new Date(row?.updatedAt).toISOString(),
    href: { action: "open_workspace", target: `${WorkspaceKind.FIELD_VISIT}:${id}` }
  });
}

export async function listWorkspaces(userId, { db = prisma } = {}) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) return [];
  const rows = await db.fieldVisit.findMany({
    where: { ownerUserId },
    select: { id: true, ownerUserId: true, status: true, goal: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 100
  });
  return rows.map(toFieldVisitWorkspaceDescriptor);
}

export const listFieldVisitWorkspaces = listWorkspaces;
