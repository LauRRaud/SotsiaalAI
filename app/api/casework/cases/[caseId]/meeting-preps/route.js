import { json } from "@/lib/documents/server";
import { createMeetingPrep, listMeetingPreps } from "@/lib/casework/caseWorkMeetingPrep";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* JTA-V1 (E3) — juhtumi kohtumise ettevalmistused.
   Omanikupiiri EI kontrollita siin: ta elab teenuskihis. Kaks kontrolli
   tähendaks kaht tõde ja üks neist vananeks. */

export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep" });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const search = new URL(request.url).searchParams;
    const result = await listMeetingPreps({
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
  const guard = await guardCaseWorkRequest(request, { scope: "casework:meeting-prep-create", limit: 30 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const prep = await createMeetingPrep({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      meetingAt: body?.meetingAt ?? null
    });
    return json({ ok: true, prep }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
