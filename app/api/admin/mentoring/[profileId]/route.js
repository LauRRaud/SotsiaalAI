import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringAdminAuth
} from "@/lib/mentoring/api";
import {
  deleteExternalMentorRecord,
  reviewMentorProfile,
  setExternalConsentStatus
} from "@/lib/mentoring/adminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringAdminAuth();
    const params = await context?.params;
    const profileId = String(params?.profileId || "").trim();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    let result;
    if (action === "review") {
      result = { profile: await reviewMentorProfile(auth, profileId, String(body.decision || "").toUpperCase(), body) };
    } else if (action === "consent") {
      result = { profile: await setExternalConsentStatus(auth, profileId, body) };
    } else if (action === "delete_external") {
      result = await deleteExternalMentorRecord(auth, profileId);
    } else {
      return mentoringErrorResponse({ message: "api.common.invalid_request", status: 400 }, locale);
    }
    return json({ ok: true, ...result });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring-admin] action failed", "mentoring.errors.save_failed");
  }
}
