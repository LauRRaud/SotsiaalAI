import { json } from "@/lib/documents/server";
import { markTransferred } from "@/lib/casework/caseWorkTransfer";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * „Märgi üle kantuks" — AINUS tee `ULE_KANTUD`-ini (L19).
 *
 * OMA MARSRUUT, MITTE `/transition` PARAMEETER, ja see on L19 mõte: kaks
 * operatsiooni tähendavad kahte eri tegu. „Märgi üle kantuks" on AVALDUS selle
 * kohta, et info on STAR-is; „vii mustand järgmisse seisu" ei ole. Sama teenus
 * kirjutab samas tehingus auditirea (L18) — ilma selleta hakkaks säilituskell
 * käima ülekande peal, mille kohta ei ole ühtegi tõendit.
 *
 * `expectedFrom` on KOHUSTUSLIK: kaks samaaegset märkimist ei saa mõlemad
 * võita, teine saab 409 (L6) — ja teist auditirida ei teki.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:transfer", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const { draft, event } = await markTransferred({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      draftId,
      expectedFrom: body?.expectedFrom ?? null
    });
    return json({ ok: true, draft, event });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
