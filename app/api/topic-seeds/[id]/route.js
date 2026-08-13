import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  deleteTopicSeed,
  parseTopicSeedJsonBody,
  topicSeedPublicError,
  updateTopicSeed
} from "@/lib/topicSeeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function topicSeedErrorResponse(error, locale, context) {
  const { messageKey, status } = topicSeedPublicError(error);
  if (status >= 500) console.error(context, safeError(error));
  return errorJson(messageKey, status, locale);
}

// Owner-only DRAFT deletion. DataAuditLog is committed in the same transaction;
// linked or later lifecycle states fail closed with a version conflict.
export async function DELETE(request, context) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const params = await context?.params;
    const body = await parseTopicSeedJsonBody(request);
    const result = await deleteTopicSeed(
      auth.userId,
      String(params?.id || "").trim(),
      { expectedVersion: body.expectedVersion }
    );
    return json({ ok: true, ...result });
  } catch (error) {
    return topicSeedErrorResponse(error, locale, "[topic-seeds] delete failed");
  }
}

// Owner-only, version-safe DRAFT edit. Server-controlled ownership, status,
// frozen snapshot and audit fields are never accepted from the request body.
export async function PATCH(request, context) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const params = await context?.params;
    const body = await parseTopicSeedJsonBody(request);
    const seed = await updateTopicSeed(
      auth.userId,
      String(params?.id || "").trim(),
      body
    );
    return json({ ok: true, seed });
  } catch (error) {
    return topicSeedErrorResponse(error, locale, "[topic-seeds] update failed");
  }
}
