import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { listDataExports, requestDataExport } from "@/lib/dataExport/service";
import { verifyCurrentProfilePassword } from "@/lib/profile/accountLifecycle";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
const headers = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" };
const json = (data, status = 200) => NextResponse.json(data, { status, headers });

async function authUser() {
  const session = await getServerSession(authConfig);
  return session?.user?.id ? String(session.user.id) : null;
}

export async function GET() {
  const userId = await authUser();
  if (!userId) return json({ ok: false, messageKey: "api.common.unauthorized" }, 401);
  try { return json({ ok: true, jobs: await listDataExports(userId) }); }
  catch (error) { console.error("[data-export] list failed", safeError(error)); return json({ ok: false, messageKey: "data_export.load_failed" }, 500); }
}

export async function POST(request) {
  const userId = await authUser();
  if (!userId) return json({ ok: false, messageKey: "api.common.unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user) return json({ ok: false, messageKey: "api.common.not_found" }, 404);
    // Step-up re-auth mirrors the T02 account-deletion contract: a PIN-holding
    // account must confirm the PIN, and a passwordless (session-only) account has
    // no second factor to step up to, exactly as deleteProfileForUser treats it.
    if (user.passwordHash) {
      const verified = await verifyCurrentProfilePassword({ operation: "data-export", userId, request, passwordHash: user.passwordHash, currentPassword: body?.currentPassword });
      if (!verified.ok) return json({ ok: false, messageKey: verified.reason === "rate_limited" ? "api.common.rate_limited" : verified.reason === "required" ? "profile.errors.current_pin_required" : "profile.errors.current_pin_invalid" }, verified.reason === "rate_limited" ? 429 : verified.reason === "required" ? 400 : 401);
    }
    const result = await requestDataExport(userId);
    return json({ ok: true, created: result.created, job: result.job }, result.created ? 202 : 200);
  } catch (error) { console.error("[data-export] request failed", safeError(error)); return json({ ok: false, messageKey: "data_export.request_failed" }, 500); }
}
