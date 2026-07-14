import {
  findCovisionParticipantForActor,
  isCovisionCaseTerminal
} from "../covisionAccessShared.js";

function lifecycleError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function withCovisionCallMutationLock({
  db,
  covisionCaseId,
  access,
  createService,
  callback,
  onTerminal = null
}) {
  if (!db?.$transaction || typeof createService !== "function" || typeof callback !== "function") {
    throw lifecycleError("api.common.server_error", 500);
  }
  return db.$transaction(async (tx) => {
    if (typeof tx?.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`covisionSession:${covisionCaseId}`}))`;
    }
    const covisionCase = await tx.covisionCase.findUnique({
      where: { id: covisionCaseId },
      select: {
        ownerId: true,
        status: true,
        sessionState: { select: { phase: true } },
        closure: { select: { id: true } },
        participants: {
          select: { userId: true, email: true, role: true, inviteStatus: true }
        }
      }
    });
    if (!covisionCase) throw lifecycleError("api.common.not_found", 404);
    const participant = findCovisionParticipantForActor(
      covisionCase,
      access.userId,
      access.email
    );
    if (
      covisionCase.ownerId !== access.userId
      && participant?.inviteStatus !== "ACCEPTED"
    ) throw lifecycleError("api.common.not_found", 404);
    if (isCovisionCaseTerminal(covisionCase)) {
      if (typeof onTerminal === "function") return onTerminal();
      throw lifecycleError("covision.errors.case_read_only", 409);
    }
    const participantRole = String(participant?.role || "").toUpperCase();
    const freshAccess = {
      ...access,
      covisionCase,
      canModerate: access.isAdmin
        || covisionCase.ownerId === access.userId
        || participantRole === "CO_MODERATOR"
    };
    return callback({
      access: freshAccess,
      db: tx,
      service: createService(tx)
    });
  });
}
