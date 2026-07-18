import prisma from "@/lib/prisma";

import { assertWorkspaceDescriptor, WorkspaceLifecycle, WorkspaceVisibility } from "../descriptor.js";
import { WorkspaceKind } from "../registry.js";

function lifecycle(status) {
  return String(status || "").toUpperCase() === "ARCHIVED"
    ? WorkspaceLifecycle.ARCHIVED
    : WorkspaceLifecycle.ACTIVE;
}

export function toJourneyWorkspaceDescriptor(row) {
  const ownerId = String(row?.ownerUserId || "").trim();
  const id = String(row?.id || "").trim();
  return assertWorkspaceDescriptor({
    ref: { kind: WorkspaceKind.JOURNEY, id },
    title: String(row?.title || "workspace.kind.journey").trim(),
    ownerId,
    responsibleId: ownerId,
    lifecycle: lifecycle(row?.status),
    phase: null,
    goal: null,
    nextAction: null,
    progress: null,
    visibility: WorkspaceVisibility.PRIVATE,
    participants: { active: 1, invited: 0 },
    lastMeaningfulActivityAt: new Date(row?.updatedAt).toISOString(),
    href: { action: "open_workspace", target: `${WorkspaceKind.JOURNEY}:${id}` }
  });
}

export async function listWorkspaces(userId, { db = prisma } = {}) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) return [];
  const rows = await db.journey.findMany({
    where: { ownerUserId },
    select: { id: true, ownerUserId: true, title: true, status: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 100
  });
  return rows.map(toJourneyWorkspaceDescriptor);
}

export const listJourneyWorkspaces = listWorkspaces;
