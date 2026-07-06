import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function disabledStatus() {
  return {
    ok: true,
    disabled: true,
    reason: "kov_source_monitor_filesystem_disabled",
    sourceFiles: 0,
    reportExists: false,
    report: {
      generatedAt: null,
      appliedAt: null,
      checkedUrls: 0,
      fetchedOk: 0,
      fetchedFailed: 0,
      changedSources: 0,
      baselineMissing: 0,
      candidatesWritten: 0,
      reportFile: "KOV/kov_web_sources_kontroll.report.json",
      items: []
    }
  };
}

async function loadSourceMonitorService() {
  if (process.env.KOV_SOURCE_MONITOR_FILESYSTEM_ENABLED !== "1") return null;
  const importService = Function("specifier", "return import(specifier)");
  return importService("@/lib/admin/rag/kovSourceMonitor/service");
}

export async function GET(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const service = await loadSourceMonitorService();
    if (!service) return json(disabledStatus());
    return json(await service.getKovWebSourcesStatus());
  } catch (error) {
    console.error("[kov-source-monitor] status failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}

export async function POST(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const service = await loadSourceMonitorService();
    if (!service) {
      return errorJson("api.admin.kov.update_failed", 503, auth.locale, {
        message: "KOV veebiallikate failisüsteemi seire on productionis vaikimisi välja lülitatud.",
        reason: "kov_source_monitor_filesystem_disabled"
      });
    }
    const action = String(body?.action || "web-check");
    const result = action === "apply-check"
      ? await service.applyKovWebSourcesCheck()
      : await service.checkKovWebSourcesFromWeb({
          maxUrls: Number(body?.maxUrls || 0) || 0,
          slug: String(body?.slug || "").trim().toLowerCase()
        });
    const status = await service.getKovWebSourcesStatus();
    return json({
      ok: true,
      action,
      result,
      status
    });
  } catch (error) {
    console.error("[kov-source-monitor] action failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}
