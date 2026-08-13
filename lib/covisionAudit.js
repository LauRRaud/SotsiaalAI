const MAX_KEY = 240;

function clean(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function cleanMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      safe[clean(key, 60)] = typeof value === "string" ? clean(value, 120) : value;
    }
  }
  return Object.keys(safe).length ? safe : null;
}

export async function appendCovisionAuditEvent(tx, input) {
  if (!tx?.covisionAuditEvent?.upsert) throw new TypeError("covision audit store is required");
  const covisionCaseId = clean(input?.covisionCaseId, 100);
  const action = clean(input?.action, 80);
  const entityType = clean(input?.entityType, 80);
  const entityId = clean(input?.entityId, 100);
  const idempotencyKey = clean(input?.idempotencyKey, MAX_KEY);
  if (!covisionCaseId || !action || !entityType || !entityId || !idempotencyKey) {
    throw new TypeError("complete covision audit identity is required");
  }
  return tx.covisionAuditEvent.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      covisionCaseId,
      participantId: clean(input?.participantId, 100) || null,
      actorUserId: clean(input?.actorUserId, 100) || null,
      actorRoleSnapshot: clean(input?.actorRoleSnapshot, 80) || "SYSTEM",
      action,
      entityType,
      entityId,
      idempotencyKey,
      metadata: cleanMetadata(input?.metadata),
      occurredAt: input?.occurredAt || new Date()
    }
  });
}
