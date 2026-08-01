import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { revokeInvite } from "@/lib/org/inviteService";
import { orgErrorResponse, orgJson, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kutse tühistamine. Pärast seda ei rakendu token enam kunagi (§11.2). */
export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const inviteId = await readParam(context, "inviteId");
    const invite = await revokeInvite(auth.organizationId, inviteId, { actorUserId: auth.userId });
    return orgJson({ ok: true, invite });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.invite_revoke_failed", "org");
  }
}
