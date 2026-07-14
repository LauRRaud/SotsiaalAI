import {
  callError,
  callJson,
  emitCovisionCallEvent,
  readCovisionCaseId,
  requireCallInCovision,
  requireCovisionCallAccess,
  statusForCallError,
  withCovisionCallMutation
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
    const result = await withCovisionCallMutation(covisionCaseId, access, async ({ db, service, access: freshAccess }) => {
      let callSessionId = String(body?.callSessionId || "").trim();
      if (!callSessionId) {
        const active = await service.getContextCall({ contextType: "COVISION", contextId: covisionCaseId });
        callSessionId = active?.id || "";
      }
      if (!callSessionId) throw Object.assign(new Error("call.not_active"), { status: 404 });
      const callAccess = await requireCallInCovision(callSessionId, covisionCaseId, { db });
      if (!callAccess.ok) throw Object.assign(new Error(callAccess.message), { status: callAccess.status });
      return service.joinCall({ callSessionId, userId: freshAccess.userId });
    });
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
