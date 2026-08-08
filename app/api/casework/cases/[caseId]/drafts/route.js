import { json } from "@/lib/documents/server";
import { createDraft, listDrafts } from "@/lib/casework/caseWorkDraft";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* JTA-V1 (E5) — juhtumi STAR2 mustandid (ptk 4.5 kaheksa elementi). */

export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:draft" });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const search = new URL(request.url).searchParams;
    const result = await listDrafts({
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

/**
 * Uus mustand.
 *
 * `transferState` EI TULE kehast ja teenuskiht ei võta teda vastu: iga element
 * algab `MUSTAND`-ist ja edasi liigub ainult `transition` marsruudi kaudu.
 * Loomisel antud seis oleks tee, mis läheks olekumasinast mööda.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:draft-create", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const draft = await createDraft({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      draftType: body?.draftType ?? null
    });
    return json({ ok: true, draft }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
