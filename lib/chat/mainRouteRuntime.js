import { NextResponse } from "next/server";

import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { buildLocalizedExtraSystemInstruction } from "@/lib/chat/systemPrompts/index.js";
import { WORK_MODES } from "@/lib/chat/orchestrationPolicy";
import { prisma } from "@/lib/prisma";
import { publishRoomEvent } from "@/lib/roomStream";
import { safeLogPayload } from "@/lib/privacy/safeError";
import { isArchivedRoom } from "@/lib/rooms/accessGuard";

export function makeChatError(messageKey, status = 400, extras = {}) {
  return NextResponse.json({
    ok: false,
    messageKey,
    message: messageKey,
    ...extras
  }, {
    status,
    headers: CHAT_NO_STORE_HEADERS
  });
}

export const logChatInfo = (event, payload = {}) => {
  try {
    console.info("[chat]", event, safeLogPayload(payload));
  } catch {}
};

export const logChatError = (event, payload = {}) => {
  try {
    console.error("[chat]", event, safeLogPayload(payload));
  } catch {}
};

export function buildChatOrchestrationMetadata(plan, extra = null) {
  const orchestration = plan && typeof plan === "object"
    ? {
        mode: plan.mode || WORK_MODES.GENERAL_QUESTION,
        step: plan.step || "detect",
        complexity: plan.complexity || "normal",
        reasoning: plan.reasoning || "low",
        capability: plan.capability || "assistant",
        userVisibleMode: plan.userVisibleMode || "assistant"
      }
    : null;

  if (!orchestration && !extra) return null;
  return {
    ...(extra && typeof extra === "object" ? extra : {}),
    ...(orchestration ? { orchestration } : {})
  };
}

export function buildSourceLookupSystemInstruction(replyLang = "et") {
  return buildLocalizedExtraSystemInstruction("SOURCE_LOOKUP_MODE", { replyLang });
}

export function buildMissingMunicipalitySystemInstruction(effectiveRole = "CLIENT", replyLang = "et") {
  return buildLocalizedExtraSystemInstruction("MUNICIPALITY_CLARIFICATION_REQUIRED", {
    effectiveRole,
    replyLang
  });
}

export function buildVoiceInputSystemInstruction(replyLang = "et") {
  return buildLocalizedExtraSystemInstruction("VOICE_INPUT_MODE", { replyLang });
}

/**
 * SOL-CHAT-07 — TEINE värav, mitte koopia esimesest.
 *
 * Sõnumi kirjutas varem see funktsioon ilma ühegi kontrollita: ta usaldas, et kutsuja on
 * liikmesust juba kontrollinud. Kutsujaid on aga rohkem kui üks (finalizer jookseb nii voo- kui
 * tavarajal) ja bootstrap'i värav oli adminile lahti. Kontroll käib nüüd seal, kus KIRJUTUS on —
 * see on ainus koht, kust mööda ei saa.
 *
 * VISKAB, mitte ei tagasta vaikselt `null`: ruumipöördel (`persist === false`) on ruumisõnum
 * AINUS püsiv tulemus, seega tema puudumine ei ole kõrvaltoiming, vaid pöörde ebaõnnestumine.
 */
export async function saveAssistantRoomMessage({
  roomId,
  userId,
  content
}, deps = {}) {
  if (!roomId || !userId || !content) return null;
  const db = deps.prisma || prisma;
  const membership = await db.roomMember.findFirst({
    where: { roomId, userId, leftAt: null },
    select: { id: true }
  });
  if (!membership) {
    logChatError("room.assistant_write.denied", { roomId });
    const error = new Error("room membership is required to write an assistant message");
    error.code = "ROOM_MEMBERSHIP_REQUIRED";
    throw error;
  }
  // SOL-ROOM-01: lõpetatud ruumi ühine ajalugu ei muutu enam — ka assistendi käega mitte.
  // Kirjutus on ainus koht, kust mööda ei saa (sama argument, mis SOL-CHAT-07-s).
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { archivedAt: true }
  });
  if (isArchivedRoom(room)) {
    logChatError("room.assistant_write.archived", { roomId });
    const error = new Error("archived room is read-only");
    error.code = "ROOM_ARCHIVED";
    throw error;
  }
  const msg = await db.roomMessage.create({
    data: {
      roomId,
      authorId: userId,
      senderType: "ASSISTANT",
      content
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      senderType: true,
      author: {
        select: {
          role: true
        }
      }
    }
  });
  const payload = {
    ...msg,
    authorName: "Assistant",
    authorRole: msg.author?.role || "CLIENT"
  };
  try {
    publishRoomEvent(roomId, {
      type: "message",
      message: payload
    });
  } catch {}
  return payload;
}
