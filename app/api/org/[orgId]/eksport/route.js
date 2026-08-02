import { assertCapability } from "@/lib/org/accessContext";
import { OrganizationCapability } from "@/lib/org/constants";
import { assertExportIsClean, buildOrganizationExport } from "@/lib/org/export";
import { notFound } from "@/lib/org/errors";
import { orgErrorResponse, orgJson, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Organisatsiooni eksport (E10).
 *
 * VÄRAV on `ORG_OWNER`: eksport koondab kogu organisatsiooni ühte faili ja see
 * on omaniku, mitte liikmehalduri otsus.
 *
 * `assertExportIsClean` jookseb ENNE vastuse saatmist. Kui mõni tulevane
 * `select` toob kaasa keelatud välja, kukub päring 500-ga — mitte ei lekita
 * vaikselt. Parem katkine eksport kui vaikne leke.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertCapability(auth.context, OrganizationCapability.ORG_OWNER);
    const payload = await buildOrganizationExport(auth.organizationId);
    if (!payload) throw notFound("org.errors.organization_not_found");
    assertExportIsClean(payload);
    return orgJson({ ok: true, export: payload });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.export_failed", "org");
  }
}
