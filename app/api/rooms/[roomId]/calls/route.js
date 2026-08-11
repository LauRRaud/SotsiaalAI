import { ROOM_READ, callError, callJson, createRoomCallService, readRoomId, requireRoomCallAccess } from "@/lib/calls/roomRoutes";
import { getCallRuntimeConfig } from "@/lib/calls/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req, { params }) {
  const roomId = await readRoomId(params);
  // SOL-ROOM-01: kõne seisu lugemine, seega arhiveeritud ruumis lubatud.
  const access = await requireRoomCallAccess(roomId, { intent: ROOM_READ });
  if (!access.ok) return callError(access.message, access.status);

  // E3 (audit 3 K1): püünis hoiab {ok, messageKey} lepingu ka DB-/teenusetõrkel.
  try {
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
  } catch (err) {
    console.error("[room calls GET] failed", err);
    return callError("api.common.server_error", 500);
  }
}
