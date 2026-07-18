import { json } from "@/lib/documents/server";
import {
  mentoringErrorResponse,
  mentoringLocale,
  requireMentoringMemberAuth
} from "@/lib/mentoring/api";
import {
  closeMentoringRelation,
  confirmMentoringRelationAlive,
  getMentoringRelation,
  pauseMentoringRelation,
  previewMentoringClose,
  resumeMentoringRelation,
  updateMentoringGoal
} from "@/lib/mentoring/relationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readRelationId(context) {
  const params = await context?.params;
  return String(params?.relationId || "").trim();
}

export async function GET(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const relation = await getMentoringRelation(auth, await readRelationId(context));
    return json({ ok: true, relation });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] relation load failed", "mentoring.errors.load_failed");
  }
}

export async function POST(request, context) {
  const locale = mentoringLocale(request);
  try {
    const auth = await requireMentoringMemberAuth();
    const relationId = await readRelationId(context);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    let result;
    if (action === "goal") result = await updateMentoringGoal(auth, relationId, body);
    else if (action === "pause") result = await pauseMentoringRelation(auth, relationId);
    else if (action === "resume") result = await resumeMentoringRelation(auth, relationId);
    else if (action === "alive") result = await confirmMentoringRelationAlive(auth, relationId);
    else if (action === "close_preview") result = await previewMentoringClose(auth, relationId);
    else if (action === "close") result = await closeMentoringRelation(auth, relationId, body);
    else {
      return mentoringErrorResponse({ message: "api.common.invalid_request", status: 400 }, locale);
    }
    return json({ ok: true, ...result });
  } catch (error) {
    return mentoringErrorResponse(error, locale, "[mentoring] relation action failed", "mentoring.errors.save_failed");
  }
}
