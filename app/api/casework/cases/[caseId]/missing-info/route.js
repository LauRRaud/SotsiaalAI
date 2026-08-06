import { json } from "@/lib/documents/server";
import { addMissingInfo, listMissingInfo } from "@/lib/casework/caseWorkMissingInfo";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Puuduva info loend (E6 operatsioon 6). Lahtised enne lahendatuid. */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:missing-info" });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const search = new URL(request.url).searchParams;
    const result = await listMissingInfo({
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

/** Punkti lisamine. Päritolu on KOHUSTUSLIK ja valideeritud (leping L5). */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:missing-info-add", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const item = await addMissingInfo({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      text: body?.text ?? null,
      provenance: body?.provenance ?? null
    });
    return json({ ok: true, item }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
