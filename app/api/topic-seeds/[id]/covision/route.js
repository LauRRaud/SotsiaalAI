import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  assertCovisionCreator,
  covisionSessionPublicError,
  normalizeCovisionStartRequest,
  parseCovisionSessionJsonBody,
  startCovisionFromTopicSeed
} from "@/lib/covisionSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function errorResponse(error, locale) {
  const { messageKey, status } = covisionSessionPublicError(error);
  if (status >= 500) console.error("[topic-seeds] covision start failed", safeError(error));
  return errorJson(messageKey, status, locale);
}

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    assertCovisionCreator(auth);
    const params = await context?.params;
    const body = normalizeCovisionStartRequest(await parseCovisionSessionJsonBody(request));
    const result = await startCovisionFromTopicSeed(
      auth.userId,
      String(params?.id || "").trim(),
      { expectedVersion: body.expectedVersion }
    );
    return json({ ok: true, ...result }, result.created ? 201 : 200);
  } catch (error) {
    return errorResponse(error, locale);
  }
}
