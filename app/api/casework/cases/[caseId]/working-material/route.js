import { json } from "@/lib/documents/server";
import { archiveWorkingMaterial } from "@/lib/casework/retention";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * „Arhiveeri töömaterjal" — O-JTA-5 rada C, omaniku otsus 08.08.
 *
 * `DELETE` OLEKS VALE VERB ja see ei ole stiiliküsimus: kustuv asi ei ole see,
 * mida URL nimetab. Mustandi read JÄÄVAD alles koos ülekande fakti ja väljade
 * loendiga — kustub ainult sisu. `POST` ütleb ausalt, et see on TEGU, mitte
 * ressursi eemaldamine.
 *
 * TEGU EI KANNA KEHA. Ulatuse otsustab teenuskiht (kandmata mustandid selles
 * juhtumis); kliendi saadetud loend tähendaks, et pöördumatu kustutuse piiri
 * valib kutsuja — ja järgmine liides võiks selle piiri kogemata laiemaks teha.
 */
export async function POST(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:working-material", limit: 20 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const result = await archiveWorkingMaterial({
      ownerUserId: guard.userId,
      caseWorkAssistId: caseId
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
