import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import {
  cancelMentoringRequest,
  respondMentoringRequest
} from "@/lib/mentoring/requestService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const requestId = String(params?.requestId || "").trim();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    let result;
    if (action === "cancel") {
      result = await cancelMentoringRequest(auth, requestId);
    } else if (action === "respond") {
      result = await respondMentoringRequest(auth, requestId, String(body.decision || "").toUpperCase());
    } else {
      return mentoringErrorResponse({ message: "api.common.invalid_request", status: 400 }, locale);
    }
    return json({ ok: true, ...result });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] request action failed", "mentoring.errors.save_failed");
  }
}
