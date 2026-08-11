import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { requireResearchAuth } from "@/lib/research/auth";
import { claimResearchJobForIntent, getActiveResearchJobCount, listResearchJobsForOwner } from "@/lib/research/jobStore";
import { buildPaginationMeta, parseListLimit, parseListOffset } from "@/lib/documents/listing";
import { runDeepResearchJob } from "@/lib/research/pipeline";
import { safeError } from "@/lib/privacy/safeError";
import {
  releaseUsageForRequest,
  reserveUsageForRequest,
  usageErrorDescriptor
} from "@/lib/usage/routeAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const RATE_LIMIT_POST_MAX = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_POST_MAX, 12);
const RATE_LIMIT_LIST_MAX = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_LIST_MAX, 60);
const RESEARCH_API_ENABLED_RAW = String(process.env.RESEARCH_API_ENABLED || "").trim().toLowerCase();
const RESEARCH_API_ENABLED = RESEARCH_API_ENABLED_RAW
  ? ["true", "1", "yes", "on"].includes(RESEARCH_API_ENABLED_RAW)
  : process.env.NODE_ENV !== "production";
const RESEARCH_JOB_MODE = String(process.env.RESEARCH_JOB_MODE || process.env.RESEARCH_RUNNER_MODE || "inline")
  .trim()
  .toLowerCase();
const AGENT_RAG_COLLECTION_ID = String(process.env.AGENT_RAG_COLLECTION_ID || "agent_documents")
  .trim()
  .toLowerCase();
const PRIVATE_AGENT_RAG_COLLECTION_IDS = new Set(["agent_documents", AGENT_RAG_COLLECTION_ID]);

function json(data, status = 200, extraHeaders = {}) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Authorization",
      ...extraHeaders,
    },
  });
}

function errorJson(messageKey, status = 400, extras = {}, extraHeaders = {}) {
  return json(
    {
      ok: false,
      messageKey,
      message: messageKey,
      ...extras,
    },
    status,
    extraHeaders
  );
}

function usageErrorJson(error, scope) {
  const descriptor = usageErrorDescriptor(error, scope);
  return errorJson(descriptor.body.messageKey, descriptor.status, descriptor.body, descriptor.headers);
}

function isPlausibleConversationId(id) {
  if (!id || typeof id !== "string") return false;
  if (id.length < 8 || id.length > 200) return false;
  return /^[A-Za-z0-9._\-:+]+$/.test(id);
}

function normalizeGeo(rawGeo = {}) {
  const levelRaw = String(rawGeo?.level || "ALL").trim().toUpperCase();
  const level =
    levelRaw === "NATIONAL" || levelRaw === "MUNICIPALITY" || levelRaw === "DISTRICT"
      ? levelRaw
      : "ALL";
  return {
    level,
    country: String(rawGeo?.country || "EE")
      .trim()
      .toUpperCase()
      .slice(0, 2),
    municipality_id: String(rawGeo?.municipality_id || rawGeo?.municipalityId || "")
      .trim()
      .slice(0, 120),
    municipality_name: String(rawGeo?.municipality_name || rawGeo?.municipalityName || "")
      .trim()
      .slice(0, 160),
    district_id: String(rawGeo?.district_id || rawGeo?.districtId || "")
      .trim()
      .slice(0, 120),
    district_name: String(rawGeo?.district_name || rawGeo?.districtName || "")
      .trim()
      .slice(0, 160),
  };
}

function normalizeFocus(raw) {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map(item => String(item || "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8)
    )
  );
}

function normalizeOutputStyle(rawStyle, authRole) {
  const value = String(rawStyle || "").trim().toUpperCase();
  if (value === "SOCIAL_WORKER" || value === "CLIENT") return value;
  return authRole === "SOCIAL_WORKER" ? "SOCIAL_WORKER" : "CLIENT";
}

// Owner-scoped list of the caller's own research jobs for the unified "My documents"
// workspace (E3). Reading past jobs is allowed even when creating new ones is disabled
// (RESEARCH_API_ENABLED off) — the `enabled` flag lets the UI show an honest "cannot start
// new research right now" state without hiding the objects the user already has.
export async function GET(req) {
  // Oma tööde loend ei sõltu tellimusest (SOL-RES-01) — uue töö käivitamine allpool jääb värava taha.
  const auth = await requireResearchAuth({ allowWithoutSubscription: true });
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, {
      requireSubscription: auth.requireSubscription,
      redirect: auth.redirect,
    });
  }

  const rateLimit = enforceChatRateLimit(req, {
    scope: "research_list",
    userId: auth.userId,
    limit: RATE_LIMIT_LIST_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (rateLimit) return rateLimit;

  const requestUrl = new URL(req.url);
  const limit = parseListLimit(requestUrl.searchParams.get("limit"), { fallback: 20, maxLimit: 100 });
  const offset = parseListOffset(requestUrl.searchParams.get("offset"));

  let listing;
  try {
    listing = await listResearchJobsForOwner({
      userId: auth.userId,
      limit,
      offset,
      // SOL-RES-07: vestluse avamisel küsib klient just selle vestluse aktiivset tööd.
      convId: requestUrl.searchParams.get("convId"),
      activeOnly: String(requestUrl.searchParams.get("status") || "").trim().toLowerCase() === "active"
    });
  } catch (error) {
    console.error("[research] list failed", safeError(error));
    return errorJson("research.error.failed", 500);
  }

  return json({
    ok: true,
    enabled: RESEARCH_API_ENABLED,
    jobs: listing.jobs,
    pagination: buildPaginationMeta({ total: listing.total, limit, offset }),
  });
}

export async function POST(req) {
  if (!RESEARCH_API_ENABLED) {
    return errorJson("research.error.disabled", 404);
  }

  const auth = await requireResearchAuth();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, {
      requireSubscription: auth.requireSubscription,
      redirect: auth.redirect,
    });
  }

  const rateLimit = enforceChatRateLimit(req, {
    scope: "research_post",
    userId: auth.userId,
    limit: RATE_LIMIT_POST_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  if (rateLimit) return rateLimit;

  let payload;
  try {
    payload = await req.json();
  } catch {
    return errorJson("chat.error.invalid_json", 400);
  }

  const query = String(payload?.query || "").trim();
  if (!query) return errorJson("chat.error.message_required", 400);
  if (query.length > 6000) return errorJson("research.error.query_too_long", 400);

  const convIdRaw = String(payload?.convId || payload?.conv_id || "").trim();
  const convId = convIdRaw && isPlausibleConversationId(convIdRaw) ? convIdRaw : null;
  if (convIdRaw && !convId) return errorJson("chat.error.invalid_conv_id", 400);

  const roomId = String(payload?.roomId || payload?.room_id || "").trim();
  if (roomId) return errorJson("research.error.room_not_supported", 400);

  const uiLocale = String(payload?.uiLocale || payload?.ui_locale || "et")
    .trim()
    .toLowerCase();
  const profile = String(payload?.profile || "standard").trim().toLowerCase() === "light" ? "light" : "standard";
  const outputStyle = normalizeOutputStyle(payload?.output_style || payload?.outputStyle, auth.role);
  const collectionIds = Array.isArray(payload?.collection_ids)
    ? payload.collection_ids
        .map(v => String(v || "").trim())
        .filter(Boolean)
        .filter(v => !PRIVATE_AGENT_RAG_COLLECTION_IDS.has(v.toLowerCase()))
        .slice(0, 3)
    : [];
  const activeJobCount = await getActiveResearchJobCount(auth.userId);
  if (activeJobCount > 0) {
    return errorJson("api.common.rate_limited", 429, {
      scope: "research_active_job",
      limit: 1,
      used: activeJobCount
    });
  }

  const normalizedPayload = {
    mode: "deep_research",
    sources: "rag_only",
    query,
    profile,
    focus: normalizeFocus(payload?.focus),
    collection_ids: collectionIds,
    geo: normalizeGeo(payload?.geo || {}),
    output_style: outputStyle,
    ui_locale: uiLocale,
    convId,
    persist: Boolean(payload?.persist ?? true),
    userId: auth.userId,
    userRole: auth.role,
  };

  let usageHandle = null;
  try {
    usageHandle = await reserveUsageForRequest({
      request: req,
      userId: auth.userId,
      metric: "DEEP_RESEARCH_RUN",
      scope: "research.run",
      idempotencyKey: payload?.idempotencyKey,
      metadata: { profile, outputStyle, collectionCount: collectionIds.length }
    });
  } catch (error) {
    return usageErrorJson(error, "research.run");
  }

  normalizedPayload.usageIdempotencyKey = usageHandle.idempotencyKey;

  // SOL-RES-02: kliendi kavatsuse võti seob nüüd reservatsiooni JA töö. Sama võtmega korduskatse
  // tagastab olemasoleva töö (ka lõppenu), mitte ei käivita uut tasulist jooksu.
  let job;
  let reusedIntent = false;
  try {
    const claim = await claimResearchJobForIntent({
      userId: auth.userId,
      payload: normalizedPayload,
      clientIntentKey: payload?.idempotencyKey,
    });
    job = claim.job;
    reusedIntent = claim.outcome === "reused";
  } catch (error) {
    if (error?.code === "INTENT_CONFLICT") {
      try {
        await releaseUsageForRequest(usageHandle, { reason: "research_intent_conflict" });
      } catch (releaseError) {
        console.error("[research] usage release failed", safeError(releaseError));
      }
      return errorJson("research.error.intent_conflict", 409);
    }
    try {
      await releaseUsageForRequest(usageHandle, { reason: "research_job_create_failed" });
    } catch (releaseError) {
      console.error("[research] usage release failed", safeError(releaseError));
    }
    if (error?.code === "ACTIVE_JOB_LIMIT") {
      return errorJson("api.common.rate_limited", 429, {
        scope: "research_active_job",
        limit: 1,
        used: await getActiveResearchJobCount(auth.userId)
      });
    }
    console.error("[research] job create failed", safeError(error));
    return errorJson("research.error.failed", 503);
  }

  // Korduskatse ei ole uus päring: ei uut logirida ega uut jooksu.
  if (reusedIntent) {
    return json({ ok: true, id: job.id, status: job.status || "queued", reused: true });
  }

  prisma.chatLog.create({
    data: {
      event: "research_request",
      userId: auth.userId,
      role: auth.role,
      data: {
        queryLength: query.length,
        profile,
        outputStyle,
        collectionCount: collectionIds.length,
        focusCount: normalizedPayload.focus.length,
        convId,
        jobId: job.id
      }
    }
  }).catch(error => {
    try {
      console.error("[research] request log failed", safeError(error));
    } catch {}
  });

  if (RESEARCH_JOB_MODE !== "worker") {
    queueMicrotask(() => {
      runDeepResearchJob(job).catch(err => {
        try {
          console.error("[research][job] run failed", safeError(err));
        } catch {}
      });
    });
  }

  return json({
    ok: true,
    id: job.id,
    status: "queued",
  });
}
