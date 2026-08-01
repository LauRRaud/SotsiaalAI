import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { assertOrgSeatsEnabled } from "@/lib/org/flags";
import { endSeatPlan, updateSeatLimit } from "@/lib/org/seats";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Kohalimiidi muutmine. Limiiti ei saa langetada alla hõivatud kohtade arvu. */
export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const seatPlanId = await readParam(context, "seatPlanId");
    const body = await readJsonBody(request);
    const seatPlan = await updateSeatLimit(auth.organizationId, seatPlanId, {
      actorUserId: auth.userId,
      seatLimit: body?.seatLimit
    });
    return orgJson({ ok: true, seatPlan });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.seat_plan_update_failed", "org");
  }
}

/** Plaani lõpetamine lõpetab ka kõik selle kohad — koht plaanita ei ole koht. */
export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const seatPlanId = await readParam(context, "seatPlanId");
    const body = await readJsonBody(request);
    const seatPlan = await endSeatPlan(auth.organizationId, seatPlanId, {
      actorUserId: auth.userId,
      reason: body?.reason
    });
    return orgJson({ ok: true, seatPlan });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.seat_plan_end_failed", "org");
  }
}
