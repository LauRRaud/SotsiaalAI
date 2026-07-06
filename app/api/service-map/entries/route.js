import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { listPublishedHelpMapEntries } from "@/lib/help";
import { listPublishedServiceMapEntries } from "@/lib/serviceProviderProfiles";
import { safeError } from "@/lib/privacy/safeError";
import { isAdmin } from "@/lib/authz";
import { readServiceMapEntriesQuery } from "@/lib/serviceMap/entriesQueryPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = localeFromRequest(request);

  try {
    const session = await getServerSession(authConfig).catch(() => null);
    const query = readServiceMapEntriesQuery(request, {
      canPreviewReviewEntries: isAdmin(session?.user)
    });
    const requestedType = String(query.type || "").trim().toUpperCase();
    const serviceOnlyTypes = new Set(["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT", "KOV_CONTACT", "SERVICE_PROVIDER", "SERVICES_CONTACTS"]);
    const helpOnlyTypes = new Set(["HELP_REQUEST", "HELP_OFFER", "HELP_LISTINGS"]);
    const shouldLoadServices = !requestedType || requestedType === "ALL" || serviceOnlyTypes.has(requestedType);
    const shouldLoadHelp = !requestedType || requestedType === "ALL" || helpOnlyTypes.has(requestedType);
    const [serviceEntries, helpEntries] = await Promise.all([
      shouldLoadServices ? listPublishedServiceMapEntries(query) : Promise.resolve([]),
      shouldLoadHelp
        ? listPublishedHelpMapEntries({
            ...query,
            locale,
            currentUserId: session?.user?.id || ""
          })
        : Promise.resolve([])
    ]);
    const entries = [...serviceEntries, ...helpEntries];
    return json({
      ok: true,
      entries
    });
  } catch (error) {
    console.error("[service-map] entries load failed", safeError(error));
    return errorJson("service_map.errors.load_failed", 500, locale);
  }
}
