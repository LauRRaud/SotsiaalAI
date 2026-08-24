import { randomUUID } from "node:crypto";

const CONTACT_CHECK_LOCK_KEY = "service-map-contact-freshness-check";
const CONTACT_SOURCE_NAMESPACES = new Set(["KOV_FILE_CONTACT", "RAG_KOV_CONTACT"]);

export const SERVICE_MAP_SOURCE = Object.freeze({
  KOV_FILE_CONTACT: "KOV_FILE_CONTACT",
  RAG_KOV_CONTACT: "RAG_KOV_CONTACT",
  KOV_MUNICIPALITY: "KOV_MUNICIPALITY",
  RAG_SERVICE_PROVIDER: "RAG_SERVICE_PROVIDER"
});

export async function withServiceMapSourceLock(db, namespace, operation) {
  if (typeof operation !== "function") throw new TypeError("Source operation is required");
  if (typeof db?.$transaction !== "function") return operation(db);
  return db.$transaction(async (tx) => {
    if (CONTACT_SOURCE_NAMESPACES.has(namespace)) {
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        CONTACT_CHECK_LOCK_KEY
      );
    }
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "service_map_source_sync",
      namespace
    );
    return operation(tx);
  }, { maxWait: 10_000, timeout: 120_000 });
}

export function createSourceGeneration() {
  return randomUUID();
}

export function sourceLifecycleFields(namespace, generation, now = new Date()) {
  return {
    sourceNamespace: namespace,
    sourceGeneration: generation,
    lastSeenAt: now,
    tombstonedAt: null
  };
}

export async function reconcileCompleteServiceMapSource({
  db,
  namespace,
  generation,
  actorUserId = null,
  now = new Date()
}) {
  if (!db || !namespace || !generation) throw new TypeError("Complete source identity is required");

  const execute = async (tx) => {
    const staleWhere = {
      sourceNamespace: namespace,
      OR: [{ sourceGeneration: null }, { sourceGeneration: { not: generation } }],
      status: { not: "HIDDEN" }
    };
    const staleRows = typeof tx.serviceMapEntry.findMany === "function"
      ? await tx.serviceMapEntry.findMany({ where: staleWhere, select: { id: true } })
      : [];
    const hidden = await tx.serviceMapEntry.updateMany({
      where: staleWhere,
      data: {
        status: "HIDDEN",
        tombstonedAt: now,
        revision: { increment: 1 }
      }
    });

    if (Number(hidden?.count || 0) > 0) {
      await tx.dataAuditLog.create({
        data: {
          actorUserId,
          action: "SERVICE_MAP_SOURCE_RECONCILED",
          resourceType: "ServiceMapEntry",
          resourceId: namespace,
          meta: {
            generation,
            hiddenCount: hidden.count,
            hiddenEntryIds: staleRows.map((row) => row.id),
            reason: "missing_from_complete_source"
          }
        }
      });
    }
    return Number(hidden?.count || 0);
  };

  return typeof db.$transaction === "function" ? db.$transaction(execute) : execute(db);
}
