import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { cancelDataExport } from "@/lib/dataExport/service";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0", Pragma: "no-cache", Expires: "0" };
const json = (data, status = 200) => NextResponse.json(data, { status, headers });

export async function DELETE(_request, { params }) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return json({ ok: false, messageKey: "api.common.unauthorized" }, 401);
  const resolved = await params;
  try { return json({ ok: true, job: await cancelDataExport(userId, resolved?.id) }); }
  catch (error) {
    if (error?.status === 404) return json({ ok: false, messageKey: "api.common.not_found" }, 404);
    console.error("[data-export] cancel failed", safeError(error));
    return json({ ok: false, messageKey: "data_export.cancel_failed" }, 500);
  }
}
