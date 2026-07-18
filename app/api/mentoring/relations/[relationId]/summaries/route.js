import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { createMentoringSummary } from "@/lib/mentoring/summaryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const relationId = String(params?.relationId || "").trim();
    const body = await request.json().catch(() => ({}));
    const summary = await createMentoringSummary(auth, relationId, body);
    return json({ ok: true, summary }, 201);
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] summary create failed", "mentoring.errors.save_failed");
  }
}
