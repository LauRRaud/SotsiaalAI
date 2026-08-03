/**
 * TEENUSPÄEVIK E10 — juhi staatustahvli API.
 *
 * VÄRAVAT EI OLE ROUTE'IS: skoop on loendipõhine ja elab `dispatchBoard.js`-is.
 * Õiguseta liige saab TÜHJA tahvli, mitte 403 — veakood ütleks, et siin on
 * midagi, mida ta näha ei tohi, ja seegi on info.
 */
import { getDispatchBoard } from "@/lib/serviceLog/dispatchBoard";
import { assignVisit, listAssignableWorkers, reassignVisit } from "@/lib/serviceLog/dispatchAssign";
import { ServiceLogError } from "@/lib/serviceLog/errors";
import { isServiceLogDayRouteEnabled } from "@/lib/serviceLog/flags";
import { orgErrorResponse, orgJson, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    /* Lipp väljas = päevateekonda ei ole, seega tahvlil ei ole midagi näidata.
       Tühi vastus, mitte viga: juhi vaade ei tohi lipust sõltuvalt katki minna. */
    if (!isServiceLogDayRouteEnabled()) return orgJson({ ok: true, board: { allowed: false, workers: [] } });

    const date = new URL(request.url).searchParams.get("date");
    const [board, workers] = await Promise.all([
      getDispatchBoard(auth.userId, { organizationId: auth.organizationId, date }),
      /* Kellele saab määrata, tuleb SERVERILT — sama loend on ka määramise
         valideerimise alus, seega „valikus ei olnud" ja „ei lubata määrata"
         ei saa üksteisest lahku minna. */
      listAssignableWorkers(auth.userId, auth.organizationId)
    ]);
    return orgJson({ ok: true, board, workers });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}

/**
 * Tööde määramine ja asendus.
 *
 * KAKS TOIMINGUT, ÜKS MARSRUUT: mõlemad kirjutavad TEISE inimese päevikusse ja
 * mõlema õigus tuleb samast kohast. Eraldi marsruudid tähendaks kahte kohta,
 * kus see kontroll peab olema — ja üks neist jääks ükskord uuendamata.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    if (!isServiceLogDayRouteEnabled()) return orgErrorResponse({ status: 404 }, "org.errors.not_found", "org");

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "assign") {
      const visit = await assignVisit(auth.userId, {
        organizationId: auth.organizationId,
        workerUserId: body?.workerUserId,
        clientDisplayName: body?.clientDisplayName,
        address: body?.address,
        plannedStartAt: body?.plannedStartAt,
        note: body?.note
      });
      return orgJson({ ok: true, visit });
    }

    if (action === "reassign") {
      const visit = await reassignVisit(auth.userId, {
        organizationId: auth.organizationId,
        visitId: body?.visitId,
        toWorkerUserId: body?.workerUserId,
        reason: body?.reason
      });
      return orgJson({ ok: true, visit });
    }

    /* Tundmatu toiming on 400, mitte vaikne ei-midagi. */
    return orgErrorResponse({ status: 400 }, "service_log.errors.invalid_input", "service_log");
  } catch (error) {
    /* Teenuspäeviku veakoodid kannavad oma staatust ja sõnumit — org-kihi
       üldine „list_failed" varjaks ära, MIKS määramine ei õnnestunud. */
    if (error instanceof ServiceLogError) {
      return orgErrorResponse({ status: error.status }, error.messageKey, "service_log");
    }
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}
