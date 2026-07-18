import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringAdminAuth
} from "@/lib/mentoring/api";
import { listMentoringAuditEvents } from "@/lib/mentoring/adminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringAdminAuth();
    const url = new URL(request.url);
    const events = await listMentoringAuditEvents(auth, {
      profileId: url.searchParams.get("profileId") || ""
    });
    return json({ ok: true, events });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring-admin] audit failed", "mentoring.errors.load_failed");
  }
}
