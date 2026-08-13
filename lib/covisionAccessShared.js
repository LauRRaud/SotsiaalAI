const CASE_STATUS = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  SUMMARY_READY: "summary_ready",
  CLOSED: "closed",
  ARCHIVED: "archived"
});
const PARTICIPANT_ROLE = Object.freeze({
  OWNER: "owner",
  PARTICIPANT: "participant",
  OBSERVER: "observer",
  CO_MODERATOR: "co_moderator",
  SUMMARY_REVIEWER: "summary_reviewer"
});
const WRITABLE_CASE_STATUS = Object.freeze({
  draft: "DRAFT",
  active: "ACTIVE",
  summary_ready: "SUMMARY_READY",
  closed: "CLOSED",
  archived: "ARCHIVED"
});

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function fromDb(value, map, fallback = "") {
  return map[String(value || "").trim().toUpperCase()] || fallback;
}

export function covisionParticipantIdentityOr({ userId = "", email = "" } = {}) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const identity = [];
  if (normalizedUserId) identity.push({ userId: normalizedUserId });
  if (normalizedEmail) identity.push({ userId: null, email: normalizedEmail, identityErasedAt: null });
  return identity;
}

export function findCovisionParticipantForActor(covisionCase, userId, email) {
  if (covisionCase?.ownerId === userId) {
    return { role: "OWNER", inviteStatus: "ACCEPTED" };
  }
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return (covisionCase?.participants || []).find((participant) => (
    !participant.identityErasedAt
    && ["INVITED", "ACCEPTED"].includes(participant.inviteStatus)
    && !(
      participant.inviteStatus === "INVITED"
      && participant.inviteExpiresAt
      && new Date(participant.inviteExpiresAt).getTime() <= Date.now()
    )
    && (
      (participant.userId && participant.userId === userId)
      || (
        !participant.userId
        && normalizedEmail
        && participant.email
        && participant.email.toLowerCase() === normalizedEmail
      )
    )
  )) || null;
}

/**
 * Kes tohib kovisiooni juhtumi LUUA ja selle omanikuks saada.
 *
 * Omanik 02.08: mõlemad spetsialistirollid. Varem oli see kitsam kui
 * `canUseCovisionRole` (osalemine) — teenuseosutaja sai liituda kutsutuna, aga
 * mitte ise juhtumit avada. See vahe ei pidanud vastu kahele faktile: kovisioon
 * on teenuseosutaja paketis MÜÜDUD (`HinnastusBody` `provider = included`) ja
 * teenuseosutaja pakett on kallim (19.99 vs 14.99) — kallim pakett ei tohi anda
 * vähem. Tugiisikul ja hooldustöötajal on oma juhtumid, mida kovisiooni tuua.
 *
 * Kliendile see EI laiene: `canUseCovisionRole` ei lase teda ruumi ligigi.
 */
export function canCreateCovision(auth = {}) {
  const role = String(auth.role || "").trim().toUpperCase();
  return (
    auth.isAdmin === true
    || role === "ADMIN"
    || role === "SOCIAL_WORKER"
    || role === "SERVICE_PROVIDER"
  );
}

export function serializeCovisionWorkspaceCase(
  covisionCase,
  { userId = "", email = "" } = {}
) {
  if (!covisionCase) return null;
  const participant = findCovisionParticipantForActor(covisionCase, userId, email);
  if (covisionCase.ownerId !== userId && !participant) return null;
  const inviteStatus = fromDb(
    participant?.inviteStatus,
    { INVITED: "invited", ACCEPTED: "accepted" },
    covisionCase.ownerId === userId ? "accepted" : ""
  );
  const common = {
    id: covisionCase.id,
    status: fromDb(covisionCase.status, CASE_STATUS, "draft"),
    lastActivityAt: covisionCase.lastActivityAt,
    updatedAt: covisionCase.updatedAt,
    currentUserRole: fromDb(participant?.role, PARTICIPANT_ROLE, ""),
    inviteStatus,
    isInvitation: inviteStatus === "invited"
  };
  if (inviteStatus === "invited") {
    return {
      ...common,
      title: null,
      summary: null,
      centralQuestion: null,
      contentRestricted: true
    };
  }
  return {
    ...common,
    title: covisionCase.title,
    summary: covisionCase.summary,
    centralQuestion: covisionCase.centralQuestion,
    contentRestricted: false
  };
}

export function normalizeCovisionLegacyPatchStatus(requestedStatus, currentStatus = "DRAFT") {
  if (requestedStatus == null || requestedStatus === "") return currentStatus || "DRAFT";
  const status = WRITABLE_CASE_STATUS[String(requestedStatus).trim().toLowerCase()];
  if (!status) throw fail("api.common.invalid_request", 400);
  if (status === "CLOSED" || status === "ARCHIVED") {
    throw fail("covision.errors.save_failed", 409);
  }
  return status;
}

export function assertCovisionLegacyPatchAllowed(covisionCase) {
  if (covisionCase?.sessionState) throw fail("covision.errors.save_failed", 409);
  return covisionCase;
}

export function isCovisionCaseTerminal(covisionCase) {
  return covisionCase?.sessionState?.phase === "complete"
    || covisionCase?.status === "CLOSED"
    || covisionCase?.status === "ARCHIVED"
    || Boolean(covisionCase?.closure);
}

export function assertCovisionLegacyWriteAllowed(covisionCase) {
  if (isCovisionCaseTerminal(covisionCase)) {
    throw fail("covision.errors.case_read_only", 409);
  }
  return covisionCase;
}
