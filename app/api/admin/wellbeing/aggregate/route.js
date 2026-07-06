import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import {
  buildWellbeingExportDataset,
  exportWellbeingCsv
} from "@/lib/wellbeing/aggregateExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff"
};

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: NO_STORE_HEADERS
  });
}

function errorJson(message, status = 400) {
  return json({ ok: false, message }, status);
}

function filtersFromRequest(request) {
  const url = new URL(request.url);
  return {
    periodStart: url.searchParams.get("periodStart"),
    periodEnd: url.searchParams.get("periodEnd"),
    roleGroup: url.searchParams.get("roleGroup"),
    workflowType: url.searchParams.get("workflowType"),
    aggregationLevel: url.searchParams.get("aggregationLevel") || "role_group"
  };
}

export async function GET(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  const authz = assertAdmin(session);
  if (!authz.ok) {
    return errorJson(authz.message || "api.common.forbidden", authz.status || 403);
  }

  const url = new URL(request.url);
  const format = String(url.searchParams.get("format") || "json").toLowerCase();
  const dataset = await buildWellbeingExportDataset(filtersFromRequest(request));

  if (format === "csv") {
    return new NextResponse(exportWellbeingCsv(dataset), {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"wellbeing-aggregate.csv\""
      }
    });
  }

  return json({ ok: true, dataset });
}
