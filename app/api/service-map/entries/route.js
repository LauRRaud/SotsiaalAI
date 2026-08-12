import { getServerSession } from "next-auth";

import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { listPublishedHelpMapEntries } from "@/lib/help";
import { listPublishedServiceMapEntries } from "@/lib/serviceProviderProfiles";
import { isAdmin } from "@/lib/authz";
import {
  decodeServiceMapCursor,
  encodeServiceMapCombinedCursor,
  readServiceMapEntriesQuery
} from "@/lib/serviceMap/entriesQueryPolicy";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { loadPeerServiceMapEntries } from "@/lib/serviceMap/peerAccess";
import { combineServiceMapSourceResults, isServiceMapAccessError, isServiceMapSourcePermissionError } from "@/lib/serviceMap/sourceResults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, deps = {}) {
  const locale = localeFromRequest(request);
  const getSession = deps.getSession || (() => getServerSession(authConfig));
  const loadServices = deps.loadServices || listPublishedServiceMapEntries;
  const loadPeerListings = deps.loadPeerListings || loadPeerServiceMapEntries;
  const applyRateLimit = deps.consumeRateLimit || consumeRateLimit;

  let session;
  try {
    session = await getSession();
  } catch {
    console.error("[service-map] auth dependency unavailable", { code: "SERVICE_MAP_AUTH_UNAVAILABLE" });
    return errorJson(
      "workspace_feature_pages.service_map.errors.load_failed",
      503,
      locale,
      { code: "SERVICE_MAP_AUTH_UNAVAILABLE", partial: false }
    );
  }

  try {
    const limiter = applyRateLimit(
      `service-map:entries:${session?.user?.id || "anonymous"}:${getRequestIpFromRequest(request)}`,
      90,
      60_000
    );
    if (!limiter.allowed) return errorJson("api.common.rate_limited", 429, locale);
    const query = readServiceMapEntriesQuery(request, {
      canPreviewReviewEntries: isAdmin(session?.user)
    });
    if (query.invalidCursor) return errorJson("workspace_feature_pages.service_map.errors.invalid_cursor", 400, locale);
    const requestedType = String(query.type || "").trim().toUpperCase();
    const serviceOnlyTypes = new Set(["KOV_SOCIAL_CONTACT", "KOV_GENERAL_CONTACT", "KOV_CONTACT", "SERVICE_PROVIDER", "SERVICES_CONTACTS"]);
    const helpOnlyTypes = new Set(["HELP_REQUEST", "HELP_OFFER", "HELP_LISTINGS"]);
    const shouldLoadServices = !requestedType || requestedType === "ALL" || serviceOnlyTypes.has(requestedType);
    const shouldLoadHelp = !requestedType || requestedType === "ALL" || helpOnlyTypes.has(requestedType);
    const canReadPeerListings = Boolean(session?.user?.id);
    const combinedCursor = query.combinedCursor || {};
    const serviceQuery = {
      ...query,
      cursorRaw: query.combinedCursor ? combinedCursor.serviceCursor || "" : query.cursorRaw,
      cursor: query.combinedCursor
        ? decodeServiceMapCursor(combinedCursor.serviceCursor, query, "service")
        : query.cursor
    };
    const peerQuery = {
      ...query,
      cursorRaw: query.combinedCursor ? combinedCursor.peerCursor || "" : query.cursorRaw,
      cursor: query.combinedCursor
        ? decodeServiceMapCursor(combinedCursor.peerCursor, query, "help")
        : query.cursor
    };
    if (query.combinedCursor && (
      (combinedCursor.serviceCursor && !serviceQuery.cursor) ||
      (combinedCursor.peerCursor && !peerQuery.cursor)
    )) {
      return errorJson("workspace_feature_pages.service_map.errors.invalid_cursor", 400, locale);
    }
    const [serviceSettled, peerListingsSettled] = await Promise.allSettled([
      shouldLoadServices && combinedCursor.serviceDone !== true
        ? loadServices(serviceQuery)
        : Promise.resolve({ entries: [], page: { hasMore: false, nextCursor: null } }),
      shouldLoadHelp && canReadPeerListings && combinedCursor.peerDone !== true
        ? loadPeerListings({ userId: session?.user?.id || "", query: { ...peerQuery, locale }, loadHelpEntries: listPublishedHelpMapEntries })
        : Promise.resolve({ entries: [], page: null, peerListingsAvailable: canReadPeerListings, peerListingsAccess: canReadPeerListings ? "AUTHORIZED" : "AUTH_REQUIRED" })
    ]);
    const combined = combineServiceMapSourceResults({
      servicesRequested: shouldLoadServices,
      peerListingsRequested: shouldLoadHelp,
      peerListingsAuthorized: canReadPeerListings,
      serviceSettled,
      peerListingsSettled
    });
    for (const [source, state] of Object.entries(combined.sources)) {
      if (state.status !== "unavailable") continue;
      console.error("[service-map] independent source unavailable", {
        source,
        code: state.errorCode
      });
    }
    const { serviceResult, peerResult } = combined;
    const serviceEntries = Array.isArray(serviceResult) ? serviceResult : serviceResult.entries;
    const helpEntries = peerResult.entries;
    const helpResult = peerResult;
    const entries = [...serviceEntries, ...helpEntries];
    const activePage = shouldLoadServices && !shouldLoadHelp
      ? serviceResult.page
      : shouldLoadHelp && !shouldLoadServices
        ? helpResult.page
        : (() => {
            const serviceUnavailable = combined.sources.services.status === "unavailable";
            const peerUnavailable = combined.sources.peerListings.status === "unavailable";
            const serviceHasMore = Boolean(serviceResult?.page?.hasMore);
            const peerHasMore = Boolean(helpResult?.page?.hasMore);
            const hasMore = serviceHasMore || peerHasMore;
            return {
              hasMore,
              nextCursor: hasMore ? encodeServiceMapCombinedCursor({
                serviceCursor: serviceHasMore ? serviceResult.page.nextCursor : null,
                peerCursor: peerHasMore ? helpResult.page.nextCursor : null,
                serviceDone: !serviceUnavailable && !serviceHasMore,
                peerDone: combined.sources.peerListings.status === "auth_required" || (!peerUnavailable && !peerHasMore)
              }, query) : null,
              returnedCount: entries.length,
              truncated: hasMore,
              requiresSourceFilter: false,
              limitScope: "per_source",
              requestedLimitPerSource: query.limit
            };
          })();
    return json({
      ok: true,
      entries,
      page: activePage,
      partial: combined.partial,
      sources: combined.sources,
      peerListingsAvailable: canReadPeerListings,
      peerListingsAccess: canReadPeerListings ? "AUTHORIZED" : "AUTH_REQUIRED"
    });
  } catch (error) {
    if (isServiceMapAccessError(error)) {
      const status = Number(error?.status || error?.statusCode || 0) === 401 ? 401 : 403;
      const code = status === 401 ? "SERVICE_MAP_AUTH_REQUIRED" : "SERVICE_MAP_ACCESS_DENIED";
      console.error("[service-map] entries access failure", { code });
      return errorJson(
        status === 401 ? "api.common.unauthorized" : "api.common.forbidden",
        status,
        locale,
        { code, partial: false }
      );
    }
    if (isServiceMapSourcePermissionError(error)) {
      console.error("[service-map] source permission unavailable", { code: "SERVICE_MAP_SOURCE_PERMISSION_UNAVAILABLE" });
      return errorJson(
        "workspace_feature_pages.service_map.errors.load_failed",
        503,
        locale,
        { code: "SERVICE_MAP_SOURCE_PERMISSION_UNAVAILABLE", partial: false }
      );
    }
    const status = error?.code === "SERVICE_MAP_SOURCES_UNAVAILABLE" ? 503 : 500;
    const code = status === 503 ? "SERVICE_MAP_SOURCES_UNAVAILABLE" : "SERVICE_MAP_ENTRIES_LOAD_FAILED";
    console.error("[service-map] entries load failed", { code });
    return errorJson(
      "workspace_feature_pages.service_map.errors.load_failed",
      status,
      locale,
      { code, partial: false }
    );
  }
}
