import { errorJson } from "@/lib/documents/server";
import { guardServiceLogRequest } from "@/lib/serviceLog/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Manual service narratives remain available; AI drafting is paused before quota.
export async function POST(req) {
  const { response, locale } = await guardServiceLogRequest(req, {
    scope: "service_narrative_draft", limit: 10
  });
  if (response) return response;
  return errorJson("api.rag.retired", 503, locale);
}
