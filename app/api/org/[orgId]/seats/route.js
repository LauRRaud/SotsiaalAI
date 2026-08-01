import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { assertOrgSeatsEnabled } from "@/lib/org/flags";
import { createSeatPlan, listSeatPlans } from "@/lib/org/seats";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Organisatsiooni kohaplaanid.
 *
 * VÄRAV on `BILLING_MANAGER`, mitte `MEMBER_ADMIN`: raha ja liikmesus on eri
 * usaldustasemed. Liikmete haldaja saab kutsuda inimesi, aga mitte otsustada,
 * mida organisatsioon maksab.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const seatPlans = await listSeatPlans(auth.organizationId);
    return orgJson({ ok: true, seatPlans });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}

export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgSeatsEnabled();
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.BILLING_MANAGER);
    const body = await readJsonBody(request);
    const seatPlan = await createSeatPlan(auth.organizationId, {
      actorUserId: auth.userId,
      seatRole: body?.seatRole,
      seatLimit: body?.seatLimit,
      unitPriceCents: body?.unitPriceCents,
      source: body?.source,
      priceReason: body?.priceReason,
      validUntil: body?.validUntil
    });
    return orgJson({ ok: true, seatPlan }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.seat_plan_create_failed", "org");
  }
}
