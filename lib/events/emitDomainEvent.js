import { validateDomainEventInput } from "@/lib/events/registry";

function enabled(value) {
  return ["1", "true", "on", "yes"].includes(String(value ?? "false").trim().toLowerCase());
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

function assertTransactionClient(tx) {
  if (!tx?.domainEvent?.create || typeof tx.$connect === "function") {
    const error = new TypeError("emitDomainEvent requires a Prisma transaction client");
    error.code = "DOMAIN_EVENT_TX_REQUIRED";
    throw error;
  }
}

export async function emitDomainEvent(tx, input = {}) {
  if (!enabled(process.env.U1_OUTBOX_ENABLED)) {
    return { emitted: false, created: false, disabled: true, event: null };
  }
  assertTransactionClient(tx);
  const value = validateDomainEventInput(input);
  const occurredAt = input.occurredAt instanceof Date ? input.occurredAt : new Date();
  if (!Number.isFinite(occurredAt.getTime())) {
    throw Object.assign(new TypeError("Invalid event occurrence time"), { code: "INVALID_EVENT_TIME" });
  }
  const data = {
    type: value.type,
    version: value.eventSpec.version,
    occurredAt,
    actorKind: value.actorKind,
    actorUserId: value.actorUserId,
    sourceFeature: value.eventSpec.sourceFeature,
    sourceType: value.eventSpec.sourceType,
    sourceId: value.sourceId,
    workspaceKind: input.workspaceKind ?? value.eventSpec.workspaceKind ?? null,
    workspaceId: value.workspaceId,
    audienceRule: value.eventSpec.audienceRule,
    audienceHint: null,
    visibilityClass: value.eventSpec.visibilityClass,
    actionKind: value.eventSpec.actionKind,
    actionTarget: value.actionTarget,
    idempotencyKey: value.idempotencyKey,
    retentionClass: value.eventSpec.retentionClass,
    meta: Object.keys(value.meta).length ? value.meta : undefined
  };
  try {
    const event = await tx.domainEvent.create({ data });
    return { emitted: true, created: true, disabled: false, event };
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const event = await tx.domainEvent.findUnique?.({ where: { idempotencyKey: value.idempotencyKey } });
    if (!event) throw error;
    return { emitted: true, created: false, disabled: false, event };
  }
}

export const domainEventEmitterInternals = Object.freeze({ assertTransactionClient, enabled });
