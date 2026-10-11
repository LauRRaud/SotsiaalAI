import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { closeJourneyForUser } from "@/lib/journey/service";
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

/**
 * Paneb Teekonna pausile või lõpetab selle inimese enda hinnanguga. Ainult
 * Teekonna omanik; võõras ja olematu on 404. Uuesti avamine käib nagu seni
 * (`PATCH /api/journeys/[id]` seisuga ACTIVE).
 */
export async function POST(request, context) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) return json({ ok: false, message: "api.common.unauthorized" }, 401);
  try {
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    return json({ ok: true, journey: await closeJourneyForUser(userId, params?.id, body) });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[journeys] closure failed", safeError(error));
    /* 5xx korral ei lähe välja midagi peale üldise võtme: algne teade võib kanda andmebaasi detaile. */
    return json(
      {
        ok: false,
        message: status >= 500 ? "journeys.errors.save_failed" : error?.message || "journeys.errors.save_failed",
        ...(status < 500 && error?.field ? { field: error.field, limit: error.limit } : {})
      },
      status
    );
  }
}
