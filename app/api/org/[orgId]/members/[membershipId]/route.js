import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import {
  endMembership,
  reactivateMembership,
  setPrimaryUnit,
  suspendMembership
} from "@/lib/org/members";
import { badRequest } from "@/lib/org/errors";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Liikmesuse haldus. `action` on selgesõnaline, mitte tuletatud väljadest —
 * „peata", „taasta" ja „vaheta üksus" on eri toimingud eri auditiridadega ja
 * neid ei tohi ühte PATCH-i sisse ära peita.
 */
export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const membershipId = await readParam(context, "membershipId");
    const body = await readJsonBody(request);
    const action = String(body?.action || "").trim();

    if (action === "suspend") {
      const membership = await suspendMembership(auth.organizationId, membershipId, {
        actorUserId: auth.userId
      });
      return orgJson({ ok: true, membership });
    }
    if (action === "reactivate") {
      const membership = await reactivateMembership(auth.organizationId, membershipId, {
        actorUserId: auth.userId
      });
      return orgJson({ ok: true, membership });
    }
    if (action === "setPrimaryUnit") {
      const membershipUnit = await setPrimaryUnit(auth.organizationId, membershipId, {
        actorUserId: auth.userId,
        unitId: String(body?.unitId || "").trim()
      });
      return orgJson({ ok: true, membershipUnit });
    }
    throw badRequest("org.errors.unknown_action");
  } catch (error) {
    return orgErrorResponse(error, "org.errors.member_update_failed", "org");
  }
}

/**
 * Liikmesuse lõpetamine.
 *
 * Inimene tohib ALATI ise lahkuda — see ei nõua `MEMBER_ADMIN`-it, sest
 * organisatsioon ei oma inimest (arenduskava §D1). Teise inimese eemaldamine
 * nõuab `MEMBER_ADMIN`-it.
 *
 * Kumbki tee ei puuduta kontot, tellimust ega ühtegi isiklikku objekti.
 */
export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    const membershipId = await readParam(context, "membershipId");
    const isSelf = membershipId === auth.context.membership?.id;
    if (!isSelf) assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);

    const body = await readJsonBody(request);
    const membership = await endMembership(auth.organizationId, membershipId, {
      actorUserId: auth.userId,
      reason: body?.reason
    });
    return orgJson({ ok: true, membership });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.member_end_failed", "org");
  }
}
