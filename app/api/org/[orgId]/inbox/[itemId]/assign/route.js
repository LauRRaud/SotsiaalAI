import { assertWritable } from "@/lib/org/accessContext";
import { assertOrgInboxEnabled } from "@/lib/org/flags";
import { assignWork } from "@/lib/org/inbox";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Töö määramine. `WORK_ASSIGNER` kontroll on teenusekihis ja ta on ÜKSUSE
 * skoobis — üksusejuht saab määrata ainult oma üksuse tööd.
 *
 * Topeltmääramise võistlus on kaetud osalise unikaalindeksiga; siin route'is
 * seda ei kontrollita, sest kaks samaaegset päringut näeksid mõlemad tühja kohta.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgInboxEnabled();
    assertWritable(auth.context);
    const itemId = await readParam(context, "itemId");
    const body = await readJsonBody(request);
    const assignment = await assignWork(auth.context, itemId, {
      assigneeMembershipId: String(body?.assigneeMembershipId || "").trim()
    });
    return orgJson({ ok: true, assignment }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.work_assign_failed", "org");
  }
}
