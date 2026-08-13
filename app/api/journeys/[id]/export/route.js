import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { exportJourneyForUser } from "@/lib/journey/service";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "Content-Disposition": 'attachment; filename="teekond.json"',
  "X-Content-Type-Options": "nosniff"
};

export async function GET(_request, context) {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return NextResponse.json({ ok: false, message: "api.common.unauthorized" }, { status: 401 });
  try {
    const params = await context?.params;
    const value = await exportJourneyForUser(userId, params?.id);
    return new NextResponse(JSON.stringify(value, null, 2), { status: 200, headers: HEADERS });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[journeys] export failed", safeError(error));
    return NextResponse.json(
      { ok: false, message: error?.message || "journeys.errors.export_failed" },
      { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
    );
  }
}
