import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  normalizeTopicSeedQueueRequest,
  parseTopicSeedJsonBody,
  queueTopicSeed,
  topicSeedPublicError
} from "@/lib/topicSeeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function topicSeedErrorResponse(error, locale, context) {
  const { messageKey, status } = topicSeedPublicError(error);
  if (status >= 500) {
    console.error(context, safeError(error));
  }
  return errorJson(messageKey, status, locale);
}

// A6.1: the owner deliberately queues a DRAFT, freezing a shareable generalized
// snapshot. Version-safe (expectedVersion) and requires a conscious
// no-identifiers confirmation. WAITING does NOT publish the seed to anyone else.
export async function POST(request, context) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const params = await context?.params;
    const body = normalizeTopicSeedQueueRequest(await parseTopicSeedJsonBody(request));
    const seed = await queueTopicSeed(auth.userId, String(params?.id || "").trim(), {
      expectedVersion: body.expectedVersion,
      confirmedNoIdentifiers: body.confirmedNoIdentifiers,
      confirmedPrivacyReview: body.confirmedPrivacyReview
    });
    return json({ ok: true, seed });
  } catch (error) {
    return topicSeedErrorResponse(error, locale, "[topic-seeds] queue failed");
  }
}
