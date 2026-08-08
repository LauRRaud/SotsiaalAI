import { json } from "@/lib/documents/server";
import { addQuestion, listQuestions } from "@/lib/casework/caseWorkMeetingPrep";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep" });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId } = await params;
    const result = await listQuestions({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

/** Täpsustav küsimus või kliendiga kontrollitav väide. Päritolu on kohustuslik. */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-question", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId } = await params;
    const body = await request.json().catch(() => ({}));
    const question = await addQuestion({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId,
      kind: body?.kind ?? null,
      text: body?.text ?? null,
      provenance: body?.provenance ?? null,
      ordinal: body?.ordinal
    });
    return json({ ok: true, question }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
