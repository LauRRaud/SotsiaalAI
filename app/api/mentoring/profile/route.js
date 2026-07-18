import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import {
  getOwnMentorProfile,
  pauseOwnMentorProfile,
  resumeOwnMentorProfile,
  retireOwnMentorProfile,
  setOwnMentorCapacity,
  submitOwnMentorProfile,
  upsertOwnMentorProfile
} from "@/lib/mentoring/profileService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const profile = await getOwnMentorProfile(auth);
    return json({ ok: true, profile });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] profile load failed", "mentoring.errors.load_failed");
  }
}

export async function PUT(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const body = await request.json().catch(() => ({}));
    const profile = await upsertOwnMentorProfile(auth, body);
    return json({ ok: true, profile });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] profile save failed", "mentoring.errors.save_failed");
  }
}

export async function POST(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    let profile;
    if (action === "submit") profile = await submitOwnMentorProfile(auth);
    else if (action === "pause") profile = await pauseOwnMentorProfile(auth);
    else if (action === "resume") profile = await resumeOwnMentorProfile(auth);
    else if (action === "retire") profile = await retireOwnMentorProfile(auth);
    else if (action === "capacity") profile = await setOwnMentorCapacity(auth, body.capacity);
    else {
      return mentoringErrorResponse(
        { message: "api.common.invalid_request", status: 400 },
        locale
      );
    }
    return json({ ok: true, profile });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] profile action failed", "mentoring.errors.save_failed");
  }
}
