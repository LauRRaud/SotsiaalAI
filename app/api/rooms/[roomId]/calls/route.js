import { callError, callJson, createRoomCallService, readRoomId, requireRoomCallAccess } from "@/lib/calls/roomRoutes";
import { getCallRuntimeConfig } from "@/lib/calls/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req, { params }) {
  const roomId = await readRoomId(params);
  const access = await requireRoomCallAccess(roomId);
  if (!access.ok) return callError(access.message, access.status);

  const service = createRoomCallService();
  const call = await service.getRoomCall({ roomId });
  const config = getCallRuntimeConfig();
  return callJson({
    ok: true,
    call,
    config: {
      provider: config.providerKey,
      providerAvailable: config.callServiceConfigured,
      maxParticipants: config.maxParticipants,
      recordingEnabled: config.recordingEnabled,
      liveKitEgressEnabled: config.liveKitEgressEnabled
    },
    canModerate: access.canModerate
  });
}
