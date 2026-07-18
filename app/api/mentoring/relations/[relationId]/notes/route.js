import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { createMentoringNote, listMyMentoringNotes } from "@/lib/mentoring/noteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const notes = await listMyMentoringNotes(auth, String(params?.relationId || "").trim());
    return json({ ok: true, notes });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] notes load failed", "mentoring.errors.load_failed");
  }
}

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const note = await createMentoringNote(auth, String(params?.relationId || "").trim(), body);
    return json({ ok: true, note }, 201);
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] note create failed", "mentoring.errors.save_failed");
  }
}
