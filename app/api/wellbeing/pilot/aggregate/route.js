import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth";
import { safeError } from "@/lib/privacy/safeError";
import { isWellbeingDomainError, newWellbeingCorrelationId, WELLBEING_UNEXPECTED_ERROR } from "@/lib/wellbeing/apiErrors";
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

/* SOL-WB-11: ligipääsu- ja skoobivead on tuntud domeenivead ja tohivad oma võtme
   välja anda; kõik muu (nt Prisma erind skoopide lugemisel) on ootamatu ja
   annab fikseeritud võtme koos korrelatsiooni-ID-ga. Vahet teeb `isWellbeingDomainError`,
   mitte see, kas erindil juhtus `message` olema. */
function accessErrorJson(error) {
  if (isWellbeingDomainError(error)) {
    return errorJson(error.message, Number(error.status));
  }
  const correlationId = newWellbeingCorrelationId();
  console.error("[wellbeing] pilot aggregate failed", safeError(error, { correlationId }));
  return json({ ok: false, message: WELLBEING_UNEXPECTED_ERROR, correlationId }, 500);
}

function filtersFromRequest(request) {
  const url = new URL(request.url);
  return {
    pilotId: url.searchParams.get("pilotId"),
    /* SOL-WB-06: periood on valik fikseeritud võrgust. Vabad `periodStart`/
       `periodEnd` võetakse teadlikult VASTU ja lükatakse tagasi 400-ga —
       vaikne ignoreerimine tähendaks, et vana klient saab teistsuguse valimi
       kui ta küsis, ilma et keegi seda ütleks. */
    periodStart: url.searchParams.get("periodStart"),
    periodEnd: url.searchParams.get("periodEnd"),
    periodKind: url.searchParams.get("periodKind"),
    periodYear: url.searchParams.get("periodYear"),
    periodIndex: url.searchParams.get("periodIndex"),
    roleGroup: url.searchParams.get("roleGroup"),
    workflowType: url.searchParams.get("workflowType"),
    /* SOL-WB-04: ühik on päringu osa, mitte konstant. Ilma selleta oleks
       vaikeväärtuse vahetus teinud sagedusvaate kättesaamatuks — „record jääb
       alles" peab tähendama, et teda saab küsida. Tundmatu väärtus annab 400
       (vt `normalizeWellbeingAnalysisUnit`), sest vaikne tagasilangus annaks
       kliendile teise vaate sama nime all. */
    analysisUnit: url.searchParams.get("analysisUnit"),
    aggregationLevel: url.searchParams.get("aggregationLevel") || "role_group"
  };
}

export async function GET(request) {
  const session = await getServerSession(authConfig).catch(() => null);
  let access;
  let filters;
  try {
    access = await resolveWellbeingPilotAccess(session);
    if (!access.ok) {
      return errorJson(access.message || "wellbeing.pilot.forbidden", access.status || 403);
    }
    filters = resolveWellbeingPilotAggregateFilters(filtersFromRequest(request), access);
  } catch (error) {
    return accessErrorJson(error);
  }

  const url = new URL(request.url);
  const format = String(url.searchParams.get("format") || "json").toLowerCase();
  const datasetOptions = filters.minimumGroupSize
    ? { env: { ...process.env, WELLBEING_MIN_GROUP_SIZE: String(filters.minimumGroupSize) } }
    : {};
  /* Koondi arvutamine oli varem KOGU try-plokist väljas: Prisma tõrge siin
     lendas käsitlemata välja. Sama värav kehtib ka temale. */
  let dataset;
  let report;
  try {
    dataset = await buildWellbeingExportDataset(filters, datasetOptions);
    report = buildWellbeingPilotReport(dataset);
  } catch (error) {
    return accessErrorJson(error);
  }

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
