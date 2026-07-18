import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import {
  handoffWellbeingDraftToMentoring,
  listMentorHandoffCandidates,
  markMentoringPreparationOpened,
  recallMentoringPreparation,
  shareMentoringPreparation
} from "@/lib/mentoring/preparationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const candidates = await listMentorHandoffCandidates(auth);
    return json({ ok: true, candidates });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] handoff candidates failed", "mentoring.errors.load_failed");
  }
}

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const relationId = String(params?.relationId || "").trim();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    let preparation;
    if (action === "handoff") {
      preparation = await handoffWellbeingDraftToMentoring(auth, relationId, body);
    } else if (action === "share") {
      preparation = await shareMentoringPreparation(auth, relationId, body.noteId, body);
    } else if (action === "recall") {
      preparation = await recallMentoringPreparation(auth, relationId, body.noteId);
    } else if (action === "open") {
      preparation = await markMentoringPreparationOpened(auth, relationId, body.noteId);
    } else {
      return mentoringErrorResponse({ message: "api.common.invalid_request", status: 400 }, locale);
    }
    return json({ ok: true, preparation });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] preparation action failed", "mentoring.errors.save_failed");
  }
}
