import { json } from "@/lib/documents/server";
import { linkCaseWorkItem, listCaseWorkItems } from "@/lib/casework/caseWorkItem";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Juhtumi seosed (E6 operatsioon 5).
 *
 * Loend on pagineeritud ja kannab AINULT nähtavaid seoseid: ligipääsmatu rida
 * ei ilmu siia ega mõjuta detailvaate arvu (leping L3).
 */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:items" });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const search = new URL(request.url).searchParams;
    const result = await listCaseWorkItems({
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

/** Seose lisamine. 0 kopeeritud rida — sünnib ainult viit. */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:link", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const item = await linkCaseWorkItem({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      targetType: body?.targetType ?? null,
      targetId: body?.targetId ?? null
    });
    return json({ ok: true, item }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
