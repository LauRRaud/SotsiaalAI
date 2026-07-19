import {
  callError,
  callJson,
  createRoomCallService,
  emitCallEvent,
  loadCallForResponse,
  readCallSessionId,
  readRecordingRequestId,
  readRoomId,
  requireCallInRoom,
  requireRoomCallAccess,
  statusForCallError
} from "@/lib/calls/roomRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// E6 (12 K1): omaniku/moderaatori käsitsi salvestise kustutus — kustutab füüsilise
// failiobjekti + seotud dokumendi ja märgib rea DELETED (sama purge-tuum nagu
// auto-retention). POST, et olla järjekindel teiste salvestuse-action-route'idega.
export async function POST(_req, { params }) {
  const roomId = await readRoomId(params);
  const callSessionId = await readCallSessionId(params);
  const recordingRequestId = await readRecordingRequestId(params);
  const access = await requireRoomCallAccess(roomId);
  if (!access.ok) return callError(access.message, access.status);
  const callAccess = await requireCallInRoom(callSessionId, roomId);
  if (!callAccess.ok) return callError(callAccess.message, callAccess.status);

  try {
    const service = createRoomCallService();
    await service.deleteRecordingFile({
      callSessionId,
      recordingRequestId,
      userId: access.userId,
      canModerate: access.canModerate
    });
    const call = await loadCallForResponse(callSessionId);
    await emitCallEvent(roomId, call);
    return callJson({ ok: true, call });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
