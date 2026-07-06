import {
  applyKovContactRegistryCheck,
  checkKovContactRegistryFromWeb,
  getKovContactRegistryStatus,
  writeKovContactRegistryBaseline
} from "@/lib/admin/rag/contactRegistry/service";
import { errorJson, json, requireKovAdminSession } from "@/lib/admin/rag/kov/api";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  try {
    const status = await getKovContactRegistryStatus();
    return json(status);
  } catch (error) {
    console.error("[contact-registry] status failed", safeError(error));
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
    const action = String(body?.action || "web-check");
    let result;
    if (action === "apply-check") {
      result = await applyKovContactRegistryCheck({
        syncServiceMap: Boolean(body?.syncServiceMap)
      });
    } else if (action === "baseline") {
      result = await writeKovContactRegistryBaseline();
    } else {
      result = await checkKovContactRegistryFromWeb({
        maxUrls: Number(body?.maxUrls || 0) || 0
      });
    }
    const status = await getKovContactRegistryStatus();
    return json({
      ok: true,
      action,
      result,
      status
    });
  } catch (error) {
    console.error("[contact-registry] refresh failed", safeError(error));
    return errorJson("api.admin.kov.update_failed", 500, auth.locale);
  }
}
