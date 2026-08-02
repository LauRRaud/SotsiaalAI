import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { assertOrgSeatsEnabled } from "@/lib/org/flags";
import { assignSeat } from "@/lib/org/seats";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Koha andmine liikmele.
 *
 * Limiidi kontroll on teenusekihis TEHINGU ja reaLUKU all — mitte siin.
 * Route'i tasemel kontrollimine oleks TOCTOU: kaks samaaegset päringut
 * näeksid mõlemad vaba kohta.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const seatPlanId = await readParam(context, "seatPlanId");
    const body = await readJsonBody(request);
    const assignment = await assignSeat(auth.organizationId, {
      actorUserId: auth.userId,
      seatPlanId,
      membershipId: String(body?.membershipId || "").trim()
    });
    return orgJson({ ok: true, assignment }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.seat_assign_failed", "org");
  }
}
