import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { activateModule, suspendModule } from "@/lib/org/organizations";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Aktiivsed moodulid. Tulevad juba kontekstist — eraldi päringut ei ole vaja. */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;
  return orgJson({ ok: true, activeModules: auth.context.activeModules });
}

/**
 * Mooduli aktiveerimine. Moodul ei anna ise sisuõigust — ta avab vastava
 * capability-kihi kasutamise (arenduskava §5.1). Seepärast ei anta siin kellelegi
 * ühtegi granti.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.ORG_OWNER);
    const body = await readJsonBody(request);
    const activated = await activateModule(auth.organizationId, {
      actorUserId: auth.userId,
      moduleKey: body?.moduleKey,
      reason: body?.reason
    });
    return orgJson({ ok: true, module: activated }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.module_activate_failed", "org");
  }
}

export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.ORG_OWNER);
    const body = await readJsonBody(request);
    const suspended = await suspendModule(auth.organizationId, {
      actorUserId: auth.userId,
      moduleKey: body?.moduleKey,
      reason: body?.reason
    });
    return orgJson({ ok: true, module: suspended });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.module_suspend_failed", "org");
  }
}
