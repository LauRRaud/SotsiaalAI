import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { getCatalogProfile } from "@/lib/mentoring/catalogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const profile = await getCatalogProfile(auth, params?.profileId);
    return json({ ok: true, profile });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] catalog profile failed", "mentoring.errors.load_failed");
  }
}
