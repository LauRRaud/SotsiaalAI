import { json } from "@/lib/documents/server";
import { setPrepField } from "@/lib/casework/caseWorkMeetingPrep";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Ühe välja määramine (`PUT`, upsert): üks rida välja kohta.
 *
 * `provenance` VÕETAKSE VASTU ainult siis, kui rida veel ei ole — teenuskiht
 * jätab olemasoleva rea märgise puutumata ja saadetud väärtuse eirab. Märgise
 * muutmiseks on eraldi marsruut `fields/[fieldKey]/confirm-provenance`, ja see
 * on kogu L4 mõte: AI mustandi märgist ei saa maha võtta teksti parandamise
 * kõrvalmõjuna.
 */
export async function PUT(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-field", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, prepId } = await params;
    const body = await request.json().catch(() => ({}));
    const field = await setPrepField({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: prepId,
      fieldKey: body?.fieldKey ?? null,
      text: body?.text ?? null,
      provenance: body?.provenance ?? null
    });
    return json({ ok: true, field });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
