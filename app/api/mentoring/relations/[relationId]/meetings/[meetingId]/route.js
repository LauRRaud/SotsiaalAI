import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { updateMentoringMeeting } from "@/lib/mentoring/meetingService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const relationId = String(params?.relationId || "").trim();
    const meetingId = String(params?.meetingId || "").trim();
    const body = await request.json().catch(() => ({}));
    const meeting = await updateMentoringMeeting(auth, relationId, meetingId, body);
    return json({ ok: true, meeting });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] meeting update failed", "mentoring.errors.save_failed");
  }
}
