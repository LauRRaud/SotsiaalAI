import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import { createMentoringRequest } from "@/lib/mentoring/requestService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const body = await request.json().catch(() => ({}));
    const created = await createMentoringRequest(auth, body);
    return json({ ok: true, request: created }, 201);
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] request create failed", "mentoring.errors.save_failed");
  }
}
