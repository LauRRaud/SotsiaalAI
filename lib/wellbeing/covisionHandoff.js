import { prisma as defaultPrisma } from "../prisma.js";
import { detectAnonymityIssues } from "../covisionShared.js";
import { COVISION_STAGE_PHASES } from "../covisionSessionShared.js";
import { withWellbeingOutputDraftLock } from "./outputDraftLock.js";

const MAX_COVISION_PREFILL_LENGTH = 4_000;
const HANDOFF_REQUEST_KEYS = new Set(["expectedUpdatedAt", "confirmedNoIdentifiers"]);
const PUBLIC_ERRORS = Object.freeze({
  "api.common.invalid_request": 400,
  "api.common.forbidden": 403,
  "api.common.not_found": 404,
  "wellbeing.errors.identifiers_confirmation_required": 400,
  "wellbeing.errors.identifiers_detected": 400,
  "wellbeing.errors.covision_handoff_conflict": 409
});

function fail(message, status, code = null) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function invalid(code = "INVALID_REQUEST") {
  return fail("api.common.invalid_request", 400, code);
}

function forbidden() {
  return fail("api.common.forbidden", 403, "CREATOR_ROLE_FORBIDDEN");
}

function notFound() {
  return fail("api.common.not_found", 404, "NOT_FOUND");
}

function conflict(code = "WELLBEING_COVISION_CONFLICT") {
  return fail("wellbeing.errors.covision_handoff_conflict", 409, code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sameInstant(left, right) {
  const leftTime = left instanceof Date ? left.getTime() : new Date(left).getTime();
  const rightTime = right instanceof Date ? right.getTime() : new Date(right).getTime();
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function normalizeActor(actor) {
  const userId = String(actor?.userId || "").trim().slice(0, 200);
  if (!userId) throw notFound();
  const role = String(actor?.role || "").trim().toUpperCase();
  if (actor?.isAdmin !== true && role !== "ADMIN" && role !== "SOCIAL_WORKER") {
    throw forbidden();
  }
  return { userId };
}

export function normalizeWellbeingCovisionHandoffRequest(input) {
  if (!isPlainObject(input)) throw invalid();
  for (const key of Object.keys(input)) {
    if (!HANDOFF_REQUEST_KEYS.has(key)) {
      throw invalid("UNKNOWN_FIELD");
    }
  }
  if (input.confirmedNoIdentifiers !== true) {
    throw fail(
      "wellbeing.errors.identifiers_confirmation_required",
      400,
      "IDENTIFIERS_CONFIRMATION_REQUIRED"
    );
  }
  const expectedUpdatedAt = typeof input.expectedUpdatedAt === "string"
    ? input.expectedUpdatedAt.trim()
    : "";
  const parsedExpectedUpdatedAt = new Date(expectedUpdatedAt);
  if (
    !expectedUpdatedAt
    || !Number.isFinite(parsedExpectedUpdatedAt.getTime())
    || parsedExpectedUpdatedAt.toISOString() !== expectedUpdatedAt
  ) {
    throw conflict("WELLBEING_DRAFT_VERSION_CONFLICT");
  }
  return {
    expectedUpdatedAt,
    confirmedNoIdentifiers: true
  };
}

/* Detektori leidudest tohib kliendini jõuda AINULT tüüp ja koguarv —
   mitte kunagi snippet, label ega tuvastatud väärtus (need võivad
   sattuda logidesse/monitooringusse). */
function sanitizedIdentifierDetails(details) {
  const issueTypes = Array.isArray(details?.issueTypes)
    ? [...new Set(details.issueTypes.filter((type) => typeof type === "string" && type))].slice(0, 8)
    : [];
  const issueCount = Number.isFinite(Number(details?.issueCount))
    ? Math.max(issueTypes.length, Math.trunc(Number(details.issueCount)))
    : issueTypes.length;
  if (!issueTypes.length) return null;
  return { issueTypes, issueCount };
}

export function wellbeingCovisionHandoffPublicError(error) {
  const messageKey = typeof error?.message === "string" ? error.message : "";
  const status = PUBLIC_ERRORS[messageKey];
  if (status && Number(error?.status) === status) {
    if (messageKey === "wellbeing.errors.identifiers_detected") {
      const details = sanitizedIdentifierDetails(error?.details);
      if (details) return { messageKey, status, details };
    }
    return { messageKey, status };
  }
  return { messageKey: "wellbeing.errors.covision_handoff_failed", status: 500 };
}

function finalDraftText(draft) {
  const edited = typeof draft.editedText === "string" ? draft.editedText.trim() : "";
  const generated = typeof draft.generatedText === "string" ? draft.generatedText.trim() : "";
  const text = edited || generated;
  if (!text || text.length > MAX_COVISION_PREFILL_LENGTH) {
    throw invalid("COVISION_PREFILL_LENGTH_INVALID");
  }
  const issues = detectAnonymityIssues(text);
  if (issues.length > 0) {
    const error = fail("wellbeing.errors.identifiers_detected", 400, "IDENTIFIERS_DETECTED");
    error.details = {
      issueTypes: [...new Set(issues.map((issue) => issue.type))].slice(0, 8),
      issueCount: issues.length
    };
    throw error;
  }
  return text;
}

function initialPhase() {
  return COVISION_STAGE_PHASES?.[1]?.[0] || "waiting_room";
}

function assertEligibleDraft(draft) {
  if (
    draft.outputType !== "covision_input"
    || draft.recipientType !== "covision"
    || draft.status !== "ready_to_share"
    || draft.visibility !== "private"
    || draft.userReviewed !== true
    || draft.userConfirmed !== true
  ) {
    throw conflict("WELLBEING_DRAFT_NOT_READY");
  }
}

/**
 * Owner-only, idempotent and atomic handoff from a confirmed private wellbeing
 * draft into a private Covision session. The confirmed text is stored as the
 * owner's stage-2 private prefill; no shared case_anchor is minted here.
 */
export async function startCovisionFromWellbeingDraft(
  actor,
  draftId,
  request,
  { db = defaultPrisma } = {}
) {
  const { userId } = normalizeActor(actor);
  const normalizedDraftId = String(draftId || "").trim().slice(0, 200);
  if (!normalizedDraftId) throw notFound();
  const normalizedRequest = normalizeWellbeingCovisionHandoffRequest(request);

  const result = await withWellbeingOutputDraftLock(db, normalizedDraftId, async (tx) => {
    const draft = await tx.wellbeingOutputDraft.findFirst({
      where: { id: normalizedDraftId, userId },
      select: {
        id: true,
        userId: true,
        outputType: true,
        recipientType: true,
        generatedText: true,
        editedText: true,
        userReviewed: true,
        userConfirmed: true,
        visibility: true,
        status: true,
        covisionCaseId: true,
        handedOffAt: true,
        updatedAt: true
      }
    });
    if (!draft) throw notFound();

    if (draft.covisionCaseId) {
      return { covisionCaseId: draft.covisionCaseId, created: false };
    }

    assertEligibleDraft(draft);
    if (!sameInstant(draft.updatedAt, normalizedRequest.expectedUpdatedAt)) {
      throw conflict("WELLBEING_DRAFT_VERSION_CONFLICT");
    }
    const prefillText = finalDraftText(draft);
    const now = new Date();

    const covisionCase = await tx.covisionCase.create({
      data: {
        ownerId: userId,
        title: "Kovisioon",
        summary: null,
        anonymizedDescription: null,
        centralQuestion: null,
        expectedHelpTypes: ["perspectives", "next_step"],
        topics: ["work-wellbeing"],
        tags: ["work-wellbeing"],
        status: "ACTIVE",
        visibility: "PRIVATE",
        anonymityConfirmedAt: now,
        lastActivityAt: now
      }
    });
    const participant = await tx.covisionParticipant.create({
      data: {
        covisionCaseId: covisionCase.id,
        userId,
        role: "OWNER",
        inviteStatus: "ACCEPTED"
      }
    });
    const session = await tx.covisionSessionState.create({
      data: {
        covisionCaseId: covisionCase.id,
        stage: 1,
        phase: initialPhase(),
        version: 0
      }
    });
    await tx.covisionParticipantState.create({
      data: { sessionId: session.id, participantId: participant.id }
    });
    await tx.covisionPrivateState.create({
      data: {
        sessionId: session.id,
        userId,
        stage: 2,
        kind: "case_anchor",
        content: { text: prefillText },
        version: 0
      }
    });

    const linked = await tx.wellbeingOutputDraft.updateMany({
      where: {
        id: draft.id,
        userId,
        status: "ready_to_share",
        covisionCaseId: null,
        updatedAt: draft.updatedAt
      },
      data: {
        status: "in_covision",
        covisionCaseId: covisionCase.id,
        handedOffAt: now
      }
    });
    if (!linked || linked.count !== 1) {
      throw conflict("WELLBEING_DRAFT_VERSION_CONFLICT");
    }

    return { covisionCaseId: covisionCase.id, created: true };
  });

  return result;
}
