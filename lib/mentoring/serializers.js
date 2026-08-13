import { MENTOR_PROFILE_ORIGIN, MENTOR_PROFILE_STATUS } from "./constants.js";

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/**
 * Kataloogi/profiili avalik projektsioon. VÄLJA-TASEMEL allowlist: publicContact,
 * consentNote ja review-väljad EI sisaldu kunagi mitte-admin serializeris
 * (ptk 7.3 serializer-piir).
 */
export function serializeCatalogProfile(profile) {
  if (!profile) return null;
  const external = profile.origin === MENTOR_PROFILE_ORIGIN.ESTA_IMPORT && !profile.userId;
  return {
    id: profile.id,
    origin: profile.origin,
    external,
    displayName: profile.displayName,
    title: profile.title || null,
    organization: profile.organization || null,
    fields: profile.fields || [],
    topics: profile.topics || [],
    languages: profile.languages || [],
    formats: profile.formats || [],
    bioShort: profile.bioShort || null,
    capacity: profile.capacity,
    externalProfileUrl: external ? profile.externalProfileUrl || null : null,
    checkedAt: external ? iso(profile.checkedAt) : null,
    canRequest: !external
      && (profile.status === MENTOR_PROFILE_STATUS.ACTIVE
        || (profile.status === MENTOR_PROFILE_STATUS.PENDING_REVIEW && profile.approvedSnapshotVisible === true))
      && profile.capacity === "OPEN"
  };
}

export function serializeCatalogProfileDetail(profile) {
  const base = serializeCatalogProfile(profile);
  if (!base) return null;
  return {
    ...base,
    bioFull: profile.bioFull || null,
    experienceSummary: profile.experienceSummary || null
  };
}

export function serializeOwnProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    origin: profile.origin,
    status: profile.status,
    displayName: profile.displayName,
    title: profile.title || null,
    organization: profile.organization || null,
    fields: profile.fields || [],
    topics: profile.topics || [],
    languages: profile.languages || [],
    formats: profile.formats || [],
    bioShort: profile.bioShort || null,
    bioFull: profile.bioFull || null,
    experienceSummary: profile.experienceSummary || null,
    capacity: profile.capacity,
    reviewReasonKey: profile.reviewReasonKey || null,
    reviewedAt: iso(profile.reviewedAt),
    version: profile.version,
    updatedAt: iso(profile.updatedAt)
  };
}

/**
 * Admin-projektsioon: sisaldab publicContact'i ja nõusolekuvälju — AINULT
 * admin-rajal (requireMentoringAdmin).
 */
export function serializeAdminProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.userId || null,
    origin: profile.origin,
    status: profile.status,
    consentStatus: profile.consentStatus || null,
    displayName: profile.displayName,
    title: profile.title || null,
    organization: profile.organization || null,
    fields: profile.fields || [],
    topics: profile.topics || [],
    languages: profile.languages || [],
    formats: profile.formats || [],
    bioShort: profile.bioShort || null,
    bioFull: profile.bioFull || null,
    experienceSummary: profile.experienceSummary || null,
    capacity: profile.capacity,
    externalProfileUrl: profile.externalProfileUrl || null,
    externalSlug: profile.externalSlug || null,
    publicContact: profile.publicContact || null,
    contactDisplayAllowed: profile.contactDisplayAllowed === true,
    checkedAt: iso(profile.checkedAt),
    consentNote: profile.consentNote || null,
    consentEvidenceType: profile.consentEvidenceType || null,
    consentEvidenceRef: profile.consentEvidenceRef || null,
    consentCapturedAt: iso(profile.consentCapturedAt),
    reviewedByUserId: profile.reviewedByUserId || null,
    reviewedAt: iso(profile.reviewedAt),
    reviewReasonKey: profile.reviewReasonKey || null,
    version: profile.version,
    createdAt: iso(profile.createdAt),
    updatedAt: iso(profile.updatedAt)
  };
}

export function serializeRequestForMentee(request, profile = null) {
  if (!request) return null;
  return {
    id: request.id,
    mentorProfileId: request.mentorProfileId,
    mentorDisplayName: profile?.displayName || null,
    message: request.anonymizedAt ? null : request.message || null,
    status: request.status,
    expiresAt: iso(request.expiresAt),
    respondedAt: iso(request.respondedAt),
    createdAt: iso(request.createdAt),
    canCancel: request.status === "PENDING"
  };
}

export function serializeRequestForMentor(request, menteeName = null) {
  if (!request) return null;
  return {
    id: request.id,
    menteeName: menteeName || null,
    message: request.anonymizedAt ? null : request.message || null,
    status: request.status,
    expiresAt: iso(request.expiresAt),
    createdAt: iso(request.createdAt),
    canRespond: request.status === "PENDING"
  };
}

function partyView(user, userId) {
  if (userId === null) return { deleted: true, name: null };
  if (!user) return { deleted: false, name: null };
  const first = user.profile?.firstName || "";
  const last = user.profile?.lastName || "";
  const name = `${first} ${last}`.trim() || user.email || null;
  return { deleted: false, name };
}

/**
 * Suhtevaade. canX lipud arvutab AINULT server (COLLAB 9.4: UI ei arvuta
 * õigusi). acceptedVersions = kummagi poole kinnitatud kokkuleppeversioonid.
 */
export function serializeRelation(relation, {
  userId,
  acceptances = [],
  meetings = [],
  summaries = [],
  notes = [],
  preparations = [],
  commonRooms = [],
  mentorUser = null,
  menteeUser = null
} = {}) {
  if (!relation) return null;
  const isMentor = relation.mentorUserId === userId;
  const position = isMentor ? "mentor" : "mentee";
  const open = relation.status === "ACTIVE" || relation.status === "PAUSED";
  const myAcceptance = acceptances.find(
    (a) => a.userId === userId && a.agreementVersion === relation.agreementVersion
  );
  const otherId = isMentor ? relation.menteeUserId : relation.mentorUserId;
  const otherAcceptance = acceptances.find(
    (a) => a.userId === otherId && a.agreementVersion === relation.agreementVersion
  );
  return {
    id: relation.id,
    position,
    status: relation.status,
    goalSummary: relation.goalSummary || null,
    agreementText: relation.agreementText || null,
    agreementVersion: relation.agreementVersion,
    myAgreementAccepted: Boolean(myAcceptance),
    otherAgreementAccepted: Boolean(otherAcceptance),
    mentor: partyView(mentorUser, relation.mentorUserId),
    mentee: partyView(menteeUser, relation.menteeUserId),
    pausedAt: iso(relation.pausedAt),
    closedAt: iso(relation.closedAt),
    closedByMe: relation.closedByUserId === userId,
    closeReasonKey: relation.closeReasonKey || null,
    purgedAt: iso(relation.purgedAt),
    lastActivityAt: iso(relation.lastActivityAt),
    createdAt: iso(relation.createdAt),
    version: relation.version,
    meetings: meetings.map(serializeMeeting),
    summaries: summaries.map((summary) => serializeSummary(summary, { userId })),
    notes: notes.map(serializeNote),
    preparations: preparations.map((note) => serializePreparation(note, { userId, isMentor })),
    commonRooms: commonRooms.map((room) => ({ id: room.id, title: room.title || null })),
    can: {
      editShared: relation.status === "DRAFT" || open,
      proposeAgreement: relation.status === "DRAFT" || open,
      acceptAgreement: (relation.status === "DRAFT" || open)
        && Boolean(relation.agreementText) && !myAcceptance,
      pause: relation.status === "ACTIVE",
      resume: relation.status === "PAUSED",
      close: relation.status !== "CLOSED",
      createMeeting: relation.status === "ACTIVE",
      createSummary: open,
      addNote: true,
      handoffPreparation: position === "mentee" && open
    }
  };
}

export function serializeMeeting(meeting) {
  if (!meeting) return null;
  return {
    id: meeting.id,
    occurredAt: iso(meeting.occurredAt),
    mode: meeting.mode,
    roomId: meeting.roomId || null,
    topicSummary: meeting.topicSummary || null,
    status: meeting.status,
    version: meeting.version,
    updatedAt: iso(meeting.updatedAt)
  };
}

export function serializeSummary(summary, { userId } = {}) {
  if (!summary) return null;
  const confirmations = summary.confirmations || [];
  return {
    id: summary.id,
    meetingId: summary.meetingId || null,
    kind: summary.kind,
    content: summary.content,
    status: summary.status,
    supersededById: summary.supersededById || null,
    correctionOfId: summary.correctionOfId || null,
    confirmedAt: iso(summary.confirmedAt),
    myConfirmation: confirmations.some((c) => c.userId === userId),
    confirmationCount: confirmations.length,
    createdByMe: summary.createdByUserId === userId,
    version: summary.version,
    updatedAt: iso(summary.updatedAt)
  };
}

export function serializeNote(note) {
  if (!note) return null;
  return {
    id: note.id,
    kind: note.kind,
    content: note.content,
    version: note.version,
    createdAt: iso(note.createdAt),
    updatedAt: iso(note.updatedAt)
  };
}

/**
 * Ettevalmistuse (kind=PREPARATION) vaade. Mentor näeb AINULT külmutatud
 * sharedContent'i pärast jagamist ja enne tagasivõttu; omanik näeb kõike.
 */
export function serializePreparation(note, { userId, isMentor = false } = {}) {
  if (!note) return null;
  const own = note.ownerId === userId;
  if (!own) {
    if (!note.sharedAt || note.recalledAt) return null;
    return {
      id: note.id,
      kind: note.kind,
      sharedContent: note.openedByOtherAt ? note.sharedContent : null,
      sharedAt: iso(note.sharedAt),
      openedAt: iso(note.openedByOtherAt),
      own: false
    };
  }
  return {
    id: note.id,
    kind: note.kind,
    content: note.content,
    sharedContent: note.sharedContent || null,
    sharedAt: iso(note.sharedAt),
    openedAt: iso(note.openedByOtherAt),
    recalledAt: iso(note.recalledAt),
    own: true,
    canShare: !note.sharedAt || Boolean(note.recalledAt),
    canRecall: Boolean(note.sharedAt) && !note.recalledAt && !note.openedByOtherAt,
    isMentorView: isMentor
  };
}
