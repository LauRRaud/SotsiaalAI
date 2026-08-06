import { json } from "@/lib/documents/server";
import { getCaseWorkAssist, updateCaseWorkAssist } from "@/lib/casework/caseWorkAssist";
import { countCaseWorkItems } from "@/lib/casework/caseWorkItem";
import { countOpenMissingInfo } from "@/lib/casework/caseWorkMissingInfo";
import { caseWorkErrorResponse, guardCaseWorkRequest } from "@/lib/casework/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Juhtumi detailvaade (E6 operatsioon 10). */
export async function GET(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:get" });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const record = await getCaseWorkAssist({ ownerUserId: guard.userId, id: caseId });
    /* Mõlemad loendurid kasutavad SAMA nähtavusfiltrit mis loendid. Kui nad
       lahku läheksid, ütleks vaade „3 seost" ja näitaks kahte — ja see vahe ise
       oleks leke (leping L3). */
    const [itemCount, openMissingInfo] = await Promise.all([
      countCaseWorkItems({ ownerUserId: guard.userId, caseWorkAssistId: caseId }),
      countOpenMissingInfo({ ownerUserId: guard.userId, caseWorkAssistId: caseId })
    ]);
    return json({ ok: true, case: record, counts: { items: itemCount, openMissingInfo } });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}

/**
 * Põhiandmete muutmine (E6 operatsioonid 2–4): kliendiviide, järgmine kontakt,
 * STAR-i viide. Päritolu EI OLE siin — ta on muutumatu (L12).
 */
export async function PATCH(request, { params }) {
  const guard = await guardCaseWorkRequest(request, { scope: "casework:update", limit: 60 });
  if (guard.response) return guard.response;

  try {
    const { caseId } = await params;
    const body = await request.json().catch(() => ({}));
    const patch = {};
    for (const field of [
      "clientUserId",
      "clientDisplayName",
      "clientExternalRef",
      "externalSystem",
      "externalReference",
      "nextContactAt",
      /* Päritoluväljad võetakse SIHILIKULT kaasa: teenuskiht keeldub nendega
         selge veaga. Kui filtreeriksime nad vaikselt välja, arvaks klient, et
         muudatus õnnestus. */
      "preInquiryId",
      "urgentRequestId"
    ]) {
      if (field in (body || {})) patch[field] = body[field];
    }

    const updated = await updateCaseWorkAssist({ ownerUserId: guard.userId, id: caseId, patch });
    return json({ ok: true, case: updated });
  } catch (error) {
    return caseWorkErrorResponse(error, guard.locale);
  }
}
