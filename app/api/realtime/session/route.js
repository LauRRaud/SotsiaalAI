import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import {
  REALTIME_TRANSCRIPTION_MODEL,
  VOICE_SESSION_LIMIT_MS,
  VOICE_SESSION_LIMIT_SECONDS,
  buildRealtimeSessionConfig
} from "@/lib/chat/realtimeVoice";
import {
  createVoiceSettlementToken,
  realtimeSafetyIdentifier
} from "@/lib/chat/realtimeVoiceToken";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { providerAbortSignal } from "@/lib/net/providerRequest";
import {
  releaseUsageForRequest,
  reserveUsageForRequest,
  usageErrorDescriptor
} from "@/lib/usage/routeAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime/calls";
const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL
  || REALTIME_TRANSCRIPTION_MODEL;
const SESSION_CREATE_TIMEOUT_MS = 20_000;
const SESSION_RATE_LIMIT_MAX = 3;
const SESSION_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_SDP_CHARS = 80_000;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function json(body, status = 200, headers = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...NO_STORE_HEADERS, ...headers }
  });
}

function voiceSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function validSessionId(value) {
  return /^[a-zA-Z0-9_-]{16,96}$/.test(String(value || ""));
}

export async function POST(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) return json({ ok: false, messageKey: "api.common.unauthorized" }, 401);

  const roleState = resolveSessionRoleState(session, request.cookies);
  const gate = await requireSubscription(session, roleState.effectiveRole);
  if (!gate.ok) {
    return json({
      ok: false,
      messageKey: gate.message,
      redirect: gate.redirect,
      requireSubscription: gate.requireSubscription
    }, gate.status);
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  const secret = voiceSecret();
  if (!apiKey || !secret) {
    return json({ ok: false, messageKey: "api.common.service_unavailable" }, 503);
  }

  const ip = getRequestIpFromRequest(request);
  const rateLimit = consumeRateLimit(
    `realtime-voice:${session.user.id}:${ip}`,
    SESSION_RATE_LIMIT_MAX,
    SESSION_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) {
    return json({ ok: false, messageKey: "api.common.rate_limited" }, 429, {
      "Retry-After": String(rateLimit.retryAfterSec)
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, messageKey: "api.common.invalid_request" }, 400);
  }

  const sdp = String(payload?.sdp || "");
  const sessionId = String(payload?.sessionId || "");
  if (!sdp.startsWith("v=0") || sdp.length > MAX_SDP_CHARS || !validSessionId(sessionId)) {
    return json({ ok: false, messageKey: "api.common.invalid_request" }, 400);
  }

  let usageHandle = null;
  try {
    usageHandle = await reserveUsageForRequest({
      request,
      userId: session.user.id,
      metric: "STT_SECONDS",
      amount: VOICE_SESSION_LIMIT_SECONDS,
      scope: "realtime.voice",
      idempotencyKey: sessionId,
      metadata: {
        model: OPENAI_TRANSCRIBE_MODEL,
        maximumSeconds: VOICE_SESSION_LIMIT_SECONDS
      }
    });
  } catch (error) {
    const descriptor = usageErrorDescriptor(error, "realtime.voice");
    return json(descriptor.body, descriptor.status, descriptor.headers);
  }

  // Replaying one client key must not create another paid provider session.
  if (usageHandle.reused) {
    return json({ ok: false, messageKey: "api.common.conflict" }, 409);
  }

  try {
    const form = new FormData();
    form.set("sdp", sdp);
    form.set("session", JSON.stringify(buildRealtimeSessionConfig({
      locale: payload?.locale,
      transcriptionModel: OPENAI_TRANSCRIBE_MODEL
    })));

    const upstream = await fetch(OPENAI_REALTIME_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Safety-Identifier": realtimeSafetyIdentifier(session.user.id, secret)
      },
      body: form,
      signal: providerAbortSignal(request.signal, SESSION_CREATE_TIMEOUT_MS)
    });
    const answerSdp = await upstream.text();
    if (!upstream.ok || !answerSdp.startsWith("v=0")) {
      throw new Error(`realtime_session_${upstream.status}`);
    }

    const startedAt = Date.now();
    const expiresAt = startedAt + VOICE_SESSION_LIMIT_MS + 60_000;
    const settlementToken = createVoiceSettlementToken({
      userId: session.user.id,
      idempotencyKey: usageHandle.idempotencyKey,
      startedAt,
      expiresAt
    }, secret);

    return json({
      ok: true,
      sdp: answerSdp,
      settlementToken,
      limitMs: VOICE_SESSION_LIMIT_MS,
      expiresAt: new Date(expiresAt).toISOString()
    });
  } catch {
    await releaseUsageForRequest(usageHandle, { reason: "provider_error" }).catch(() => {});
    return json({ ok: false, messageKey: "api.common.service_unavailable" }, 503);
  }
}

