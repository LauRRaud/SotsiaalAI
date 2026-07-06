import { getMailer, resolveBaseUrl } from "./mailer.js";
import { prisma } from "./prisma.js";
import {
  buildAnonymizedDraft,
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
  buildEffectivePracticeRagDocId,
  buildEffectivePracticeRagMetadata,
  buildEffectivePracticeRagText
} from "./covisionKnowledge.js";
import { buildRagHeaders, deleteRagDocument, ragServiceRequest } from "@/lib/documents/ragService";

const MAX_SHORT_TEXT_LENGTH = 1_000;
const MAX_TEXT_LENGTH = 16_000;

const CASE_STATUS_TO_DB = Object.freeze({
  draft: "DRAFT",
  active: "ACTIVE",
  summary_ready: "SUMMARY_READY",
  closed: "CLOSED",
  archived: "ARCHIVED"
});

const CASE_STATUS_FROM_DB = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  SUMMARY_READY: "summary_ready",
  CLOSED: "closed",
  ARCHIVED: "archived"
});

const PRACTICE_STATUS_TO_DB = Object.freeze({
  draft: "DRAFT",
  anonymity_check: "ANONYMITY_CHECK",
  review: "REVIEW",
  published: "PUBLISHED",
  hidden: "HIDDEN",
  archived: "ARCHIVED"
});

const PRACTICE_STATUS_FROM_DB = Object.freeze({
  DRAFT: "draft",
  ANONYMITY_CHECK: "anonymity_check",
  REVIEW: "review",
  PUBLISHED: "published",
  HIDDEN: "hidden",
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

const effectivePracticeInclude = {
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

async function resolveParticipants(input, { ownerId, ownerEmail }) {
  const requested = normalizeParticipantInputs(input, ownerEmail);
  const emails = requested.map((participant) => participant.email).filter(Boolean);
  const usersByEmail = new Map();
  if (emails.length) {
    const users = await prisma.user.findMany({
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
    status: toDbEnum(input.status ?? existing?.status, CASE_STATUS_TO_DB, existing?.status || "DRAFT"),
    visibility: String(input.visibility || existing?.visibility || "PRIVATE").toUpperCase() === "ORGANIZATION" ? "ORGANIZATION" : "PRIVATE",
    anonymityConfirmedAt: input.anonymityConfirmed
      ? new Date()
      : existing?.anonymityConfirmedAt || null
  };
}

function visibleCaseWhere({ userId, email }) {
  const participantOr = [{ userId }];
  if (email) participantOr.push({ email });
  return {
    OR: [
      { ownerId: userId },
      {
        participants: {
          some: {
            OR: participantOr,
            inviteStatus: { not: "DECLINED" }
          }
        }
      }
    ]
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
  if (!covisionCase || covisionCase.ownerId === userId) {
    return covisionCase ? { role: "OWNER", inviteStatus: "ACCEPTED" } : null;
  }
  return (covisionCase.participants || []).find((participant) => (
    (participant.userId && participant.userId === userId) ||
    (email && participant.email && participant.email.toLowerCase() === email)
  )) || null;
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
    id: user.id,
    email: user.email,
    role: user.role,
    name
  };
}

export function serializeCovisionCase(covisionCase, { userId = "", email = "" } = {}) {
  if (!covisionCase) return null;
  return {
    id: covisionCase.id,
    ownerId: covisionCase.ownerId,
    currentUserId: userId,
    title: covisionCase.title,
    summary: covisionCase.summary,
    anonymizedDescription: covisionCase.anonymizedDescription,
    centralQuestion: covisionCase.centralQuestion,
    expectedHelpTypes: covisionCase.expectedHelpTypes || [],
    topics: covisionCase.topics || [],
    tags: covisionCase.tags || [],
    status: fromDbEnum(covisionCase.status, CASE_STATUS_FROM_DB, "draft"),
    visibility: String(covisionCase.visibility || "PRIVATE").toLowerCase(),
    sourcePreInquiryId: covisionCase.sourcePreInquiryId,
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
      userId: participant.userId,
      email: participant.email,
      role: fromDbEnum(participant.role, PARTICIPANT_ROLE_FROM_DB, "participant"),
      inviteStatus: fromDbEnum(participant.inviteStatus, INVITE_STATUS_FROM_DB, "invited"),
      user: serializeUser(participant.user)
    })),
    messages: (covisionCase.messages || []).map((message) => ({
      id: message.id,
      authorId: message.authorId,
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

function serializeEffectivePractice(practice) {
  if (!practice) return null;
  return {
    id: practice.id,
    authorId: practice.authorId,
    sourceCovisionCaseId: practice.sourceCovisionCaseId,
    title: practice.title,
    background: practice.background,
    mainChallenge: practice.mainChallenge,
    whatHelped: practice.whatHelped,
    networkOrServiceRole: practice.networkOrServiceRole,
    outcome: practice.outcome,
    learningPoints: practice.learningPoints,
    limitations: practice.limitations,
    sources: practice.sources,
    topics: practice.topics || [],
    tags: practice.tags || [],
    status: fromDbEnum(practice.status, PRACTICE_STATUS_FROM_DB, "draft"),
    ragSourceId: practice.ragSourceId,
    ragMetadata: practice.ragMetadata,
    anonymityCheckedAt: practice.anonymityCheckedAt,
    reviewedAt: practice.reviewedAt,
    createdAt: practice.createdAt,
    updatedAt: practice.updatedAt,
    author: serializeUser(practice.author)
  };
}

async function syncEffectivePracticeToRag(practice, auth = {}) {
  const status = String(practice?.status || "").toUpperCase();
  const shouldPublish = status === "PUBLISHED";
  const include = effectivePracticeInclude;

  if (!shouldPublish) {
    if (practice?.ragSourceId) {
      await deleteRagDocument(practice.ragSourceId, {
        route: "covision/effective-practice",
        stage: "rag_delete",
        userId: auth.userId,
        role: auth.role
      });
      return prisma.effectivePractice.update({
        where: { id: practice.id },
        data: {
          ragSourceId: null,
          ragMetadata: {
            syncStatus: "removed",
            reason: "practice_not_published",
            checkedAt: new Date().toISOString()
          }
        },
        include
      });
    }
    return practice;
  }

  const docId = buildEffectivePracticeRagDocId(practice);
  if (!docId) return practice;
  if (!String(process.env.RAG_SERVICE_API_KEY || "").trim()) {
    return prisma.effectivePractice.update({
      where: { id: practice.id },
      data: {
        ragMetadata: {
          syncStatus: "skipped",
          reason: "rag_key_missing",
          checkedAt: new Date().toISOString()
        }
      },
      include
    });
  }

  const metadata = buildEffectivePracticeRagMetadata(practice, docId);
  const response = await ragServiceRequest(
    "/ingest/text",
    {
      method: "POST",
      headers: buildRagHeaders("application/json", {
        route: "covision/effective-practice",
        stage: "rag_ingest",
        userId: auth.userId,
        role: auth.role
      }),
      body: JSON.stringify({
        doc_id: docId,
        text: buildEffectivePracticeRagText(practice),
        metadata
      })
    },
    "covision.errors.practice_rag_sync_failed"
  );

  return prisma.effectivePractice.update({
    where: { id: practice.id },
    data: {
      ragSourceId: docId,
      ragMetadata: {
        ...metadata,
        syncStatus: "synced",
        inserted: response?.inserted ?? null,
        checkedAt: new Date().toISOString()
      },
      reviewedAt: practice.reviewedAt || new Date()
    },
    include
  });
}

async function finalizeEffectivePractice(practice, auth = {}) {
  try {
    return await syncEffectivePracticeToRag(practice, auth);
  } catch (error) {
    console.error("[covision] effective practice RAG sync failed", {
      practiceId: practice?.id,
      error: error?.message || String(error)
    });
    return prisma.effectivePractice.update({
      where: { id: practice.id },
      data: {
        ragMetadata: {
          syncStatus: "failed",
          message: String(error?.message || error),
          checkedAt: new Date().toISOString()
        }
      },
      include: effectivePracticeInclude
    });
  }
}

async function sendCovisionInviteEmails({ emails, inviterEmail }) {
  const recipients = [...new Set((emails || []).map(normalizeEmail).filter(Boolean))];
  if (!recipients.length) return;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (!from) return;
  const baseUrl = String(resolveBaseUrl() || "http://localhost:3000").replace(/\/+$/, "");
  const link = `${baseUrl}/kovisioon`;
  const mailer = getMailer("covision-invite");
  for (const to of recipients) {
    await mailer.sendMail({
      to,
      from,
      replyTo: inviterEmail || undefined,
      subject: "SotsiaalAI kovisiooni kutse",
      text: [
        "Sind kutsuti SotsiaalAI kovisiooni arutelusse.",
        "",
        "Kovisiooni sisu avaneb alles pärast autentimist ja õiguste kontrolli.",
        link
      ].join("\n"),
      html: [
        "<p>Sind kutsuti SotsiaalAI kovisiooni arutelusse.</p>",
        "<p>Kovisiooni sisu avaneb alles pärast autentimist ja õiguste kontrolli.</p>",
        `<p><a href="${link}">${link}</a></p>`
      ].join("\n")
    });
  }
}

export async function listCovisionWorkspace(auth) {
  const [cases, practices] = await Promise.all([
    prisma.covisionCase.findMany({
      where: visibleCaseWhere(auth),
      orderBy: [{ lastActivityAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: covisionCaseInclude
    }),
    prisma.effectivePractice.findMany({
      where: {
        OR: [
          { authorId: auth.userId },
          { status: "PUBLISHED" }
        ]
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      include: effectivePracticeInclude
    })
  ]);
  return {
    cases: cases.map((item) => serializeCovisionCase(item, auth)),
    practices: practices.map(serializeEffectivePractice)
  };
}

export async function getVisibleCovisionCase(auth, id) {
  const covisionCase = await prisma.covisionCase.findFirst({
    where: {
      id,
      ...visibleCaseWhere(auth)
    },
    include: covisionCaseInclude
  });

  if (!covisionCase) return null;

  const participant = currentUserParticipant(covisionCase, auth.userId, auth.email);
  if (participant?.id && participant.inviteStatus === "INVITED") {
    await prisma.covisionParticipant.update({
      where: { id: participant.id },
      data: {
        userId: participant.userId || auth.userId,
        inviteStatus: "ACCEPTED"
      }
    }).catch(() => null);
  }

  return covisionCase;
}

export async function createCovisionCase(auth, input = {}) {
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

  const covisionCase = await prisma.covisionCase.create({
    data: {
      ownerId: auth.userId,
      ...normalized,
      sourcePreInquiryId: normalizeText(input.sourcePreInquiryId, 80) || null,
      journeySteps: { create: normalizeJourneySteps(input.journeySteps) },
      parties: { create: normalizeParties(input.parties) },
      riskFactors: { create: normalizeRiskFactors(input.riskFactors) },
      participants: { create: participants }
    },
    include: covisionCaseInclude
  });

  sendCovisionInviteEmails({
    emails: invitedEmails,
    inviterEmail: ownerEmail
  }).catch((error) => {
    console.error("[covision] invite email failed", error?.message || error);
  });

  return serializeCovisionCase(covisionCase, auth);
}

export async function updateCovisionCase(auth, id, input = {}) {
  const existing = await getVisibleCovisionCase(auth, id);
  if (!existing) throw fail("api.common.not_found", 404);
  if (!canManageCovisionCase(existing, auth)) throw fail("api.common.forbidden", 403);

  const normalized = normalizeCaseInput(input, existing);
  const participants = await resolveParticipants(input.participants ?? existing.participants, {
    ownerId: existing.ownerId,
    ownerEmail: existing.owner?.email || auth.email || null
  });
  const existingEmails = new Set((existing.participants || []).map((participant) => participant.email).filter(Boolean));
  const invitedEmails = participants
    .filter((participant) => participant.role !== "OWNER" && participant.email && !existingEmails.has(participant.email))
    .map((participant) => participant.email);

  const covisionCase = await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.covisionJourneyStep.deleteMany({ where: { covisionCaseId: id } }),
      tx.covisionParty.deleteMany({ where: { covisionCaseId: id } }),
      tx.covisionRiskFactor.deleteMany({ where: { covisionCaseId: id } }),
      tx.covisionParticipant.deleteMany({ where: { covisionCaseId: id } })
    ]);

    return tx.covisionCase.update({
      where: { id },
      data: {
        ...normalized,
        lastActivityAt: new Date(),
        journeySteps: { create: normalizeJourneySteps(input.journeySteps ?? existing.journeySteps) },
        parties: { create: normalizeParties(input.parties ?? existing.parties) },
        riskFactors: { create: normalizeRiskFactors(input.riskFactors ?? existing.riskFactors) },
        participants: { create: participants }
      },
      include: covisionCaseInclude
    });
  });

  sendCovisionInviteEmails({
    emails: invitedEmails,
    inviterEmail: auth.email
  }).catch((error) => {
    console.error("[covision] invite email failed", error?.message || error);
  });

  return serializeCovisionCase(covisionCase, auth);
}

export async function addCovisionMessage(auth, id, input = {}) {
  const covisionCase = await getVisibleCovisionCase(auth, id);
  if (!covisionCase) throw fail("api.common.not_found", 404);
  const body = normalizeText(input.body, MAX_TEXT_LENGTH);
  if (!body) throw fail("covision.errors.message_required", 400);
  const messageType = toDbEnum(input.messageType || input.type, MESSAGE_TYPE_TO_DB, "FREE_TEXT");

  const message = await prisma.covisionMessage.create({
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

  await prisma.covisionCase.update({
    where: { id },
    data: {
      status: covisionCase.status === "DRAFT" ? "ACTIVE" : covisionCase.status,
      lastActivityAt: new Date()
    }
  }).catch(() => null);

  return {
    id: message.id,
    authorId: message.authorId,
    messageType: fromDbEnum(message.messageType, MESSAGE_TYPE_FROM_DB, "free_text"),
    body: message.body,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    author: serializeUser(message.author)
  };
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

export async function upsertCovisionSummary(auth, id, input = {}) {
  const covisionCase = await getVisibleCovisionCase(auth, id);
  if (!covisionCase) throw fail("api.common.not_found", 404);
  if (!canEditSummary(covisionCase, auth)) throw fail("api.common.forbidden", 403);

  const data = normalizeSummaryInput(input);
  const summary = await prisma.covisionSummary.upsert({
    where: { covisionCaseId: id },
    create: {
      covisionCaseId: id,
      ...data
    },
    update: data
  });

  await prisma.covisionCase.update({
    where: { id },
    data: {
      status: "SUMMARY_READY",
      lastActivityAt: new Date()
    }
  }).catch(() => null);

  return summary;
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

function normalizePracticeInput(input = {}, { admin = false } = {}) {
  const title = normalizeText(input.title, 180);
  if (!title) throw fail("covision.errors.practice_title_required", 400);
  let status = toDbEnum(input.status, PRACTICE_STATUS_TO_DB, "DRAFT");
  if (!admin && status === "PUBLISHED") {
    status = "REVIEW";
  }
  return {
    title,
    background: normalizeText(input.background, MAX_TEXT_LENGTH) || null,
    mainChallenge: normalizeText(input.mainChallenge, MAX_TEXT_LENGTH) || null,
    whatHelped: normalizeText(input.whatHelped, MAX_TEXT_LENGTH) || null,
    networkOrServiceRole: normalizeText(input.networkOrServiceRole, MAX_TEXT_LENGTH) || null,
    outcome: normalizeText(input.outcome, MAX_TEXT_LENGTH) || null,
    learningPoints: normalizeText(input.learningPoints, MAX_TEXT_LENGTH) || null,
    limitations: normalizeText(input.limitations, MAX_TEXT_LENGTH) || null,
    sources: normalizeText(input.sources, MAX_TEXT_LENGTH) || null,
    topics: normalizeList(input.topics, { maxItems: 24, maxLength: 80 }),
    tags: normalizeList(input.tags, { maxItems: 32, maxLength: 60 }),
    status,
    anonymityCheckedAt: status === "ANONYMITY_CHECK" || status === "REVIEW" || status === "PUBLISHED"
      ? new Date()
      : null
  };
}

export async function createEffectivePractice(auth, input = {}) {
  const sourceCovisionCaseId = normalizeText(input.sourceCovisionCaseId, 80);
  if (sourceCovisionCaseId) {
    const source = await getVisibleCovisionCase(auth, sourceCovisionCaseId);
    if (!source) throw fail("api.common.not_found", 404);
  }
  const data = normalizePracticeInput(input, { admin: auth.isAdmin });
  const practice = await prisma.effectivePractice.create({
    data: {
      authorId: auth.userId,
      sourceCovisionCaseId: sourceCovisionCaseId || null,
      ...data
    },
    include: effectivePracticeInclude
  });
  return serializeEffectivePractice(await finalizeEffectivePractice(practice, auth));
}

export async function updateEffectivePractice(auth, id, input = {}) {
  const existing = await prisma.effectivePractice.findFirst({
    where: {
      id,
      authorId: auth.userId
    }
  });
  if (!existing) throw fail("api.common.not_found", 404);
  const practice = await prisma.effectivePractice.update({
    where: { id },
    data: normalizePracticeInput({ ...existing, ...input }, { admin: auth.isAdmin }),
    include: effectivePracticeInclude
  });
  return serializeEffectivePractice(await finalizeEffectivePractice(practice, auth));
}

export function buildCaseFromPreInquiryDraft(preInquiry) {
  const sourceText = normalizeText(preInquiry?.situation, MAX_TEXT_LENGTH);
  const topics = inferCovisionTopics(preInquiry?.topic, sourceText);
  const anonymityIssues = detectAnonymityIssues(sourceText);
  return {
    title: normalizeText(preInquiry?.topic, MAX_SHORT_TEXT_LENGTH) || "Eelpöördumisest loodud kovisiooni mustand",
    summary: "Mustand on loodud spetsialisti aktiivsel valikul eelpöördumise põhjal. Enne kolleegide kutsumist tuleb anonüümsus üle kontrollida.",
    anonymizedDescription: buildAnonymizedDraft(sourceText),
    centralQuestion: "",
    topics,
    tags: topics,
    status: "draft",
    sourcePreInquiryId: preInquiry?.id || null,
    anonymityIssues
  };
}
