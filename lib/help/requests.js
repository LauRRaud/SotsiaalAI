import prisma from "../prisma.js";
import { resolvePrimaryHelpCategory } from "./categories.js";
import { toHelpListingView } from "./listingViews.js";
import { mapEntryFieldsFromInput, syncHelpRequestMapEntry } from "./mapEntries.js";
import { municipalitySummarySelect, requireMunicipality } from "./municipalities.js";
import { resolveTargetGroups, targetGroupSummarySelect } from "./targetGroups.js";

const DEFAULT_HELP_LISTING_EXPIRY_DAYS = 45;

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
  const title = String(value || "").replace(/\s+/g, " ").trim();
  if (!title) return null;
  return title.slice(0, 160);
}

function normalizeRequiredDescription(value = "") {
  const description = String(value || "").replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!description) {
    const error = new Error("HELP_REQUEST_DESCRIPTION_REQUIRED");
    error.code = "HELP_REQUEST_DESCRIPTION_REQUIRED";
    throw error;
  }
  return description.slice(0, 5000);
}

function normalizeOptionalText(value = "", max = 240) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
}

function normalizeStatus(value = "") {
  const status = String(value || "").trim().toUpperCase();
  if (!status) return undefined;
  if (["DRAFT", "OPEN", "MATCHED", "CLOSED", "CANCELLED", "ARCHIVED"].includes(status)) return status;
  const error = new Error("HELP_REQUEST_STATUS_INVALID");
  error.code = "HELP_REQUEST_STATUS_INVALID";
  throw error;
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
  const explicit = normalizeOptionalText(input?.structuredSummary, 280);
  if (explicit) return explicit;
  const title = normalizeOptionalText(input?.title, 120);
  const description = normalizeOptionalText(input?.description, 280);
  return title || description || null;
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

  const created = await prismaClient.helpRequest.create({
    data: {
      userId,
      municipalityId,
      primaryCategoryId: primaryCategory.id,
      title: normalizeOptionalTitle(input?.title),
      description: normalizeRequiredDescription(input?.description),
      structuredSummary: buildStructuredSummary(input),
      roleLabel: normalizeOptionalText(input?.roleLabel || input?.serviceLabel, 120),
      beneficiaryLabel: normalizeOptionalText(input?.beneficiaryLabel, 120),
      urgency: normalizeOptionalText(input?.urgency, 120),
      availabilityOrStart: normalizeOptionalText(input?.availabilityOrStart, 240),
      compensationDetails: normalizeOptionalText(input?.compensationDetails, 240),
      conditions: normalizeOptionalText(input?.conditions, 500),
      skillsOrBackground: normalizeOptionalText(input?.skillsOrBackground, 500),
      rawPlace: normalizeOptionalText(input?.rawPlace, 160),
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
  await syncHelpRequestMapEntry(created, mapEntryFieldsFromInput(input), prismaClient);
  return getHelpRequestById(created.id, prismaClient);
}

async function listHelpRequests(filters = {}, prismaClient = prisma) {
  const where = {};
  const userId = String(filters?.userId || filters?.requesterId || "").trim();
  const excludeUserId = String(filters?.excludeUserId || "").trim();
  const municipalityId = String(filters?.municipalityId || "").trim();
  const status = normalizeStatus(filters?.status);
  const primaryCategoryId = String(filters?.primaryCategoryId || "").trim();

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

  const municipalityId = String(input?.municipalityId || "").trim() || null;
  if (municipalityId) {
    await requireMunicipality(municipalityId, prismaClient);
  }

  const data = {};
  if (Object.prototype.hasOwnProperty.call(input, "title")) data.title = normalizeOptionalTitle(input?.title);
  if (Object.prototype.hasOwnProperty.call(input, "description")) data.description = normalizeRequiredDescription(input?.description);
  if (Object.prototype.hasOwnProperty.call(input, "structuredSummary") || Object.prototype.hasOwnProperty.call(input, "description") || Object.prototype.hasOwnProperty.call(input, "title")) {
    data.structuredSummary = buildStructuredSummary({
      structuredSummary: input?.structuredSummary,
      title: Object.prototype.hasOwnProperty.call(input, "title") ? input?.title : undefined,
      description: Object.prototype.hasOwnProperty.call(input, "description") ? input?.description : undefined
    });
  }
  if (Object.prototype.hasOwnProperty.call(input, "roleLabel") || Object.prototype.hasOwnProperty.call(input, "serviceLabel")) {
    data.roleLabel = normalizeOptionalText(input?.roleLabel || input?.serviceLabel, 120);
  }
  if (Object.prototype.hasOwnProperty.call(input, "beneficiaryLabel")) data.beneficiaryLabel = normalizeOptionalText(input?.beneficiaryLabel, 120);
  if (Object.prototype.hasOwnProperty.call(input, "urgency")) data.urgency = normalizeOptionalText(input?.urgency, 120);
  if (Object.prototype.hasOwnProperty.call(input, "availabilityOrStart")) data.availabilityOrStart = normalizeOptionalText(input?.availabilityOrStart, 240);
  if (Object.prototype.hasOwnProperty.call(input, "compensationDetails")) data.compensationDetails = normalizeOptionalText(input?.compensationDetails, 240);
  if (Object.prototype.hasOwnProperty.call(input, "conditions")) data.conditions = normalizeOptionalText(input?.conditions, 500);
  if (Object.prototype.hasOwnProperty.call(input, "skillsOrBackground")) data.skillsOrBackground = normalizeOptionalText(input?.skillsOrBackground, 500);
  if (Object.prototype.hasOwnProperty.call(input, "rawPlace")) data.rawPlace = normalizeOptionalText(input?.rawPlace, 160);
  if (Object.prototype.hasOwnProperty.call(input, "helpType")) data.helpType = normalizeHelpType(input?.helpType);
  if (Object.prototype.hasOwnProperty.call(input, "timeType")) data.timeType = normalizeTimeType(input?.timeType);
  if (Object.prototype.hasOwnProperty.call(input, "status")) data.status = normalizeStatus(input?.status);
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

  const updated = await prismaClient.helpRequest.update({
    where: { id },
    data: {
      ...data,
      ...(shouldUpdateTargetGroups
        ? {
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
          }
        : {})
    },
    select: helpRequestDetailSelect
  });
  await syncHelpRequestMapEntry(updated, mapEntryFieldsFromInput(input), prismaClient);
  return getHelpRequestById(id, prismaClient);
}

export async function deleteHelpRequest(helpRequestId, prismaClient = prisma) {
  const id = String(helpRequestId || "").trim();
  if (!id) return null;
  return prismaClient.helpRequest.delete({
    where: { id },
    select: {
      id: true
    }
  });
}

export async function listHelpRequestListingViews(filters = {}, options = {}, prismaClient = prisma) {
  const locale = String(options?.locale || filters?.locale || "et").trim();
  const records = await listHelpRequests(filters, prismaClient);
  return records.map((record) => toHelpListingView(record, { kind: "request", locale }));
}
