import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { deleteJourneyStep, updateJourneyStep } from "@/lib/journey/steps";
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

function failure(error, fallback, label) {
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error(`[journeys] ${label} failed`, safeError(error));
  return json(
    {
      ok: false,
      message: status >= 500 ? fallback : error?.message || fallback,
      ...(status < 500 && error?.field ? { field: error.field, limit: error.limit } : {})
    },
    status
  );
}

/** Muudab sammu või märgib selle tehtuks, ära jäetuks või uuesti tegemata. */
export async function PATCH(request, context) {
  const auth = await requireJourneyUser();
  if (!auth) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    return json({ ok: true, ...(await updateJourneyStep(auth.userId, params?.id, params?.stepId, body)) });
  } catch (error) {
    return failure(error, "journeys.errors.save_failed", "step update");
  }
}

/** Kustutab valesti lisatud sammu. */
export async function DELETE(_request, context) {
  const auth = await requireJourneyUser();
  if (!auth) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const params = await context?.params;
    return json({ ok: true, ...(await deleteJourneyStep(auth.userId, params?.id, params?.stepId)) });
  } catch (error) {
    return failure(error, "journeys.errors.delete_failed", "step delete");
  }
}
