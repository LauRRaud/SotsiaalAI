import { json } from "@/lib/documents/server";
import { getDraft } from "@/lib/casework/caseWorkDraft";
import { purgeDueAt } from "@/lib/casework/retention";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Üks mustand koos väljadega.
 *
 * `DELETE` PUUDUB TEADLIKULT: mustand on ülekandeahela lüli ja tema jälg on
 * tõend. Lõpetamise tee on `EI_KANTA` — TEADLIK lõpp, mitte „jäi seisma"
 * (ptk 2.2). Kustutus laseks otsuse ajaloost vaikselt kaduda.
 *
 * `PATCH` puudub samal põhjusel mis märkmel: konteiner on tekstita ja tema seisu
 * muudab ainult `transition` marsruut, mis kannab tingimuslikku siiret.
 */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:draft" });
  if (guard.response) return guard.response;

  try {
    const { caseId, draftId } = await params;
    const draft = await getDraft({ ownerUserId: guard.userId, caseWorkAssistId: caseId, draftId });
    /* L7 loendus MUSTANDI vaates. Kuupäev tuleb säilitusmoodulist — samast
       valemist, mille järgi sisu päriselt kustub. Teine arvutus siin tähendaks,
       et ekraanil seisab üks kuupäev ja purge juhtub teisel. */
    return json({ ok: true, draft: { ...draft, purgeDueAt: purgeDueAt(draft.transferredAt) } });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
