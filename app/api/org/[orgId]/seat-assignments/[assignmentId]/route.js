import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { assertOrgSeatsEnabled } from "@/lib/org/flags";
import { releaseSeat } from "@/lib/org/seats";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Koha vabastamine. Liikmesus ja õigused jäävad puutumata — koht on ainult maksja telg. */
export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const assignmentId = await readParam(context, "assignmentId");
    const body = await readJsonBody(request);
    const assignment = await releaseSeat(auth.organizationId, assignmentId, {
      actorUserId: auth.userId,
      reason: body?.reason
    });
    return orgJson({ ok: true, assignment });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.seat_release_failed", "org");
  }
}
