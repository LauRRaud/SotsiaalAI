import { json } from "@/lib/documents/server";
import { createNote, listNotes } from "@/lib/casework/caseWorkMeetingNote";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* JTA-V1 (E4) — juhtumi kohtumise märkmed.
   Omanikupiiri EI kontrollita siin: ta elab teenuskihis. */

export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note" });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const search = new URL(request.url).searchParams;
    const result = await listNotes({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      cursor: search.get("cursor"),
      limit: search.get("limit")
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-note-create", limit: 30 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const note = await createNote({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingPrepId: body?.meetingPrepId ?? null,
      meetingAt: body?.meetingAt ?? null
    });
    return json({ ok: true, note }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
