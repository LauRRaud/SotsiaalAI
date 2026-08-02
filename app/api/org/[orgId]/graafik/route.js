/**
 * TEENUSPÄEVIK E10 — juhi staatustahvli API.
 *
 * VÄRAVAT EI OLE ROUTE'IS: skoop on loendipõhine ja elab `dispatchBoard.js`-is.
 * Õiguseta liige saab TÜHJA tahvli, mitte 403 — veakood ütleks, et siin on
 * midagi, mida ta näha ei tohi, ja seegi on info.
 */
import { getDispatchBoard } from "@/lib/serviceLog/dispatchBoard";
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
    const board = await getDispatchBoard(auth.userId, {
      organizationId: auth.organizationId,
      date
    });
    return orgJson({ ok: true, board });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}
