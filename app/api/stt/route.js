import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { logEvent } from "@/lib/chat/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { canSpendMonthlyBudget } from "@/lib/usageBudget";
import { readAudioDurationSecondsFromFile } from "@/lib/audio/duration";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STT_URL = process.env.STT_SERVER_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe";
const STT_RATE_LIMIT_WINDOW_MS = Number(process.env.STT_RATE_LIMIT_WINDOW_MS || 60_000);
const STT_RATE_LIMIT_MAX = Number(process.env.STT_RATE_LIMIT_MAX || 20);
const STT_MAX_AUDIO_MB = Number(process.env.STT_MAX_AUDIO_MB || 12);
const STT_MAX_AUDIO_BYTES = Math.max(1, Math.floor(STT_MAX_AUDIO_MB * 1024 * 1024));
const STT_MAX_REQUEST_BYTES = Number(process.env.STT_MAX_REQUEST_BYTES || Math.ceil(STT_MAX_AUDIO_BYTES * 1.2));
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0"
};

function isSupportedAudioMime(type) {
  const normalized = String(type || "").toLowerCase().trim();
  if (!normalized) return true;
  if (normalized.startsWith("audio/")) return true;
  return normalized === "video/webm" || normalized === "video/mp4";
}

function normalizeLanguage(locale) {
  const base = String(locale || "").toLowerCase().split("-")[0].trim();
  if (!base || base === "auto") return undefined;
  if (base.length === 2) return base;
  return undefined;
}

function localeFromRequest(req, fallback = "en") {
  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));
  return fromHeader || fallback;
}

function errorJson(messageKey, status, locale = "en", extras = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return NextResponse.json({
    ok: false,
    messageKey,
    message: translated,
    ...extras
  }, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function json(payload, status = 200, headers = {}) {
  return NextResponse.json(payload, {
    status,
    headers: {
      ...NO_STORE_HEADERS,
      ...headers
    }
  });
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRequestSize(req) {
  return toNullableNumber(req.headers.get("content-length"));
}

function buildPreflightBudgetIncrement({ usesExternalProvider, inputDurationSeconds }) {
  if (inputDurationSeconds != null && Number.isFinite(Number(inputDurationSeconds)) && Number(inputDurationSeconds) > 0) {
    return {
      sttRequests: 1,
      sttMinutes: Number(inputDurationSeconds) / 60
    };
  }

  if (usesExternalProvider) {
    return {
      sttRequests: 1
    };
  }

  return {
    sttRequests: 1,
    sttMinutes: 1
  };
}

export async function POST(req) {
  const uiLocale = localeFromRequest(req);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    return errorJson("api.common.unauthorized", 401, uiLocale);
  }

  const roleState = resolveSessionRoleState(session, req.cookies);
  const role = roleState.effectiveRole;
  const gate = await requireSubscription(session, role);
  if (!gate.ok) {
    return json({
      ok: false,
      messageKey: gate.message,
      message: serverT(uiLocale, gate.message, undefined, gate.message),
      redirect: gate.redirect,
      requireSubscription: gate.requireSubscription
    }, gate.status);
  }

  const ip = getRequestIpFromRequest(req);
  const limit = consumeRateLimit(`stt:${session.user.id}:${ip}`, STT_RATE_LIMIT_MAX, STT_RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return json({
      ok: false,
      messageKey: "api.stt.rate_limited",
      message: serverT(uiLocale, "api.stt.rate_limited", undefined, "api.stt.rate_limited")
    }, 429, {
      "Retry-After": String(limit.retryAfterSec)
    });
  }

  if (!STT_URL && !OPENAI_API_KEY) {
    return errorJson("api.stt.not_configured", 503, uiLocale);
  }
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > STT_MAX_REQUEST_BYTES) {
    return errorJson("api.stt.audio_too_large", 413, uiLocale, {
      maxMB: STT_MAX_AUDIO_MB
    });
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return errorJson("api.common.invalid_request", 400, uiLocale);
  }

  const file = form.get("audio");
  const locale = form.get("locale") || "auto";
  if (!file || typeof file === "string") {
    return errorJson("api.stt.audio_missing", 400, uiLocale);
  }
  if (!isSupportedAudioMime(file.type)) {
    return errorJson("api.stt.audio_format_unsupported", 415, uiLocale, {
      mimeType: file.type || null
    });
  }
  const fileSize = Number(file.size || 0);
  if (fileSize > STT_MAX_AUDIO_BYTES) {
    return errorJson("api.stt.audio_too_large", 413, uiLocale, {
      maxMB: STT_MAX_AUDIO_MB,
      sizeMB: Number((fileSize / (1024 * 1024)).toFixed(1))
    });
  }
  const inputDurationSeconds = await readAudioDurationSecondsFromFile(file);
  const usesExternalProvider = Boolean(STT_URL);
  const budgetCheck = await canSpendMonthlyBudget(
    session.user.id,
    buildPreflightBudgetIncrement({
      usesExternalProvider,
      inputDurationSeconds
    })
  );
  if (!budgetCheck.allowed) {
    return errorJson("api.common.monthly_budget_exceeded", 429, uiLocale, {
      budgetEur: budgetCheck.budgetEur,
      usedEur: budgetCheck.usedEur,
      remainingEur: budgetCheck.remainingEur
    });
  }

  if (STT_URL) {
    try {
      const fd = new FormData();
      fd.append("audio", file, file.name || "audio.webm");
      fd.append("locale", locale);

      const res = await fetch(STT_URL, {
        method: "POST",
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false || !data?.text) {
        throw new Error(data?.message || "api.stt.transcription_failed");
      }
      await logEvent("stt_request", {
        userId: session.user.id,
        role,
        provider: "external",
        locale: String(locale || "auto"),
        fileSizeBytes: fileSize,
        mimeType: file.type || null,
        textLength: String(data.text || "").length,
        durationSeconds: toNullableNumber(inputDurationSeconds)
      });

      return json({
        ok: true,
        text: data.text,
        language: data.language || locale,
        provider: "external"
      });
    } catch (err) {
      console.error("[stt] external provider failed", safeError(err));
      return errorJson(err?.message || "api.stt.service_error", 502, uiLocale);
    }
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
    const language = normalizeLanguage(locale);
    const startedAt = Date.now();
    const transcription = await client.audio.transcriptions.create({
      file,
      model: OPENAI_STT_MODEL,
      response_format: "json",
      ...(language ? { language } : {})
    });
    const text = String(transcription?.text || "").trim();
    if (!text) throw new Error("api.stt.transcription_failed");
    const usage = transcription?.usage;
    const usageType = String(usage?.type || "").trim() || null;
    const isTokenUsage = usageType === "tokens";
    const isDurationUsage = usageType === "duration";
    const measuredDurationSeconds =
      (isDurationUsage ? toNullableNumber(usage?.seconds) : null) ?? toNullableNumber(inputDurationSeconds);
    await logEvent("stt_cost_usage", {
      userId: session.user.id,
      role,
      provider: "openai",
      model: OPENAI_STT_MODEL,
      route: "api/stt",
      stage: "stt_transcribe",
      latency_ms: Date.now() - startedAt,
      request_size_bytes: readRequestSize(req),
      file_size_bytes: fileSize,
      duration_seconds: measuredDurationSeconds,
      text_chars: text.length,
      input_tokens: isTokenUsage ? toNullableNumber(usage?.input_tokens) : null,
      output_tokens: isTokenUsage ? toNullableNumber(usage?.output_tokens) : null,
      total_tokens: isTokenUsage ? toNullableNumber(usage?.total_tokens) : null,
      audio_tokens: isTokenUsage ? toNullableNumber(usage?.input_token_details?.audio_tokens) : null,
      text_tokens: isTokenUsage ? toNullableNumber(usage?.input_token_details?.text_tokens) : null,
      mime_type: file.type || null,
      language: String(language || locale || "auto"),
      usage_type: usageType,
      cost_read_directly: Boolean(usageType),
      cost_estimation_basis: usageType ? null : null
    });
    await logEvent("stt_request", {
      userId: session.user.id,
      role,
      provider: "openai",
      locale: String(language || locale || "auto"),
      fileSizeBytes: fileSize,
      mimeType: file.type || null,
      textLength: text.length,
      durationSeconds: measuredDurationSeconds
    });

    return json({
      ok: true,
      text,
      language: language || locale,
      provider: "openai"
    });
  } catch (err) {
    console.error("[stt] openai provider failed", safeError(err));
    return errorJson(err?.message || "api.stt.service_error", 502, uiLocale);
  }
}
