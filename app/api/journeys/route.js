import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { createJourneyForUser, listJourneysForUser } from "@/lib/journey/service";
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
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return null;
  return { session, userId };
}

export async function GET(request) {
  const auth = await requireJourneyUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }

  try {
    const url = new URL(request.url);
    const page = await listJourneysForUser(auth.userId, {
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit"),
      status: url.searchParams.get("status")
    });
    return json({ ok: true, journeys: page.items, page });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[journeys] list failed", safeError(error));
    return json({ ok: false, message: error?.message || "journeys.errors.load_failed" }, status);
  }
}

export async function POST(request) {
  const auth = await requireJourneyUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }
  const limited = enforceChatRateLimit(request, {
    scope: "journey_create",
    userId: auth.userId,
    limit: 30,
    windowMs: 60 * 60 * 1000,
    messageKey: "journeys.errors.rate_limited"
  });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const journey = await createJourneyForUser(auth.userId, body, {
      roleContext: auth.session?.user?.role || "CLIENT"
    });
    return json({ ok: true, journey }, 201);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[journeys] create failed", safeError(error));
    }
    return json({
      ok: false,
      message: error?.message || "journeys.errors.save_failed",
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.field ? { field: error.field, limit: error.limit } : {})
    }, status);
  }
}
