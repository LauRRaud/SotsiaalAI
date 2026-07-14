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
  const access = await requireCovisionCallAccess(covisionCaseId, { allowTerminal: true });
  if (!access.ok) return callError(access.message, access.status);
  const body = await req.json().catch(() => ({}));

  try {
    const result = await withCovisionCallMutation(
      covisionCaseId,
      access,
      async ({ db, service, access: freshAccess }) => {
        let callSessionId = String(body?.callSessionId || "").trim();
        if (!callSessionId) {
          const active = await service.getContextCall({
            contextType: "COVISION",
            contextId: covisionCaseId
          });
          callSessionId = active?.id || "";
        }
        if (!callSessionId) {
          throw Object.assign(new Error("call.not_active"), { status: 404 });
        }
        const callAccess = await requireCallInCovision(callSessionId, covisionCaseId, { db });
        if (!callAccess.ok) {
          throw Object.assign(new Error(callAccess.message), { status: callAccess.status });
        }
        await service.endCall({
          callSessionId,
          userId: freshAccess.userId,
          canModerate: freshAccess.canModerate
        });
        return { terminal: false };
      },
      { onTerminal: () => ({ terminal: true }) }
    );
    if (result.terminal) return callJson({ ok: true, call: null, ended: true });
    await emitCovisionCallEvent(covisionCaseId, null);
    return callJson({ ok: true, call: null, ended: true });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
