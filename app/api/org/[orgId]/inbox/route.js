import { assertOrgInboxEnabled } from "@/lib/org/flags";
import { listInboxItems } from "@/lib/org/inbox";
import { orgErrorResponse, orgJson, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Organisatsiooni vastuvõtulaud.
 *
 * VÄRAVAT EI OLE ROUTE'IS — skoop on `lib/org/inbox.js`-is ja ta on
 * loendipõhine, mitte tõeväärtuspõhine: koordinaator näeb oma skoopi, määratud
 * töötaja näeb oma tööd, tavaline liige saab TÜHJA LOENDI.
 *
 * Tühi loend, mitte 403: veakood ütleks, et postkast on olemas ja seal on
 * midagi, mida see inimene näha ei tohi. Loend ei ütle kummagi kohta midagi.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgInboxEnabled();
    const requestUrl = new URL(request.url);
    const items = await listInboxItems(auth.context, {
      includeClosed: requestUrl.searchParams.get("includeClosed") === "1"
    });
    return orgJson({ ok: true, items });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}
