import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { getJourneyForUser } from "@/lib/journey/service";
import { buildPlainLanguageReadingAid, canExplainJourneySummary } from "@/lib/journey/plainLanguageExplanation";
import { CHAT_NO_STORE_HEADERS } from "@/lib/chat/routeServerUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: CHAT_NO_STORE_HEADERS });
}

export async function POST(request, { params }, deps = {}) {
  const getSession = deps.getServerSession || (() => getServerSession(authConfig));
  const getJourney = deps.getJourneyForUser || getJourneyForUser;
  const session = await getSession().catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return json({ ok: false, messageKey: "api.common.unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  if (body?.confirmed !== true) return json({ ok: false, messageKey: "journeys.plain_language.confirmation_required" }, 400);
  const resolvedParams = await params;
  try {
    const journey = await getJourney(userId, resolvedParams?.id);
    if (!canExplainJourneySummary({ source: journey.summary, isOfficial: journey?.context?.isOfficial === true })) {
      return json({ ok: false, messageKey: "journeys.plain_language.not_available" }, 409);
    }
    return json({
      ok: true,
      source: { kind: "JOURNEY_SUMMARY", title: journey.title, updatedAt: journey.updatedAt },
      readingAid: buildPlainLanguageReadingAid(journey.summary)
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return json({ ok: false, messageKey: status === 404 ? "journeys.errors.not_found" : "journeys.plain_language.unavailable" }, status);
  }
}
