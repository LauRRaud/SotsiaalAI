import { prisma } from "@/lib/prisma";
import { normalizeJourneyCreateInput, normalizeJourneyUpdateInput } from "./validation.js";
import { serializeJourney } from "./serializers.js";
import { emitDomainEvent } from "@/lib/events/emitDomainEvent";
import { DomainEventType } from "@/lib/events/registry";

function publicError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireOwnerId(ownerUserId) {
  const normalized = String(ownerUserId || "").trim();
  if (!normalized) throw publicError("api.common.unauthorized", 401);
  return normalized;
}

function activityContext(context, type, at = new Date()) {
  const current = context && typeof context === "object" && !Array.isArray(context) ? context : {};
  const existing = Array.isArray(current.activityLog) ? current.activityLog : [];
  return {
    ...current,
    activityLog: [...existing, { type, date: at.toISOString() }].slice(-50)
  };
}

async function emitJourneyEvent(tx, { type, journeyId, ownerUserId, occurredAt }) {
  return emitDomainEvent(tx, {
    type,
    actorKind: "user",
    actorUserId: ownerUserId,
    sourceId: journeyId,
    workspaceId: journeyId,
    actionTarget: type === DomainEventType.WORKSPACE_DELETED ? "journey" : `journey:${journeyId}`,
    idempotencyKey: `${type}:${journeyId}:${occurredAt.toISOString()}`,
    occurredAt,
    meta: { kind: "journey" }
  });
}

async function ensureOwnedConversation(userId, conversationId, { db = prisma } = {}) {
  if (!conversationId) return null;
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      userId
    },
    select: {
      id: true
    }
  });
  if (!conversation) {
    throw publicError("journeys.errors.conversation_not_found", 400);
  }
  return conversation.id;
}

export async function listJourneysForUser(ownerUserId) {
  const userId = requireOwnerId(ownerUserId);
  const journeys = await prisma.journey.findMany({
    where: {
      ownerUserId: userId
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" }
    ]
  });

  return journeys.map(serializeJourney);
}

export async function createJourneyForUser(ownerUserId, input = {}, options = {}) {
  const userId = requireOwnerId(ownerUserId);
  const db = options.db || prisma;
  const data = normalizeJourneyCreateInput(input, options);
  data.conversationId = await ensureOwnedConversation(userId, data.conversationId, { db });

  const occurredAt = new Date();
  const journey = await db.$transaction(async (tx) => {
    const created = await tx.journey.create({
      data: {
        ...data,
        context: activityContext(data.context, "created", occurredAt),
        ownerUserId: userId
      }
    });
    await emitJourneyEvent(tx, {
      type: DomainEventType.WORKSPACE_CREATED,
      journeyId: created.id,
      ownerUserId: userId,
      occurredAt
    });
    return created;
  });

  return serializeJourney(journey);
}

export async function getJourneyForUser(ownerUserId, journeyId, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  if (!id) throw publicError("journeys.errors.not_found", 404);

  const journey = await db.journey.findFirst({
    where: {
      id,
      ownerUserId: userId
    }
  });

  if (!journey) throw publicError("journeys.errors.not_found", 404);
  return serializeJourney(journey);
}

function serializeLinkedPreInquiry(row) {
  if (!row) return null;
  return {
    id: row.id,
    topic: row.topic ?? null,
    status: row.status,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt
  };
}

/**
 * Owner-scoped minimal view of the pre-inquiries created from a journey.
 * Only the journey owner (== pre-inquiry author) ever reaches this data, and
 * only id/topic/status/timestamps are exposed — never the pre-inquiry body,
 * recipient or draft. The recipient of a pre-inquiry never sees this link.
 */
export async function listLinkedPreInquiriesForJourney(ownerUserId, journeyId, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  if (!id) return [];

  const rows = await db.preInquiry.findMany({
    where: {
      sourceJourneyId: id,
      authorId: userId
    },
    select: {
      id: true,
      topic: true,
      status: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { updatedAt: "desc" }
  });

  return rows.map(serializeLinkedPreInquiry);
}

export async function getJourneyDetailForUser(ownerUserId, journeyId, { db = prisma } = {}) {
  const journey = await getJourneyForUser(ownerUserId, journeyId, { db });
  const linkedPreInquiries = await listLinkedPreInquiriesForJourney(ownerUserId, journey.id, { db });
  return { ...journey, linkedPreInquiries };
}

export async function updateJourneyForUser(ownerUserId, journeyId, input = {}, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  if (!id) throw publicError("journeys.errors.not_found", 404);

  const existing = await db.journey.findFirst({
    where: {
      id,
      ownerUserId: userId
    },
    select: {
      id: true,
      status: true,
      context: true,
      updatedAt: true
    }
  });

  if (!existing) throw publicError("journeys.errors.not_found", 404);

  const existingUpdatedAt = existing.updatedAt instanceof Date ? existing.updatedAt : new Date(existing.updatedAt);
  if (!Object.hasOwn(payload, "expectedUpdatedAt") || !payload.expectedUpdatedAt) {
    throw publicError("journeys.errors.version_required", 409);
  }
  const expectedUpdatedAt = new Date(payload.expectedUpdatedAt);
  if (!Number.isFinite(expectedUpdatedAt.getTime()) || existingUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw publicError("journeys.errors.conflict", 409);
  }

  const data = normalizeJourneyUpdateInput(payload);
  if (!Object.keys(data).length) {
    return getJourneyDetailForUser(userId, id);
  }
  if (existing.status === "ARCHIVED") {
    const changedFields = Object.keys(data);
    const isExplicitReopen = changedFields.length === 1 && data.status === "ACTIVE";
    if (!isExplicitReopen) throw publicError("journeys.errors.archived", 409);
  }

  const occurredAt = new Date();
  data.context = activityContext(
    Object.hasOwn(data, "context") ? data.context : existing.context,
    data.status && data.status !== existing.status
      ? (data.status === "ARCHIVED" ? "archived" : "reopened")
      : "updated",
    occurredAt
  );
  const journey = await db.$transaction(async (tx) => {
    const result = await tx.journey.updateMany({
      where: { id, ownerUserId: userId, updatedAt: existingUpdatedAt },
      data
    });
    if (result.count !== 1) throw publicError("journeys.errors.conflict", 409);
    const updated = await tx.journey.findUnique({ where: { id } });
    if (data.status && data.status !== existing.status) {
      await emitJourneyEvent(tx, {
        type: data.status === "ARCHIVED"
          ? DomainEventType.WORKSPACE_ARCHIVED
          : DomainEventType.WORKSPACE_ACTIVATED,
        journeyId: id,
        ownerUserId: userId,
        occurredAt
      });
    }
    return updated;
  });

  // Keep the PATCH payload shape identical to the GET detail so the client's
  // "Seotud eelpöördumised" list is not dropped after an unrelated journey edit.
  return {
    ...serializeJourney(journey),
    linkedPreInquiries: await listLinkedPreInquiriesForJourney(userId, id, { db })
  };
}

export async function deleteJourneyForUser(ownerUserId, journeyId, confirmation, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  if (String(confirmation || "").trim().toUpperCase() !== "DELETE") {
    throw publicError("journeys.errors.delete_confirmation_required", 400);
  }
  const existing = await db.journey.findFirst({
    where: { id, ownerUserId: userId },
    select: { id: true }
  });
  if (!existing) throw publicError("journeys.errors.not_found", 404);
  const occurredAt = new Date();
  await db.$transaction(async (tx) => {
    await emitJourneyEvent(tx, {
      type: DomainEventType.WORKSPACE_DELETED,
      journeyId: id,
      ownerUserId: userId,
      occurredAt
    });
    await tx.journey.delete({ where: { id } });
  });
  return { id, deleted: true };
}
