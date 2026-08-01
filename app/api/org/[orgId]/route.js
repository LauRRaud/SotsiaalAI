import { assertCapability, assertWritable, toClientContext } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { updateOrganization } from "@/lib/org/organizations";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Organisatsiooni ülevaade. Iga aktiivne liige näeb seda — see ongi tema tööruum.
 * Vastus on `toClientContext` projektsioon, mis EI sisalda üksuste puud ega ühtegi
 * välja, mille pealt saaks järeldada teiste liikmete tegevust.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;
  return orgJson({ ok: true, context: toClientContext(auth.context) });
}

export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.ORG_OWNER);
    const body = await readJsonBody(request);
    const organization = await updateOrganization(auth.organizationId, {
      actorUserId: auth.userId,
      displayName: body?.displayName,
      legalName: body?.legalName,
      registryCode: body?.registryCode,
      municipalityId: body?.municipalityId,
      defaultLocale: body?.defaultLocale,
      timezone: body?.timezone
    });
    return orgJson({ ok: true, organization });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.update_failed", "org");
  }
}
