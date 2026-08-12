import { prisma as defaultPrisma } from "../prisma.js";

function moderationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function publishServiceMapEntry({
  db = defaultPrisma,
  entryId,
  actorUserId,
  expectedRevision,
  reason
}) {
  const id = String(entryId || "").trim();
  const actor = String(actorUserId || "").trim();
  const normalizedReason = String(reason || "").trim().slice(0, 500);
  const revision = Number(expectedRevision);
  if (!id || !actor || normalizedReason.length < 3 || !Number.isInteger(revision) || revision < 1) {
    throw moderationError("SERVICE_MAP_MODERATION_INVALID", "Entry, actor, reason and revision are required");
  }

  return db.$transaction(async (tx) => {
    const current = await tx.serviceMapEntry.findUnique({
      where: { id },
      select: { id: true, status: true, revision: true }
    });
    if (!current) throw moderationError("SERVICE_MAP_ENTRY_NOT_FOUND", "Service-map entry was not found");
    if (current.status !== "NEEDS_REVIEW") {
      throw moderationError("SERVICE_MAP_MODERATION_STATE_CONFLICT", "Only a reviewable entry can be published");
    }

    const updated = await tx.serviceMapEntry.updateMany({
      where: { id, status: "NEEDS_REVIEW", revision },
      data: {
        status: "PUBLISHED",
        revision: { increment: 1 },
        tombstonedAt: null
      }
    });
    if (updated.count !== 1) {
      throw moderationError("SERVICE_MAP_MODERATION_REVISION_CONFLICT", "Service-map entry changed before publish");
    }

    await tx.dataAuditLog.create({
      data: {
        actorUserId: actor,
        action: "SERVICE_MAP_ENTRY_PUBLISHED",
        resourceType: "ServiceMapEntry",
        resourceId: id,
        meta: {
          reason: normalizedReason,
          previousStatus: current.status,
          previousRevision: revision,
          nextRevision: revision + 1
        }
      }
    });

    return tx.serviceMapEntry.findUnique({
      where: { id },
      select: { id: true, status: true, revision: true, updatedAt: true }
    });
  });
}
