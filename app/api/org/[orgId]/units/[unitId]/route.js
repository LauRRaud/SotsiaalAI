import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { archiveUnit, moveUnit, updateUnit } from "@/lib/org/structure";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Üksuse muutmine. `parentUnitId` kehas suunatakse `moveUnit`-i, mitte
 * `updateUnit`-i: vanema muutmine on struktuurne toiming oma invariantidega
 * (tsükkel, sügavus, alampuu ümberarvutus) ja oma auditireaga.
 */
export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const unitId = await readParam(context, "unitId");
    const body = await readJsonBody(request);

    if (Object.hasOwn(body || {}, "parentUnitId")) {
      const moved = await moveUnit(auth.organizationId, unitId, {
        actorUserId: auth.userId,
        parentUnitId: body.parentUnitId || null
      });
      return orgJson({ ok: true, moved });
    }

    const unit = await updateUnit(auth.organizationId, unitId, {
      actorUserId: auth.userId,
      name: body?.name,
      type: body?.type,
      sortOrder: body?.sortOrder
    });
    return orgJson({ ok: true, unit });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.unit_update_failed", "org");
  }
}

/** Arhiveerimine, MITTE kustutamine — üksus kannab ajalugu, kes kus töötas. */
export async function DELETE(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const unitId = await readParam(context, "unitId");
    const unit = await archiveUnit(auth.organizationId, unitId, { actorUserId: auth.userId });
    return orgJson({ ok: true, unit });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.unit_archive_failed", "org");
  }
}
