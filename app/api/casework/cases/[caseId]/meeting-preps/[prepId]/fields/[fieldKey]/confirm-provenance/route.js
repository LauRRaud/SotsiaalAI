import { json } from "@/lib/documents/server";
import { confirmFieldProvenance } from "@/lib/casework/caseWorkMeetingPrep";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * `AI_MUSTAND` → inimese märgis. OMA MARSRUUT, MITTE `PATCH`-i KÕRVALMÕJU.
 *
 * MIKS OMA MARSRUUT: kui märgise muutmine oleks osa tavalisest uuendusest,
 * kaoks AI mustandi märgis iga teksti parandamisega — ja just see märgis on
 * ainus asi, mis hiljem ütleb, kust väide tuli. Eraldi tegu tähendab, et
 * inimene ütleb „ma vaatasin selle üle ja võtan vastutuse".
 *
 * `from` ON KOHUSTUSLIK ja läheb tingimuslikku update'i: kaks samaaegset
 * kinnitust ei kirjuta teineteist üle, teine saab 409.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-confirm", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId, fieldKey } = await params;
    const body = await request.json().catch(() => ({}));
    const field = await confirmFieldProvenance({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId,
      fieldKey,
      from: body?.from ?? null,
      to: body?.to ?? null
    });
    return json({ ok: true, field });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
