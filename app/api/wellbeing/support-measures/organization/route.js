import { isOrgWorkspaceEnabled } from "@/lib/org/flags";
import { listUserOrganizationSupportMeasures } from "@/lib/org/supportMeasures";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Mida töötaja asutus pakub — „Minu tugivõimalused" eeltäide (TO-6, ptk 8.13).
 *
 * Ainult lugemine ja ainult kasutaja ENDA aktiivsete liikmesuste asutused.
 * Päring ei jäta asutusele mingit jälge: asutus ei saa teada, et töötaja oma
 * tugivõimalusi vaatas. Suletud organisatsioonikihiga on vastus tühi loend,
 * mitte viga — tööriist töötab siis nagu enne.
 */
export async function GET(request) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const organizations = isOrgWorkspaceEnabled() ? await listUserOrganizationSupportMeasures(auth.userId) : [];
    return wellbeingJson({ ok: true, organizations });
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "support-measures organization read failed" });
  }
}
