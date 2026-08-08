import { json } from "@/lib/documents/server";
import { addEntry, listEntries } from "@/lib/casework/caseWorkMeetingNote";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note" });
  if (guard.response) return guard.response;

  try {
    const { caseId, noteId } = await params;
    const result = await listEntries({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingNoteId: noteId
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

/**
 * Uus kirje ühes kaheksast kihist.
 *
 * `layer` JA `provenance` on MÕLEMAD kohustuslikud (L4, L5). Kumbagi ei tuletata
 * ega panda vaikeväärtust: vaikeväärtus tähendaks, et märgistamata rida saab
 * vaikselt tähendada „faktiline asjaolu, töötaja kirjutatud" — ja just see vahe
 * on kogu kihilise märkme mõte.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note-entry", limit: 120 });
  if (guard.response) return guard.response;

  try {
    const { caseId, noteId } = await params;
    const body = await request.json().catch(() => ({}));
    const entry = await addEntry({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingNoteId: noteId,
      layer: body?.layer ?? null,
      text: body?.text ?? null,
      provenance: body?.provenance ?? null,
      ordinal: body?.ordinal
    });
    return json({ ok: true, entry }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
