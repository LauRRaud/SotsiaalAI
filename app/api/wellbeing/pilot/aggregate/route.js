import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth";
import {
  buildWellbeingExportDataset,
  exportWellbeingCsv
} from "@/lib/wellbeing/aggregateExport";
import {
  resolveWellbeingPilotAccess,
  resolveWellbeingPilotAggregateFilters
} from "@/lib/wellbeing/pilotAccess";
import { buildWellbeingPilotReport } from "@/lib/wellbeing/pilotReport";
import {
  exportWellbeingPilotReportHtml,
  exportWellbeingPilotReportXlsx
} from "@/lib/wellbeing/pilotReportExport";

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
    pilotId: url.searchParams.get("pilotId"),
    periodStart: url.searchParams.get("periodStart"),
    periodEnd: url.searchParams.get("periodEnd"),
    roleGroup: url.searchParams.get("roleGroup"),
    workflowType: url.searchParams.get("workflowType"),
    aggregationLevel: url.searchParams.get("aggregationLevel") || "role_group"
  };
}

export async function GET(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  const access = await resolveWellbeingPilotAccess(session);
  if (!access.ok) {
    return errorJson(access.message || "wellbeing.pilot.forbidden", access.status || 403);
  }

  let filters;
  try {
    filters = resolveWellbeingPilotAggregateFilters(filtersFromRequest(request), access);
  } catch (error) {
    return errorJson(error?.message || "wellbeing.pilot.forbidden", error?.status || 403);
  }

  const url = new URL(request.url);
  const format = String(url.searchParams.get("format") || "json").toLowerCase();
  const datasetOptions = filters.minimumGroupSize
    ? { env: { ...process.env, WELLBEING_MIN_GROUP_SIZE: String(filters.minimumGroupSize) } }
    : {};
  const dataset = await buildWellbeingExportDataset(filters, datasetOptions);
  const report = buildWellbeingPilotReport(dataset);

  if (format === "csv") {
    return new NextResponse(exportWellbeingCsv(dataset), {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"wellbeing-pilot-aggregate.csv\""
      }
    });
  }

  if (format === "report-html") {
    return new NextResponse(exportWellbeingPilotReportHtml(report, { dataset, filters }), {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": "inline; filename=\"wellbeing-pilot-report.html\""
      }
    });
  }

  if (format === "xlsx") {
    return new NextResponse(exportWellbeingPilotReportXlsx(report, { dataset, filters }), {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"wellbeing-pilot-report.xlsx\""
      }
    });
  }

  return json({
    ok: true,
    dataset,
    report,
    access: {
      allowedRoleGroups: access.allowedRoleGroups || [],
      pilotScopes: access.pilotScopes || []
    }
  });
}
