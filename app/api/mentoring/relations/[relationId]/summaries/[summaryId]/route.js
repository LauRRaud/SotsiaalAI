import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import {
  confirmMentoringSummary,
  discardMentoringSummary,
  submitMentoringSummary,
  superseedMentoringSummary,
  updateMentoringSummary
} from "@/lib/mentoring/summaryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const relationId = String(params?.relationId || "").trim();
    const summaryId = String(params?.summaryId || "").trim();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    let summary;
    if (action === "update") summary = await updateMentoringSummary(auth, relationId, summaryId, body);
    else if (action === "submit") summary = await submitMentoringSummary(auth, relationId, summaryId, body);
    else if (action === "confirm") summary = await confirmMentoringSummary(auth, relationId, summaryId);
    else if (action === "discard") summary = await discardMentoringSummary(auth, relationId, summaryId);
    else if (action === "supersede") summary = await superseedMentoringSummary(auth, relationId, summaryId, body);
    else {
      return mentoringErrorResponse({ message: "api.common.invalid_request", status: 400 }, locale);
    }
    return json({ ok: true, summary });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] summary action failed", "mentoring.errors.save_failed");
  }
}
