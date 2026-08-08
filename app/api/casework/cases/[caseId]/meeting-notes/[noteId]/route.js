import { json } from "@/lib/documents/server";
import { getNote } from "@/lib/casework/caseWorkMeetingNote";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Üks märge koos kirjetega.
 *
 * `DELETE` PUUDUB TEADLIKULT ja seda ei tohi hiljem „sümmeetria pärast" juurde
 * kirjutada (E3 ettevalmistusel ta on). Ettevalmistus kirjeldab kohtumist, mida
 * veel ei olnud; märge seda, mis juba juhtus. Üksik kirje on eemaldatav, märge
 * tervikuna mitte — juhtumi kustutus viib ta kaskaadis.
 *
 * `PATCH` puudub samal põhjusel: märkme konteiner on tekstita ja tema ainus
 * sisuline väli (`meetingAt`) määratakse loomisel. Muutuv sisu elab kirjetes.
 */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note" });
  if (guard.response) return guard.response;

  try {
    const { caseId, noteId } = await params;
    const note = await getNote({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingNoteId: noteId
    });
    return json({ ok: true, note });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
