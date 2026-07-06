import {
  callError,
  callJson,
  createCovisionCallService,
  emitCovisionCallEvent,
  loadCallForResponse,
  readCallSessionId,
  readCovisionCaseId,
  requireCallInCovision,
  requireCovisionCallAccess,
  statusForCallError
} from "@/lib/calls/covisionRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req, { params }) {
  const covisionCaseId = await readCovisionCaseId(params);
  const callSessionId = await readCallSessionId(params);
  const access = await requireCovisionCallAccess(covisionCaseId);
  if (!access.ok) return callError(access.message, access.status);
  const callAccess = await requireCallInCovision(callSessionId, covisionCaseId);
  if (!callAccess.ok) return callError(callAccess.message, callAccess.status);

  try {
    const service = createCovisionCallService();
    const request = await service.createSpeakRequest({ callSessionId, userId: access.userId });
    const payload = await loadCallForResponse(callSessionId);
    await emitCovisionCallEvent(covisionCaseId, payload);
    return callJson({ ok: true, request, call: payload });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
