import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth";
import { assertAdmin } from "@/lib/authz";
import { safeError } from "@/lib/privacy/safeError";
import {
  isWellbeingDomainError,
  newWellbeingCorrelationId,
  WELLBEING_UNEXPECTED_ERROR
} from "@/lib/wellbeing/apiErrors";
import { assertNoFreeFormPeriod, resolveWellbeingPeriod } from "@/lib/wellbeing/periodGrid";
import { normalizeWellbeingAnalysisUnit } from "@/lib/wellbeing/aggregate";
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

/* SOL-WB-06: sama perioodivõrk kehtib ka admini pinnal. Leid nimetas mõlemat
   marsruuti ja platvormiülene vaade ei ole differencing'i vastu immuunne —
   temas on rohkem inimesi, aga ka rohkem kitsaid alamrühmi. */
function filtersFromRequest(request) {
  const url = new URL(request.url);
  const selection = {
    periodStart: url.searchParams.get("periodStart"),
    periodEnd: url.searchParams.get("periodEnd"),
    periodKind: url.searchParams.get("periodKind"),
    periodYear: url.searchParams.get("periodYear"),
    periodIndex: url.searchParams.get("periodIndex")
  };
  assertNoFreeFormPeriod(selection);
  const period = resolveWellbeingPeriod(selection);
  return {
    periodKind: period.periodKind,
    periodLabel: period.label,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    roleGroup: url.searchParams.get("roleGroup"),
    workflowType: url.searchParams.get("workflowType"),
    /* SOL-WB-04: ühik on valitav ka admini pinnal — sama argument mis
       perioodivõrgul, leid nimetas mõlemat marsruuti. */
    analysisUnit: normalizeWellbeingAnalysisUnit(url.searchParams.get("analysisUnit")),
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
  /* SOL-WB-11: koondi arvutus oli täiesti katteta — Prisma või skeemi tõrge
     lendas käsitlemata välja. Vastus on nüüd fikseeritud võti koos
     korrelatsiooni-ID-ga, sisemine tekst jääb logisse. */
  let dataset;
  try {
    dataset = await buildWellbeingExportDataset(filtersFromRequest(request));
  } catch (error) {
    /* Perioodivalik ja muud tuntud domeenivead tohivad oma võtme välja anda —
       muidu paistaks „vale periood" serveriveana ja klient ei saaks teada, mida
       parandada. */
    if (isWellbeingDomainError(error)) {
      return json({
        ok: false,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }, Number(error.status));
    }
    const correlationId = newWellbeingCorrelationId();
    console.error("[wellbeing] admin aggregate failed", safeError(error, { correlationId }));
    return json({ ok: false, message: WELLBEING_UNEXPECTED_ERROR, correlationId }, 500);
  }

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
