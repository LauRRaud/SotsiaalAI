import { json } from "@/lib/documents/server";
import { deleteMeetingPrep, getMeetingPrep, updateMeetingPrep } from "@/lib/casework/caseWorkMeetingPrep";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Üks ettevalmistus koos väljade ja küsimustega. */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep" });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId } = await params;
    const prep = await getMeetingPrep({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId
    });
    return json({ ok: true, prep });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

/**
 * `meetingAt` on ainus muudetav väli.
 *
 * `provenance`-i siin EI OLE ja see ei ole unustus: prep ise ei kanna märgist,
 * märgis elab igal väljal ja igal küsimusel eraldi (L4).
 */
export async function PATCH(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-update", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId } = await params;
    const body = await request.json().catch(() => ({}));
    const prep = await updateMeetingPrep({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId,
      meetingAt: body?.meetingAt ?? null
    });
    return json({ ok: true, prep });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

/** Ettevalmistus on tulevikuplaan, mitte tõend — kustutus on kõva kustutus. */
export async function DELETE(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-delete", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId } = await params;
    await deleteMeetingPrep({ ownerUserId: guard.userId, caseWorkAssistId: caseId, meetingPrepId: prepId });
    return json({ ok: true });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
