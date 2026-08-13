import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  parseTopicSeedJsonBody,
  topicSeedPublicError,
  withdrawTopicSeed
} from "@/lib/topicSeeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const params = await context?.params;
    const body = await parseTopicSeedJsonBody(request);
    const seed = await withdrawTopicSeed(
      auth.userId,
      String(params?.id || "").trim(),
      { expectedVersion: body.expectedVersion }
    );
    return json({ ok: true, seed });
  } catch (error) {
    const { messageKey, status } = topicSeedPublicError(error);
    if (status >= 500) console.error("[topic-seeds] withdraw failed", safeError(error));
    return errorJson(messageKey, status, locale);
  }
}
