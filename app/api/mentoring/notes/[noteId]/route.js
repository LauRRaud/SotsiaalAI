import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { deleteMentoringNote, updateMentoringNote } from "@/lib/mentoring/noteService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PUT(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const note = await updateMentoringNote(auth, String(params?.noteId || "").trim(), body);
    return json({ ok: true, note });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] note update failed", "mentoring.errors.save_failed");
  }
}

export async function DELETE(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const result = await deleteMentoringNote(auth, String(params?.noteId || "").trim());
    return json({ ok: true, ...result });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] note delete failed", "mentoring.errors.save_failed");
  }
}
