import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { listMyMentoringRelations } from "@/lib/mentoring/relationService";
import {
  listIncomingMentoringRequests,
  listMyMentoringRequests
} from "@/lib/mentoring/requestService";
import { getOwnMentorProfile } from "@/lib/mentoring/profileService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const [relations, myRequests, incomingRequests, profile] = await Promise.all([
      listMyMentoringRelations(auth),
      listMyMentoringRequests(auth),
      listIncomingMentoringRequests(auth),
      getOwnMentorProfile(auth)
    ]);
    return json({ ok: true, relations, myRequests, incomingRequests, profile });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] overview failed", "mentoring.errors.load_failed");
  }
}
