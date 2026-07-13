import { prisma } from "@/lib/prisma";
import { normalizeJourneyCreateInput, normalizeJourneyUpdateInput } from "./validation.js";
import { serializeJourney } from "./serializers.js";

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

async function ensureOwnedConversation(userId, conversationId) {
  if (!conversationId) return null;
  const conversation = await prisma.conversation.findFirst({
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
  const data = normalizeJourneyCreateInput(input, options);
  data.conversationId = await ensureOwnedConversation(userId, data.conversationId);

  const journey = await prisma.journey.create({
    data: {
      ...data,
      ownerUserId: userId
    }
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

export async function updateJourneyForUser(ownerUserId, journeyId, input = {}) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  if (!id) throw publicError("journeys.errors.not_found", 404);

  const existing = await prisma.journey.findFirst({
    where: {
      id,
      ownerUserId: userId
    },
    select: {
      id: true
    }
  });

  if (!existing) throw publicError("journeys.errors.not_found", 404);

  const data = normalizeJourneyUpdateInput(input);
  if (!Object.keys(data).length) {
    return getJourneyDetailForUser(userId, id);
  }

  const journey = await prisma.journey.update({
    where: {
      id
    },
    data
  });

  // Keep the PATCH payload shape identical to the GET detail so the client's
  // "Seotud eelpöördumised" list is not dropped after an unrelated journey edit.
  return {
    ...serializeJourney(journey),
    linkedPreInquiries: await listLinkedPreInquiriesForJourney(userId, id)
  };
}
