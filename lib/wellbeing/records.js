import { isDeepStrictEqual } from "node:util";
import { prisma as defaultPrisma } from "../prisma.js";
import {
  HARD_CASE_FIELD_KEYS,
  buildHardCaseRecord
} from "./hardCase.js";
import { withWellbeingAdvisoryLock } from "./outputDraftLock.js";
import {
  INTERRUPTIONS_FIELD_KEYS,
  buildInterruptionsRecord
} from "./interruptions.js";
import {
  QUICK_CHECK_FIELD_KEYS,
  buildQuickCheckRecord
} from "./quickCheck.js";
import {
  RECOVERY_FIELD_KEYS,
  buildRecoveryRecord
} from "./recovery.js";
import {
  ROLE_BOUNDARIES_FIELD_KEYS,
  buildRoleBoundariesRecord
} from "./roleBoundaries.js";
import {
  STARTER_SUPPORT_FIELD_KEYS,
  buildStarterSupportRecord
} from "./starterSupport.js";
import {
  WORKPLACE_VIOLENCE_FIELD_KEYS,
  buildWorkplaceViolenceRecord
} from "./workplaceViolence.js";
import {
  WORK_PROCESSES_FIELD_KEYS,
  buildWorkProcessesRecord
} from "./workProcesses.js";
import {
  WORK_BOUNDARIES_FIELD_KEYS,
  buildWorkBoundariesRecord
} from "./workBoundaries.js";

const VALID_WORKFLOW_TYPES = new Set([
  "quick-check",
  "overview",
  "hard-case",
  "workplace-violence",
  "recovery",
  "work-boundaries",
  "interruptions",
  "work-processes",
  "role-boundaries",
  "starter-support"
]);

function requireUserId(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) {
    const error = new Error("wellbeing.errors.unauthorized");
    error.status = 401;
    throw error;
  }
  return normalized;
}

function validateQuickCheckFields(fields = {}) {
  const missing = QUICK_CHECK_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateHardCaseFields(fields = {}) {
  const missing = HARD_CASE_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateInterruptionsFields(fields = {}) {
  const missing = INTERRUPTIONS_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateWorkplaceViolenceFields(fields = {}) {
  const missing = WORKPLACE_VIOLENCE_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateRecoveryFields(fields = {}) {
  const missing = RECOVERY_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateRoleBoundariesFields(fields = {}) {
  const missing = ROLE_BOUNDARIES_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateStarterSupportFields(fields = {}) {
  const missing = STARTER_SUPPORT_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateWorkBoundariesFields(fields = {}) {
  const missing = WORK_BOUNDARIES_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function validateWorkProcessesFields(fields = {}) {
  const missing = WORK_PROCESSES_FIELD_KEYS.filter((key) => !(key in fields));
  if (missing.length > 0) {
    const error = new Error("wellbeing.errors.invalid_standardized_fields");
    error.status = 400;
    error.details = { missing };
    throw error;
  }
}

function normalizeTake(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(Math.max(Math.trunc(number), 1), 100);
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* Topeltkliki ja paralleelpäringu kaitse (E0.3): sama omaniku sama töövoo
   sisult identne salvestus ≤30 s aknas tagastab olemasoleva kirje, mitte ei
   loo uut. Advisory-lock (võti omanik+töövoog) serialiseerib päris
   paralleelsed päringud; võrdlus on sügavvõrdlus, mitte võtmejärjestusest
   sõltuv stringify. Teadlik >30 s kordus loob uue kirje (kuni E2 toob
   „kas uuendada äsjast kirjet?" UI). */
const DEDUPE_WINDOW_MS = 30_000;

function sameStoredPayload(existing, data) {
  return isDeepStrictEqual(existing?.standardizedFields, data.standardizedFields)
    && (existing?.period ?? null) === (data.period ?? null)
    && (existing?.roleGroup ?? null) === (data.roleGroup ?? null);
}

async function createWellbeingRecordDeduped(prisma, data) {
  const lockKey = `wellbeingRecord:${data.ownerUserId}:${data.workflowType}`;
  return withWellbeingAdvisoryLock(prisma, lockKey, async (tx) => {
    const recent = await tx.wellbeingRecord.findFirst({
      where: {
        ownerUserId: data.ownerUserId,
        workflowType: data.workflowType,
        createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) }
      },
      orderBy: { createdAt: "desc" }
    });
    if (recent && sameStoredPayload(recent, data)) {
      return { record: recent, deduplicated: true };
    }
    const record = await tx.wellbeingRecord.create({ data });
    return { record, deduplicated: false };
  });
}

export async function createQuickCheckRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateQuickCheckFields(standardizedFields);

  const record = buildQuickCheckRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createHardCaseRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateHardCaseFields(standardizedFields);

  const record = buildHardCaseRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createInterruptionsRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateInterruptionsFields(standardizedFields);

  const record = buildInterruptionsRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createWorkplaceViolenceRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateWorkplaceViolenceFields(standardizedFields);

  const record = buildWorkplaceViolenceRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createRecoveryRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateRecoveryFields(standardizedFields);

  const record = buildRecoveryRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createWorkBoundariesRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateWorkBoundariesFields(standardizedFields);

  const record = buildWorkBoundariesRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createWorkProcessesRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateWorkProcessesFields(standardizedFields);

  const record = buildWorkProcessesRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createRoleBoundariesRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateRoleBoundariesFields(standardizedFields);

  const record = buildRoleBoundariesRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function createStarterSupportRecordForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};
  validateStarterSupportFields(standardizedFields);

  const record = buildStarterSupportRecord({
    period: payload.period || null,
    roleGroup: payload.roleGroup || null,
    standardizedFields
  });

  return createWellbeingRecordDeduped(prisma, {
    ownerUserId,
    schemaVersion: record.schemaVersion,
    scoringVersion: record.scoringVersion,
    workflowType: record.workflowType,
    period: record.period,
    roleGroup: record.roleGroup,
    standardizedFields: record.standardizedFields,
    computedSignal: record.computedSignal,
    loadFactors: record.loadFactors,
    resourceFactors: record.resourceFactors,
    riskMarkers: record.riskMarkers,
    recommendedActions: record.recommendedActions,
    visibility: "private",
    aggregationEligible: record.aggregationEligible
  });
}

export async function listWellbeingRecordsForUser(userId, filters = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const workflowType = String(filters.workflowType || "").trim();
  const periodStart = parseDate(filters.periodStart);
  const periodEnd = parseDate(filters.periodEnd);
  const createdAt = {
    ...(periodStart ? { gte: periodStart } : {}),
    ...(periodEnd ? { lt: periodEnd } : {})
  };

  return prisma.wellbeingRecord.findMany({
    where: {
      ownerUserId,
      ...(VALID_WORKFLOW_TYPES.has(workflowType) ? { workflowType } : {}),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {})
    },
    orderBy: { createdAt: "desc" },
    take: normalizeTake(filters.take)
  });
}

function requireRecordId(recordId) {
  const normalized = String(recordId || "").trim();
  if (!normalized) {
    const error = new Error("wellbeing.errors.record_missing");
    error.status = 400;
    throw error;
  }
  return normalized;
}

/* Üksikkirje lugemine (E1). Omanik-skoop `findFirst`-iga, MITTE `findUnique`:
   võõra omaniku kirje ID tagastab `null` (marsruut → 404), nii et olemasolu
   ei leki üle omanikupiiri. */
export async function getWellbeingRecordForUser(userId, recordId, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  return prisma.wellbeingRecord.findFirst({
    where: { id, ownerUserId }
  });
}

/* Päris kustutus (E1). `deleteMany` omanik-skoobiga where'is: võõra kirje või
   olematu ID annab `count: 0` (marsruut → 404) ilma viskamiseta. Koondist
   eemaldumine on automaatne — `aggregate.js` arvutab elusalt DB-st (ptk 4.3),
   materialiseeritud kihti pole. */
export async function deleteWellbeingRecordForUser(userId, recordId, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  const result = await prisma.wellbeingRecord.deleteMany({
    where: { id, ownerUserId }
  });
  return { deleted: Number(result?.count) === 1, count: Number(result?.count) || 0 };
}
