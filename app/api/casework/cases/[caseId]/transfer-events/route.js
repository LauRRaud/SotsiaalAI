import { json } from "@/lib/documents/server";
import { listTransferEvents } from "@/lib/casework/caseWorkTransfer";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Juhtumi ülekandeajalugu (L8).
 *
 * AINULT `GET`. `POST`, `PATCH` ja `DELETE` puuduvad, sest tabel on append-only
 * — ridu sünnitavad ainult kopeerimine ja ülekantuks märkimine, kumbki oma
 * marsruudil. Tõend, mida saab tagantjärele muuta või kustutada, ei ole tõend.
 *
 * Vastuses ei ole ühtegi kopeeritud VÄÄRTUST — ainult väljade võtmed (L8).
 */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:transfer", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const url = new URL(request.url);
    const { items, nextCursor } = await listTransferEvents({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      cursor: url.searchParams.get("cursor"),
      limit: url.searchParams.get("limit")
    });
    return json({ ok: true, items, nextCursor });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
