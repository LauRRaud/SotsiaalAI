import {
  callError,
  callJson,
  emitCovisionCallEvent,
  loadCallForResponse,
  readCovisionCaseId,
  requireCovisionCallAccess,
  statusForCallError,
  withCovisionCallMutation
} from "@/lib/calls/covisionRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req, { params }) {
  const covisionCaseId = await readCovisionCaseId(params);
  const access = await requireCovisionCallAccess(covisionCaseId);
  if (!access.ok) return callError(access.message, access.status);

  try {
    const call = await withCovisionCallMutation(covisionCaseId, access, ({ service, access: freshAccess }) => (
      service.startContextCall({ contextType: "COVISION", contextId: covisionCaseId, userId: freshAccess.userId })
    ));
    const payload = await loadCallForResponse(call.id);
    await emitCovisionCallEvent(covisionCaseId, payload);
    return callJson({ ok: true, call: payload });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
