import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { getJourneyForUser } from "@/lib/journey/service";
import { buildPreInquiryPrefillFromJourney } from "@/lib/journey/preInquiryHandoff";
import { safeError } from "@/lib/privacy/safeError";

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
  return { userId };
}

async function resolveParams(context) {
  return await context?.params;
}

export async function POST(request, context) {
  const auth = await requireJourneyUser();
  if (!auth) {
    return json({ ok: false, message: "api.common.unauthorized" }, 401);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const params = await resolveParams(context);
    const journey = await getJourneyForUser(auth.userId, params?.id);
    const prefill = buildPreInquiryPrefillFromJourney(journey, {
      shareKeys: body?.shareKeys || body?.share || []
    });
    return json({
      ok: true,
      prefill,
      persisted: false,
      shared: false
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[journeys] pre-inquiry handoff failed", safeError(error));
    }
    return json({ ok: false, message: error?.message || "journeys.errors.pre_inquiry_draft_failed" }, status);
  }
}
