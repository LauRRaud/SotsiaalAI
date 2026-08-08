import { json } from "@/lib/documents/server";
import { recordCopyEvent } from "@/lib/casework/caseWorkTransfer";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kopeerimise auditirida (L16 kolmas samm).
 *
 * VASTUS ON 200 KA KORDUSE KORRAL (L22). `clientActionId` sünnib kliendis enne
 * lõikelauale kirjutust; kui vastus ei jõua tagasi ja kasutaja vajutab uuesti,
 * annab unikaalne indeks sama rea tagasi. Üks tegu = üks tulemus, ja `created`
 * ütleb ausalt, kas rida tekkis just nüüd.
 *
 * 201 EI KASUTATA MEELEGA: kordus ei loo midagi ja kaks eri koodi ühe teo kohta
 * sunniks liidest neid eristama, ilma et vahel oleks kasutaja jaoks tähendust.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:transfer", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId, draftId } = await params;
    const body = await request.json().catch(() => ({}));
    const { created, event } = await recordCopyEvent({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId,
      draftId,
      fieldKeys: body?.fieldKeys ?? null,
      clientActionId: body?.clientActionId ?? null
    });
    return json({ ok: true, created, event });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
