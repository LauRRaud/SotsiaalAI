import { json } from "@/lib/documents/server";
import { retractEntry } from "@/lib/casework/caseWorkMeetingNote";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kirje TÜHISTAMINE (SOL-CW-15).
 *
 * MIKS `POST /retract`, MITTE `DELETE`. Marsruut, mis nimetab end kustutuseks,
 * lubab kustutust — ja siin ei kustutata midagi: rida jääb alles, tema sisu
 * läheb paranduste ajalukku ja aktiivselt pinnalt kaob ainult tekst. `DELETE`,
 * mis ei kustuta, oleks vale lubadus API pinnal, ja just pinna ausus on selle
 * leiu sisu. Lisaks vajab tegu KEHA (`reason`), mida `DELETE`-il ei ole kombeks
 * kanda ja mille mõni vahendaja lihtsalt ära viskaks.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note-entry-retract", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, noteId, entryId } = await params;
    const body = await request.json().catch(() => ({}));
    const entry = await retractEntry({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingNoteId: noteId,
      entryId,
      reason: body?.reason
    });
    return json({ ok: true, entry });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
