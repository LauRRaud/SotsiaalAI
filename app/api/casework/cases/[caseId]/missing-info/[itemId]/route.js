import { json } from "@/lib/documents/server";
import { removeMissingInfo, setMissingInfoStatus } from "@/lib/casework/caseWorkMissingInfo";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Puuduva info staatuse muutmine (E6 operatsioon 7).
 *
 * `resolvedAt` tuleb SERVERIST, mitte kliendilt — marsruut ei võta teda vastu
 * ega edasta. Tagasi `OPEN` viimine nullib ta (leping E1 invariant).
 */
export async function PATCH(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:missing-info-status", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const item = await setMissingInfoStatus({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      itemId,
      status: body?.status ?? null
    });
    return json({ ok: true, item });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

export async function DELETE(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:missing-info-remove", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, itemId } = await params;
    await removeMissingInfo({ ownerUserId: guard.userId, caseWorkAssistId: caseId, itemId });
    return json({ ok: true });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
