import prisma from "@/lib/prisma";
import { createNotificationEvent } from "@/lib/notifications";
import { getEventSpec } from "@/lib/events/registry";
import { resolveRecipients } from "@/lib/events/recipients";

function enabled(value) {
  return ["1", "true", "on", "yes"].includes(String(value ?? "false").trim().toLowerCase());
}

function projectionSuffix(event) {
  const statusKey = String(event?.meta?.statusKey || "").trim();
  if (event.type === "pre_inquiry.recalled") return `recalled:${event.occurredAt.toISOString()}`;
  if (event.type === "network_share.changed") {
    return `${event.meta?.actionCode || "changed"}:${event.meta?.statusCode || "unknown"}:${event.id}`;
  }
  return `${statusKey}:${event.occurredAt.toISOString()}`;
}

export async function projectDomainEvents({
  db = prisma,
  now = new Date(),
  dryRun = false,
  batchSize = 40,
  cursor = null
} = {}) {
  const counters = { considered: 0, created: 0, existing: 0, failed: 0, zeroRecipients: 0 };
  if (!enabled(process.env.U1_PROJECTOR_ENABLED)) {
    return { disabled: true, ...counters, truncated: false, nextCursor: null };
  }
  const take = Math.max(1, Math.min(Number(batchSize) || 40, 100));
  const rows = await db.domainEvent.findMany({
    where: { projectedAt: null, ...(cursor ? { id: { gt: String(cursor) } } : {}) },
    orderBy: { id: "asc" },
    take
  });
  for (const event of rows) {
    counters.considered += 1;
    try {
      const spec = getEventSpec(event.type);
      if (!spec) throw Object.assign(new Error("Unknown domain event type"), { code: "UNKNOWN_EVENT_TYPE" });
      const recipients = await resolveRecipients(event, { db });
      if (!recipients.length) counters.zeroRecipients += 1;
      if (dryRun) continue;
      for (const userId of recipients) {
        const result = await createNotificationEvent({
          userId,
          type: spec.projectionType,
          sourceId: event.sourceId,
          targetId: event.sourceId,
          dedupeSuffix: projectionSuffix(event),
          emailPolicy: spec.emailPolicy,
          eventId: event.id,
          workspaceKind: event.workspaceKind,
          workspaceId: event.workspaceId
        }, { db, now, verifyRecipient: false });
        counters[result.created ? "created" : "existing"] += 1;
      }
      await db.domainEvent.updateMany({
        where: { id: event.id, projectedAt: null },
        data: { projectedAt: now }
      });
    } catch {
      counters.failed += 1;
    }
  }
  const truncated = rows.length === take;
  return {
    disabled: false,
    dryRun,
    ...counters,
    truncated,
    nextCursor: truncated ? rows.at(-1)?.id || null : null
  };
}

export const domainEventProjectorInternals = Object.freeze({ enabled, projectionSuffix });
