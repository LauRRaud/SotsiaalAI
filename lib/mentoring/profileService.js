import {
  MENTOR_PROFILE_STATUS,
  MENTOR_PROFILE_ORIGIN,
  MENTOR_CAPACITY,
  MENTORING_AUDIT_ACTIONS,
  MENTORING_LIMITS
} from "./constants.js";
import {
  conflict,
  invalid,
  normalizeTags,
  normalizeText,
  notFound,
  recordMentoringAudit,
  resolveDb,
  withMentoringProfileLock
} from "./shared.js";
import { serializeOwnProfile } from "./serializers.js";

const EDITABLE_STATUSES = new Set([
  MENTOR_PROFILE_STATUS.DRAFT,
  MENTOR_PROFILE_STATUS.REJECTED,
  MENTOR_PROFILE_STATUS.ACTIVE,
  MENTOR_PROFILE_STATUS.PAUSED,
  MENTOR_PROFILE_STATUS.PENDING_REVIEW
]);

function profileInput(payload = {}) {
  return {
    displayName: normalizeText(payload.displayName, {
      max: MENTORING_LIMITS.MAX_SHORT_TEXT, required: true, field: "display_name"
    }),
    title: normalizeText(payload.title, { max: MENTORING_LIMITS.MAX_SHORT_TEXT }),
    organization: normalizeText(payload.organization, { max: MENTORING_LIMITS.MAX_SHORT_TEXT }),
    fields: normalizeTags(payload.fields),
    topics: normalizeTags(payload.topics),
    languages: normalizeTags(payload.languages, { max: 6 }),
    formats: normalizeTags(payload.formats, { max: 6 }),
    bioShort: normalizeText(payload.bioShort, { max: MENTORING_LIMITS.MAX_SHORT_TEXT }),
    bioFull: normalizeText(payload.bioFull),
    experienceSummary: normalizeText(payload.experienceSummary)
  };
}

export async function getOwnMentorProfile(actor, options = {}) {
  const db = resolveDb(options);
  const profile = await db.mentorProfile.findFirst({
    where: { userId: actor.userId, origin: { in: [MENTOR_PROFILE_ORIGIN.SELF, MENTOR_PROFILE_ORIGIN.ESTA_IMPORT] } }
  });
  return serializeOwnProfile(profile);
}

export async function upsertOwnMentorProfile(actor, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const input = profileInput(payload);
  return withMentoringProfileLock(db, actor.userId, async (tx) => {
    const existing = await tx.mentorProfile.findFirst({ where: { userId: actor.userId } });
    if (!existing) {
      const created = await tx.mentorProfile.create({
        data: {
          userId: actor.userId,
          origin: MENTOR_PROFILE_ORIGIN.SELF,
          status: MENTOR_PROFILE_STATUS.DRAFT,
          capacity: MENTOR_CAPACITY.OPEN,
          ...input
        }
      });
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.PROFILE_CREATED,
        actorUserId: actor.userId,
        profileId: created.id
      });
      return serializeOwnProfile(created);
    }
    if (!EDITABLE_STATUSES.has(existing.status)) throw conflict("PROFILE_NOT_EDITABLE");
    const expectedVersion = Number(payload.expectedVersion);
    if (!Number.isInteger(expectedVersion)) throw conflict("PROFILE_VERSION_REQUIRED");
    const updated = await tx.mentorProfile.updateMany({
      where: { id: existing.id, userId: actor.userId, version: expectedVersion },
      data: { ...input, version: { increment: 1 }, updatedAt: now }
    });
    if (updated.count !== 1) throw conflict("PROFILE_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.PROFILE_UPDATED,
      actorUserId: actor.userId,
      profileId: existing.id
    });
    const fresh = await tx.mentorProfile.findFirst({ where: { id: existing.id } });
    return serializeOwnProfile(fresh);
  });
}

async function transitionOwnProfile(actor, { from, to, action, data = {} }, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringProfileLock(db, actor.userId, async (tx) => {
    const existing = await tx.mentorProfile.findFirst({ where: { userId: actor.userId } });
    if (!existing) throw notFound();
    if (!from.includes(existing.status)) throw conflict("PROFILE_STATUS_CONFLICT");
    const updated = await tx.mentorProfile.updateMany({
      where: { id: existing.id, userId: actor.userId, version: existing.version },
      data: { status: to, version: { increment: 1 }, updatedAt: now, ...data }
    });
    if (updated.count !== 1) throw conflict("PROFILE_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action,
      actorUserId: actor.userId,
      profileId: existing.id,
      meta: { from: existing.status, to }
    });
    const fresh = await tx.mentorProfile.findFirst({ where: { id: existing.id } });
    return serializeOwnProfile(fresh);
  });
}

export async function submitOwnMentorProfile(actor, options = {}) {
  const db = resolveDb(options);
  const existing = await db.mentorProfile.findFirst({ where: { userId: actor.userId } });
  if (!existing) throw notFound();
  if (!existing.displayName || !(existing.bioShort || "").trim() || !existing.fields?.length) {
    throw invalid("PROFILE_INCOMPLETE");
  }
  return transitionOwnProfile(actor, {
    from: [MENTOR_PROFILE_STATUS.DRAFT, MENTOR_PROFILE_STATUS.REJECTED],
    to: MENTOR_PROFILE_STATUS.PENDING_REVIEW,
    action: MENTORING_AUDIT_ACTIONS.PROFILE_SUBMITTED,
    data: { reviewReasonKey: null }
  }, options);
}

export async function pauseOwnMentorProfile(actor, options = {}) {
  return transitionOwnProfile(actor, {
    from: [MENTOR_PROFILE_STATUS.ACTIVE],
    to: MENTOR_PROFILE_STATUS.PAUSED,
    action: MENTORING_AUDIT_ACTIONS.PROFILE_PAUSED
  }, options);
}

export async function resumeOwnMentorProfile(actor, options = {}) {
  return transitionOwnProfile(actor, {
    from: [MENTOR_PROFILE_STATUS.PAUSED],
    to: MENTOR_PROFILE_STATUS.ACTIVE,
    action: MENTORING_AUDIT_ACTIONS.PROFILE_RESUMED
  }, options);
}

export async function retireOwnMentorProfile(actor, options = {}) {
  return transitionOwnProfile(actor, {
    from: [
      MENTOR_PROFILE_STATUS.DRAFT,
      MENTOR_PROFILE_STATUS.PENDING_REVIEW,
      MENTOR_PROFILE_STATUS.ACTIVE,
      MENTOR_PROFILE_STATUS.PAUSED,
      MENTOR_PROFILE_STATUS.REJECTED
    ],
    to: MENTOR_PROFILE_STATUS.RETIRED,
    action: MENTORING_AUDIT_ACTIONS.PROFILE_RETIRED
  }, options);
}

export async function setOwnMentorCapacity(actor, capacity, options = {}) {
  const normalized = String(capacity || "").toUpperCase();
  if (!Object.values(MENTOR_CAPACITY).includes(normalized)) throw invalid("INVALID_CAPACITY");
  const db = resolveDb(options);
  const now = options.now || new Date();
  return withMentoringProfileLock(db, actor.userId, async (tx) => {
    const existing = await tx.mentorProfile.findFirst({ where: { userId: actor.userId } });
    if (!existing) throw notFound();
    const updated = await tx.mentorProfile.updateMany({
      where: { id: existing.id, userId: actor.userId, version: existing.version },
      data: { capacity: normalized, version: { increment: 1 }, updatedAt: now }
    });
    if (updated.count !== 1) throw conflict("PROFILE_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.PROFILE_UPDATED,
      actorUserId: actor.userId,
      profileId: existing.id,
      meta: { capacity: normalized }
    });
    const fresh = await tx.mentorProfile.findFirst({ where: { id: existing.id } });
    return serializeOwnProfile(fresh);
  });
}
