import { json } from "@/lib/documents/server";
import {
  buildCaseFromPreInquiryDraft,
  buildPreInquiryCovisionCaseInput,
  createCovisionCase
} from "@/lib/covision";
import {
  covisionErrorResponse,
  covisionLocale,
  requireCovisionAuth
} from "@/lib/covisionApi";
import { assertCovisionCreator } from "@/lib/covisionSession";
import { getVisiblePreInquiry } from "@/lib/preInquiries";
import { enforcePreInquiryRateLimit } from "@/lib/preInquiryApiBoundary";

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
    assertCovisionCreator(auth);
    const limited = enforcePreInquiryRateLimit(request, { action: "mutate", userId: auth.userId });
    if (limited) return limited;
    const inquiry = await getVisiblePreInquiry(auth.userId, await readId(context));
    if (!inquiry) {
      return covisionErrorResponse({ message: "api.common.not_found", status: 404 }, locale);
    }
    const body = await request.json().catch(() => ({}));
    const draft = buildCaseFromPreInquiryDraft(inquiry);
    const covisionCase = await createCovisionCase(
      auth,
      buildPreInquiryCovisionCaseInput(draft, body),
      { sourcePreInquiryId: inquiry.id }
    );
    return json({
      ok: true,
      case: covisionCase,
      anonymityIssues: draft.anonymityIssues || []
    }, 201);
  } catch (error) {
    return covisionErrorResponse(error, locale, "[covision] pre-inquiry draft failed", "covision.errors.pre_inquiry_draft_failed");
  }
}
