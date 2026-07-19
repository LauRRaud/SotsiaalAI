import prismaClient from "@/lib/prisma";
import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";

/* T20 COLLAB-P3 (O-CO-3 variant b) — ruumi elutsükli üleminekuteated.
 *
 * T12 andis atomaarse omanikuvahetuse (transfer-endpoint), aga üleminek oli
 * osalejatele NÄHTAMATU: uus omanik ja liikmed said sellest teada alles ruumi
 * avades. O-CO-3 (b): osalejad näevad üleminekuteadet.
 *
 * Sama leping mis T12 E7 kõneteavitustel: payload kannab ainult ID-d ja ohutut
 * sihtlinki; teavitamine EI tohi kunagi kukutada omanikuvahetust ennast —
 * iga saaja on eraldi try/catch'is ja funktsioon ei viska. */

export async function notifyRoomOwnershipTransferred({
  db = prismaClient,
  roomId,
  previousOwnerId,
  newOwnerId,
  now = new Date()
} = {}) {
  const counters = { created: 0, existing: 0, skipped: 0, failed: 0 };
  if (!roomId || !newOwnerId || !db?.notificationEvent?.create || !db?.roomMember?.findMany) {
    counters.skipped += 1;
    return counters;
  }
  let members = [];
  try {
    members = await db.roomMember.findMany({
      where: {
        roomId,
        leftAt: null,
        /* Vana omanik algatas ise — tema ei vaja teadet enda tegevusest. */
        ...(previousOwnerId ? { userId: { not: previousOwnerId } } : {})
      },
      select: { userId: true }
    });
  } catch {
    counters.failed += 1;
    return counters;
  }
  const userIds = [...new Set((members || []).map((m) => String(m?.userId || "").trim()).filter(Boolean))];
  for (const userId of userIds) {
    try {
      const result = await createNotificationEvent(
        {
          userId,
          type: NOTIFICATION_EVENT_TYPES.ROOM_OWNERSHIP_TRANSFERRED,
          sourceId: roomId,
          targetId: roomId,
          /* Sama ruumi järgmine üleminek on uus sündmus — suffix kannab
           * ülemineku hetke ja uut omanikku. */
          dedupeSuffix: `to-${newOwnerId}-${now.getTime()}`,
          emailPolicy: "NONE"
        },
        { db, now }
      );
      counters[result.created ? "created" : "existing"] += 1;
    } catch {
      counters.failed += 1;
    }
  }
  return counters;
}
