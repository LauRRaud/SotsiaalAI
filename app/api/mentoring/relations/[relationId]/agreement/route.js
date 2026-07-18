import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import {
  acceptMentoringAgreement,
  proposeMentoringAgreement
} from "@/lib/mentoring/relationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const params = await context?.params;
    const relationId = String(params?.relationId || "").trim();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    let result;
    if (action === "propose") {
      result = await proposeMentoringAgreement(auth, relationId, body, { locale });
    } else if (action === "accept") {
      result = await acceptMentoringAgreement(auth, relationId, body, { locale });
    } else {
      return mentoringErrorResponse({ message: "api.common.invalid_request", status: 400 }, locale);
    }
    return json({ ok: true, ...result });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] agreement action failed", "mentoring.errors.save_failed");
  }
}
