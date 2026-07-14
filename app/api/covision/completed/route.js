import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  covisionCompletedCasePublicError,
  listCompletedCases
} from "@/lib/covisionCompletedCases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const url = new URL(request.url);
    const result = await listCompletedCases(
      { userId: auth.userId },
      {
        scope: url.searchParams.get("scope"),
        status: url.searchParams.get("status"),
        sort: url.searchParams.get("sort"),
        q: url.searchParams.get("q")
      }
    );
    return json({ ok: true, ...result });
  } catch (error) {
    const descriptor = covisionCompletedCasePublicError(error);
    if (descriptor.status >= 500) console.error("[completed-cases] list failed", safeError(error));
    return errorJson(descriptor.messageKey, descriptor.status, locale);
  }
}
