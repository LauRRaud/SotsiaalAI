import {
  SUPERVISION_ACTIONS as ACTIONS,
  assertAllowedKeys,
  conflict,
  invalid,
  normalizeText,
  notFound,
  parseOptionalDate,
  recordSupervisionAudit,
  requireExpectedVersion,
  requireSupervisionUser,
  resolveDb,
  staleVersion,
  withSupervisionProcessLock
} from "./shared.js";
import { loadProcessForViewer, requireSupervisorContext } from "./service.js";
import { VIEWER_ROLES, serializeMeeting } from "./serializers.js";

/**
 * M8 kohtumised (Q2.2 M8, Q2.4 read 18–19). Kohtumine on FAKTIKIRJE (võib toimuda
 * platvormiväliselt). Kirjutab AINULT superviisor; loevad liikmed. HELD on lõplik
 * (faktijälg — tagasi → 409). seq on protsessisiseselt unikaalne.
 */

const MEETING_STATUSES = new Set(["PLANNED", "HELD", "CANCELLED"]);

async function requireSupervisorMeetingProcess(db, processId, userId) {
  const { process, viewer } = await loadProcessForViewer(db, processId, userId);
  if (viewer.role !== VIEWER_ROLES.SV) throw notFound();
  if (process.status === "CLOSED") throw conflict("supervision.errors.already_closed", "ALREADY_CLOSED");
  return { process };
}

export async function planMeeting({ processId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["plannedAt"]);
  const { process } = await requireSupervisorMeetingProcess(db, processId, userId);
  const plannedAt = parseOptionalDate(input?.plannedAt, "INVALID_PLANNED_AT");

  const meeting = await withSupervisionProcessLock(db, process.id, async (tx) => {
    await requireSupervisorContext(tx, process.id, userId);
    const last = await tx.supervisionMeeting.findFirst({
      where: { processId: process.id }, orderBy: [{ seq: "desc" }]
    });
    const seq = (last?.seq || 0) + 1;
    const created = await tx.supervisionMeeting.create({
      data: { processId: process.id, seq, plannedAt, status: "PLANNED", agendaTopicIds: [], version: 0 }
    });
    await recordSupervisionAudit(tx, {
      action: ACTIONS.MEETING_PLANNED, actorUserId: userId, processId: process.id,
      targetKind: "meeting", targetId: created.id, metadata: { seq }
    });
    await tx.supervisionProcess.update({ where: { id: process.id }, data: { lastActivityAt: now } });
    return created;
  });
  return { ok: true, meeting: serializeMeeting(meeting) };
}

export async function updateMeeting({ meetingId, session, input }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const { userId } = requireSupervisionUser(session);
  assertAllowedKeys(input, ["status", "plannedAt", "heldAt", "note", "agendaTopicIds", "expectedVersion"]);
  const id = String(meetingId || "").trim();
  if (!id) throw notFound();
  const meeting = await db.supervisionMeeting.findUnique({ where: { id } });
  if (!meeting) throw notFound();
  const { process } = await requireSupervisorMeetingProcess(db, meeting.processId, userId);
  const expectedVersion = requireExpectedVersion(input?.expectedVersion);

  let requestedStatus = null;
  if (input.status !== undefined) {
    requestedStatus = String(input.status || "").trim().toUpperCase();
    if (!MEETING_STATUSES.has(requestedStatus)) throw invalid("INVALID_STATUS");
  }
  const plannedAt = input.plannedAt !== undefined ? parseOptionalDate(input.plannedAt, "INVALID_PLANNED_AT") : undefined;
  const heldAtInput = input.heldAt !== undefined ? parseOptionalDate(input.heldAt, "INVALID_HELD_AT") : undefined;
  const note = input.note !== undefined ? normalizeText(input.note, { max: 20000, field: "note" }) : undefined;
  let agendaTopicIds;
  if (input.agendaTopicIds !== undefined) {
    if (!Array.isArray(input.agendaTopicIds) || input.agendaTopicIds.some((x) => typeof x !== "string")) {
      throw invalid("INVALID_AGENDA");
    }
    agendaTopicIds = [...new Set(input.agendaTopicIds.map((x) => x.trim()).filter(Boolean))];
  }

  const updated = await withSupervisionProcessLock(db, process.id, async (tx) => {
    await requireSupervisorContext(tx, process.id, userId);
    const fresh = await tx.supervisionMeeting.findUnique({ where: { id } });
    if (!fresh) throw notFound();
    if (fresh.version !== expectedVersion) throw staleVersion();

    // HELD on lõplik: sellest ei liiguta teise olekusse.
    if (fresh.status === "HELD" && requestedStatus && requestedStatus !== "HELD") {
      throw conflict("supervision.errors.conflict", "MEETING_HELD_FINAL");
    }

    const data = { version: { increment: 1 } };
    const becomingHeld = requestedStatus === "HELD" && fresh.status !== "HELD";
    if (requestedStatus && requestedStatus !== fresh.status) data.status = requestedStatus;
    if (becomingHeld) {
      data.heldAt = heldAtInput || now;
      data.markedHeldByUserId = userId;
    } else if (heldAtInput !== undefined) {
      data.heldAt = heldAtInput;
    }
    if (plannedAt !== undefined) data.plannedAt = plannedAt;
    if (note !== undefined) data.note = note;
    if (agendaTopicIds !== undefined) data.agendaTopicIds = agendaTopicIds;

    const row = await tx.supervisionMeeting.update({ where: { id }, data });
    if (becomingHeld) {
      await recordSupervisionAudit(tx, {
        action: ACTIONS.MEETING_HELD, actorUserId: userId, processId: process.id,
        targetKind: "meeting", targetId: id, metadata: { seq: fresh.seq }
      });
    }
    await tx.supervisionProcess.update({ where: { id: process.id }, data: { lastActivityAt: now } });
    return row;
  });
  return { ok: true, meeting: serializeMeeting(updated) };
}
