import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import {
  createTopicSeed,
  listTopicSeeds,
  parseTopicSeedJsonBody,
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

export async function GET(request) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const seeds = await listTopicSeeds(auth.userId);
    return json({ ok: true, seeds });
  } catch (error) {
    return topicSeedErrorResponse(error, locale, "[topic-seeds] list failed");
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const body = await parseTopicSeedJsonBody(request);
    const seed = await createTopicSeed(auth.userId, body);
    return json({ ok: true, seed }, 201);
  } catch (error) {
    return topicSeedErrorResponse(error, locale, "[topic-seeds] create failed");
  }
}
