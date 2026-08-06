import { json } from "@/lib/documents/server";
import { eraseCaseClientReference, getCaseWorkAssist } from "@/lib/casework/caseWorkAssist";
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
 * OMANIKUPIIRI KONTROLLIME SIIN, sest teenusoperatsioon ise on tahtlikult
 * omanikuvaba (teda kutsub ka konto kustutamise orkestreerija ilma sessioonita).
 */
export async function DELETE(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:erase-client", limit: 20 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    /* Võõras juhtum annab siin 404 — sama vastus mis olematu. */
    await getCaseWorkAssist({ ownerUserId: guard.userId, id: caseId });

    const body = await request.json().catch(() => ({}));
    const result = await eraseCaseClientReference({
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
