import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import {
  buildHelpRequestProjectionFromJourney,
  partitionHelpRequestShareKeys
} from "@/lib/journey/helpRequestProjection";
import { getJourneyForUser } from "@/lib/journey/service";
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
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

async function requireJourneyUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  return userId ? { userId } : null;
}

export async function POST(request, context, deps = {}) {
  const requireUser = deps.requireJourneyUser || requireJourneyUser;
  const loadJourney = deps.getJourneyForUser || getJourneyForUser;
  const auth = await requireUser();
  if (!auth) return json({ ok: false, message: "api.common.unauthorized" }, 401);

  try {
    const body = await request.json().catch(() => ({}));
    const keys = partitionHelpRequestShareKeys(body?.shareKeys ?? body?.share ?? []);
    const params = await context?.params;
    const journey = await loadJourney(auth.userId, params?.id);
    const prefill = buildHelpRequestProjectionFromJourney(journey, {
      shareKeys: keys.confirmedKeys
    });
    return json({
      ok: true,
      prefill,
      persisted: false,
      shared: false,
      ignoredKeys: keys.ignoredKeys
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[journeys] help-request handoff failed", safeError(error));
    }
    return json({
      ok: false,
      message: error?.message || "journeys.errors.help_request_draft_failed"
    }, status);
  }
}
