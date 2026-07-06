import {
  callError,
  callJson,
  createCovisionCallService,
  emitCovisionCallEvent,
  readCovisionCaseId,
  requireCallInCovision,
  requireCovisionCallAccess,
  statusForCallError
} from "@/lib/calls/covisionRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req, { params }) {
  const covisionCaseId = await readCovisionCaseId(params);
  const access = await requireCovisionCallAccess(covisionCaseId);
  if (!access.ok) return callError(access.message, access.status);
  const body = await req.json().catch(() => ({}));

  try {
    const service = createCovisionCallService();
    let callSessionId = String(body?.callSessionId || "").trim();
    if (!callSessionId) {
      const active = await service.getContextCall({ contextType: "COVISION", contextId: covisionCaseId });
      callSessionId = active?.id || "";
    }
    if (!callSessionId) return callError("call.not_active", 404);
    const callAccess = await requireCallInCovision(callSessionId, covisionCaseId);
    if (!callAccess.ok) return callError(callAccess.message, callAccess.status);
    const result = await service.joinCall({ callSessionId, userId: access.userId });
    await emitCovisionCallEvent(covisionCaseId, result.call);
    return callJson({
      ok: true,
      ...result,
      livekitUrl: result.call?.provider === "LIVEKIT_SELF_HOSTED" ? process.env.LIVEKIT_URL || "" : ""
    });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
