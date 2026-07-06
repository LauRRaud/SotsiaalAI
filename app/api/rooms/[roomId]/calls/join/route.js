import {
  callError,
  callJson,
  createRoomCallService,
  emitCallEvent,
  readRoomId,
  requireCallInRoom,
  requireRoomCallAccess,
  statusForCallError
} from "@/lib/calls/roomRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req, { params }) {
  const roomId = await readRoomId(params);
  const access = await requireRoomCallAccess(roomId);
  if (!access.ok) return callError(access.message, access.status);
  const body = await req.json().catch(() => ({}));

  try {
    const service = createRoomCallService();
    let callSessionId = String(body?.callSessionId || "").trim();
    if (!callSessionId) {
      const active = await service.getRoomCall({ roomId });
      callSessionId = active?.id || "";
    }
    if (!callSessionId) return callError("call.not_active", 404);
    const callAccess = await requireCallInRoom(callSessionId, roomId);
    if (!callAccess.ok) return callError(callAccess.message, callAccess.status);
    const result = await service.joinCall({ callSessionId, userId: access.userId });
    await emitCallEvent(roomId, result.call);
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
