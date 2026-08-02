import { assertCapability } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { listMembers } from "@/lib/org/members";
import { orgErrorResponse, orgJson, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Liikmete nimekiri. Nõuab `MEMBER_ADMIN`-i — see EI ole avalik kontaktiloend,
 * vaid haldusvaade, mis sisaldab e-posti aadresse ja õigusi.
 *
 * Projektsioon on `lib/org/members.js`-is ja ta ei sisalda ühtegi
 * kasutusmõõdikut ega privaatvälja (arenduskava §7.4). Kui siia tekib kunagi
 * „viimati aktiivne", on see lepingurikkumine.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const requestUrl = new URL(request.url);
    const members = await listMembers(auth.organizationId, {
      includeEnded: requestUrl.searchParams.get("includeEnded") === "1"
    });
    return orgJson({ ok: true, members });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}
