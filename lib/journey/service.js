import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { normalizeJourneyCreateInput, normalizeJourneyUpdateInput } from "./validation.js";
import { serializeJourney } from "./serializers.js";
import { emitDomainEvent } from "@/lib/events/emitDomainEvent";
import { DomainEventType } from "@/lib/events/registry";
import { writeDataAudit } from "@/lib/privacy/audit";
import {
  JOURNEY_CREATE_LIMITS,
  JOURNEY_EXPORT_LIMITS,
  JOURNEY_PAGE_LIMITS,
  JOURNEY_STATUSES,
  JOURNEY_TEXT_LIMITS
} from "./constants.js";
import {
  journeyCursorWhere,
  makeJourneyPage,
  normalizeJourneyPageLimit
} from "./pagination.js";
import { buildJourneyExport } from "./export.js";

function publicError(message, status = 400, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function requireOwnerId(ownerUserId) {
  const normalized = String(ownerUserId || "").trim();
  if (!normalized) throw publicError("api.common.unauthorized", 401);
  return normalized;
}

function normalizeClientActionId(value) {
  const normalized = String(value || "").trim();
  if (!normalized) throw publicError("journeys.errors.client_action_id_required", 400, "JOURNEY_CLIENT_ACTION_ID_REQUIRED");
  if (normalized.length > JOURNEY_TEXT_LIMITS.clientActionId || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw publicError("journeys.errors.client_action_id_invalid", 400, "JOURNEY_CLIENT_ACTION_ID_INVALID");
  }
  return normalized;
}

function deterministicJourneyId(ownerUserId, clientActionId) {
  return `jrn_${createHash("sha256").update(`${ownerUserId}\0${clientActionId}`).digest("hex").slice(0, 28)}`;
}

function canonical(value) {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

const CREATE_FIELDS = Object.freeze([
  "conversationId", "roleContext", "status", "sharingStatus", "title", "summary",
  "primaryPath", "domains", "missingInfo", "riskSignals", "suggestedActions", "context"
]);

function assertIdempotentReplay(existing, wanted) {
  const storedShape = Object.fromEntries(CREATE_FIELDS.map((key) => [key, canonical(existing?.[key])]));
  const wantedShape = Object.fromEntries(CREATE_FIELDS.map((key) => [key, canonical(wanted?.[key])]));
  if (JSON.stringify(storedShape) !== JSON.stringify(wantedShape)) {
    throw publicError("journeys.errors.idempotency_conflict", 409, "JOURNEY_IDEMPOTENCY_CONFLICT");
  }
  return existing;
}

async function emitJourneyEvent(tx, { type, journeyId, ownerUserId, occurredAt, stableKey = null }) {
  return emitDomainEvent(tx, {
    type,
    required: true,
    actorKind: "user",
    actorUserId: ownerUserId,
    sourceId: journeyId,
    workspaceId: journeyId,
    actionTarget: type === DomainEventType.WORKSPACE_DELETED ? "journey" : `journey:${journeyId}`,
    idempotencyKey: stableKey || `${type}:${journeyId}:${occurredAt.toISOString()}:${randomUUID()}`,
    occurredAt,
    meta: { kind: "journey" }
  });
}

async function ensureOwnedConversation(userId, conversationId, { db = prisma } = {}) {
  if (!conversationId) return null;
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true }
  });
  if (!conversation) throw publicError("journeys.errors.conversation_not_found", 400);
  return conversation.id;
}

function serializeJourneySummary(row) {
  return {
    id: row.id,
    status: row.status,
    sharingStatus: row.sharingStatus,
    title: row.title,
    summary: row.summary,
    primaryPath: row.primaryPath,
    domains: Array.isArray(row.domains) ? row.domains : [],
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt
  };
}

function statusFilter(value) {
  if (!value) return null;
  const status = String(value).trim().toUpperCase();
  if (!JOURNEY_STATUSES.includes(status)) throw publicError("journeys.errors.status_invalid", 400);
  return status;
}

export async function listJourneysForUser(ownerUserId, options = {}) {
  const userId = requireOwnerId(ownerUserId);
  const db = options.db || prisma;
  const limit = normalizeJourneyPageLimit(options.limit);
  const status = statusFilter(options.status);
  const cursorWhere = journeyCursorWhere(options.cursor, "updatedAt");
  const where = {
    ownerUserId: userId,
    ...(status ? { status } : {}),
    ...(cursorWhere ? { AND: [cursorWhere] } : {})
  };
  const countWhere = { ownerUserId: userId, ...(status ? { status } : {}) };
  const [rows, totalCount] = await Promise.all([
    db.journey.findMany({
      where,
      select: {
        id: true, status: true, sharingStatus: true, title: true, summary: true,
        primaryPath: true, domains: true, createdAt: true, updatedAt: true
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1
    }),
    db.journey.count({ where: countWhere })
  ]);
  const page = makeJourneyPage(rows, limit, "updatedAt", totalCount);
  return { ...page, items: page.items.map(serializeJourneySummary) };
}

export async function createJourneyForUser(ownerUserId, input = {}, options = {}) {
  const userId = requireOwnerId(ownerUserId);
  const db = options.db || prisma;
  const clientActionId = normalizeClientActionId(input.clientActionId);
  const data = normalizeJourneyCreateInput(input, options);
  data.conversationId = await ensureOwnedConversation(userId, data.conversationId, { db });
  const id = deterministicJourneyId(userId, clientActionId);

  try {
    const journey = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        `journey-create:${userId}`
      );
      const replay = await tx.journey.findUnique({ where: { id } });
      if (replay) return assertIdempotentReplay(replay, data);

      const [activeCount, totalCount] = await Promise.all([
        tx.journey.count({ where: { ownerUserId: userId, status: { in: ["ACTIVE", "DRAFT"] } } }),
        tx.journey.count({ where: { ownerUserId: userId } })
      ]);
      if (activeCount >= JOURNEY_CREATE_LIMITS.activePerOwner || totalCount >= JOURNEY_CREATE_LIMITS.totalPerOwner) {
        throw publicError("journeys.errors.create_limit_reached", 429, "JOURNEY_CREATE_LIMIT_REACHED");
      }

      const occurredAt = new Date();
      const created = await tx.journey.create({ data: { id, ...data, ownerUserId: userId } });
      await emitJourneyEvent(tx, {
        type: DomainEventType.WORKSPACE_CREATED,
        journeyId: created.id,
        ownerUserId: userId,
        occurredAt,
        stableKey: `${DomainEventType.WORKSPACE_CREATED}:${created.id}`
      });
      return created;
    });
    return serializeJourney(journey);
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    const replay = await db.journey.findUnique({ where: { id } });
    if (!replay) throw error;
    return serializeJourney(assertIdempotentReplay(replay, data));
  }
}

export async function getJourneyForUser(ownerUserId, journeyId, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  if (!id) throw publicError("journeys.errors.not_found", 404);
  const journey = await db.journey.findFirst({ where: { id, ownerUserId: userId } });
  if (!journey) throw publicError("journeys.errors.not_found", 404);
  return serializeJourney(journey);
}

function serializeLinkedPreInquiry(row) {
  return {
    id: row.id,
    topic: row.topic ?? null,
    status: row.status,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt
  };
}

export async function listLinkedPreInquiriesForJourney(ownerUserId, journeyId, options = {}) {
  const userId = requireOwnerId(ownerUserId);
  const db = options.db || prisma;
  const id = String(journeyId || "").trim();
  const limit = normalizeJourneyPageLimit(options.limit);
  if (!id) return { items: [], totalCount: 0, hasMore: false, nextCursor: null };
  const cursorWhere = journeyCursorWhere(options.cursor, "updatedAt");
  const baseWhere = { sourceJourneyId: id, authorId: userId };
  const where = { ...baseWhere, ...(cursorWhere ? { AND: [cursorWhere] } : {}) };
  const [rows, totalCount] = await Promise.all([
    db.preInquiry.findMany({
      where,
      select: { id: true, topic: true, status: true, createdAt: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1
    }),
    db.preInquiry.count({ where: baseWhere })
  ]);
  const page = makeJourneyPage(rows, limit, "updatedAt", totalCount);
  return { ...page, items: page.items.map(serializeLinkedPreInquiry) };
}

function serializeActivity(row) {
  return {
    id: row.id,
    type: row.type,
    occurredAt: row.occurredAt?.toISOString?.() || row.occurredAt
  };
}

export async function listJourneyActivityForUser(ownerUserId, journeyId, options = {}) {
  const userId = requireOwnerId(ownerUserId);
  const db = options.db || prisma;
  const id = String(journeyId || "").trim();
  const limit = normalizeJourneyPageLimit(options.limit, JOURNEY_PAGE_LIMITS.activity);
  const cursorWhere = journeyCursorWhere(options.cursor, "occurredAt");
  const baseWhere = { workspaceKind: "journey", workspaceId: id, actorUserId: userId };
  const where = { ...baseWhere, ...(cursorWhere ? { AND: [cursorWhere] } : {}) };
  const [rows, totalCount] = await Promise.all([
    db.domainEvent.findMany({
      where,
      select: { id: true, type: true, occurredAt: true },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: limit + 1
    }),
    db.domainEvent.count({ where: baseWhere })
  ]);
  const page = makeJourneyPage(rows, limit, "occurredAt", totalCount);
  return { ...page, items: page.items.map(serializeActivity) };
}

export async function getJourneyDetailForUser(ownerUserId, journeyId, { db = prisma } = {}) {
  const journey = await getJourneyForUser(ownerUserId, journeyId, { db });
  const [linkedPreInquiries, activity] = await Promise.all([
    listLinkedPreInquiriesForJourney(ownerUserId, journey.id, { db }),
    listJourneyActivityForUser(ownerUserId, journey.id, { db })
  ]);
  return {
    ...journey,
    linkedPreInquiries: linkedPreInquiries.items,
    linkedPreInquiriesPage: linkedPreInquiries,
    activity: activity.items,
    activityPage: activity
  };
}

export async function updateJourneyForUser(ownerUserId, journeyId, input = {}, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  if (!id) throw publicError("journeys.errors.not_found", 404);
  const existing = await db.journey.findFirst({
    where: { id, ownerUserId: userId },
    select: { id: true, status: true, updatedAt: true }
  });
  if (!existing) throw publicError("journeys.errors.not_found", 404);
  const existingUpdatedAt = existing.updatedAt instanceof Date ? existing.updatedAt : new Date(existing.updatedAt);
  if (!payload.expectedUpdatedAt) throw publicError("journeys.errors.version_required", 409);
  const expectedUpdatedAt = new Date(payload.expectedUpdatedAt);
  if (!Number.isFinite(expectedUpdatedAt.getTime()) || existingUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw publicError("journeys.errors.conflict", 409);
  }
  const data = normalizeJourneyUpdateInput(payload);
  if (!Object.keys(data).length) return getJourneyDetailForUser(userId, id, { db });
  if (existing.status === "ARCHIVED") {
    const changedFields = Object.keys(data);
    const isExplicitReopen = changedFields.length === 1 && data.status === "ACTIVE";
    if (!isExplicitReopen) throw publicError("journeys.errors.archived", 409);
  }

  const occurredAt = new Date();
  const eventType = data.status && data.status !== existing.status
    ? (data.status === "ARCHIVED" ? DomainEventType.WORKSPACE_ARCHIVED : DomainEventType.WORKSPACE_ACTIVATED)
    : DomainEventType.WORKSPACE_UPDATED;
  await db.$transaction(async (tx) => {
    const result = await tx.journey.updateMany({
      where: { id, ownerUserId: userId, updatedAt: existingUpdatedAt },
      data
    });
    if (result.count !== 1) throw publicError("journeys.errors.conflict", 409);
    await emitJourneyEvent(tx, { type: eventType, journeyId: id, ownerUserId: userId, occurredAt });
  });
  return getJourneyDetailForUser(userId, id, { db });
}

export async function deleteJourneyForUser(ownerUserId, journeyId, confirmation, { db = prisma } = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  if (String(confirmation || "").trim().toUpperCase() !== "DELETE") {
    throw publicError("journeys.errors.delete_confirmation_required", 400);
  }
  const existing = await db.journey.findFirst({ where: { id, ownerUserId: userId }, select: { id: true } });
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

export async function exportJourneyForUser(ownerUserId, journeyId, { db = prisma, exportedAt = new Date() } = {}) {
  const userId = requireOwnerId(ownerUserId);
  return db.$transaction(async (tx) => {
    const journey = await getJourneyForUser(userId, journeyId, { db: tx });
    const [linkedPreInquiries, activity] = await Promise.all([
      tx.preInquiry.findMany({
        where: { sourceJourneyId: journey.id, authorId: userId },
        select: { id: true, topic: true, status: true, createdAt: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: JOURNEY_EXPORT_LIMITS.linkedPreInquiries + 1
      }),
      tx.domainEvent.findMany({
        where: { workspaceKind: "journey", workspaceId: journey.id, actorUserId: userId },
        select: { id: true, type: true, occurredAt: true },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: JOURNEY_EXPORT_LIMITS.activity + 1
      })
    ]);
    if (
      linkedPreInquiries.length > JOURNEY_EXPORT_LIMITS.linkedPreInquiries
      || activity.length > JOURNEY_EXPORT_LIMITS.activity
    ) {
      throw publicError("journeys.errors.export_failed", 413, "JOURNEY_EXPORT_LIMIT_REACHED");
    }
    const value = buildJourneyExport({
      journey,
      linkedPreInquiries: linkedPreInquiries.map(serializeLinkedPreInquiry),
      activity: activity.map(serializeActivity),
      exportedAt
    });
    await writeDataAudit({
      db: tx,
      actorUserId: userId,
      targetUserId: userId,
      action: "JOURNEY_EXPORT",
      resourceType: "Journey",
      resourceId: journey.id,
      meta: { schemaVersion: value.schemaVersion, format: "json" }
    });
    return value;
  });
}
