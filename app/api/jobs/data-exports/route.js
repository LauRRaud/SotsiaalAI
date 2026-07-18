import { NextResponse } from "next/server";
import { assertRetentionAccess } from "@/lib/retention";
import { runNextDataExport } from "@/lib/dataExport/service";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export async function POST(request) {
  const access = await assertRetentionAccess(request);
  if (!access.ok) return NextResponse.json({ ok: false, messageKey: "api.common.unauthorized" }, { status: access.status || 401 });
  try { return NextResponse.json({ ok: true, job: await runNextDataExport() }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("[data-export] worker failed", safeError(error)); return NextResponse.json({ ok: false, messageKey: "data_export.worker_failed" }, { status: 500 }); }
}
