import prismaClient from "@/lib/prisma";
import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";

/* T12 E7 — kõne/salvestuse elutsükli teavitused (T04 pind).
   Leping: payloadis ainult ID, olek ja ohutu sihtlink. Siit ei lähe välja
   sõnumi sisu, salvestise heli ega kokkuvõtte teksti — teavituse tekst tuleb
   i18n-võtmest (notifications.events.*), mitte serverist.

   Kaks reeglit hoiavad kõnevoo ohutuna:
   1) Teavitamine EI tohi kunagi kukutada kõnet ega salvestuse lõpetamist —
      iga saaja on eraldi try/catch'i sees ja funktsioon ei viska.
   2) Saaja kontrollitakse ka kirjutamise hetkel (createNotificationEvent
      verifyRecipient = vaikimisi true), seega vahepeal lahkunud liige või
      nõusoleku tagasi võtnud osaleja ei saa teavitust isegi siis, kui ta
      allpool olevasse loendisse veel jõudis. */

function emptyCounters() {
  return { created: 0, existing: 0, skipped: 0, failed: 0 };
}

function canWriteNotifications(db) {
  return Boolean(db?.notificationEvent?.create);
}

async function emitToRecipients(db, { userIds, now, build }) {
  const counters = emptyCounters();
  for (const userId of userIds) {
    try {
      const result = await createNotificationEvent(build(userId), { db, now });
      counters[result.created ? "created" : "existing"] += 1;
    } catch {
      // Saaja ei kvalifitseeru (lahkus ruumist, võttis nõusoleku tagasi) või
      // teavituse kirjutamine ebaõnnestus — kõne ise ei tohi sellest katkeda.
      counters.failed += 1;
    }
  }
  return counters;
}

function uniqueUserIds(rows, { exclude = null } = {}) {
  const ids = new Set();
  for (const row of rows || []) {
    const userId = String(row?.userId || "").trim();
    if (!userId || userId === exclude) continue;
    ids.add(userId);
  }
  return [...ids];
}

/** Ruumis algas kõne → teavita ruumi praegusi liikmeid peale alustaja. */
export async function notifyRoomCallStarted({
  db = prismaClient,
  roomId,
  callSessionId,
  actorUserId,
  now = new Date()
} = {}) {
  if (!roomId || !callSessionId || !canWriteNotifications(db) || !db?.roomMember?.findMany) {
    return { ...emptyCounters(), skipped: 1 };
  }
  const members = await db.roomMember.findMany({
    where: { roomId, leftAt: null, ...(actorUserId ? { userId: { not: actorUserId } } : {}) },
    select: { userId: true }
  });
  const userIds = uniqueUserIds(members, { exclude: actorUserId });
  return emitToRecipients(db, {
    userIds,
    now,
    build: (userId) => ({
      userId,
      type: NOTIFICATION_EVENT_TYPES.CALL_STARTED,
      sourceId: callSessionId,
      targetId: roomId,
      dedupeSuffix: "started",
      // Kõne on käimasolev sündmus — e-kiri jõuaks kohale pärast selle lõppu.
      emailPolicy: "NONE"
    })
  });
}

/** Salvestis lõpetati ja on saadaval → teavita nõustunuks jäänud osalejaid. */
export async function notifyCallRecordingAvailable({
  db = prismaClient,
  roomId,
  callSessionId,
  recordingRequestId,
  now = new Date()
} = {}) {
  if (!roomId || !recordingRequestId || !canWriteNotifications(db) || !db?.callRecordingConsent?.findMany) {
    return { ...emptyCounters(), skipped: 1 };
  }
  const consents = await db.callRecordingConsent.findMany({
    where: {
      recordingRequestId,
      ...(callSessionId ? { callSessionId } : {}),
      status: "CONSENTED"
    },
    select: { userId: true }
  });
  const userIds = uniqueUserIds(consents);
  return emitToRecipients(db, {
    userIds,
    now,
    build: (userId) => ({
      userId,
      type: NOTIFICATION_EVENT_TYPES.CALL_RECORDING_READY,
      sourceId: recordingRequestId,
      targetId: roomId,
      dedupeSuffix: "available",
      emailPolicy: "OPTIONAL"
    })
  });
}
