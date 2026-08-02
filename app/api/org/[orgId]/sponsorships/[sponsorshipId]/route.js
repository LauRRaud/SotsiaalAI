import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { assertOrgSeatsEnabled } from "@/lib/org/flags";
import { revokeClientSponsorship } from "@/lib/org/sponsorship";
import { orgErrorResponse, orgJson, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Sponsorluse tühistamine ENNE vastuvõtmist.
 *
 * Juba vastu võetud sponsorlust see ei puuduta: pöörduja tellimus jääb kehtima
 * kuni `validUntil`-ini. Organisatsioon ei saa inimeselt ligipääsu tagantjärele
 * ära võtta (arenduskava §5.6).
 */
export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const sponsorshipId = await readParam(context, "sponsorshipId");
    const sponsorship = await revokeClientSponsorship(auth.organizationId, sponsorshipId, {
      actorUserId: auth.userId
    });
    return orgJson({ ok: true, sponsorship });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.sponsorship_revoke_failed", "org");
  }
}
