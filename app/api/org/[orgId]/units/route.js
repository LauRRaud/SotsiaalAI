import { assertCapability, assertWritable } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { createUnit, listUnits } from "@/lib/org/structure";
import { orgErrorResponse, orgJson, readJsonBody, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Struktuur on kogu organisatsiooni jaoks LOETAV igale aktiivsele liikmele —
 * inimene peab teadma, millistesse tiimidesse ta organisatsioonis kuulub ja
 * kelle poole pöörduda. Struktuur ei ole tundlik sisu.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    const requestUrl = new URL(request.url);
    const units = await listUnits(auth.organizationId, {
      includeArchived: requestUrl.searchParams.get("includeArchived") === "1"
    });
    return orgJson({ ok: true, units });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}

/** Loomine nõuab `MEMBER_ADMIN`-i või omanikku — struktuur on haldustoiming. */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertWritable(auth.context);
    assertCapability(auth.context, OrganizationCapability.MEMBER_ADMIN);
    const body = await readJsonBody(request);
    const unit = await createUnit(auth.organizationId, {
      actorUserId: auth.userId,
      name: body?.name,
      type: body?.type,
      parentUnitId: body?.parentUnitId,
      sortOrder: body?.sortOrder
    });
    return orgJson({ ok: true, unit }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.unit_create_failed", "org");
  }
}
