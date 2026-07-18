import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringAdminAuth
} from "@/lib/mentoring/api";
import { listExternalMentorRecords } from "@/lib/mentoring/adminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringAdminAuth();
    const records = await listExternalMentorRecords(auth);
    return json({ ok: true, records });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring-admin] external list failed", "mentoring.errors.load_failed");
  }
}
