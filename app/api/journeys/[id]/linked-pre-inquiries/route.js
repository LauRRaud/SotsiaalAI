import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { getJourneyForUser, listLinkedPreInquiriesForJourney } from "@/lib/journey/service";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

export async function GET(request, context) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const params = await context?.params;
    await getJourneyForUser(userId, params?.id);
    const url = new URL(request.url);
    const page = await listLinkedPreInquiriesForJourney(userId, params?.id, {
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit")
    });
    return json({ ok: true, page });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[journeys] linked list failed", safeError(error));
    return json({ ok: false, message: error?.message || "journeys.errors.load_failed" }, status);
  }
}
