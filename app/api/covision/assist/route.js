import { json } from "@/lib/documents/server";
import {
  buildCovisionAssist,
  getVisibleCovisionCase,
  serializeCovisionCase
} from "@/lib/covision";
import { fetchCovisionKnowledgeSupport } from "@/lib/covisionKnowledge";
import {
  covisionErrorResponse,
  covisionLocale,
  requireCovisionAuth
} from "@/lib/covisionApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const body = await request.json().catch(() => ({}));
    let covisionCase = body?.case || {};
    if (body?.caseId) {
      const record = await getVisibleCovisionCase(auth, String(body.caseId));
      if (!record) {
        return covisionErrorResponse({ message: "api.common.not_found", status: 404 }, locale);
      }
      covisionCase = serializeCovisionCase(record, auth);
    }
    if (body?.action === "knowledge") {
      const support = await fetchCovisionKnowledgeSupport(auth, covisionCase, {
        topK: body?.topK
      });
      return json({
        ok: true,
        knowledge: support
      });
    }
    const result = buildCovisionAssist({
      action: body?.action,
      covisionCase,
      description: body?.description,
      messages: body?.messages
    });
    return json({
      ok: true,
      ...result
    });
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] assist failed", "covision.errors.assist_failed");
  }
}
