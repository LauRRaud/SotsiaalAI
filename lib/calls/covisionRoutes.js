import { prisma } from "@/lib/prisma";
import { getVisibleCovisionCase } from "@/lib/covision";
import { requireCovisionAuth } from "@/lib/covisionApi";
import { createConfiguredCallProvider } from "@/lib/calls/providers";
import { createCallService, getCallRuntimeConfig } from "@/lib/calls/service";
import { callError, callJson, loadCallForResponse, statusForCallError } from "@/lib/calls/roomRoutes";

export { callError, callJson, loadCallForResponse, statusForCallError };

export async function readCovisionCaseId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.id || "").trim();
}

export async function readCallSessionId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.callSessionId || "").trim();
}

export async function readRequestId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.requestId || "").trim();
}

export async function requireCovisionCallAccess(covisionCaseId) {
  try {
    const auth = await requireCovisionAuth();
    if (!covisionCaseId) return { ok: false, status: 400, message: "api.common.missing_id" };
    const covisionCase = await getVisibleCovisionCase(auth, covisionCaseId);
    if (!covisionCase) return { ok: false, status: 404, message: "api.common.not_found" };
    const participant = (covisionCase.participants || []).find((item) => (
      item.userId === auth.userId || (auth.email && item.email === auth.email)
    ));
    const participantRole = String(participant?.role || "").toUpperCase();
    return {
      ok: true,
      ...auth,
      covisionCase,
      canModerate: auth.isAdmin || covisionCase.ownerId === auth.userId || participantRole === "CO_MODERATOR"
    };
  } catch (error) {
    return { ok: false, status: Number(error?.status) || 401, message: error?.message || "api.common.unauthorized" };
  }
}

export async function requireCallInCovision(callSessionId, covisionCaseId) {
  if (!callSessionId) return { ok: false, status: 400, message: "call.missing_call_session_id" };
  const call = await prisma.callSession.findFirst({
    where: {
      id: callSessionId,
      contextType: "COVISION",
      contextId: covisionCaseId
    },
    select: { id: true, status: true }
  });
  if (!call) return { ok: false, status: 404, message: "call.not_found" };
  return { ok: true, call };
}

export function createCovisionCallService() {
  return createCallService({
    prisma,
    provider: createConfiguredCallProvider(),
    maxParticipants: getCallRuntimeConfig().maxParticipants
  });
}

export async function emitCovisionCallEvent() {}
