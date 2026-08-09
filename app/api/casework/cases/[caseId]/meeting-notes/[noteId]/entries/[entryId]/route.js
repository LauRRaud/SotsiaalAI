import { json } from "@/lib/documents/server";
import { updateEntry } from "@/lib/casework/caseWorkMeetingNote";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kirje PARANDAMINE.
 *
 * `reason` on KOHUSTUSLIK (SOL-CW-15): parandus säilitab eelmise versiooni,
 * tegija, aja ja põhjuse. Ilma põhjuseta annab teenuskiht 400 — auditirida ilma
 * põhjuseta ei erista eksituse parandamist sisu ümberkirjutamisest.
 *
 * `provenance` EI OLE loendis ja teenuskiht ei võta teda vastu ka siis, kui keha
 * ta kaasa paneb (L4).
 *
 * `layer` on muudetav, AGA teenuskiht keelab `PRIVAATNE_REFLEKSIOON`-i ja
 * sellest välja liikumise (409): ümbernimetamine oleks ainus tee, mis tühistaks
 * VAIKSELT lubaduse „privaatne refleksioon ei lähe STAR2-sse kunagi".
 */
export async function PATCH(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note-entry-update", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, noteId, entryId } = await params;
    const body = await request.json().catch(() => ({}));
    const entry = await updateEntry({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingNoteId: noteId,
      entryId,
      layer: body?.layer,
      text: body?.text,
      ordinal: body?.ordinal,
      reason: body?.reason
    });
    return json({ ok: true, entry });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

/* `DELETE`-i EI OLE ja seda ei tohi „sümmeetria pärast" tagasi kirjutada
   (SOL-CW-15). Kohtumise märkme rida on toimunud kohtumise jälg; tema kõva
   kustutus jättis alles tühja konteineri, mis näis endiselt tõendina. Tagasi
   võtta saab tühistusega: `POST .../entries/<id>/retract`. */
