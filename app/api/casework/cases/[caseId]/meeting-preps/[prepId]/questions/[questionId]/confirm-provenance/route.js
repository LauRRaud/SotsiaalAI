import { json } from "@/lib/documents/server";
import { confirmQuestionProvenance } from "@/lib/casework/caseWorkMeetingPrep";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Küsimuse päritolu kinnitamine — sama leping mis väljal.
 *
 * Ainus lubatud suund on `AI_MUSTAND` → inimese märgis. Tagasitee masina
 * märgise juurde annab 400: ta kirjutaks inimese kinnituse ümber ja hiljem ei
 * oleks võimalik aru saada, kumb tegelikult juhtus.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-confirm", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId, questionId } = await params;
    const body = await request.json().catch(() => ({}));
    const question = await confirmQuestionProvenance({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId,
      questionId,
      from: body?.from ?? null,
      to: body?.to ?? null
    });
    return json({ ok: true, question });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
