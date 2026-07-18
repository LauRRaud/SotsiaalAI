import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { listMentorCatalog } from "@/lib/mentoring/catalogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const url = new URL(request.url);
    const profiles = await listMentorCatalog(auth, {
      field: url.searchParams.get("field") || "",
      topic: url.searchParams.get("topic") || "",
      language: url.searchParams.get("language") || ""
    });
    return json({ ok: true, profiles });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] catalog failed", "mentoring.errors.load_failed");
  }
}
