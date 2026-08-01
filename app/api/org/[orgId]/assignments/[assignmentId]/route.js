import { assertWritable } from "@/lib/org/accessContext";
import { badRequest } from "@/lib/org/errors";
import { assertOrgInboxEnabled } from "@/lib/org/flags";
import { handOverWork, respondToAssignment } from "@/lib/org/inbox";
import { orgErrorResponse, orgJson, readJsonBody, readParam, requireOrgContext } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Määratud töötaja vastus: vastuvõtt või tagasilükkamine.
 *
 * AINULT määratud inimene ise — juht ei saa töötaja eest „vastu võtta".
 * Vastuvõtmine on nõustumine vastutusega, mitte haldustoiming.
 */
export async function PATCH(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgInboxEnabled();
    assertWritable(auth.context);
    const assignmentId = await readParam(context, "assignmentId");
    const body = await readJsonBody(request);
    const action = String(body?.action || "").trim();
    if (action !== "accept" && action !== "reject") throw badRequest("org.errors.unknown_action");

    const assignment = await respondToAssignment(auth.context, assignmentId, {
      accept: action === "accept",
      reason: body?.reason
    });
    return orgJson({ ok: true, assignment });
  } catch (error) {
    return orgErrorResponse(error, "org.errors.work_response_failed", "org");
  }
}

/**
 * Üleandmine. Lubatud kas töö määrajale VÕI senisele vastutajale endale —
 * puhkusele minev töötaja peab saama töö edasi anda ilma juhti ootamata.
 */
export async function POST(request, context) {
  const auth = await requireOrgContext(request, context);
  if (!auth.ok) return auth.response;

  try {
    assertOrgInboxEnabled();
    assertWritable(auth.context);
    const assignmentId = await readParam(context, "assignmentId");
    const body = await readJsonBody(request);
    const assignment = await handOverWork(auth.context, assignmentId, {
      toMembershipId: String(body?.toMembershipId || "").trim(),
      reason: body?.reason
    });
    return orgJson({ ok: true, assignment }, 201);
  } catch (error) {
    return orgErrorResponse(error, "org.errors.work_handover_failed", "org");
  }
}
