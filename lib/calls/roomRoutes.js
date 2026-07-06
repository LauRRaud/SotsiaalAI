import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishRoomEvent } from "@/lib/roomStream";
import { hasRoomBillingAccess } from "@/lib/rooms/access";
import { createConfiguredCallProvider } from "@/lib/calls/providers";
import { createCallService, getCallRuntimeConfig, serializeCallSession } from "@/lib/calls/service";

const CALL_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

export function callJson(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: CALL_NO_STORE_HEADERS
  });
}

export function callError(messageKey, status = 400, extras = {}) {
  return callJson({
    ok: false,
    messageKey,
    message: messageKey,
    ...extras
  }, status);
}

export async function readRoomId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.roomId || "").trim();
}

export async function readCallSessionId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.callSessionId || "").trim();
}

export async function readRequestId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.requestId || "").trim();
}

export async function readRecordingRequestId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.recordingRequestId || "").trim();
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return { ok: false, status: 401, message: "api.common.unauthorized" };
    return {
      ok: true,
    session,
    userId: session.user.id,
    userEmail: session.user.email || "",
    userName: session.user.name || "",
    userRole: session.user.role,
    isAdmin: session.user.isAdmin === true
  };
  } catch {
    return { ok: false, status: 401, message: "api.common.unauthorized" };
  }
}

async function hasActiveSubscription(userId) {
  if (!userId) return false;
  const now = new Date();
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: now } }]
    },
    select: { id: true }
  });
  return Boolean(sub);
}

export async function requireRoomCallAccess(roomId) {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!roomId) return { ok: false, status: 400, message: "api.common.missing_room_id" };

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      ownerId: true,
      helpMatch: { select: { id: true } }
    }
  });
  if (!room) return { ok: false, status: 404, message: "api.rooms.not_found" };

  const membership = await prisma.roomMember.findFirst({
    where: {
      roomId,
      userId: auth.userId,
      leftAt: null
    }
  });
  if (!membership) return { ok: false, status: 403, message: "api.rooms.access_denied" };

  const billingAccess = hasRoomBillingAccess({
    userRole: auth.userRole,
    membership,
    hasActiveSubscription: await hasActiveSubscription(auth.userId),
    room
  });
  if (!billingAccess.ok) return { ok: false, status: 403, message: "api.rooms.join_unavailable" };

  const roomRole = String(membership.role || "").toUpperCase();
  return {
    ok: true,
    ...auth,
    room,
    membership,
    canModerate: auth.isAdmin || auth.userRole === "ADMIN" || room.ownerId === auth.userId || roomRole === "OWNER" || roomRole === "MODERATOR"
  };
}

export async function requireCallInRoom(callSessionId, roomId) {
  if (!callSessionId) return { ok: false, status: 400, message: "call.missing_call_session_id" };
  const call = await prisma.callSession.findFirst({
    where: {
      id: callSessionId,
      roomId
    },
    select: { id: true, status: true }
  });
  if (!call) return { ok: false, status: 404, message: "call.not_found" };
  return { ok: true, call };
}

export function createRoomCallService() {
  return createCallService({
    prisma,
    provider: createConfiguredCallProvider(),
    maxParticipants: getCallRuntimeConfig().maxParticipants
  });
}

export async function emitCallEvent(roomId, call) {
  try {
    publishRoomEvent(roomId, {
      type: "call",
      call
    });
  } catch {}
}

export async function loadCallForResponse(callSessionId) {
  const call = await prisma.callSession.findFirst({ where: { id: callSessionId } });
  if (!call) return null;
  const [participants, speakRequests] = await Promise.all([
    prisma.callParticipant.findMany({
      where: { callSessionId, leftAt: null },
      orderBy: { joinedAt: "asc" },
      include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } }
    }),
    prisma.callSpeakRequest.findMany({
      where: { callSessionId, status: "ACTIVE" },
      orderBy: { requestedAt: "asc" },
      include: { user: { select: { profile: { select: { firstName: true, lastName: true } } } } }
    })
  ]);
  return serializeCallSession(call, {
    participants,
    speakRequests,
    recording: await prisma.callRecordingRequest.findFirst({
      where: {
        callSessionId,
        status: { in: ["REQUESTED", "READY_TO_RECORD", "DECLINED", "ACTIVE", "STOPPED", "COMPLETED", "FAILED"] }
      },
      orderBy: { requestedAt: "desc" },
      include: {
        requestedBy: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } },
        consents: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } } }
        },
        files: true
      }
    }).then(request => request ? { request } : null),
    providerAvailable: getCallRuntimeConfig().callServiceConfigured,
    providerKey: getCallRuntimeConfig().providerKey
  });
}

export async function requesterDisplayName(access) {
  const sessionName = String(access?.userName || "").trim();
  if (sessionName) return sessionName;
  const user = await prisma.user.findUnique({
    where: { id: access.userId },
    select: {
      email: true,
      profile: { select: { firstName: true, lastName: true } }
    }
  });
  const profileName = [user?.profile?.firstName, user?.profile?.lastName].filter(Boolean).join(" ").trim();
  return profileName || user?.email || access?.userEmail || "Kõne osaleja";
}

export function statusForCallError(error) {
  const message = String(error?.message || "api.common.server_error");
  if (error?.status) return { message, status: error.status };
  if (message === "call.forbidden") return { message, status: 403 };
  if (message === "call.not_active") return { message, status: 409 };
  if (message === "call.participants_full") return { message, status: 409 };
  if (message === "call.participant_not_found") return { message, status: 404 };
  if (message === "call.speak_request_not_found") return { message, status: 404 };
  if (message === "call.recording_forbidden") return { message, status: 403 };
  if (message === "call.recording_request_not_found") return { message, status: 404 };
  if (message === "call.recording_invalid_decision") return { message, status: 400 };
  if (message === "call.recording_not_ready") return { message, status: 409 };
  if (message === "call.recording_not_active") return { message, status: 409 };
  if (message === "call.recording_disabled") return { message, status: 503 };
  if (message === "call.recording_not_allowed") return { message, status: 403 };
  if (message === "call.recording_file_not_found") return { message, status: 404 };
  if (message === "call.recording_audio_only_required") return { message, status: 409 };
  return { message, status: 500 };
}
