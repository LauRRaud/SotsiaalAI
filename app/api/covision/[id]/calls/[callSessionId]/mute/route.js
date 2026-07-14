import {
  callError,
  callJson,
  emitCovisionCallEvent,
  loadCallForResponse,
  readCallSessionId,
  readCovisionCaseId,
  requireCallInCovision,
  requireCovisionCallAccess,
  statusForCallError,
  withCovisionCallMutation
} from "@/lib/calls/covisionRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req, { params }) {
  const covisionCaseId = await readCovisionCaseId(params);
  const callSessionId = await readCallSessionId(params);
  const access = await requireCovisionCallAccess(covisionCaseId);
  if (!access.ok) return callError(access.message, access.status);
  const body = await req.json().catch(() => ({}));

  try {
    await withCovisionCallMutation(covisionCaseId, access, async ({ db, service, access: freshAccess }) => {
      const callAccess = await requireCallInCovision(callSessionId, covisionCaseId, { db });
      if (!callAccess.ok) throw Object.assign(new Error(callAccess.message), { status: callAccess.status });
      return service.setMuted({ callSessionId, userId: freshAccess.userId, micMuted: body?.micMuted === true });
    });
    const payload = await loadCallForResponse(callSessionId);
    await emitCovisionCallEvent(covisionCaseId, payload);
    return callJson({ ok: true, call: payload });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
