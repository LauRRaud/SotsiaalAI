import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  applyCovisionSessionAction,
  covisionSessionPublicError,
  parseCovisionSessionJsonBody
} from "@/lib/covisionSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(error, locale) {
  const { messageKey, status } = covisionSessionPublicError(error);
  if (status >= 500) console.error("[covision-session] action failed", safeError(error));
  return errorJson(messageKey, status, locale);
}

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const params = await context?.params;
    const session = await applyCovisionSessionAction(
      { userId: auth.userId, email: auth.email },
      String(params?.id || "").trim(),
      await parseCovisionSessionJsonBody(request)
    );
    return json({ ok: true, ...session });
  } catch (error) {
    return errorResponse(error, locale);
  }
}
