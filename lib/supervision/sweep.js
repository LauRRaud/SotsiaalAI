import { prisma as defaultPrisma } from "../prisma.js";
import { notifyMeetingUpcoming } from "./notifications.js";

const HOUR_MS = 60 * 60 * 1000;
export const SUPERVISION_MEETING_UPCOMING_HOURS = 48;

/**
 * Ajastatud supervisioonikohtumiste korje. Võti (plannedAt,id) teeb üle batch'i
 * mahu liikumise stabiilseks; protsess ja liikmed loetakse iga rea jaoks
 * värskelt, et tühistatud/suletud/lahkunud seis ei saaks vana kandidaadi kaudu
 * teavitust.
 */
export async function runSupervisionSweep({
  db = defaultPrisma,
  now = new Date(),
  dryRun = false,
  batchSize = 50
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || 50, 100));
  const until = new Date(now.getTime() + SUPERVISION_MEETING_UPCOMING_HOURS * HOUR_MS);
  const counters = {
    meetingsConsidered: 0,
    meetingsNotified: 0,
    notificationsCreated: 0,
    notificationsExisting: 0
  };
  let cursor = null;

  while (true) {
    const meetings = await db.supervisionMeeting.findMany({
      where: {
        status: "PLANNED",
        plannedAt: { gte: now, lte: until },
        ...(cursor ? {
          AND: [{ OR: [
            { plannedAt: { gt: cursor.plannedAt } },
            { plannedAt: cursor.plannedAt, id: { gt: cursor.id } }
          ] }]
        } : {})
      },
      orderBy: [{ plannedAt: "asc" }, { id: "asc" }],
      select: { id: true, processId: true, plannedAt: true },
      take
    });
    if (!meetings.length) break;

    for (const meeting of meetings) {
      counters.meetingsConsidered += 1;
      const process = await db.supervisionProcess.findUnique({ where: { id: meeting.processId } });
      if (!process || process.status === "CLOSED") continue;
      const participants = await db.supervisionParticipation.findMany({
        where: { processId: meeting.processId, status: "ACCEPTED" },
        select: { userId: true }
      });
      const recipients = [...new Set([process.supervisorId, ...participants.map((row) => row.userId)])];
      if (dryRun) {
        if (recipients.length) counters.meetingsNotified += 1;
        continue;
      }
      let createdForMeeting = false;
      for (const userId of recipients) {
        const result = await notifyMeetingUpcoming(db, {
          meetingId: meeting.id,
          processId: meeting.processId,
          userId,
          plannedAt: meeting.plannedAt
        }, { now });
        if (result?.created) {
          counters.notificationsCreated += 1;
          createdForMeeting = true;
        } else {
          counters.notificationsExisting += 1;
        }
      }
      if (createdForMeeting) counters.meetingsNotified += 1;
    }

    const last = meetings.at(-1);
    cursor = { plannedAt: last.plannedAt, id: last.id };
    if (meetings.length < take) break;
  }

  return counters;
}
