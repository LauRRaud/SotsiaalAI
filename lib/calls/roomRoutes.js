import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishRoomEvent } from "@/lib/roomStream";
import { hasRoomBillingAccess } from "@/lib/rooms/access";
import { createConfiguredCallProvider } from "@/lib/calls/providers";
import { createCallService, getCallRuntimeConfig, loadCallState, serializeCallSession } from "@/lib/calls/service";
import { normalizeServerLocale } from "@/lib/i18n/serverMessages";

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

/**
 * SOL-CALL-01 — nõusolekuotsuse vastus ei tohi väita rohkem, kui teenusekiht tõendas.
 *
 * Withdraw ja decline vastasid mõlemad tingimusteta `ok: true`, ka siis, kui
 * `discardActiveRecording()` ei suutnud egress'i peatumist kinnitada. Inimene sai
 * kinnituse, et salvestamine lõppes, samal ajal kui see võis jätkuda.
 *
 * ÜKS koht, sest withdraw ja decline on sama voog kahe nupu all. Kaks koopiat
 * lahkneksid esimese muudatusega ja üks pool jääks valetama — täpselt see muster,
 * mille SOL-RAGADMIN-04 juba ühe korra maha võttis.
 *
 * 202, mitte 4xx: nõusoleku tagasivõtt ISE õnnestus (rida on WITHDRAWN). Lõpetamata
 * on ainult tõendus, et salvestamine peatus, ja see töö on järjekorras.
 */
export function consentDecisionJson({ outcome, call }) {
  if (outcome && outcome.providerStopConfirmed === false) {
    return callJson({
      ok: false,
      messageKey: "calls.recording_stop_unconfirmed",
      message: "calls.recording_stop_unconfirmed",
      recordingStopConfirmed: false,
      reconcileQueued: Boolean(outcome.reconcileQueued),
      call
    }, 202);
  }
  return callJson({ ok: true, call });
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
  const state = await loadCallState(prisma, callSessionId);
  if (!state) return null;
  const runtime = getCallRuntimeConfig();
  return serializeCallSession(state.call, {
    participants: state.participants,
    speakRequests: state.speakRequests,
    recording: state.recording,
    providerAvailable: runtime.callServiceConfigured,
    providerKey: runtime.providerKey
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

// Salvestuse nõusolekukirje keel. Vaikimisi `et`, mitte `en` — kogu senine
// kirjevaru on eestikeelne ja tundmatu keel ei tohi teda ümber sildistada.
export function callRequestLocale(request) {
  const url = request?.url ? new URL(request.url) : null;
  const fromQuery = normalizeServerLocale(url?.searchParams?.get("locale"));
  if (fromQuery) return fromQuery;
  return (
    normalizeServerLocale(request?.headers?.get("x-ui-locale")) ||
    normalizeServerLocale(request?.headers?.get("x-locale")) ||
    normalizeServerLocale(request?.headers?.get("accept-language")) ||
    "et"
  );
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
  /* SOL-CALL-06: kustutus ei õnnestunud ja rida jäi `DELETE_PENDING`-iks. 503, sest
     see EI OLE kasutaja viga ega lõplik keeldumine — töö on pooleli ja retention
     proovib uuesti. 200 „ok" oleks siin vale väide tundliku heli kohta. */
  if (message === "call.recording_delete_failed") return { message, status: 503 };
  /* SOL-CALL-10: salvestusmaht. 413 on sama kood, mille annab dokumendi üleslaadimine
     kvoodi ületamisel — sama piir, sama vastus, et klient ei peaks kahte lugu õppima. */
  if (message === "call.recording_storage_quota_exceeded") return { message, status: 413 };
  if (message === "call.recording_too_large") return { message, status: 413 };
  // E3 (audit 13 K2): tundmatu viga logitakse serveripoolel ja maskitakse —
  // sisemine veatekst ei tohi lekkida kliendi messageKey'sse.
  console.error("[call route] unmapped error", error);
  return { message: "api.common.server_error", status: 500 };
}
