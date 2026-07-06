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

export async function getJourneyForUser(ownerUserId, journeyId) {
  const userId = requireOwnerId(ownerUserId);
  const id = String(journeyId || "").trim();
  if (!id) throw publicError("journeys.errors.not_found", 404);

  const journey = await prisma.journey.findFirst({
    where: {
      id,
      ownerUserId: userId
    }
  });

  if (!journey) throw publicError("journeys.errors.not_found", 404);
  return serializeJourney(journey);
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
    return getJourneyForUser(userId, id);
  }

  const journey = await prisma.journey.update({
    where: {
      id
    },
    data
  });

  return serializeJourney(journey);
}
