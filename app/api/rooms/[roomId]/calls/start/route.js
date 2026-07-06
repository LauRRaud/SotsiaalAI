import {
  callError,
  callJson,
  createRoomCallService,
  emitCallEvent,
  loadCallForResponse,
  readRoomId,
  requireRoomCallAccess,
  statusForCallError
} from "@/lib/calls/roomRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req, { params }) {
  const roomId = await readRoomId(params);
  const access = await requireRoomCallAccess(roomId);
  if (!access.ok) return callError(access.message, access.status);

  try {
    const service = createRoomCallService();
    const call = await service.startRoomCall({ roomId, userId: access.userId });
    const payload = await loadCallForResponse(call.id);
    await emitCallEvent(roomId, payload);
    return callJson({ ok: true, call: payload });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
