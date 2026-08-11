export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { requireSubscription, resolveSessionRoleState } from "@/lib/authz";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";
import {
  DEFAULT_ANALYZE_ALLOWED_MIME_CSV,
  DEFAULT_ANALYZE_MAX_UPLOAD_MB,
  readAnalyzeMaxUploadMb,
  resolveAnalyzeMimeType
} from "@/lib/chat/analyzeFileConfig";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { safeError } from "@/lib/privacy/safeError";
import { RAG_SERVICE_KEY } from "@/lib/server/ragAuth";
import {
  commitUsageForRequest,
  releaseUsageForRequest,
  reserveUsageForRequest,
  usageErrorDescriptor
} from "@/lib/usage/routeAdapter";

const MAX_MB = readAnalyzeMaxUploadMb(
  process.env.RAG_SERVER_MAX_MB || process.env.RAG_MAX_UPLOAD_MB || process.env.NEXT_PUBLIC_RAG_MAX_UPLOAD_MB,
  DEFAULT_ANALYZE_MAX_UPLOAD_MB
);
const RAW_ALLOWED_MIME = String(
  process.env.RAG_ALLOWED_MIME ||
    process.env.RAG_SERVER_ALLOWED_MIME ||
    process.env.NEXT_PUBLIC_RAG_ALLOWED_MIME ||
    DEFAULT_ANALYZE_ALLOWED_MIME_CSV
);
const ALLOWED_MIME = new Set(
  RAW_ALLOWED_MIME.split(",")
    .map(v => v.trim().toLowerCase())
    .filter(Boolean)
);
const RAW_RAG_HOST = (process.env.RAG_INTERNAL_HOST || "127.0.0.1:8000").trim();
const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS || 30_000);
const ALLOW_EXTERNAL = process.env.ALLOW_EXTERNAL_RAG === "1";
const LOCAL_HOST_RE = /^(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?$/i;
const CHAT_RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.CHAT_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const CHAT_ANALYZE_FILE_POST_RATE_LIMIT_MAX = readChatRateLimit(process.env.CHAT_RATE_LIMIT_ANALYZE_FILE_POST_MAX, 15);
const CHAT_ANALYZE_MAX_CHUNKS = readChatRateLimit(process.env.CHAT_ANALYZE_MAX_CHUNKS, 80, 1);

function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, {
    status,
    headers: { ...CHAT_NO_STORE_HEADERS, ...extraHeaders }
  });
}

function localeFromRequest(req) {
  const url = new URL(req.url);
  const fromQuery = normalizeServerLocale(url.searchParams.get("locale") || url.searchParams.get("lang"));
  if (fromQuery) return fromQuery;
  const fromHeader =
    normalizeServerLocale(req.headers.get("x-ui-locale")) ||
    normalizeServerLocale(req.headers.get("x-locale")) ||
    normalizeServerLocale(req.headers.get("accept-language"));
  return fromHeader || "en";
}

function errorJson(messageKey, status, locale = "en", extras = {}, extraHeaders = {}) {
  const translated = serverT(locale, messageKey, undefined, messageKey);
  return json({
    ok: false,
    messageKey,
    message: translated,
    ...extras
  }, status, extraHeaders);
}

function usageErrorJson(error, scope, locale) {
  const descriptor = usageErrorDescriptor(error, scope);
  return errorJson(
    descriptor.body.messageKey,
    descriptor.status,
    locale,
    descriptor.body,
    descriptor.headers
  );
}

function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function isLocalBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return LOCAL_HOST_RE.test(parsed.host);
  } catch {
    return false;
  }
}

async function callRagAnalyze(formData) {
  if (!RAG_SERVICE_KEY) throw new Error("api.chat.analyze.rag_key_missing");

  const base = normalizeBaseFromHost(RAW_RAG_HOST);
  if (!ALLOW_EXTERNAL && !isLocalBaseUrl(base)) {
    throw new Error("api.chat.analyze.rag_host_external_denied");
  }

  const headers = new Headers();
  headers.set("X-API-Key", RAG_SERVICE_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS);

  try {
    const res = await fetch(`${base}/analyze`, {
      method: "POST",
      headers,
      body: formData,
      cache: "no-store",
      signal: controller.signal
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const messageKey = data?.messageKey || data?.message || "api.chat.analyze.rag_service_failed";
      const err = new Error(messageKey);
      err.status = res.status;
      err.payload = data;
      throw err;
    }

    return data || {};
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("api.chat.analyze.service_unavailable");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  if (!session?.user?.id) {
    return errorJson("api.common.unauthorized", 401, locale);
  }
  const rateLimitResponse = enforceChatRateLimit(request, {
    scope: "analyze_file_post",
    userId: session.user.id,
    limit: CHAT_ANALYZE_FILE_POST_RATE_LIMIT_MAX,
    windowMs: CHAT_RATE_LIMIT_WINDOW_MS
  });
  if (rateLimitResponse) return rateLimitResponse;

  const roleState = resolveSessionRoleState(session, request.cookies);
  const role = roleState.effectiveRole;
  const gate = await requireSubscription(session, role);
  if (!gate.ok) {
    return json({
      ok: false,
      messageKey: gate.message,
      message: serverT(locale, gate.message, undefined, gate.message),
      redirect: gate.redirect,
      requireSubscription: gate.requireSubscription
    }, gate.status);
  }

  let fd;
  try {
    fd = await request.formData();
  } catch {
    return errorJson("api.chat.analyze.multipart_required", 400, locale);
  }

  const file = fd.get("file");
  if (!file || typeof file === "string") {
    return errorJson("api.chat.analyze.file_required", 400, locale);
  }

  const sizeMB = (file.size || 0) / (1024 * 1024);
  if (sizeMB > MAX_MB) {
    return errorJson("api.chat.analyze.file_too_large", 413, locale, {
      sizeMB: Number(sizeMB.toFixed(1)),
      maxMB: MAX_MB
    });
  }

  const mimeTypeRaw = fd.get("mimeType");
  const resolvedMimeType = resolveAnalyzeMimeType({
    mimeTypeFromRequest: typeof mimeTypeRaw === "string" ? mimeTypeRaw : "",
    mimeTypeFromFile: String(file?.type || ""),
    fileName: file?.name || "",
    allowedMime: [...ALLOWED_MIME]
  });
  if (!resolvedMimeType) {
    return errorJson("api.chat.analyze.mime_not_allowed", 415, locale);
  }

  const userId = String(session.user.id);
  const rawIdempotencyKey = fd.get("idempotencyKey");
  let usageHandle = null;

  try {
    usageHandle = await reserveUsageForRequest({
      request,
      userId,
      metric: "FILE_ANALYZE",
      scope: "chat.analyze_file",
      idempotencyKey: typeof rawIdempotencyKey === "string" ? rawIdempotencyKey : null,
      metadata: { mimeType: resolvedMimeType, sizeBytes: Number(file.size || 0) }
    });
  } catch (e) {
    return usageErrorJson(e, "chat.analyze_file", locale);
  }

  const forward = new FormData();
  forward.append("file", file, file.name || "file");

  forward.append("mimeType", resolvedMimeType);

  const maxChunksRaw = fd.get("maxChunks");
  let maxChunks = CHAT_ANALYZE_MAX_CHUNKS;
  if (typeof maxChunksRaw === "string" && maxChunksRaw.trim()) {
    const parsed = Number(maxChunksRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      maxChunks = Math.min(Math.floor(parsed), CHAT_ANALYZE_MAX_CHUNKS);
    }
  }
  forward.append("maxChunks", String(maxChunks));

  /* SOL-CHAT-08 — TULEMUS EI TOHI COMMIT'I VEA TAGA KADUDA.
     Vana järjekord: analüüs valmis → „valmis" lipp tõeseks → commit → commit'i viga läks
     `catch`-i, kus vabastust EI tehtud (lipp oli juba tõene) ja kasutajale läks analüüsi asemel
     VIGA. Fail oli välisteenuses juba edukalt töödeldud, tulemus visati ära ja reservatsioon jäi
     kinni. `lib/usage/paidResult.js` teine piir ütleb siin täpselt vastupidist: tasu enda viga ei
     vabasta midagi JA ei tühista tulemust — reservatsioon jääb RESERVED-iks, mille sama võtmega
     korduskatse commit'ib või mille aegumise korral reaper tagastab.

     Miks tulemust ei püsistata serveris (kriteeriumi „taastatav serveripoolne tulemus"): analüüs
     on lepingu järgi EFEMEERNE (`privacy.ephemeral`), tema sisu on kasutaja dokument ja teda ei
     hoita serveris. Taastatavus on siin lahendatud kavatsuse võtmega: kordus taaskasutab SAMA
     reservatsiooni, seega teist ühikut ei võeta. Faili uuesti parsimist see ei väldi — see on
     teadlik hind privaatsuse eest ja mitte tähelepanematus. */
  let data;
  try {
    data = await callRagAnalyze(forward);
  } catch (e) {
    console.error("[analyze-file] RAG analyze error:", safeError(e));
    if (usageHandle) {
      try {
        await releaseUsageForRequest(usageHandle, { reason: "file_analysis_failed" });
      } catch (releaseError) {
        console.error("[analyze-file] usage release failed:", safeError(releaseError));
      }
    }
    const status = Number(e?.status) || 502;
    return errorJson(e?.message || "api.chat.analyze.service_unavailable", status, locale);
  }

  try {
    await commitUsageForRequest(usageHandle);
  } catch (commitError) {
    // Teadlikult ilma vabastuseta ja ilma veata kasutajale: tulemus on olemas ja kuulub talle.
    console.error("[analyze-file] usage commit failed:", safeError(commitError));
  }

  return json({
    ...(data && typeof data === "object" ? data : {}),
    ok: true,
    privacy: {
      ephemeral: true,
      noteKey: "api.chat.analyze.privacy_ephemeral"
    }
  });
}
