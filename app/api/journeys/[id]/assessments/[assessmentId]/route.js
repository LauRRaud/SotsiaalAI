import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { deleteJourneyAssessment } from "@/lib/journey/assessments";
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

/** Kustutab valesti pandud märke. Ainult Teekonna omanik. */
export async function DELETE(_request, context) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const params = await context?.params;
    return json({ ok: true, ...(await deleteJourneyAssessment(userId, params?.id, params?.assessmentId)) });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[journeys] assessment delete failed", safeError(error));
    return json({ ok: false, message: status >= 500 ? "journeys.errors.delete_failed" : error?.message || "journeys.errors.delete_failed" }, status);
  }
}
