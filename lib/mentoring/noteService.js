import { MENTORING_NOTE_KIND, MENTORING_AUDIT_ACTIONS } from "./constants.js";
import {
  conflict,
  findRelationForMember,
  normalizeText,
  notFound,
  resolveDb
} from "./shared.js";
import { serializeNote } from "./serializers.js";

/**
 * Privaatmärkmed (EM7, kind=NOTE): AINULT omanik; teine pool ega admin ei näe
 * kunagi (7.1). Märkmed jäävad omanikule ka pärast suhte lõppu — seepärast ei
 * piira ükski toiming suhte olekut.
 */
export async function listMyMentoringNotes(actor, relationId, options = {}) {
  const db = resolveDb(options);
  await findRelationForMember(db, actor.userId, relationId, { select: { id: true, mentorUserId: true, menteeUserId: true } });
  const notes = await db.mentoringPrivateNote.findMany({
    where: { ownerId: actor.userId, relationId: String(relationId), kind: MENTORING_NOTE_KIND.NOTE },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 200
  });
  return notes.map(serializeNote);
}

export async function createMentoringNote(actor, relationId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const content = normalizeText(payload.content, { required: true, field: "note" });
  await findRelationForMember(db, actor.userId, relationId, { select: { id: true, mentorUserId: true, menteeUserId: true } });
  const note = await db.mentoringPrivateNote.create({
    data: {
      ownerId: actor.userId,
      relationId: String(relationId),
      kind: MENTORING_NOTE_KIND.NOTE,
      content
    }
  });
  return serializeNote(note);
}

export async function updateMentoringNote(actor, noteId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const id = String(noteId || "").trim();
  if (!id) throw notFound();
  const content = normalizeText(payload.content, { required: true, field: "note" });
  const expectedVersion = Number(payload.expectedVersion);
  if (!Number.isInteger(expectedVersion)) throw conflict("NOTE_VERSION_REQUIRED");
  const existing = await db.mentoringPrivateNote.findFirst({
    where: { id, ownerId: actor.userId, kind: MENTORING_NOTE_KIND.NOTE }
  });
  if (!existing) throw notFound();
  const updated = await db.mentoringPrivateNote.updateMany({
    where: { id, ownerId: actor.userId, version: expectedVersion },
    data: { content, version: { increment: 1 }, updatedAt: now }
  });
  if (updated.count !== 1) throw conflict("NOTE_VERSION_CONFLICT");
  const fresh = await db.mentoringPrivateNote.findFirst({ where: { id } });
  return serializeNote(fresh);
}

export async function deleteMentoringNote(actor, noteId, options = {}) {
  const db = resolveDb(options);
  const id = String(noteId || "").trim();
  if (!id) throw notFound();
  const deleted = await db.mentoringPrivateNote.deleteMany({
    where: { id, ownerId: actor.userId, kind: MENTORING_NOTE_KIND.NOTE }
  });
  if (deleted.count !== 1) throw notFound();
  return { ok: true };
}

export const MENTORING_NOTE_AUDIT = MENTORING_AUDIT_ACTIONS;
