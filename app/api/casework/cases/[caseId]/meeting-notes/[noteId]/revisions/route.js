import { json } from "@/lib/documents/server";
import { listEntryRevisions } from "@/lib/casework/caseWorkMeetingNote";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Märkme paranduste ja tühistuste ajalugu (SOL-CW-15).
 *
 * SIIT TULEB ALGNE SISU TAGASI. Ilma selle marsruudita oleks „eelmine versioon
 * säilib" lubadus, mida keegi kontrollida ei saa — ja pind ei suudaks eristada
 * puutumata märget sellest, mille kõik read on tühistatud.
 *
 * Kirjutusteed siin EI OLE: read on andmebaasi triggeri tasemel muutumatud.
 */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note-revisions", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, noteId } = await params;
    const result = await listEntryRevisions({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingNoteId: noteId
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
