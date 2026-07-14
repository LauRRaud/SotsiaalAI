import {
  callError,
  callJson,
  emitCovisionCallEvent,
  loadCallForResponse,
  readCallSessionId,
  readCovisionCaseId,
  readRequestId,
  requireCallInCovision,
  requireCovisionCallAccess,
  statusForCallError,
  withCovisionCallMutation
} from "@/lib/calls/covisionRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(_req, { params }) {
  const covisionCaseId = await readCovisionCaseId(params);
  const callSessionId = await readCallSessionId(params);
  const requestId = await readRequestId(params);
  const access = await requireCovisionCallAccess(covisionCaseId);
  if (!access.ok) return callError(access.message, access.status);
  try {
    await withCovisionCallMutation(covisionCaseId, access, async ({ db, service, access: freshAccess }) => {
      const callAccess = await requireCallInCovision(callSessionId, covisionCaseId, { db });
      if (!callAccess.ok) throw Object.assign(new Error(callAccess.message), { status: callAccess.status });
      return service.resolveSpeakRequest({
        callSessionId,
        requestId,
        userId: freshAccess.userId,
        canModerate: freshAccess.canModerate
      });
    });
    const payload = await loadCallForResponse(callSessionId);
    await emitCovisionCallEvent(covisionCaseId, payload);
    return callJson({ ok: true, call: payload });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
