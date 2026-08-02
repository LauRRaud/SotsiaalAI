import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { applyCapabilityTemplate, grantCapability } from "@/lib/org/members";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Capability andmine — kas ükshaaval või mallina.
 *
 * VÄRAV on `ORG_OWNER`, mitte `MEMBER_ADMIN`. Põhjus: `MEMBER_ADMIN` saaks
 * muidu anda iseendale `ORG_OWNER`-i ja kogu õigusmudel oleks mõttetu.
 * Liikmete haldamine ja ÕIGUSTE jagamine on kaks eri usaldustaset.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.ORG_OWNER);
    const membershipId = await readParam(context, "membershipId");
    const body = await readJsonBody(request);

    if (body?.templateKey) {
      const grants = await applyCapabilityTemplate(auth.organizationId, membershipId, {
        actorUserId: auth.userId,
        templateKey: String(body.templateKey),
        scopeUnitId: body?.scopeUnitId || null
      });
      return orgJson({ ok: true, grants }, 201);
    }

    const grant = await grantCapability(auth.organizationId, membershipId, {
      actorUserId: auth.userId,
      capability: body?.capability,
      scopeType: body?.scopeType,
      scopeUnitId: body?.scopeUnitId || null,
      validUntil: body?.validUntil || null,
      reason: body?.reason
    });
    return orgJson({ ok: true, grant }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.capability_grant_failed", "org");
  }
}
