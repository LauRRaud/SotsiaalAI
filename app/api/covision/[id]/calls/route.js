import { callError, callJson, createCovisionCallService, readCovisionCaseId, requireCovisionCallAccess } from "@/lib/calls/covisionRoutes";
import { getCallRuntimeConfig } from "@/lib/calls/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req, { params }) {
  const covisionCaseId = await readCovisionCaseId(params);
  const access = await requireCovisionCallAccess(covisionCaseId);
  if (!access.ok) return callError(access.message, access.status);

  const service = createCovisionCallService();
  const call = await service.getContextCall({ contextType: "COVISION", contextId: covisionCaseId });
  const config = getCallRuntimeConfig();
  return callJson({
    ok: true,
    call,
    config: {
      provider: config.providerKey,
      providerAvailable: config.callServiceConfigured,
      maxParticipants: config.maxParticipants,
      recordingEnabled: false,
      liveKitEgressEnabled: false
    },
    canModerate: access.canModerate
  });
}
