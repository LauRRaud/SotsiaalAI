import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { utcDayStart, secondsUntilUtcMidnight } from "@/lib/analyzeQuota";
import { requireResearchAuth } from "@/lib/research/auth";
import { createResearchJob, getActiveResearchJobCount } from "@/lib/research/jobStore";
import { getResearchDailyLimit } from "@/lib/research/guardrails";
import { runDeepResearchJob } from "@/lib/research/pipeline";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const RATE_LIMIT_POST_MAX = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_POST_MAX, 12);
const RESEARCH_API_ENABLED_RAW = String(process.env.RESEARCH_API_ENABLED || "").trim().toLowerCase();
const RESEARCH_API_ENABLED = RESEARCH_API_ENABLED_RAW
  ? ["true", "1", "yes", "on"].includes(RESEARCH_API_ENABLED_RAW)
  : process.env.NODE_ENV !== "production";
const RESEARCH_JOB_MODE = String(process.env.RESEARCH_JOB_MODE || process.env.RESEARCH_RUNNER_MODE || "inline")
  .trim()
  .toLowerCase();

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      Vary: "Authorization",
    },
  });
}

function errorJson(messageKey, status = 400, extras = {}) {
  return json(
    {
      ok: false,
      messageKey,
      message: messageKey,
      ...extras,
    },
    status
  );
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

  const dailyLimit = getResearchDailyLimit(auth.role);
  const dayStart = utcDayStart();
  try {
    const usedToday = await prisma.chatLog.count({
      where: {
        event: "research_request",
        userId: auth.userId,
        role: auth.role,
        createdAt: {
          gte: dayStart
        }
      }
    });

    if (usedToday >= dailyLimit) {
      const quotaError = new Error("research.error.daily_quota_exceeded");
      quotaError.code = "DAILY_QUOTA";
      quotaError.used = usedToday;
      throw quotaError;
    }
  } catch (error) {
    if (error?.code === "DAILY_QUOTA") {
      return errorJson("api.common.rate_limited", 429, {
        scope: "research_daily_quota",
        limit: dailyLimit,
        used: error.used,
        retryAfter: secondsUntilUtcMidnight()
      });
    }
    console.error("[research] quota log failed", safeError(error));
    return errorJson("research.error.failed", 503);
  }

  let job;
  try {
    job = await createResearchJob({
      userId: auth.userId,
      payload: normalizedPayload,
    });
  } catch (error) {
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
