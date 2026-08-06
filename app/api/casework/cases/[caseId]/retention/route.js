import { json } from "@/lib/documents/server";
import { transitionRetention } from "@/lib/casework/caseWorkAssist";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Retention-siire (E6 operatsioon 8) — PRIVILEGEERITUD OPERATSIOON, mitte
 * tavaline väljamuutmine. Sellepärast on tal oma marsruut: `PATCH /cases/[id]`
 * ei tohi kunagi kirjutuskaitset seada, muidu satuks ta kogemata sinna, kus
 * muudetakse järgmise kontakti kuupäeva.
 *
 * Ainult EDASI (`ACTIVE → READ_ONLY → ARCHIVED`) ja põhjus on kohustuslik.
 * Kustutust ei ole (L16).
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:retention", limit: 20 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const updated = await transitionRetention({
      ownerUserId: guard.userId,
      id: caseId,
      toState: body?.toState ?? null,
      reason: body?.reason ?? null
    });
    return json({ ok: true, case: updated });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
