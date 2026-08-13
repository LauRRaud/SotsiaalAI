import { NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import {
  MENTOR_PROFILE_STATUS,
  MENTOR_PROFILE_ORIGIN,
  MENTOR_CONSENT_STATUS,
  MENTORING_AUDIT_ACTIONS,
  MENTORING_LIMITS
} from "./constants.js";
import {
  conflict,
  emitMentoringNotification,
  invalid,
  notFound,
  recordMentoringAudit,
  resolveDb,
  withMentoringProfileLock
} from "./shared.js";
import { serializeAdminProfile } from "./serializers.js";
import {
  MENTOR_CONSENT_EVIDENCE_TYPES,
  mentorProfileSnapshot
} from "./profilePolicy.js";

const REVIEW_REASONS = new Set([
  "incomplete",
  "misleading",
  "out_of_scope",
  "abuse",
  "duplicate",
  "other"
]);

export async function listMentorModerationQueue(actor, options = {}) {
  const db = resolveDb(options);
  const [pending, counters] = await Promise.all([
    db.mentorProfile.findMany({
      where: { status: MENTOR_PROFILE_STATUS.PENDING_REVIEW },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: 100
    }),
    Promise.all([
      db.mentorProfile.count({ where: { status: MENTOR_PROFILE_STATUS.ACTIVE, origin: MENTOR_PROFILE_ORIGIN.SELF } }),
      db.mentorProfile.count({ where: { status: MENTOR_PROFILE_STATUS.PENDING_REVIEW } }),
      db.mentorProfile.count({
        where: { origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT, userId: null }
      }),
      db.mentorProfile.count({
        where: {
          origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT,
          userId: null,
          consentStatus: MENTOR_CONSENT_STATUS.CONSENTED
        }
      }),
      db.mentoringRelation.count({ where: { status: { in: ["ACTIVE", "PAUSED"] } } })
    ])
  ]);
  const [activeCount, pendingCount, externalCount, consentedCount, relationCount] = counters;
  return {
    queue: pending.map(serializeAdminProfile),
    // Loendurid on arvud, mitte sisu (ptk 8.1 admin).
    counters: {
      activeProfiles: activeCount,
      pendingReview: pendingCount,
      externalRecords: externalCount,
      consentedExternal: consentedCount,
      openRelations: relationCount
    }
  };
}

export async function listExternalMentorRecords(actor, options = {}) {
  const db = resolveDb(options);
  const records = await db.mentorProfile.findMany({
    where: { origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT, userId: null },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 300
  });
  return records.map(serializeAdminProfile);
}

async function loadProfile(tx, profileId) {
  const id = String(profileId || "").trim();
  if (!id) throw notFound();
  const profile = await tx.mentorProfile.findFirst({ where: { id } });
  if (!profile) throw notFound();
  return profile;
}

/**
 * Kataloogivärav (O-EM-2): moderatsioon, MITTE kvalifikatsioonikinnitus.
 */
export async function reviewMentorProfile(actor, profileId, decision, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const approve = decision === "APPROVE";
  const reject = decision === "REJECT";
  const revoke = decision === "REVOKE";
  if (!approve && !reject && !revoke) throw invalid("INVALID_DECISION");
  const reasonKey = String(payload.reasonKey || "").trim() || null;
  if ((reject || revoke) && (!reasonKey || !REVIEW_REASONS.has(reasonKey))) {
    // Dokumenteeritud alus on REJECT/REVOKE eeltingimus (ptk 4.1).
    throw invalid("REASON_REQUIRED");
  }

  return withMentoringProfileLock(db, profileId, async (tx) => {
    const profile = await loadProfile(tx, profileId);
    if (profile.origin === MENTOR_PROFILE_ORIGIN.ESTA_IMPORT && !profile.userId) {
      // Väline kirje EI saa kunagi ise ACTIVE-ks (ptk 4.1).
      throw conflict("EXTERNAL_RECORD_NOT_REVIEWABLE");
    }
    let from;
    let to;
    let action;
    let notifyType;
    if (approve) {
      from = [MENTOR_PROFILE_STATUS.PENDING_REVIEW];
      to = MENTOR_PROFILE_STATUS.ACTIVE;
      action = MENTORING_AUDIT_ACTIONS.PROFILE_APPROVED;
      notifyType = NOTIFICATION_EVENT_TYPES.MENTORING_PROFILE_APPROVED;
    } else if (reject) {
      from = [MENTOR_PROFILE_STATUS.PENDING_REVIEW];
      to = MENTOR_PROFILE_STATUS.REJECTED;
      action = MENTORING_AUDIT_ACTIONS.PROFILE_REJECTED;
      notifyType = NOTIFICATION_EVENT_TYPES.MENTORING_PROFILE_REJECTED;
    } else {
      from = [
        MENTOR_PROFILE_STATUS.ACTIVE,
        MENTOR_PROFILE_STATUS.PAUSED,
        MENTOR_PROFILE_STATUS.PENDING_REVIEW
      ];
      to = MENTOR_PROFILE_STATUS.REVOKED;
      action = MENTORING_AUDIT_ACTIONS.PROFILE_REVOKED;
      notifyType = NOTIFICATION_EVENT_TYPES.MENTORING_PROFILE_REVOKED;
    }
    if (!from.includes(profile.status)) throw conflict("PROFILE_STATUS_CONFLICT");
    const updated = await tx.mentorProfile.updateMany({
      where: { id: profile.id, version: profile.version },
      data: {
        status: to,
        ...(approve ? {
          approvedSnapshot: mentorProfileSnapshot(profile),
          approvedSnapshotAt: now,
          approvedSnapshotVisible: true
        } : {
          approvedSnapshotVisible: false
        }),
        reviewedByUserId: actor.userId,
        reviewedAt: now,
        reviewReasonKey: reasonKey,
        version: { increment: 1 },
        updatedAt: now
      }
    });
    if (updated.count !== 1) throw conflict("PROFILE_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action,
      actorUserId: actor.userId,
      profileId: profile.id,
      meta: { from: profile.status, to, ...(reasonKey ? { reasonKey } : {}) }
    });
    if (profile.userId) {
      await emitMentoringNotification(tx, {
        type: notifyType,
        userId: profile.userId,
        sourceId: profile.id,
        targetId: profile.id,
        dedupeSuffix: `${to}:${now.getTime()}`
      }, { now });
    }
    const fresh = await tx.mentorProfile.findFirst({ where: { id: profile.id } });
    return serializeAdminProfile(fresh);
  });
}

/**
 * EXTERNAL_REFERENCE nõusolekutelg (ptk 6.1): PENDING_CONSENT → CONSENTED |
 * DECLINED_CONSENT | STALE. Nõusoleku dokumentatsioon (kuupäev + viis) käib
 * eraldi tüübi, viite ja serveriajaga — kõik väljad on admin-only.
 */
export async function setExternalConsentStatus(actor, profileId, payload = {}, options = {}) {
  const db = resolveDb(options);
  const now = options.now || new Date();
  const consentStatus = String(payload.consentStatus || "").toUpperCase();
  if (!Object.values(MENTOR_CONSENT_STATUS).includes(consentStatus)) {
    throw invalid("INVALID_CONSENT_STATUS");
  }
  const consentNote = typeof payload.consentNote === "string"
    ? payload.consentNote.trim().slice(0, MENTORING_LIMITS.MAX_TEXT) || null
    : undefined;
  const contactDisplayAllowed = typeof payload.contactDisplayAllowed === "boolean"
    ? payload.contactDisplayAllowed
    : undefined;
  const refreshChecked = payload.refreshCheckedAt === true;
  const consentEvidenceType = String(payload.consentEvidenceType || "").toUpperCase();
  const consentEvidenceRef = typeof payload.consentEvidenceRef === "string"
    ? payload.consentEvidenceRef.trim().slice(0, MENTORING_LIMITS.MAX_SHORT_TEXT)
    : "";
  if (consentStatus === MENTOR_CONSENT_STATUS.CONSENTED
    && (!MENTOR_CONSENT_EVIDENCE_TYPES.includes(consentEvidenceType) || !consentEvidenceRef)) {
    throw invalid("CONSENT_EVIDENCE_REQUIRED");
  }

  return withMentoringProfileLock(db, profileId, async (tx) => {
    const profile = await loadProfile(tx, profileId);
    if (profile.origin !== MENTOR_PROFILE_ORIGIN.ESTA_IMPORT || profile.userId) {
      throw conflict("NOT_EXTERNAL_RECORD");
    }
    const updated = await tx.mentorProfile.updateMany({
      where: { id: profile.id, version: profile.version },
      data: {
        consentStatus,
        ...(consentNote !== undefined ? { consentNote } : {}),
        ...(contactDisplayAllowed !== undefined ? { contactDisplayAllowed } : {}),
        ...(consentStatus === MENTOR_CONSENT_STATUS.CONSENTED ? {
          consentEvidenceType,
          consentEvidenceRef,
          consentCapturedAt: now,
          checkedAt: now
        } : refreshChecked ? { checkedAt: now } : {}),
        version: { increment: 1 },
        updatedAt: now
      }
    });
    if (updated.count !== 1) throw conflict("PROFILE_VERSION_CONFLICT");
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.CONSENT_STATUS_CHANGED,
      actorUserId: actor.userId,
      profileId: profile.id,
      meta: { from: profile.consentStatus || "NONE", to: consentStatus }
    });
    const fresh = await tx.mentorProfile.findFirst({ where: { id: profile.id } });
    return serializeAdminProfile(fresh);
  });
}

/**
 * Välise kirje kustutamine mentori nõudel (ptk 6.4) — kohustuslik rada.
 */
export async function deleteExternalMentorRecord(actor, profileId, options = {}) {
  const db = resolveDb(options);
  return withMentoringProfileLock(db, profileId, async (tx) => {
    const profile = await loadProfile(tx, profileId);
    if (profile.origin !== MENTOR_PROFILE_ORIGIN.ESTA_IMPORT || profile.userId) {
      throw conflict("NOT_EXTERNAL_RECORD");
    }
    await tx.mentorProfile.delete({ where: { id: profile.id } });
    await recordMentoringAudit(tx, {
      action: MENTORING_AUDIT_ACTIONS.PROFILE_DELETED,
      actorUserId: actor.userId,
      profileId: profile.id,
      meta: { origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT }
    });
    return { ok: true };
  });
}

/**
 * E9: ESTA seed-i admin-import. Kirjed sisenevad EXTERNAL_REFERENCE /
 * PENDING_CONSENT olekus, kataloogis nähtamatud; kontaktid admin-only
 * (seed-poliitika jõustub väljatasemel). Idempotentne externalSlug'i kaudu.
 */
export async function importExternalMentorSeed(actor, seed = {}, options = {}) {
  const db = resolveDb(options);
  const mentors = Array.isArray(seed?.mentors) ? seed.mentors : [];
  if (!mentors.length) throw invalid("EMPTY_SEED");
  const checkedAtDefault = seed?.checkedAt ? new Date(String(seed.checkedAt)) : null;
  const results = { created: 0, existing: 0, skipped: 0 };

  for (const mentor of mentors) {
    const displayName = String(mentor?.displayName || "").trim();
    const slug = String(mentor?.slug || "").trim();
    if (!displayName || !slug) {
      results.skipped += 1;
      continue;
    }
    const checkedAtRaw = mentor?.checkedAt ? new Date(String(mentor.checkedAt)) : checkedAtDefault;
    const checkedAt = checkedAtRaw && Number.isFinite(checkedAtRaw.getTime()) ? checkedAtRaw : null;
    const publicContact = mentor?.contact && typeof mentor.contact === "object" && !Array.isArray(mentor.contact)
      ? mentor.contact
      : null;

    await db.$transaction(async (tx) => {
      const existing = await tx.mentorProfile.findFirst({
        where: { externalSlug: slug },
        select: { id: true }
      });
      if (existing) {
        results.existing += 1;
        return;
      }
      const created = await tx.mentorProfile.create({
        data: {
          userId: null,
          origin: MENTOR_PROFILE_ORIGIN.ESTA_IMPORT,
          status: MENTOR_PROFILE_STATUS.EXTERNAL_REFERENCE,
          consentStatus: MENTOR_CONSENT_STATUS.PENDING_CONSENT,
          displayName,
          title: String(mentor?.title || "").trim() || null,
          organization: String(mentor?.organization || "").trim() || null,
          fields: Array.isArray(mentor?.fields) ? mentor.fields.map((f) => String(f).trim()).filter(Boolean).slice(0, 24) : [],
          topics: Array.isArray(mentor?.topics) ? mentor.topics.map((t) => String(t).trim()).filter(Boolean).slice(0, 24) : [],
          languages: Array.isArray(mentor?.languages) ? mentor.languages.map((l) => String(l).trim()).filter(Boolean).slice(0, 6) : [],
          formats: Array.isArray(mentor?.formats) ? mentor.formats.map((f) => String(f).trim()).filter(Boolean).slice(0, 6) : [],
          bioShort: String(mentor?.roleDescription || "").trim().slice(0, 600) || null,
          externalProfileUrl: String(mentor?.sourceUrl || "").trim() || null,
          externalSlug: slug,
          publicContact,
          contactDisplayAllowed: false,
          checkedAt
        }
      });
      await recordMentoringAudit(tx, {
        action: MENTORING_AUDIT_ACTIONS.PROFILE_IMPORTED,
        actorUserId: actor.userId,
        profileId: created.id,
        meta: { slug }
      });
      results.created += 1;
    });
  }
  return results;
}

export async function listMentoringAuditEvents(actor, filters = {}, options = {}) {
  const db = resolveDb(options);
  const profileId = String(filters.profileId || "").trim() || undefined;
  const events = await db.mentoringAuditEvent.findMany({
    where: { ...(profileId ? { profileId } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200
  });
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    actorUserId: event.actorUserId || null,
    profileId: event.profileId || null,
    relationId: event.relationId || null,
    requestId: event.requestId || null,
    summaryId: event.summaryId || null,
    meta: event.meta || null,
    createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt
  }));
}
