import { json } from "@/lib/documents/server";
import { transitionDraft } from "@/lib/casework/caseWorkDraft";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Mustandi olekusiire (ptk 2.2 kuus seisu).
 *
 * `expectedFrom` ON KOHUSTUSLIK ja läheb tingimuslikku update'i (L6): kaks
 * samaaegset siiret ei saa mõlemad võita — teine saab **409**, mitte
 * „õnnestus" vale eeldusega.
 *
 * `to = ULE_KANTUD` annab **400** (L19). Sinna viib ainult E6
 * `markTransferred()`, mis loob samas tehingus auditirea. Vaikne
 * ümbersuunamine tekitaks auditirea teo kohta, mida kasutaja ei teinud.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:draft-transition", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const draft = await transitionDraft({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      draftId,
      expectedFrom: body?.expectedFrom ?? null,
      to: body?.to ?? null,
      reviewKind: body?.reviewKind
    });
    return json({ ok: true, draft });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
