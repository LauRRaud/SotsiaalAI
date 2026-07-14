import { prisma } from "./prisma.js";
import { sendCovisionInviteEmails } from "./covisionInvites.js";
import {
  assertCovisionLegacyPatchAllowed,
  canCreateCovision,
  covisionParticipantIdentityOr,
  findCovisionParticipantForActor,
  normalizeCovisionLegacyPatchStatus,
  serializeCovisionWorkspaceCase
} from "./covisionAccessShared.js";

export {
  assertCovisionLegacyPatchAllowed,
  assertCovisionLegacyWriteAllowed,
  canCreateCovision,
  covisionParticipantIdentityOr,
  findCovisionParticipantForActor,
  normalizeCovisionLegacyPatchStatus,
  serializeCovisionWorkspaceCase
} from "./covisionAccessShared.js";
import {
  buildEffectivePracticeDraft,
  detectAnonymityIssues,
  draftCovisionSummary,
  inferCovisionTopics,
  normalizeEmail,
  normalizeList,
  normalizeText,
  suggestCentralQuestions
} from "./covisionShared.js";
import {
  createEffectivePracticeCandidate,
  listEffectivePracticeWorkspace,
  updateEffectivePracticeCandidate
} from "./effectivePractices.js";
import { withCovisionLegacyWriteLock } from "./covisionLegacyWrite.js";

const MAX_TEXT_LENGTH = 16_000;

const CASE_STATUS_FROM_DB = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  SUMMARY_READY: "summary_ready",
  CLOSED: "closed",
  ARCHIVED: "archived"
});


const PARTICIPANT_ROLE_TO_DB = Object.freeze({
  owner: "OWNER",
  participant: "PARTICIPANT",
  observer: "OBSERVER",
  co_moderator: "CO_MODERATOR",
  summary_reviewer: "SUMMARY_REVIEWER"
});

const PARTICIPANT_ROLE_FROM_DB = Object.freeze({
  OWNER: "owner",
  PARTICIPANT: "participant",
  OBSERVER: "observer",
  CO_MODERATOR: "co_moderator",
  SUMMARY_REVIEWER: "summary_reviewer"
});

const INVITE_STATUS_FROM_DB = Object.freeze({
  INVITED: "invited",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  EXPIRED: "expired"
});

const FACTOR_TYPE_TO_DB = Object.freeze({
  risk: "RISK",
  protective: "PROTECTIVE",
  protective_factor: "PROTECTIVE"
});

const FACTOR_TYPE_FROM_DB = Object.freeze({
  RISK: "risk",
  PROTECTIVE: "protective"
});

const SEVERITY_TO_DB = Object.freeze({
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH"
});

const SEVERITY_FROM_DB = Object.freeze({
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
});

const STEP_STATUS_TO_DB = Object.freeze({
  confirmed: "CONFIRMED",
  needs_clarification: "NEEDS_CLARIFICATION"
});

const STEP_STATUS_FROM_DB = Object.freeze({
  CONFIRMED: "confirmed",
  NEEDS_CLARIFICATION: "needs_clarification"
});

const MESSAGE_TYPE_TO_DB = Object.freeze({
  free_text: "FREE_TEXT",
  comment: "FREE_TEXT",
  observation: "OBSERVATION",
  reflection: "OBSERVATION",
  question: "QUESTION",
  risk: "RISK",
  protective_factor: "PROTECTIVE_FACTOR",
  next_step: "NEXT_STEP",
  suggestion: "SOURCE_NOTE",
  experience: "EXPERIENCE",
  source_note: "SOURCE_NOTE",
  documentation_note: "DOCUMENTATION_NOTE",
  network_note: "NETWORK_NOTE"
});

const MESSAGE_TYPE_FROM_DB = Object.freeze({
  FREE_TEXT: "free_text",
  OBSERVATION: "observation",
  QUESTION: "question",
  RISK: "risk",
  PROTECTIVE_FACTOR: "protective_factor",
  NEXT_STEP: "next_step",
  EXPERIENCE: "experience",
  SOURCE_NOTE: "source_note",
  DOCUMENTATION_NOTE: "documentation_note",
  NETWORK_NOTE: "network_note"
});

const covisionCaseInclude = {
  sessionState: {
    select: { id: true, phase: true }
  },
  closure: { select: { id: true } },
  owner: {
    select: {
      id: true,
      email: true,
      role: true
    }
  },
  journeySteps: {
    orderBy: [{ order: "asc" }, { createdAt: "asc" }]
  },
  parties: {
    orderBy: { createdAt: "asc" }
  },
  riskFactors: {
    orderBy: { createdAt: "asc" }
  },
  participants: {
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true
        }
      }
    }
  },
  messages: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 150,
    include: {
      author: {
        select: {
          id: true,
          email: true,
          role: true,
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  },
  summaryRecord: true
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toDbEnum(value, map, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return map[normalized] || fallback;
}

function fromDbEnum(value, map, fallback = "") {
  return map[String(value || "").trim().toUpperCase()] || fallback;
}

function normalizeBool(value, fallback = false) {
  if (value === true || value === false) return value;
  return fallback;
}

function normalizeRoleInput(role, fallback = "PARTICIPANT") {
  return toDbEnum(role, PARTICIPANT_ROLE_TO_DB, fallback);
}

function normalizeCaseTitle(value) {
  const title = normalizeText(value, 180);
  if (!title) throw fail("covision.errors.title_required", 400);
  return title;
}

function normalizeJourneySteps(input) {
  const source = Array.isArray(input) ? input : [];
  return source
    .map((step, index) => {
      const type = normalizeText(step?.type, 120);
      const description = normalizeText(step?.description, MAX_TEXT_LENGTH);
      if (!type && !description) return null;
      return {
        type: type || "täpsustamisel",
        title: normalizeText(step?.title, 160) || null,
        description: description || null,
        relatedPartyIds: normalizeList(step?.relatedPartyIds, { maxItems: 20, maxLength: 80 }),
        order: Number.isFinite(Number(step?.order)) ? Number(step.order) : index,
        dateLabel: normalizeText(step?.dateLabel, 120) || null,
        notes: normalizeText(step?.notes ?? step?.note, MAX_TEXT_LENGTH) || null,
        status: toDbEnum(step?.status, STEP_STATUS_TO_DB, "NEEDS_CLARIFICATION")
      };
    })
    .filter(Boolean)
    .slice(0, 80);
}

function normalizeParties(input) {
  const source = Array.isArray(input) ? input : [];
  return source
    .map((party) => {
      const label = normalizeText(party?.label || party?.type, 160);
      if (!label) return null;
      return {
        category: normalizeText(party?.category, 160) || "Muu osapool",
        type: normalizeText(party?.type, 160) || label,
        label,
        roleDescription: normalizeText(party?.roleDescription, MAX_TEXT_LENGTH) || null,
        involvementStatus: normalizeText(party?.involvementStatus, 120) || null,
        cooperationStatus: normalizeText(party?.cooperationStatus, 120) || null,
        note: normalizeText(party?.note, MAX_TEXT_LENGTH) || null
      };
    })
    .filter(Boolean)
    .slice(0, 120);
}

function normalizeRiskFactors(input) {
  const source = Array.isArray(input) ? input : [];
  return source
    .map((factor) => {
      const label = normalizeText(factor?.label, 180);
      if (!label) return null;
      return {
        type: toDbEnum(factor?.type || factor?.kind, FACTOR_TYPE_TO_DB, "RISK"),
        label,
        severity: toDbEnum(factor?.severity, SEVERITY_TO_DB, "MEDIUM"),
        note: normalizeText(factor?.note, MAX_TEXT_LENGTH) || null,
        needsAttention: normalizeBool(factor?.needsAttention, true)
      };
    })
    .filter(Boolean)
    .slice(0, 120);
}

function normalizeParticipantInputs(input, ownerEmail) {
  const source = Array.isArray(input) ? input : [];
  const result = [];
  const seen = new Set();
  for (const item of source) {
    const email = normalizeEmail(typeof item === "string" ? item : item?.email);
    const userId = normalizeText(typeof item === "string" ? "" : item?.userId, 80);
    if (!email && !userId) continue;
    if (email && ownerEmail && email === ownerEmail) continue;
    const key = userId ? `user:${userId}` : `email:${email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      email: email || null,
      userId: userId || null,
      role: normalizeRoleInput(typeof item === "string" ? "participant" : item?.role)
    });
    if (result.length >= 80) break;
  }
  return result;
}

async function resolveParticipants(input, { ownerId, ownerEmail, db = prisma }) {
  const requested = normalizeParticipantInputs(input, ownerEmail);
  const emails = requested.map((participant) => participant.email).filter(Boolean);
  const usersByEmail = new Map();
  if (emails.length) {
    const users = await db.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true }
    });
    for (const user of users) {
      if (user.email) usersByEmail.set(user.email.toLowerCase(), user);
    }
  }

  const participants = [{
    userId: ownerId,
    email: ownerEmail || null,
    role: "OWNER",
    inviteStatus: "ACCEPTED"
  }];

  const seen = new Set([`user:${ownerId}`, ownerEmail ? `email:${ownerEmail}` : ""]);
  for (const item of requested) {
    const matched = item.email ? usersByEmail.get(item.email) : null;
    const userId = item.userId || matched?.id || null;
    if (userId === ownerId) continue;
    const key = userId ? `user:${userId}` : `email:${item.email}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.email) seen.add(`email:${item.email}`);
    participants.push({
      userId,
      email: item.email || matched?.email?.toLowerCase() || null,
      role: item.role,
      inviteStatus: "INVITED"
    });
  }

  return participants;
}

function normalizeCaseInput(input = {}, existing = null) {
  const title = normalizeCaseTitle(input.title ?? existing?.title);
  if (!input.anonymityConfirmed && !existing?.anonymityConfirmedAt) {
    throw fail("covision.errors.anonymityConfirmed_required", 400);
  }
  const description = normalizeText(
    input.anonymizedDescription ?? input.description ?? existing?.anonymizedDescription,
    MAX_TEXT_LENGTH
  );
  const topics = normalizeList(input.topics ?? existing?.topics, { maxItems: 24, maxLength: 80 });
  const inferredTopics = topics.length ? topics : inferCovisionTopics(title, description, input.summary);
  return {
    title,
    summary: normalizeText(input.summary ?? existing?.summary, MAX_TEXT_LENGTH) || null,
    anonymizedDescription: description || null,
    centralQuestion: normalizeText(input.centralQuestion ?? existing?.centralQuestion, MAX_TEXT_LENGTH) || null,
    expectedHelpTypes: normalizeList(input.expectedHelpTypes ?? existing?.expectedHelpTypes, { maxItems: 24, maxLength: 80 }),
    topics: inferredTopics,
    tags: normalizeList(input.tags ?? existing?.tags, { maxItems: 32, maxLength: 60 }),
    status: existing
      ? normalizeCovisionLegacyPatchStatus(input.status, existing.status)
      : "DRAFT",
    visibility: String(input.visibility || existing?.visibility || "PRIVATE").toUpperCase() === "ORGANIZATION" ? "ORGANIZATION" : "PRIVATE",
    anonymityConfirmedAt: input.anonymityConfirmed
      ? new Date()
      : existing?.anonymityConfirmedAt || null
  };
}

function visibleCaseWhere({ userId, email }) {
  const participantOr = covisionParticipantIdentityOr({ userId, email });
  return {
    OR: [
      { ownerId: userId },
      {
        participants: {
          some: {
            OR: participantOr,
            inviteStatus: "ACCEPTED"
          }
        }
      }
    ]
  };
}

function workspaceCaseWhere({ userId, email }) {
  const participantOr = covisionParticipantIdentityOr({ userId, email });
  return {
    OR: [
      { ownerId: userId },
      {
        participants: {
          some: {
            OR: participantOr,
            inviteStatus: { in: ["INVITED", "ACCEPTED"] }
          }
        }
      }
    ]
  };
}

function workspaceCaseSelect({ userId, email }) {
  const participantOr = covisionParticipantIdentityOr({ userId, email });
  return {
    id: true,
    ownerId: true,
    title: true,
    summary: true,
    centralQuestion: true,
    status: true,
    lastActivityAt: true,
    updatedAt: true,
    participants: {
      where: {
        OR: participantOr,
        inviteStatus: { in: ["INVITED", "ACCEPTED"] }
      },
      select: {
        userId: true,
        email: true,
        role: true,
        inviteStatus: true
      }
    }
  };
}


export function canUseCovisionRole(role, admin = false) {
  if (admin) return true;
  const normalizedRole = String(role || "").trim().toUpperCase();
  return normalizedRole === "SOCIAL_WORKER" || normalizedRole === "SERVICE_PROVIDER";
}

export function requireCovisionRole(session) {
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) throw fail("api.common.unauthorized", 401);
  const role = String(session?.user?.role || "").toUpperCase();
  const admin = role === "ADMIN" || session?.user?.isAdmin === true;
  if (!canUseCovisionRole(role, admin)) {
    throw fail("covision.errors.role_forbidden", 403);
  }
  return {
    userId,
    email: normalizeEmail(session?.user?.email),
    role,
    isAdmin: admin
  };
}

function currentUserParticipant(covisionCase, userId, email) {
  return covisionCase
    ? findCovisionParticipantForActor(covisionCase, userId, email)
    : null;
}

function canManageCovisionCase(covisionCase, auth) {
  if (!covisionCase || !auth?.userId) return false;
  if (covisionCase.ownerId === auth.userId) return true;
  const participant = currentUserParticipant(covisionCase, auth.userId, auth.email);
  return participant?.role === "CO_MODERATOR";
}

function canEditSummary(covisionCase, auth) {
  if (canManageCovisionCase(covisionCase, auth)) return true;
  const participant = currentUserParticipant(covisionCase, auth.userId, auth.email);
  return participant?.role === "SUMMARY_REVIEWER";
}

function serializeUser(user) {
  if (!user) return null;
  const name = [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ");
  return {
    role: user.role,
    name
  };
}

export function serializeCovisionCase(covisionCase, { userId = "", email = "" } = {}) {
  if (!covisionCase) return null;
  return {
    id: covisionCase.id,
    isOwner: covisionCase.ownerId === userId,
    title: covisionCase.title,
    summary: covisionCase.summary,
    anonymizedDescription: covisionCase.anonymizedDescription,
    centralQuestion: covisionCase.centralQuestion,
    expectedHelpTypes: covisionCase.expectedHelpTypes || [],
    topics: covisionCase.topics || [],
    tags: covisionCase.tags || [],
    status: fromDbEnum(covisionCase.status, CASE_STATUS_FROM_DB, "draft"),
    visibility: String(covisionCase.visibility || "PRIVATE").toLowerCase(),
    ...(covisionCase.ownerId === userId
      ? { sourcePreInquiryId: covisionCase.sourcePreInquiryId }
      : {}),
    anonymityConfirmedAt: covisionCase.anonymityConfirmedAt,
    lastActivityAt: covisionCase.lastActivityAt,
    createdAt: covisionCase.createdAt,
    updatedAt: covisionCase.updatedAt,
    owner: serializeUser(covisionCase.owner),
    currentUserRole: fromDbEnum(currentUserParticipant(covisionCase, userId, email)?.role, PARTICIPANT_ROLE_FROM_DB, ""),
    journeySteps: (covisionCase.journeySteps || []).map((step) => ({
      id: step.id,
      type: step.type,
      title: step.title,
      description: step.description,
      relatedPartyIds: step.relatedPartyIds || [],
      order: step.order,
      dateLabel: step.dateLabel,
      notes: step.notes,
      status: fromDbEnum(step.status, STEP_STATUS_FROM_DB, "needs_clarification")
    })),
    parties: (covisionCase.parties || []).map((party) => ({
      id: party.id,
      category: party.category,
      type: party.type,
      label: party.label,
      roleDescription: party.roleDescription,
      involvementStatus: party.involvementStatus,
      cooperationStatus: party.cooperationStatus,
      note: party.note
    })),
    riskFactors: (covisionCase.riskFactors || []).map((factor) => ({
      id: factor.id,
      type: fromDbEnum(factor.type, FACTOR_TYPE_FROM_DB, "risk"),
      label: factor.label,
      severity: fromDbEnum(factor.severity, SEVERITY_FROM_DB, "medium"),
      note: factor.note,
      needsAttention: factor.needsAttention
    })),
    participants: (covisionCase.participants || []).map((participant) => ({
      id: participant.id,
      role: fromDbEnum(participant.role, PARTICIPANT_ROLE_FROM_DB, "participant"),
      inviteStatus: fromDbEnum(participant.inviteStatus, INVITE_STATUS_FROM_DB, "invited"),
      user: serializeUser(participant.user)
    })),
    messages: (covisionCase.messages || []).map((message) => ({
      id: message.id,
      messageType: fromDbEnum(message.messageType, MESSAGE_TYPE_FROM_DB, "free_text"),
      body: message.body,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      author: serializeUser(message.author)
    })),
    summaryRecord: covisionCase.summaryRecord ? {
      id: covisionCase.summaryRecord.id,
      content: covisionCase.summaryRecord.content,
      keyObservations: covisionCase.summaryRecord.keyObservations,
      questions: covisionCase.summaryRecord.questions,
      risks: covisionCase.summaryRecord.risks,
      protectiveFactors: covisionCase.summaryRecord.protectiveFactors,
      possibleNextSteps: covisionCase.summaryRecord.possibleNextSteps,
      ethicalNotes: covisionCase.summaryRecord.ethicalNotes,
      documentationNotes: covisionCase.summaryRecord.documentationNotes,
      networkNotes: covisionCase.summaryRecord.networkNotes,
      takeaways: covisionCase.summaryRecord.takeaways,
      openQuestions: covisionCase.summaryRecord.openQuestions,
      createdAt: covisionCase.summaryRecord.createdAt,
      updatedAt: covisionCase.summaryRecord.updatedAt
    } : null
  };
}

export async function listCovisionWorkspace(auth) {
  const cases = await prisma.covisionCase.findMany({
    where: workspaceCaseWhere(auth),
    orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }],
    take: 100,
    select: workspaceCaseSelect(auth)
  });
  return {
    capabilities: { canCreate: canCreateCovision(auth) },
    cases: cases.map((item) => serializeCovisionWorkspaceCase(item, auth)).filter(Boolean)
  };
}

export async function listVisibleEffectivePractices(auth) {
  const workspace = await listEffectivePracticeWorkspace(auth);
  return workspace.practices;
}

async function findVisibleCovisionCase(db, auth, id) {
  const covisionCase = await db.covisionCase.findFirst({
    where: {
      id,
      ...visibleCaseWhere(auth)
    },
    include: covisionCaseInclude
  });

  if (!covisionCase) return null;
  return covisionCase;
}

export async function getVisibleCovisionCase(auth, id) {
  return findVisibleCovisionCase(prisma, auth, id);
}

export async function createCovisionCase(auth, input = {}, options = {}) {
  const ownerEmail = auth.email || null;
  const normalized = normalizeCaseInput(input);
  const participants = await resolveParticipants(input.participants, {
    ownerId: auth.userId,
    ownerEmail
  });
  const invitedEmails = participants
    .filter((participant) => participant.role !== "OWNER")
    .map((participant) => participant.email)
    .filter(Boolean);

  const covisionCase = await prisma.$transaction(async (tx) => {
    const createdCase = await tx.covisionCase.create({
      data: {
        ownerId: auth.userId,
        ...normalized,
        sourcePreInquiryId: normalizeText(options.sourcePreInquiryId, 80) || null,
        journeySteps: { create: normalizeJourneySteps(input.journeySteps) },
        parties: { create: normalizeParties(input.parties) },
        riskFactors: { create: normalizeRiskFactors(input.riskFactors) }
      }
    });
    const [sessionState, createdParticipants] = await Promise.all([
      tx.covisionSessionState.create({
        data: {
          covisionCaseId: createdCase.id,
          stage: 1,
          phase: "waiting_room",
          version: 0
        }
      }),
      Promise.all(participants.map((participant) => tx.covisionParticipant.create({
        data: { covisionCaseId: createdCase.id, ...participant }
      })))
    ]);
    await Promise.all(createdParticipants.map((participant) => (
      tx.covisionParticipantState.create({
        data: { sessionId: sessionState.id, participantId: participant.id }
      })
    )));
    return tx.covisionCase.findUnique({
      where: { id: createdCase.id },
      include: covisionCaseInclude
    });
  });

  sendCovisionInviteEmails({
    covisionCaseId: covisionCase.id,
    emails: invitedEmails,
    inviterEmail: ownerEmail
  }).catch((error) => {
    console.error("[covision] invite email failed", error?.message || error);
  });

  return serializeCovisionCase(covisionCase, auth);
}

export async function updateCovisionCase(auth, id, input = {}, { db = prisma } = {}) {
  const result = await withCovisionLegacyWriteLock(
    db,
    auth,
    id,
    findVisibleCovisionCase,
    async (tx, existing) => {
      if (!canManageCovisionCase(existing, auth)) throw fail("api.common.forbidden", 403);
      assertCovisionLegacyPatchAllowed(existing);

      const normalized = normalizeCaseInput(input, existing);
      const participants = await resolveParticipants(
        input.participants ?? existing.participants,
        {
          ownerId: existing.ownerId,
          ownerEmail: existing.owner?.email || auth.email || null,
          db: tx
        }
      );
      const existingEmails = new Set(
        (existing.participants || []).map((participant) => participant.email).filter(Boolean)
      );
      const invitedEmails = participants
        .filter((participant) => (
          participant.role !== "OWNER"
          && participant.email
          && !existingEmails.has(participant.email)
        ))
        .map((participant) => participant.email);

      await Promise.all([
        tx.covisionJourneyStep.deleteMany({ where: { covisionCaseId: id } }),
        tx.covisionParty.deleteMany({ where: { covisionCaseId: id } }),
        tx.covisionRiskFactor.deleteMany({ where: { covisionCaseId: id } }),
        tx.covisionParticipant.deleteMany({ where: { covisionCaseId: id } })
      ]);

      const covisionCase = await tx.covisionCase.update({
        where: { id },
        data: {
          ...normalized,
          lastActivityAt: new Date(),
          journeySteps: {
            create: normalizeJourneySteps(input.journeySteps ?? existing.journeySteps)
          },
          parties: { create: normalizeParties(input.parties ?? existing.parties) },
          riskFactors: {
            create: normalizeRiskFactors(input.riskFactors ?? existing.riskFactors)
          },
          participants: { create: participants }
        },
        include: covisionCaseInclude
      });
      return { covisionCase, invitedEmails };
    }
  );

  sendCovisionInviteEmails({
    covisionCaseId: result.covisionCase.id,
    emails: result.invitedEmails,
    inviterEmail: auth.email
  }).catch((error) => {
    console.error("[covision] invite email failed", error?.message || error);
  });

  return serializeCovisionCase(result.covisionCase, auth);
}

export async function addCovisionMessage(auth, id, input = {}, { db = prisma } = {}) {
  return withCovisionLegacyWriteLock(db, auth, id, findVisibleCovisionCase, async (tx, covisionCase) => {
    const body = normalizeText(input.body, MAX_TEXT_LENGTH);
    if (!body) throw fail("covision.errors.message_required", 400);
    const messageType = toDbEnum(input.messageType || input.type, MESSAGE_TYPE_TO_DB, "FREE_TEXT");

    const message = await tx.covisionMessage.create({
      data: {
        covisionCaseId: id,
        authorId: auth.userId,
        messageType,
        body
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    await tx.covisionCase.update({
      where: { id },
      data: {
        status: covisionCase.status === "DRAFT" ? "ACTIVE" : covisionCase.status,
        lastActivityAt: new Date()
      }
    });

    return {
      id: message.id,
      messageType: fromDbEnum(message.messageType, MESSAGE_TYPE_FROM_DB, "free_text"),
      body: message.body,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      author: serializeUser(message.author)
    };
  });
}

function normalizeSummaryInput(input = {}) {
  return {
    content: normalizeText(input.content, MAX_TEXT_LENGTH) || null,
    keyObservations: normalizeText(input.keyObservations, MAX_TEXT_LENGTH) || null,
    questions: normalizeText(input.questions, MAX_TEXT_LENGTH) || null,
    risks: normalizeText(input.risks, MAX_TEXT_LENGTH) || null,
    protectiveFactors: normalizeText(input.protectiveFactors, MAX_TEXT_LENGTH) || null,
    possibleNextSteps: normalizeText(input.possibleNextSteps, MAX_TEXT_LENGTH) || null,
    ethicalNotes: normalizeText(input.ethicalNotes, MAX_TEXT_LENGTH) || null,
    documentationNotes: normalizeText(input.documentationNotes, MAX_TEXT_LENGTH) || null,
    networkNotes: normalizeText(input.networkNotes, MAX_TEXT_LENGTH) || null,
    takeaways: normalizeText(input.takeaways, MAX_TEXT_LENGTH) || null,
    openQuestions: normalizeText(input.openQuestions, MAX_TEXT_LENGTH) || null
  };
}

export async function upsertCovisionSummary(auth, id, input = {}, { db = prisma } = {}) {
  return withCovisionLegacyWriteLock(db, auth, id, findVisibleCovisionCase, async (tx, covisionCase) => {
    if (!canEditSummary(covisionCase, auth)) throw fail("api.common.forbidden", 403);
    const data = normalizeSummaryInput(input);
    const summary = await tx.covisionSummary.upsert({
      where: { covisionCaseId: id },
      create: {
        covisionCaseId: id,
        ...data
      },
      update: data
    });

    await tx.covisionCase.update({
      where: { id },
      data: {
        status: "SUMMARY_READY",
        lastActivityAt: new Date()
      }
    });

    return summary;
  });
}

export function buildCovisionAssist({ action, covisionCase = {}, description = "", messages = [] } = {}) {
  if (action === "questions") {
    return {
      questions: suggestCentralQuestions({
        description: description || covisionCase.anonymizedDescription,
        topics: covisionCase.topics,
        riskFactors: covisionCase.riskFactors
      })
    };
  }
  if (action === "summary") {
    return {
      summary: draftCovisionSummary(covisionCase, messages || covisionCase.messages || [])
    };
  }
  if (action === "practice") {
    return {
      practice: buildEffectivePracticeDraft(covisionCase, covisionCase.summaryRecord || {})
    };
  }
  return {
    issues: detectAnonymityIssues(description || covisionCase.anonymizedDescription || ""),
    topics: inferCovisionTopics(description || covisionCase.anonymizedDescription || "")
  };
}

export async function createEffectivePractice(auth, input = {}) {
  return createEffectivePracticeCandidate(auth, input);
}

export async function updateEffectivePractice(auth, id, input = {}) {
  return updateEffectivePracticeCandidate(auth, id, input);
}

// buildCaseFromPreInquiryDraft and buildPreInquiryCovisionCaseInput live in the
// server-only-free ./covisionShared.js so they stay unit-testable; re-exported
// here for the existing "@/lib/covision" import surface.
export {
  buildCaseFromPreInquiryDraft,
  buildPreInquiryCovisionCaseInput
} from "./covisionShared.js";
