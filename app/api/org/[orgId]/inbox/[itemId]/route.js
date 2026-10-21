import { assertWritable } from "@/lib/org/accessContext";
import { assertOrgInboxEnabled } from "@/lib/org/flags";
import { getInboxItem, setInboxItemDueDate, transitionInboxItem } from "@/lib/org/inbox";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Avab ühe kirje koos SAATJA KINNITATUD paketiga.
 *
 * Projektsioon on valge nimekiri (`projectSourcePackage`) ja ta on määratud
 * töötajale ning koordinaatorile TÄPSELT SAMA. Teekonda, vestlust ega muud
 * pöörduja privaatset materjali siit ei saa — „jaga kogu Teekond" nuppu ei ole
 * olemas (arenduskava §14.5).
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgInboxEnabled();
    const itemId = await readParam(context, "itemId");
    const item = await getInboxItem(auth.context, itemId);
    return orgJson({ ok: true, item });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.not_found", "org");
  }
}

/**
 * Seisusiire koordinaatori käega. `RECALLED` on saatja õigus ja seda siit valida ei saa;
 * „määratud" ja „vastu võetud" tekivad määramisest ja töötaja vastusest, samuti mitte siit.
 * „Ootab määramist" võtab töö töötajalt tagasi (vt `transitionInboxItem`).
 */
export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgInboxEnabled();
    assertWritable(auth.context);
    const itemId = await readParam(context, "itemId");
    const body = await readJsonBody(request);
    /* Töö tähtaeg (koordinaator): `dueOn` = "YYYY-MM-DD" või null eemaldamiseks. */
    if (body && Object.prototype.hasOwnProperty.call(body, "dueOn") && !body.toStatus) {
      const due = await setInboxItemDueDate(auth.context, itemId, { dueOn: body.dueOn });
      return orgJson({ ok: true, due });
    }
    const item = await transitionInboxItem(auth.context, itemId, {
      toStatus: String(body?.toStatus || "").trim(),
      reason: body?.reason
    });
    return orgJson({ ok: true, item });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.inbox_transition_failed", "org");
  }
}
