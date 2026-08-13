import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { buildJourneyDraft } from "@/lib/journey/draft";
import { safeError } from "@/lib/privacy/safeError";
import { enforceChatRateLimit } from "@/lib/chat-api-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
  Pragma: "no-cache",
  Expires: "0"
};

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: NO_STORE_HEADERS
  });
}

async function requireJourneyUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  return session?.user?.id ? session : null;
}

export async function POST(request) {
  const session = await requireJourneyUser();
  if (!session) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }
  const limited = enforceChatRateLimit(request, {
    scope: "journey_draft",
    userId: session.user.id,
    limit: 30,
    windowMs: 60 * 60 * 1000,
    messageKey: "journeys.errors.rate_limited"
  });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const draft = buildJourneyDraft(body);
    return json({
      ok: true,
      draft,
      persisted: false
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[journeys] draft failed", safeError(error));
    }
    return json({
      ok: false,
      message: error?.message || "journeys.errors.draft_failed",
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.field ? { field: error.field, limit: error.limit } : {})
    }, status);
  }
}
