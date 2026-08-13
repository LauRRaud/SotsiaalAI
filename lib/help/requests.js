import prisma from "../prisma.js";
import { resolvePrimaryHelpCategory } from "./categories.js";
import { toHelpListingView, toPublicHelpListingProjection } from "./listingViews.js";
import { mapEntryFieldsFromInput, syncHelpRequestMapEntry } from "./mapEntries.js";
import { deleteHelpListingWithAcceptedMatchGuard } from "./listingDeletion.js";
import { HELP_LISTING_TEXT_LIMITS, normalizeHelpListingText, truncateDerivedHelpText } from "./listingLimits.js";
import { municipalitySummarySelect, requireMunicipality } from "./municipalities.js";
import { resolveTargetGroups, targetGroupSummarySelect } from "./targetGroups.js";

const DEFAULT_HELP_LISTING_EXPIRY_DAYS = 45;
const HELP_REQUEST_STATUS_TRANSITIONS = Object.freeze({
  PUBLISH: Object.freeze({ from: Object.freeze(["DRAFT"]), to: "OPEN" }),
  MARK_MATCHED: Object.freeze({ from: Object.freeze(["OPEN"]), to: "MATCHED" }),
  CLOSE: Object.freeze({ from: Object.freeze(["OPEN", "MATCHED"]), to: "CLOSED" }),
  CANCEL: Object.freeze({ from: Object.freeze(["DRAFT", "OPEN"]), to: "CANCELLED" }),
  ARCHIVE: Object.freeze({ from: Object.freeze(["MATCHED", "CLOSED", "CANCELLED"]), to: "ARCHIVED" }),
  REOPEN: Object.freeze({ from: Object.freeze(["CLOSED", "CANCELLED"]), to: "OPEN" })
});

const helpRequestDetailSelect = Object.freeze({
  id: true,
  userId: true,
  municipalityId: true,
  primaryCategoryId: true,
  title: true,
  description: true,
  structuredSummary: true,
  roleLabel: true,
  beneficiaryLabel: true,
  urgency: true,
  availabilityOrStart: true,
  compensationDetails: true,
  conditions: true,
  skillsOrBackground: true,
  rawPlace: true,
  helpType: true,
  timeType: true,
  status: true,
  classificationSource: true,
  classificationConfidence: true,
  userConfirmedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  mapEntry: {
    select: {
      id: true,
      kind: true,
      mapVisible: true,
      mapMode: true,
      address: true,
      normalizedAddress: true,
      latitude: true,
      longitude: true,
      geocodingStatus: true,
      geocodingRaw: true,
      county: true,
      municipalityIds: true,
      serviceArea: true,
      categoryCode: true,
      helpType: true,
      targetGroupCodes: true,
      needTags: true,
      deliveryModes: true,
      contactMode: true,
      status: true,
      expiresAt: true,
      privacyNote: true
    }
  },
  municipality: {
    select: municipalitySummarySelect
  },
  primaryCategory: {
    select: {
      id: true,
      code: true,
      labelEt: true,
      labelEn: true,
      labelRu: true
    }
  },
  categoryLinks: {
    select: {
      categoryId: true,
      category: {
        select: {
          id: true,
          code: true,
          labelEt: true,
          labelEn: true,
          labelRu: true
        }
      }
    }
  },
  targetGroupLinks: {
    select: {
      targetGroupId: true,
      targetGroup: {
        select: targetGroupSummarySelect
      }
    }
  }
});

function normalizeOptionalTitle(value = "") {
  return normalizeHelpListingText(value, { field: "title" });
}

function normalizeRequiredDescription(value = "") {
  const description = normalizeHelpListingText(value, { field: "description", preserveNewlines: true });
  if (!description) {
    const error = new Error("HELP_REQUEST_DESCRIPTION_REQUIRED");
    error.code = "HELP_REQUEST_DESCRIPTION_REQUIRED";
    throw error;
  }
  return description;
}

function normalizeOptionalText(value = "", field) {
  return normalizeHelpListingText(value, { field });
}

function normalizeStatus(value = "") {
  const status = String(value || "").trim().toUpperCase();
  if (!status) return undefined;
  if (["DRAFT", "OPEN", "MATCHED", "CLOSED", "CANCELLED", "ARCHIVED"].includes(status)) return status;
  const error = new Error("HELP_REQUEST_STATUS_INVALID");
  error.code = "HELP_REQUEST_STATUS_INVALID";
  throw error;
}

function hasOwn(input, field) {
  return Object.prototype.hasOwnProperty.call(input || {}, field);
}

function helpRequestError(code, current = undefined) {
  const error = new Error(code);
  error.code = code;
  if (current !== undefined) error.current = current;
  return error;
}

function normalizeExpectedUpdatedAt(value) {
  if (value === undefined || value === null || value === "") {
    throw helpRequestError("HELP_REQUEST_EXPECTED_UPDATED_AT_REQUIRED");
  }
  const date = value instanceof Date ? new Date(value) : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw helpRequestError("HELP_REQUEST_EXPECTED_UPDATED_AT_INVALID");
  }
  return date;
}

function nextUpdatedAt(expectedUpdatedAt) {
  return new Date(Math.max(Date.now(), expectedUpdatedAt.getTime() + 1));
}

function normalizeTransition(input = {}) {
  if (hasOwn(input, "status")) throw helpRequestError("HELP_REQUEST_STATUS_PATCH_INVALID");
  const action = String(input?.action || "").trim().toUpperCase();
  const transition = HELP_REQUEST_STATUS_TRANSITIONS[action];
  if (!transition) throw helpRequestError("HELP_REQUEST_TRANSITION_ACTION_INVALID");
  const reason = String(input?.reason || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!reason) throw helpRequestError("HELP_REQUEST_TRANSITION_REASON_REQUIRED");
  return { action, reason, transition };
}

function requireTransaction(prismaClient) {
  if (typeof prismaClient?.$transaction !== "function") {
    throw helpRequestError("HELP_REQUEST_TRANSACTION_REQUIRED");
  }
  return prismaClient.$transaction.bind(prismaClient);
}

function normalizeHelpType(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  if (["VOLUNTARY", "PAID", "MIXED"].includes(normalized)) return normalized;
  if (["VABATAHTLIK", "VABATAHTLIK ABI", "TASUTA", "VOLUNTEER", "VOLUNTEERED"].includes(normalized)) return "VOLUNTARY";
  if (["TASULINE", "PAID HELP", "PAID"].includes(normalized)) return "PAID";
  if (["SEGATUD", "VABATAHTLIK VOI TASULINE", "VABATAHTLIK VÕI TASULINE"].includes(normalized)) return "MIXED";
  return null;
}

function normalizeTimeType(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;
  if (["ONE_TIME", "RECURRING", "FLEXIBLE"].includes(normalized)) return normalized;
  if (["UHEKORDNE", "ONE TIME"].includes(normalized)) return "ONE_TIME";
  if (["IGAPAEVANE", "PAAR KORDA NADALAS", "RECURRING"].includes(normalized)) return "RECURRING";
  if (["AJUTINE", "FLEXIBLE"].includes(normalized)) return "FLEXIBLE";
  return null;
}

function normalizeClassificationSource(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return undefined;
  if (["AI", "USER", "MANUAL"].includes(normalized)) return normalized;
  const error = new Error("HELP_REQUEST_CLASSIFICATION_SOURCE_INVALID");
  error.code = "HELP_REQUEST_CLASSIFICATION_SOURCE_INVALID";
  throw error;
}

function normalizeExpiresAt(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    const error = new Error("HELP_REQUEST_EXPIRES_AT_INVALID");
    error.code = "HELP_REQUEST_EXPIRES_AT_INVALID";
    throw error;
  }
  return date;
}

function defaultExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_HELP_LISTING_EXPIRY_DAYS);
  return date;
}

function buildStructuredSummary(input = {}) {
  if (hasOwn(input, "structuredSummary")) {
    return normalizeOptionalText(input?.structuredSummary, "structuredSummary");
  }
  return truncateDerivedHelpText(input?.title, HELP_LISTING_TEXT_LIMITS.structuredSummary)
    || truncateDerivedHelpText(input?.description, HELP_LISTING_TEXT_LIMITS.structuredSummary)
    || null;
}

export async function createHelpRequest(input = {}, prismaClient = prisma) {
  const userId = String(input?.userId || input?.requesterId || "").trim();
  const municipalityId = String(input?.municipalityId || "").trim() || null;
  if (!userId) {
    const error = new Error("HELP_REQUEST_USER_REQUIRED");
    error.code = "HELP_REQUEST_USER_REQUIRED";
    throw error;
  }

  if (municipalityId) {
    await requireMunicipality(municipalityId, prismaClient);
  }

  const primaryCategory = await resolvePrimaryHelpCategory({
    primaryCategoryId: input?.primaryCategoryId,
    primaryCategoryCode: input?.primaryCategoryCode,
    category: input?.category,
    serviceLabel: input?.serviceLabel,
    description: input?.description
  }, prismaClient);
  const targetGroups = await resolveTargetGroups(input, prismaClient);

  const transaction = requireTransaction(prismaClient);
  return transaction(async (tx) => {
    const created = await tx.helpRequest.create({
      data: {
      userId,
      municipalityId,
      primaryCategoryId: primaryCategory.id,
      title: normalizeOptionalTitle(input?.title),
      description: normalizeRequiredDescription(input?.description),
      structuredSummary: buildStructuredSummary(input),
      roleLabel: normalizeOptionalText(input?.roleLabel || input?.serviceLabel, "roleLabel"),
      beneficiaryLabel: normalizeOptionalText(input?.beneficiaryLabel, "beneficiaryLabel"),
      urgency: normalizeOptionalText(input?.urgency, "urgency"),
      availabilityOrStart: normalizeOptionalText(input?.availabilityOrStart, "availabilityOrStart"),
      compensationDetails: normalizeOptionalText(input?.compensationDetails, "compensationDetails"),
      conditions: normalizeOptionalText(input?.conditions, "conditions"),
      skillsOrBackground: normalizeOptionalText(input?.skillsOrBackground, "skillsOrBackground"),
      rawPlace: normalizeOptionalText(input?.rawPlace, "rawPlace"),
      helpType: normalizeHelpType(input?.helpType),
      timeType: normalizeTimeType(input?.timeType),
      ...(normalizeStatus(input?.status) ? { status: normalizeStatus(input?.status) } : {}),
      ...(normalizeClassificationSource(input?.classificationSource) ? { classificationSource: normalizeClassificationSource(input?.classificationSource) } : {}),
      ...(Number.isFinite(Number(input?.classificationConfidence)) ? { classificationConfidence: Number(input.classificationConfidence) } : {}),
      ...(input?.userConfirmedAt ? { userConfirmedAt: new Date(input.userConfirmedAt) } : {}),
      expiresAt: normalizeExpiresAt(input?.expiresAt) || defaultExpiresAt(),
      ...(targetGroups.length
        ? {
            targetGroupLinks: {
              create: targetGroups.map((group) => ({
                targetGroupId: group.id
              }))
            }
          }
        : {})
      },
      select: helpRequestDetailSelect
    });
    await syncHelpRequestMapEntry(created, mapEntryFieldsFromInput(input), tx);
    return getHelpRequestById(created.id, tx);
  });
}

async function listHelpRequests(filters = {}, prismaClient = prisma) {
  const where = {};
  const userId = String(filters?.userId || filters?.requesterId || "").trim();
  const excludeUserId = String(filters?.excludeUserId || "").trim();
  const municipalityId = String(filters?.municipalityId || "").trim();
  const requestedStatus = normalizeStatus(filters?.status);
  const primaryCategoryId = String(filters?.primaryCategoryId || "").trim();

  // FAIL-CLOSED nähtavuspõrand. Ainult 'mine' skoop (omanik oma kirjete üle)
  // tohib näha mitteavalikke staatuseid. Iga muu kutsuja (globaalne loend,
  // skoobita, uus route) saab OPEN-põranda ega saa DRAFT/CLOSED/CANCELLED/
  // ARCHIVED/MATCHED lekitada — ka siis, kui klient saadab status=DRAFT.
  const ownerScope = filters?.scope === "mine" && Boolean(userId);
  const status = ownerScope ? requestedStatus : "OPEN";

  if (userId) where.userId = userId;
  if (excludeUserId) {
    where.NOT = {
      userId: excludeUserId
    };
  }
  if (municipalityId) where.municipalityId = municipalityId;
  if (primaryCategoryId) where.primaryCategoryId = primaryCategoryId;
  if (status) where.status = status;
  if (status === "OPEN") {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    ];
  }

  return prismaClient.helpRequest.findMany({
    where,
    select: helpRequestDetailSelect,
    orderBy: [{ createdAt: "desc" }],
    skip: Math.max(0, Number(filters?.offset) || 0),
    take: Math.max(1, Math.min(100, Number(filters?.limit) || 25))
  });
}

export async function getHelpRequestById(helpRequestId, prismaClient = prisma) {
  const id = String(helpRequestId || "").trim();
  if (!id) return null;

  return prismaClient.helpRequest.findUnique({
    where: { id },
    select: helpRequestDetailSelect
  });
}

export async function updateHelpRequest(helpRequestId, input = {}, prismaClient = prisma) {
  const id = String(helpRequestId || "").trim();
  if (!id) {
    const error = new Error("HELP_REQUEST_ID_REQUIRED");
    error.code = "HELP_REQUEST_ID_REQUIRED";
    throw error;
  }

  if (hasOwn(input, "status")) throw helpRequestError("HELP_REQUEST_STATUS_PATCH_INVALID");
  const expectedUpdatedAt = normalizeExpectedUpdatedAt(input?.expectedUpdatedAt);
  const municipalityId = String(input?.municipalityId || "").trim() || null;
  if (municipalityId) {
    await requireMunicipality(municipalityId, prismaClient);
  }

  const data = {};
  if (Object.prototype.hasOwnProperty.call(input, "title")) data.title = normalizeOptionalTitle(input?.title);
  if (Object.prototype.hasOwnProperty.call(input, "description")) data.description = normalizeRequiredDescription(input?.description);
  if (Object.prototype.hasOwnProperty.call(input, "structuredSummary") || Object.prototype.hasOwnProperty.call(input, "description") || Object.prototype.hasOwnProperty.call(input, "title")) {
    data.structuredSummary = buildStructuredSummary({
      ...(hasOwn(input, "structuredSummary") ? { structuredSummary: input?.structuredSummary } : {}),
      title: Object.prototype.hasOwnProperty.call(input, "title") ? input?.title : undefined,
      description: Object.prototype.hasOwnProperty.call(input, "description") ? input?.description : undefined
    });
  }
  if (Object.prototype.hasOwnProperty.call(input, "roleLabel") || Object.prototype.hasOwnProperty.call(input, "serviceLabel")) {
    data.roleLabel = normalizeOptionalText(input?.roleLabel || input?.serviceLabel, "roleLabel");
  }
  if (Object.prototype.hasOwnProperty.call(input, "beneficiaryLabel")) data.beneficiaryLabel = normalizeOptionalText(input?.beneficiaryLabel, "beneficiaryLabel");
  if (Object.prototype.hasOwnProperty.call(input, "urgency")) data.urgency = normalizeOptionalText(input?.urgency, "urgency");
  if (Object.prototype.hasOwnProperty.call(input, "availabilityOrStart")) data.availabilityOrStart = normalizeOptionalText(input?.availabilityOrStart, "availabilityOrStart");
  if (Object.prototype.hasOwnProperty.call(input, "compensationDetails")) data.compensationDetails = normalizeOptionalText(input?.compensationDetails, "compensationDetails");
  if (Object.prototype.hasOwnProperty.call(input, "conditions")) data.conditions = normalizeOptionalText(input?.conditions, "conditions");
  if (Object.prototype.hasOwnProperty.call(input, "skillsOrBackground")) data.skillsOrBackground = normalizeOptionalText(input?.skillsOrBackground, "skillsOrBackground");
  if (Object.prototype.hasOwnProperty.call(input, "rawPlace")) data.rawPlace = normalizeOptionalText(input?.rawPlace, "rawPlace");
  if (Object.prototype.hasOwnProperty.call(input, "helpType")) data.helpType = normalizeHelpType(input?.helpType);
  if (Object.prototype.hasOwnProperty.call(input, "timeType")) data.timeType = normalizeTimeType(input?.timeType);
  if (Object.prototype.hasOwnProperty.call(input, "municipalityId")) data.municipalityId = municipalityId;
  if (Object.prototype.hasOwnProperty.call(input, "expiresAt")) data.expiresAt = normalizeExpiresAt(input?.expiresAt) || null;

  if (Object.prototype.hasOwnProperty.call(input, "primaryCategoryId") || Object.prototype.hasOwnProperty.call(input, "primaryCategoryCode") || Object.prototype.hasOwnProperty.call(input, "category")) {
    const primaryCategory = await resolvePrimaryHelpCategory({
      primaryCategoryId: input?.primaryCategoryId,
      primaryCategoryCode: input?.primaryCategoryCode,
      category: input?.category,
      serviceLabel: input?.serviceLabel,
      description: input?.description
    }, prismaClient);
    data.primaryCategoryId = primaryCategory.id;
  }

  const shouldUpdateTargetGroups = Object.prototype.hasOwnProperty.call(input, "targetGroup")
    || Object.prototype.hasOwnProperty.call(input, "targetGroups")
    || Object.prototype.hasOwnProperty.call(input, "targetGroupCodes");
  const targetGroups = shouldUpdateTargetGroups ? await resolveTargetGroups(input, prismaClient) : null;

  const transaction = requireTransaction(prismaClient);
  return transaction(async (tx) => {
    const claimed = await tx.helpRequest.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: { ...data, updatedAt: nextUpdatedAt(expectedUpdatedAt) }
    });
    if (claimed.count !== 1) {
      const current = await getHelpRequestById(id, tx);
      if (!current) throw helpRequestError("HELP_REQUEST_NOT_FOUND");
      throw helpRequestError("HELP_REQUEST_CONFLICT", current);
    }

    if (shouldUpdateTargetGroups) {
      await tx.helpRequest.update({
        where: { id },
        data: {
          targetGroupLinks: {
            deleteMany: {},
            ...(targetGroups?.length
              ? {
                  create: targetGroups.map((group) => ({
                    targetGroupId: group.id
                  }))
                }
              : {})
          }
        },
        select: { id: true }
      });
    }

    const updated = await getHelpRequestById(id, tx);
    await syncHelpRequestMapEntry(updated, mapEntryFieldsFromInput(input), tx);
    return getHelpRequestById(id, tx);
  });
}

export async function transitionHelpRequestStatus(helpRequestId, input = {}, prismaClient = prisma) {
  const id = String(helpRequestId || "").trim();
  if (!id) throw helpRequestError("HELP_REQUEST_ID_REQUIRED");
  const expectedUpdatedAt = normalizeExpectedUpdatedAt(input?.expectedUpdatedAt);
  const { action, reason, transition } = normalizeTransition(input);
  const transaction = requireTransaction(prismaClient);

  return transaction(async (tx) => {
    const before = await getHelpRequestById(id, tx);
    if (!before) throw helpRequestError("HELP_REQUEST_NOT_FOUND");
    if (!transition.from.includes(before.status)) {
      throw helpRequestError("HELP_REQUEST_TRANSITION_CONFLICT", before);
    }

    const claimed = await tx.helpRequest.updateMany({
      where: {
        id,
        updatedAt: expectedUpdatedAt,
        status: { in: transition.from }
      },
      data: {
        status: transition.to,
        updatedAt: nextUpdatedAt(expectedUpdatedAt)
      }
    });
    if (claimed.count !== 1) {
      const current = await getHelpRequestById(id, tx);
      if (!current) throw helpRequestError("HELP_REQUEST_NOT_FOUND");
      throw helpRequestError("HELP_REQUEST_CONFLICT", current);
    }

    const updated = await getHelpRequestById(id, tx);
    await syncHelpRequestMapEntry(updated, { syncLifecycleStatus: true }, tx);
    await tx.dataAuditLog.create({
      data: {
        actorUserId: updated.userId,
        targetUserId: updated.userId,
        action: `HELP_REQUEST_${action}`,
        resourceType: "HelpRequest",
        resourceId: id,
        meta: {
          action,
          reason,
          fromStatus: before.status,
          toStatus: transition.to,
          expectedUpdatedAt: expectedUpdatedAt.toISOString()
        }
      },
      select: { id: true }
    });
    return getHelpRequestById(id, tx);
  });
}

export async function deleteHelpRequest(helpRequestId, optionsOrPrisma = {}, prismaClient = prisma) {
  const id = String(helpRequestId || "").trim();
  if (!id) return null;
  const legacyPrismaClient = typeof optionsOrPrisma?.$transaction === "function" ? optionsOrPrisma : null;
  const options = legacyPrismaClient ? {} : optionsOrPrisma;
  return deleteHelpListingWithAcceptedMatchGuard({ kind: "request", id, ...options }, legacyPrismaClient || prismaClient);
}

export async function listHelpRequestListingViews(filters = {}, options = {}, prismaClient = prisma) {
  const locale = String(options?.locale || filters?.locale || "et").trim();
  const records = await listHelpRequests(filters, prismaClient);
  const toListingView = filters?.scope === "mine"
    ? toHelpListingView
    : toPublicHelpListingProjection;
  return records.map((record) => toListingView(record, { kind: "request", locale }));
}
