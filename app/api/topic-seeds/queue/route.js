import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { safeError } from "@/lib/privacy/safeError";
import { listWaitingTopicSeedPage, topicSeedPublicError } from "@/lib/topicSeeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = localeFromRequest(request);
  try {
    const auth = await requireCovisionAuth();
    const search = new URL(request.url).searchParams;
    const page = await listWaitingTopicSeedPage(auth.userId, {
      cursor: search.get("cursor"),
      limit: search.get("limit")
    });
    return json({ ok: true, ...page });
  } catch (error) {
    const { messageKey, status } = topicSeedPublicError(error);
    if (status >= 500) console.error("[topic-seeds] queue list failed", safeError(error));
    return errorJson(messageKey, status, locale);
  }
}
