import { assertCapability } from "@/lib/org/accessContext";
import { listOrgAuditEvents } from "@/lib/org/audit";
import { OrganizationCapability } from "@/lib/org/constants";
import { orgErrorResponse, orgJson, requireOrgContext } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Organisatsiooni ENDA haldussündmused (arenduskava §7.3).
 *
 * Kaks piiri teevad sellest org-auditi, mitte platvormi auditi:
 *   1. ainult `org.*` toimingud;
 *   2. ainult selle organisatsiooni ressursid.
 * Projektsioon ei sisalda IP-d, User-Agenti ega ühtegi privaatobjekti — vt
 * `lib/org/audit.js`.
 */
export async function GET(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertCapability(auth.context, OrganizationCapability.AUDIT_VIEWER);
    const requestUrl = new URL(request.url);
    const events = await listOrgAuditEvents(auth.organizationId, {
      take: Number(requestUrl.searchParams.get("take")) || 100
    });
    return orgJson({ ok: true, events });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.list_failed", "org");
  }
}
