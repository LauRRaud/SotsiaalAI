export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { resolveServiceMapTarget } from "@/lib/serviceMap/targetResolver";

export async function GET(request) {
  const locale = localeFromRequest(request);
  try {
    const session = await getServerSession(authConfig);
    const url = new URL(request.url);
    const target = await resolveServiceMapTarget({
      userId: session?.user?.id || "",
      entryId: url.searchParams.get("entryId") || "",
      listing: url.searchParams.get("listing") || "",
      match: url.searchParams.get("match") || "",
      locale
    });
    if (!target) return errorJson("workspace_feature_pages.service_map.errors.target_not_public", 404, locale);
    return json({ ok: true, ...target });
  } catch (error) {
    console.error("[service-map] target resolve failed", safeError(error));
    return errorJson("workspace_feature_pages.service_map.errors.target_load_failed", 500, locale);
  }
}
