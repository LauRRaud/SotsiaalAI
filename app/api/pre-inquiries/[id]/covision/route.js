import { json } from "@/lib/documents/server";
import {
  buildCaseFromPreInquiryDraft,
  createCovisionCase
} from "@/lib/covision";
import {
  covisionErrorResponse,
  covisionLocale,
  requireCovisionAuth
} from "@/lib/covisionApi";
import { getVisiblePreInquiry } from "@/lib/preInquiries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function POST(request, context) {
  const locale = covisionLocale(request);
  try {
    const auth = await requireCovisionAuth();
    const inquiry = await getVisiblePreInquiry(auth.userId, await readId(context));
    if (!inquiry) {
      return covisionErrorResponse({ message: "api.common.not_found", status: 404 }, locale);
    }
    const body = await request.json().catch(() => ({}));
    const draft = buildCaseFromPreInquiryDraft(inquiry);
    const covisionCase = await createCovisionCase(auth, {
      ...draft,
      title: body?.title || draft.title,
      centralQuestion: body?.centralQuestion || draft.centralQuestion,
      participants: []
    });
    return json({
      ok: true,
      case: covisionCase,
      anonymityIssues: draft.anonymityIssues || []
    }, 201);
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] pre-inquiry draft failed", "covision.errors.pre_inquiry_draft_failed");
  }
}
