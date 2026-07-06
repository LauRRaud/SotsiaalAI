import { NextResponse } from "next/server";

import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import { buildLocalizedExtraSystemInstruction } from "@/lib/chat/systemPrompts/index.js";
import { WORK_MODES } from "@/lib/chat/orchestrationPolicy";
import { prisma } from "@/lib/prisma";
import { publishRoomEvent } from "@/lib/roomStream";
import { safeLogPayload } from "@/lib/privacy/safeError";

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

export async function saveAssistantRoomMessage({
  roomId,
  userId,
  content
}) {
  if (!roomId || !userId || !content) return null;
  const msg = await prisma.roomMessage.create({
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
