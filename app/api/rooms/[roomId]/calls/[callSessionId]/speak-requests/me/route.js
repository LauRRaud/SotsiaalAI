import {
  callError,
  callJson,
  createRoomCallService,
  emitCallEvent,
  loadCallForResponse,
  readCallSessionId,
  readRoomId,
  requireCallInRoom,
  requireRoomCallAccess,
  statusForCallError
} from "@/lib/calls/roomRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(_req, { params }) {
  const roomId = await readRoomId(params);
  const callSessionId = await readCallSessionId(params);
  const access = await requireRoomCallAccess(roomId);
  if (!access.ok) return callError(access.message, access.status);
  const callAccess = await requireCallInRoom(callSessionId, roomId);
  if (!callAccess.ok) return callError(callAccess.message, callAccess.status);

  try {
    const service = createRoomCallService();
    await service.cancelSpeakRequest({ callSessionId, userId: access.userId });
    const payload = await loadCallForResponse(callSessionId);
    await emitCallEvent(roomId, payload);
    return callJson({ ok: true, call: payload });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
