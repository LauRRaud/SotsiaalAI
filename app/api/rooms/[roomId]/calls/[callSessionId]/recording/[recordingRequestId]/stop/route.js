import {
  ROOM_WIND_DOWN,
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
import { notifyCallRecordingAvailable } from "@/lib/calls/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(_req, { params }) {
  const roomId = await readRoomId(params);
  const callSessionId = await readCallSessionId(params);
  const recordingRequestId = await readRecordingRequestId(params);
  // SOL-ROOM-01: käimasoleva salvestuse peatamine, seega arhiveeritud ruumis lubatud.
  const access = await requireRoomCallAccess(roomId, { intent: ROOM_WIND_DOWN });
  if (!access.ok) return callError(access.message, access.status);
  const callAccess = await requireCallInRoom(callSessionId, roomId);
  if (!callAccess.ok) return callError(callAccess.message, callAccess.status);

  try {
    const service = createRoomCallService();
    const stopped = await service.stopRecording({
      callSessionId,
      recordingRequestId,
      userId: access.userId,
      canModerate: access.canModerate
    });
    const call = await loadCallForResponse(callSessionId);
    await emitCallEvent(roomId, call);
    /* T12 E7: salvestis muutub kättesaadavaks alles COMPLETED-olekus (E5 c
       katkestusrajal jääb taotlus STOPPED ja fail DELETED — siis ei teavitata
       kedagi). SOL-CALL-07: saaja on salvestise KANDJA (taotleja), sest fail
       kuulub temale — mitte kõik nõustunud, kelle jaoks see teade lubaks
       ligipääsu, mida dokumendipind kunagi ei anna. */
    if (stopped?.status === "COMPLETED") {
      await notifyCallRecordingAvailable({
        roomId,
        callSessionId,
        recordingRequestId
      });
    }
    return callJson({ ok: true, call });
  } catch (error) {
    const mapped = statusForCallError(error);
    return callError(mapped.message, mapped.status);
  }
}
