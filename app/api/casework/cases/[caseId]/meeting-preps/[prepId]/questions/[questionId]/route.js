import { json } from "@/lib/documents/server";
import { removeQuestion, updateQuestion } from "@/lib/casework/caseWorkMeetingPrep";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Küsimuse muutmine.
 *
 * `provenance` EI OLE loendis ja teenuskiht ei võta teda vastu ka siis, kui
 * keha ta kaasa paneb (L4). `kind` seevastu on muudetav: sama küsimus võib
 * osutuda väiteks, mida kliendiga kontrollida — see on sisuline ümberotsus,
 * mitte märgise mahavõtmine.
 */
export async function PATCH(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-question-update", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId, questionId } = await params;
    const body = await request.json().catch(() => ({}));
    const question = await updateQuestion({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId,
      questionId,
      kind: body?.kind,
      text: body?.text,
      ordinal: body?.ordinal
    });
    return json({ ok: true, question });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

export async function DELETE(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-question-remove", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId, questionId } = await params;
    await removeQuestion({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId,
      questionId
    });
    return json({ ok: true });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
