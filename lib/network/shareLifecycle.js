import { createHash } from "node:crypto";

import { DomainEventType, getEventSpec, validateDomainEventInput } from "@/lib/events/registry";

const RECIPIENT_BY_ACTION = Object.freeze({
  CREATE: "NONE",
  UPDATE: "NONE",
  SUBMIT: "CLIENT",
  DECIDE: "WORKER",
  ATTEST: "WORKER",
  SEND: "NONE",
  OPEN: "WORKER",
  RECALL: "RECIPIENT",
  RESPOND: "WORKER",
  END: "ALL"
});

export function networkShareMutationEventKey({ actorUserId, actionCode, mutationKey }) {
  const raw = `${String(actorUserId || "system")}:${String(actionCode || "")}:${String(mutationKey || "")}`;
  return `network-share:${createHash("sha256").update(raw).digest("hex")}`;
}

/**
 * Püsiv elutsüklisündmus ja audit sünnivad sama tehingukliendiga nagu olek.
 * Meta on ainult kinnine koodistik; kliendi tekst ega otsuse märkus siia ei jõua.
 */
export async function recordNetworkShareLifecycle({
  db,
  share,
  actorUserId = null,
  actorKind = actorUserId ? "user" : "system",
  actionCode,
  fromStatus = null,
  mutationKey = null,
  now = new Date()
}) {
  if (!db?.domainEvent?.create || !db?.dataAuditLog?.create || !share?.id) {
    throw new TypeError("Network-share lifecycle transaction client is required");
  }
  const type = DomainEventType.NETWORK_SHARE_CHANGED;
  const eventSpec = getEventSpec(type);
  const statusCode = String(share.status || "");
  const recipientKind = RECIPIENT_BY_ACTION[actionCode] || "NONE";
  const idempotencyKey = networkShareMutationEventKey({
    actorUserId,
    actionCode,
    mutationKey: mutationKey || `${share.id}:${statusCode}:${new Date(now).toISOString()}`
  });
  const checked = validateDomainEventInput({
    type,
    actorKind,
    actorUserId,
    sourceId: share.id,
    idempotencyKey,
    actionTarget: share.id,
    meta: { statusCode, actionCode, recipientKind }
  });
  const existing = await db.domainEvent.findUnique({ where: { idempotencyKey } });
  if (existing) return { created: false, event: existing };
  const event = await db.domainEvent.create({
    data: {
      type,
      version: eventSpec.version,
      occurredAt: now,
      actorKind,
      actorUserId: checked.actorUserId,
      sourceFeature: eventSpec.sourceFeature,
      sourceType: eventSpec.sourceType,
      sourceId: share.id,
      workspaceKind: eventSpec.workspaceKind,
      workspaceId: null,
      audienceRule: eventSpec.audienceRule,
      audienceHint: null,
      visibilityClass: eventSpec.visibilityClass,
      actionKind: eventSpec.actionKind,
      actionTarget: share.id,
      idempotencyKey,
      retentionClass: eventSpec.retentionClass,
      meta: checked.meta
    }
  });
  await db.dataAuditLog.create({
    data: {
      actorUserId,
      action: `network_share.${String(actionCode).toLowerCase()}`,
      resourceType: "NETWORK_SHARE",
      resourceId: share.id,
      meta: { fromStatus: fromStatus || null, toStatus: statusCode }
    }
  });
  return { created: true, event };
}

export async function findNetworkShareMutationReplay({ db, actorUserId, actionCode, mutationKey }) {
  if (!mutationKey || !db?.domainEvent?.findUnique) return null;
  const idempotencyKey = networkShareMutationEventKey({ actorUserId, actionCode, mutationKey });
  const event = await db.domainEvent.findUnique({ where: { idempotencyKey } });
  if (!event || event.type !== DomainEventType.NETWORK_SHARE_CHANGED) return null;
  return db.networkShare.findFirst({ where: { id: event.sourceId } });
}
