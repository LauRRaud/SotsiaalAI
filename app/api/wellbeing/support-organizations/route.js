import { isOrgWorkspaceEnabled } from "@/lib/org/flags";
import { listUserSupportOrganizations } from "@/lib/org/support";
import { requireWellbeingApiUser, wellbeingErrorResponse, wellbeingJson } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Kas abipalvel on päris adressaat (TO-6)? Kasutaja enda asutused, kus tal on
 * vähemalt üks tugitee. Ainult asutuse ID ja nimi; saaja valib inimene ise
 * asutuse tugivaates ja seal ta ka saatmise kinnitab.
 *
 * Päring ei jäta asutusele jälge. Suletud organisatsioonikihiga on vastus tühi
 * ja abipalve jääb kopeeritavaks tekstiks nagu enne.
 */
export async function GET(request) {
  const auth = await requireWellbeingApiUser(request);
  if (!auth.ok) return auth.response;

  try {
    const organizations = isOrgWorkspaceEnabled() ? await listUserSupportOrganizations(auth.userId) : [];
    return wellbeingJson({ ok: true, organizations });
  } catch (error) {
    return wellbeingErrorResponse(error, { label: "support organizations read failed" });
  }
}
