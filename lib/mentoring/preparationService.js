import { NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import {
  MENTORING_NOTE_KIND,
  MENTORING_RELATION_STATUS,
  MENTORING_AUDIT_ACTIONS
} from "./constants.js";
import {
  conflict,
  emitMentoringNotification,
  findRelationForMember,
  invalid,
  mentoringError,
  notFound,
  recordMentoringAudit,
  resolveDb,
  withMentoringRelationLock
} from "./shared.js";
import { serializePreparation } from "./serializers.js";

const OPEN_STATUSES = [MENTORING_RELATION_STATUS.ACTIVE, MENTORING_RELATION_STATUS.PAUSED];

function sameInstant(left, right) {
  const leftTime = left instanceof Date ? left.getTime() : new Date(left).getTime();
  const rightTime = right instanceof Date ? right.getTime() : new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.name === "UniqueConstraintError";
}

/**
 * Tööheaolu mustandid, mida mentee saab suhtesse üle anda: recipientType
 * "mentor", kinnitatud (ready_to_share) ja veel üle andmata.
 */
export async function listMentorHandoffCandidates(actor, options = {}) {
  const db = resolveDb(options);
  const drafts = await db.wellbeingOutputDraft.findMany({
    where: {
      userId: actor.userId,
      recipientType: "mentor",
      status: "ready_to_share",
      handedOffAt: null
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      outputType: true,
      sourceWorkflowType: true,
      generatedText: true,
      editedText: true,
      updatedAt: true
    }
  });
  return drafts.map((draft) => ({
    id: draft.id,
    outputType: draft.outputType,
    sourceWorkflowType: draft.sourceWorkflowType,
    preview: String(draft.editedText || draft.generatedText || "").slice(0, 400),
    updatedAt: draft.updatedAt instanceof Date ? draft.updatedAt.toISOString() : draft.updatedAt
  }));
}

/**
 * Handoff (SUP Q2.7 v2 muster): siht on mentee PRIVAATKIRJE (EM7,
 * kind=PREPARATION) — mentor EI näe enne teadlikku jagamist. Külmutatud
 * KOOPIA; unique sourceDraftId + handedOffAt + sameInstant CAS tõkestavad
 * topelt-handoff'i. Tööheaolu tabelit ei muudeta skeemis — status on
 * rakenduskihi väärtus "in_mentoring".
 */
export async function handoffWellbeingDraftToMentoring(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const draftId = String(payload.draftId || "").trim();
  if (!draftId) throw invalid("MISSING_DRAFT");
  const expectedUpdatedAt = typeof payload.expectedUpdatedAt === "string"
    ? payload.expectedUpdatedAt.trim()
    : "";
  if (!expectedUpdatedAt) throw conflict("WELLBEING_DRAFT_VERSION_CONFLICT");

  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (relation.menteeUserId !== actor.userId) throw notFound();
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");

    const draft = await tx.wellbeingOutputDraft.findFirst({
      where: { id: draftId, userId: actor.userId }
    });
    if (!draft) throw notFound();
    if (draft.handedOffAt || draft.status !== "ready_to_share") throw conflict("DRAFT_NOT_READY");
    if (draft.recipientType !== "mentor" || draft.userConfirmed !== true) throw conflict("DRAFT_NOT_READY");
    if (!sameInstant(draft.updatedAt, expectedUpdatedAt)) {
      throw conflict("WELLBEING_DRAFT_VERSION_CONFLICT");
    }
    const text = String(draft.editedText || draft.generatedText || "").trim();
    if (!text) throw invalid("EMPTY_DRAFT");

    let note;
    try {
      note = await tx.mentoringPrivateNote.create({
        data: {
          ownerId: actor.userId,
          relationId: relation.id,
          kind: MENTORING_NOTE_KIND.PREPARATION,
          content: text,
          sourceDraftId: draft.id
        }
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw conflict("DRAFT_ALREADY_HANDED_OFF");
      throw error;
    }

    const linked = await tx.wellbeingOutputDraft.updateMany({
      where: {
        id: draft.id,
        userId: actor.userId,
        status: "ready_to_share",
        handedOffAt: null,
        updatedAt: draft.updatedAt
      },
      data: { status: "in_mentoring", handedOffAt: now }
    });
    if (!linked || linked.count !== 1) throw conflict("WELLBEING_DRAFT_VERSION_CONFLICT");

    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.PREPARATION_HANDED_OFF,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { noteId: note.id, draftId: draft.id }
    });
    // Teavitust EI saadeta — kasutaja enda toiming (ptk 9); U12 rida tekib.
    return serializePreparation(note, { userId: actor.userId });
  });
}

/**
 * Teadlik jagamine (ptk 3.8/3.10): eelvaade → kinnitus (I8 üldistuskinnitus:
 * kliendiandmete keeld) → KÜLMUTATUD koopia sharedContent'is.
 */
export async function shareMentoringPreparation(actor, relationId, noteId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  if (payload.confirmedNoClientData !== true) {
    throw mentoringError("mentoring.errors.client_data_confirmation_required", 400, "CLIENT_DATA_CONFIRMATION_REQUIRED");
  }
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (!OPEN_STATUSES.includes(relation.status)) throw conflict("RELATION_NOT_OPEN");
    const note = await tx.mentoringPrivateNote.findFirst({
      where: {
        id: String(noteId || ""),
        ownerId: actor.userId,
        relationId: relation.id,
        kind: MENTORING_NOTE_KIND.PREPARATION
      }
    });
    if (!note) throw notFound();
    if (note.sharedAt && !note.recalledAt) throw conflict("PREPARATION_ALREADY_SHARED");
    const updated = await tx.mentoringPrivateNote.updateMany({
      where: { id: note.id, ownerId: actor.userId, version: note.version },
      data: {
        sharedContent: note.content,
        sharedAt: now,
        openedByOtherAt: null,
        recalledAt: null,
        version: { increment: 1 },
        updatedAt: now
      }
    });
    if (updated.count !== 1) throw conflict("PREPARATION_VERSION_CONFLICT");
    await tx.mentoringRelation.updateMany({
      where: { id: relation.id },
      data: { lastActivityAt: now }
    });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.PREPARATION_SHARED,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { noteId: note.id }
    });
    const fresh = await tx.mentoringPrivateNote.findFirst({ where: { id: note.id } });
    return serializePreparation(fresh, { userId: actor.userId });
  });
}

/**
 * Tagasivõtt (U3 kahe faasi muster): lubatud AINULT enne mentori avamist.
 * Pärast avamist jääb külmutatud koopia; parandus = uus jagamine.
 */
export async function recallMentoringPreparation(actor, relationId, noteId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    const note = await tx.mentoringPrivateNote.findFirst({
      where: {
        id: String(noteId || ""),
        ownerId: actor.userId,
        relationId: relation.id,
        kind: MENTORING_NOTE_KIND.PREPARATION
      }
    });
    if (!note) throw notFound();
    if (!note.sharedAt || note.recalledAt) throw conflict("PREPARATION_NOT_SHARED");
    if (note.openedByOtherAt) throw conflict("PREPARATION_ALREADY_OPENED");
    const updated = await tx.mentoringPrivateNote.updateMany({
      where: { id: note.id, ownerId: actor.userId, openedByOtherAt: null, version: note.version },
      data: {
        recalledAt: now,
        sharedContent: null,
        version: { increment: 1 },
        updatedAt: now
      }
    });
    if (updated.count !== 1) throw conflict("PREPARATION_ALREADY_OPENED");
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.PREPARATION_RECALLED,
      actorUserId: actor.userId,
      relationId: relation.id,
      meta: { noteId: note.id }
    });
    await emitMentoringNotification(tx, {
      type: NOTIFICATION_EVENT_TYPES.MENTORING_SHARE_RECALLED,
      userId: relation.mentorUserId,
      sourceId: note.id,
      targetId: relation.id,
      dedupeSuffix: `recalled:${now.getTime()}`
    }, { now });
    const fresh = await tx.mentoringPrivateNote.findFirst({ where: { id: note.id } });
    return serializePreparation(fresh, { userId: actor.userId });
  });
}

/**
 * Mentor avab jagatud ettevalmistuse — fikseerib avamise (recall-aken sulgub).
 */
export async function markMentoringPreparationOpened(actor, relationId, noteId, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringRelationLock(db, relationId, async (tx) => {
    const relation = await findRelationForMember(tx, actor.userId, relationId);
    if (relation.mentorUserId !== actor.userId) throw notFound();
    const note = await tx.mentoringPrivateNote.findFirst({
      where: {
        id: String(noteId || ""),
        relationId: relation.id,
        kind: MENTORING_NOTE_KIND.PREPARATION,
        sharedAt: { not: null },
        recalledAt: null
      }
    });
    if (!note) throw notFound();
    if (!note.openedByOtherAt) {
      await tx.mentoringPrivateNote.updateMany({
        where: { id: note.id, openedByOtherAt: null },
        data: { openedByOtherAt: now, updatedAt: now }
      });
    }
    const fresh = await tx.mentoringPrivateNote.findFirst({ where: { id: note.id } });
    return serializePreparation(fresh, { userId: actor.userId, isMentor: true });
  });
}
