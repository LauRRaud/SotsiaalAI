import { ragRetiredPayload } from "@/lib/rag/retired";
import { NextResponse } from "next/server";

import { enforceChatRateLimit, readChatRateLimit } from "@/lib/chat-api-rate-limit";
import { requireResearchAuth } from "@/lib/research/auth";
import { listResearchJobsForOwner } from "@/lib/research/jobStore";
import { buildPaginationMeta, parseListLimit, parseListOffset } from "@/lib/documents/listing";

import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const RATE_LIMIT_WINDOW_MS = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_WINDOW_MS, 60_000, 1000);
const RATE_LIMIT_POST_MAX = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_POST_MAX, 12);
const RATE_LIMIT_LIST_MAX = readChatRateLimit(process.env.RESEARCH_RATE_LIMIT_LIST_MAX, 60);
const RESEARCH_API_ENABLED = false;

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
      intentKey: requestUrl.searchParams.get("intentKey"),
      activeOnly: String(requestUrl.searchParams.get("status") || "").trim().toLowerCase() === "active",
      search: requestUrl.searchParams.get("search")
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
  const auth = await requireResearchAuth();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  const limited = enforceChatRateLimit(req, { scope: "research_create", userId: auth.userId, limit: RATE_LIMIT_POST_MAX, windowMs: RATE_LIMIT_WINDOW_MS });
  if (limited) return limited;
  return json(ragRetiredPayload(), 503);
}
