import { prisma as defaultPrisma } from "../prisma.js";
import { withWellbeingOutputDraftLock } from "../wellbeing/outputDraftLock.js";
import { SUPERVISION_MEMBER_ROLES } from "./shared.js";

/**
 * Tööheaolu → Supervisiooni EESKAMBER üleandmine (Q2.7 v2, Q2.4 read 26).
 * Kinnitatud Tööheaolu-mustand (recipientType="supervisor") → M6 PRIVAATkirje.
 * Superviisor EI näe midagi enne tavalist jagamisväravat (rida 16). Mehaanika on
 * PEEGEL `lib/wellbeing/covisionHandoff.js`-le (allowlist, sameInstant-fingerprint,
 * handedOffAt samas tehingus) — erinevus: sihtobjekt on privaatne M6 kirje, mitte
 * uus juhtum. `covisionHandoff.js` jääb PUUTUMATA. EI M13 auditit (privaatala).
 * Topeltüleandmise tõke: M6.sourceWellbeingDraftId @unique + handedOffAt guard.
 */

const MAX_HANDOFF_LENGTH = 20_000;
const HANDOFF_REQUEST_KEYS = new Set(["processId", "expectedUpdatedAt", "title"]);
const PUBLIC_ERRORS = Object.freeze({
  "api.common.invalid_request": 400,
  "api.common.forbidden": 403,
  "api.common.not_found": 404,
  "supervision.errors.handoff_conflict": 409,
  "supervision.errors.handoff_fingerprint": 409,
  "supervision.errors.handoff_not_ready": 409
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
  return fail("api.common.forbidden", 403, "HANDOFF_ROLE_FORBIDDEN");
}

function notFound() {
  return fail("api.common.not_found", 404, "NOT_FOUND");
}

function conflict(message, code) {
  return fail(message, 409, code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sameInstant(left, right) {
  const l = left instanceof Date ? left.getTime() : new Date(left).getTime();
  const r = right instanceof Date ? right.getTime() : new Date(right).getTime();
  return Number.isFinite(l) && Number.isFinite(r) && l === r;
}

function normalizeActor(actor) {
  const userId = String(actor?.userId || "").trim().slice(0, 200);
  if (!userId) throw notFound();
  const role = String(actor?.role || "").trim().toUpperCase();
  if (actor?.isAdmin !== true && !SUPERVISION_MEMBER_ROLES.includes(role)) throw forbidden();
  return { userId };
}

export function normalizeWellbeingSupervisionHandoffRequest(input) {
  if (!isPlainObject(input)) throw invalid();
  for (const key of Object.keys(input)) {
    if (!HANDOFF_REQUEST_KEYS.has(key)) throw invalid("UNKNOWN_FIELD");
  }
  const processId = String(input.processId || "").trim();
  if (!processId) throw invalid("MISSING_PROCESS");

  const expectedUpdatedAt = typeof input.expectedUpdatedAt === "string" ? input.expectedUpdatedAt.trim() : "";
  const parsed = new Date(expectedUpdatedAt);
  if (!expectedUpdatedAt || !Number.isFinite(parsed.getTime()) || parsed.toISOString() !== expectedUpdatedAt) {
    throw conflict("supervision.errors.handoff_fingerprint", "HANDOFF_FINGERPRINT");
  }
  let title = null;
  if (input.title !== undefined) {
    if (typeof input.title !== "string") throw invalid("INVALID_TITLE");
    title = input.title.trim().slice(0, 200) || null;
  }
  return { processId, expectedUpdatedAt, title };
}

export function wellbeingSupervisionHandoffPublicError(error) {
  const messageKey = typeof error?.message === "string" ? error.message : "";
  const status = PUBLIC_ERRORS[messageKey];
  if (status && Number(error?.status) === status) return { messageKey, status };
  return { messageKey: "supervision.errors.handoff_failed", status: 500 };
}

function finalDraftText(draft) {
  const edited = typeof draft.editedText === "string" ? draft.editedText.trim() : "";
  const generated = typeof draft.generatedText === "string" ? draft.generatedText.trim() : "";
  const text = edited || generated;
  if (!text || text.length > MAX_HANDOFF_LENGTH) throw invalid("HANDOFF_LENGTH_INVALID");
  return text;
}

function assertEligibleDraft(draft) {
  if (
    draft.recipientType !== "supervisor"
    || draft.status !== "ready_to_share"
    || draft.visibility !== "private"
    || draft.userReviewed !== true
    || draft.userConfirmed !== true
  ) {
    throw conflict("supervision.errors.handoff_not_ready", "HANDOFF_NOT_READY");
  }
}

/**
 * Owner-only, idempotentne, atomaarne üleandmine kinnitatud Tööheaolu-mustandist
 * supervisiooni EESKAMBRI privaatkirjesse (M6). Ainult ACCEPTED-osalusega ACTIVE
 * sihtprotsess. Superviisorile EI leki midagi enne rida-16 jagamist.
 */
export async function startSupervisionHandoffFromWellbeingDraft(actor, draftId, request, { db = defaultPrisma } = {}) {
  const { userId } = normalizeActor(actor);
  const normalizedDraftId = String(draftId || "").trim().slice(0, 200);
  if (!normalizedDraftId) throw notFound();
  const { processId, expectedUpdatedAt, title } = normalizeWellbeingSupervisionHandoffRequest(request);

  return withWellbeingOutputDraftLock(db, normalizedDraftId, async (tx) => {
    const draft = await tx.wellbeingOutputDraft.findFirst({
      where: { id: normalizedDraftId, userId },
      select: {
        id: true, userId: true, recipientType: true, generatedText: true, editedText: true,
        userReviewed: true, userConfirmed: true, visibility: true, status: true,
        covisionCaseId: true, handedOffAt: true, updatedAt: true
      }
    });
    if (!draft) throw notFound();

    // Idempotentne: juba üle antud → tagasta olemasolev M6 kirje (topelt EI teki).
    if (draft.handedOffAt) {
      const existing = await tx.supervisionPrivateItem.findFirst({
        where: { sourceWellbeingDraftId: normalizedDraftId, ownerUserId: userId },
        select: { id: true, processId: true }
      });
      if (existing) {
        return { privateItemId: existing.id, processId: existing.processId, created: false };
      }
      throw conflict("supervision.errors.handoff_conflict", "HANDOFF_ALREADY_DONE");
    }

    assertEligibleDraft(draft);
    if (!sameInstant(draft.updatedAt, expectedUpdatedAt)) {
      throw conflict("supervision.errors.handoff_fingerprint", "HANDOFF_FINGERPRINT");
    }
    const body = finalDraftText(draft);

    // Siht: kasutaja ACCEPTED-osalus ACTIVE protsessis (server kordab UI-kontrolli).
    const participation = await tx.supervisionParticipation.findFirst({
      where: { processId, userId, status: "ACCEPTED" }, select: { id: true }
    });
    const process = await tx.supervisionProcess.findUnique({ where: { id: processId }, select: { id: true, status: true } });
    if (!participation || !process || process.status !== "ACTIVE") throw notFound();

    let privateItem;
    try {
      privateItem = await tx.supervisionPrivateItem.create({
        data: {
          processId, ownerUserId: userId, kind: "PREP_TOPIC", title, body,
          sourceKind: "WELLBEING_HANDOFF", sourceWellbeingDraftId: normalizedDraftId, version: 0
        }
      });
    } catch (error) {
      // M6.sourceWellbeingDraftId @unique — paralleelne topeltüleandmine → 409.
      if (error?.code === "P2002") throw conflict("supervision.errors.handoff_conflict", "HANDOFF_CONFLICT");
      throw error;
    }

    const now = new Date();
    const linked = await tx.wellbeingOutputDraft.updateMany({
      where: { id: draft.id, userId, status: "ready_to_share", handedOffAt: null },
      data: { status: "in_supervision", handedOffAt: now }
    });
    if (!linked || linked.count !== 1) throw conflict("supervision.errors.handoff_conflict", "HANDOFF_CONFLICT");

    return { privateItemId: privateItem.id, processId, created: true };
  });
}
