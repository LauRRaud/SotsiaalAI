import { json } from "@/lib/documents/server";
import { createCaseWorkAssist, listCaseWorkAssists } from "@/lib/casework/caseWorkAssist";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/* JUHTUM-V1 — juhtumiloend ja loomine.
   Omanikupiiri EI kontrollita siin: ta elab teenuskihis (leping L2). Kaks
   kontrolli tähendaks kaht tõde ja üks neist vananeks. */

/** Pagineeritud juhtumiloend (E6 operatsioon 9). */
export async function GET(request) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:list" });
  if (guard.response) return guard.response;

  try {
    const params = new URL(request.url).searchParams;
    const result = await listCaseWorkAssists({
      ownerUserId: guard.userId,
      cursor: params.get("cursor"),
      limit: params.get("limit"),
      retentionState: params.get("retentionState")
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

/** Juhtumi käsitsi loomine (E6 operatsioon 1). Automaatset loomist ei ole (L8). */
export async function POST(request) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:create", limit: 30 });
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const created = await createCaseWorkAssist({
      ownerUserId: guard.userId,
      preInquiryId: body?.preInquiryId ?? null,
      urgentRequestId: body?.urgentRequestId ?? null,
      clientUserId: body?.clientUserId ?? null,
      clientDisplayName: body?.clientDisplayName ?? null,
      clientExternalRef: body?.clientExternalRef ?? null,
      externalSystem: body?.externalSystem ?? null,
      externalReference: body?.externalReference ?? null,
      nextContactAt: body?.nextContactAt ?? null,
      /* Idempotentsusvõti (SOL-CW-12). Kliendi loodud ja valikuline: vana
         klient ilma võtmeta töötab edasi, aga kaotab korduskaitse. */
      clientActionId: body?.clientActionId ?? null
    });
    return json({ ok: true, case: created }, 201);
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
