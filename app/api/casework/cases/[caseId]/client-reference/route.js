import { json } from "@/lib/documents/server";
import { eraseCaseClientReference } from "@/lib/casework/caseWorkAssist";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kliendiviite kustutamine (E6 operatsioon 11).
 *
 * LUBATUD KA `READ_ONLY` JA `ARCHIVED` juhtumis — see on ainus erand
 * kirjutuskeelust (leping L17). Kirjutuskaitse kaitseb töötaja tööd, mitte
 * kolmanda isiku andmeid tema eest.
 *
 * IDEMPOTENTNE KÕRVALMÕJUDENI: teine kutse tagastab edu ilma uue auditireata.
 * Marsruut EI tee sellest 404-t — „juba kustutatud" on õnnestumine, mitte viga.
 *
 * OMANIKUPIIRI jõustab teenusoperatsioon samas tingimuslikus kirjutuses.
 */
export async function DELETE(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:erase-client", limit: 20 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await eraseCaseClientReference({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      actorUserId: guard.userId,
      actorKind: "USER",
      reason: body?.reason ?? "worker_request"
    });
    return json({ ok: true, changed: result.changed });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
