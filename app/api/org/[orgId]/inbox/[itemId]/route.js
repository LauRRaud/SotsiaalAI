import { assertWritable } from "@/lib/org/accessContext";
import { assertOrgInboxEnabled } from "@/lib/org/flags";
import { getInboxItem, transitionInboxItem } from "@/lib/org/inbox";
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

/** Seisusiire. `RECALLED` on saatja õigus ja seda siit valida ei saa. */
export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgInboxEnabled();
    assertWritable(auth.context);
    const itemId = await readParam(context, "itemId");
    const body = await readJsonBody(request);
    const item = await transitionInboxItem(auth.context, itemId, {
      toStatus: String(body?.toStatus || "").trim(),
      reason: body?.reason
    });
    return orgJson({ ok: true, item });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.inbox_transition_failed", "org");
  }
}
