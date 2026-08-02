/**
 * TEENUSPÄEVIK — juhile saadetud kuuaruanded (E10a, saaja pool).
 *
 * VÄRAVAT EI OLE ROUTE'IS, sama põhjus mis vastuvõtulaual: skoop on
 * LOENDIPÕHINE. Päring käib `recipientMembershipId` järgi, seega tavaline liige
 * saab TÜHJA LOENDI, mitte 403 — veakood ütleks, et siin on midagi, mida ta
 * näha ei tohi, ja seegi on info.
 *
 * JUHT NÄEB SEDA, MIS TALLE SAADETI. Mitte kõike, mis organisatsioonis liigub,
 * ja mitte teenuspäevikut ennast: jagamise algatab töötaja (vt reportShare.js).
 */
import { listReceivedShares } from "@/lib/serviceLog/reportShare";
import { isServiceLogEnabled } from "@/lib/serviceLog/flags";
import { orgErrorResponse, orgJson, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    /* Lipp väljas = funktsiooni ei ole. Tühi loend, mitte viga: juhi vaade ei
       tohi lipust sõltuvalt katki minna. */
    if (!isServiceLogEnabled()) return orgJson({ ok: true, items: [] });
    const membershipId = auth.context?.membership?.id;
    const items = await listReceivedShares(membershipId ? [membershipId] : []);
    return orgJson({ ok: true, items });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}
