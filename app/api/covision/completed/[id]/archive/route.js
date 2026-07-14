import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  archiveCompletedCase,
  covisionCompletedCasePublicError,
  parseCompletedCaseJsonBody
} from "@/lib/covisionCompletedCases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const params = await context?.params;
    const completedCase = await archiveCompletedCase(
      { userId: auth.userId },
      String(params?.id || "").trim(),
      await parseCompletedCaseJsonBody(request)
    );
    return json({ ok: true, completedCase });
  } catch (error) {
    const descriptor = covisionCompletedCasePublicError(error);
    if (descriptor.status >= 500) console.error("[completed-cases] archive failed", safeError(error));
    return errorJson(descriptor.messageKey, descriptor.status, locale);
  }
}
