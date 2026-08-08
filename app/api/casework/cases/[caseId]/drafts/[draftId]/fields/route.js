import { json } from "@/lib/documents/server";
import { removeField, setField } from "@/lib/casework/caseWorkDraft";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Ühe välja määramine (`PUT`, upsert).
 *
 * `provenance` võetakse vastu ainult UUE rea jaoks — teenuskiht jätab
 * olemasoleva rea märgise puutumata ja saadetud väärtuse eirab (L4).
 *
 * Terminaalse mustandi (`ULE_KANTUD`, `EI_KANTA`) väli ei muutu: **409**.
 */
export async function PUT(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:draft-field", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const field = await setField({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      draftId,
      fieldKey: body?.fieldKey ?? null,
      text: body?.text ?? null,
      provenance: body?.provenance ?? null
    });
    return json({ ok: true, field });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

export async function DELETE(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:draft-field-remove", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, draftId } = await params;
    const search = new URL(request.url).searchParams;
    await removeField({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      draftId,
      fieldKey: search.get("fieldKey")
    });
    return json({ ok: true });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
