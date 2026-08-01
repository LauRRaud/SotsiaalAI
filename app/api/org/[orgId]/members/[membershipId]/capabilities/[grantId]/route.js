import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { revokeCapability } from "@/lib/org/members";
import { orgErrorResponse, orgJson, readParam, requireOrgContext } from "../../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Capability tühistamine. Sama usaldustase kui andmisel: `ORG_OWNER`. */
export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.ORG_OWNER);
    const membershipId = await readParam(context, "membershipId");
    const grantId = await readParam(context, "grantId");
    const grant = await revokeCapability(auth.organizationId, membershipId, grantId, {
      actorUserId: auth.userId
    });
    return orgJson({ ok: true, grant });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.capability_revoke_failed", "org");
  }
}
