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

/* TO-1 „paranda uue kirjena": parandus tuleb ehitada SAMA töövoo builderiga mis
   originaal, muidu saaks parandus teistsuguse skoorimise kui parandatav. Kaart
   seob salvestatud `workflowType` tema builderi ja validaatoriga. `overview` on
   `VALID_WORKFLOW_TYPES`-is filtrina, aga tal ei ole loojat ega builderit —
   seetõttu teda siin ei ole ja tema parandamine kukub ausalt läbi. */
const WORKFLOW_BUILDERS = new Map([
  ["quick-check", { build: buildQuickCheckRecord, validate: validateQuickCheckFields }],
  ["hard-case", { build: buildHardCaseRecord, validate: validateHardCaseFields }],
  ["workplace-violence", { build: buildWorkplaceViolenceRecord, validate: validateWorkplaceViolenceFields }],
  ["recovery", { build: buildRecoveryRecord, validate: validateRecoveryFields }],
  ["work-boundaries", { build: buildWorkBoundariesRecord, validate: validateWorkBoundariesFields }],
  ["interruptions", { build: buildInterruptionsRecord, validate: validateInterruptionsFields }],
  ["work-processes", { build: buildWorkProcessesRecord, validate: validateWorkProcessesFields }],
  ["role-boundaries", { build: buildRoleBoundariesRecord, validate: validateRoleBoundariesFields }],
  ["starter-support", { build: buildStarterSupportRecord, validate: validateStarterSupportFields }]
]);

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
    where: { id, ownerUserId },
    /* TO-1 ahel mõlemas suunas: `supersedesRecordId` on skalaar (tuleb niikuinii
       kaasa), `supersededBy` on tagasiviide parandusele. Ainult id+aeg — ahela
       kuva ei vaja teise kirje sisu ja selle kaasavõtmine tooks tarbetult
       vastused/signaalid nähtavale seal, kus neid ei küsitud. */
    include: { supersededBy: { select: { id: true, createdAt: true } } }
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

/* TO-1 „paranda uue kirjena" (WB-V2-P2). Vastuseid EI muudeta kunagi kohapeal:
   parandus on uus kirje, parandatav jääb alles ja loetavaks. Nii ei kirjutata
   mustri-statistikat tagantjärele ümber — see oli TO-1 (c) valiku põhjus.

   Kaks asja peavad juhtuma koos või mitte üldse:
     1. parandatav kukub elusast koondist välja (`aggregationEligible=false`),
     2. parandus sünnib uue kirjena ja ahel seotakse (`supersedesRecordId`).
   Kui 1 õnnestuks ja 2 kukuks, kaoks kasutaja kirje vaikselt koondist ilma
   asenduseta. Advisory-lock kirje ID peal serialiseerib paralleelsed
   parandused, nii et „kaks parandust sama kirje peale" ei jõua tekkidagi;
   unikaalindeks on selle taga teine tõke.

   `aggregate.js` jääb PUUTUMATA — tema `buildWhere()` filtreerib juba
   `aggregationEligible: true` peal, seega vana kirje kukub koondist välja
   iseenesest. */
export async function createWellbeingRecordCorrectionForUser(userId, recordId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  const standardizedFields = payload.standardizedFields || {};

  return withWellbeingAdvisoryLock(prisma, `wellbeingRecord:correct:${id}`, async (tx) => {
    /* Omanik-skoop `findFirst`-iga, sama muster mis lugemisel: võõra kirje ID ei
       tohi paljastada olemasolu ka paranduskatsel. Lugemine on luku SEES, muidu
       jääks kontrolli ja kirjutuse vahele auk. */
    const original = await tx.wellbeingRecord.findFirst({
      where: { id, ownerUserId },
      include: { supersededBy: { select: { id: true } } }
    });
    if (!original) {
      const error = new Error("wellbeing.errors.record_missing");
      error.status = 404;
      throw error;
    }
    if (original.supersededBy) {
      const error = new Error("wellbeing.errors.record_already_superseded");
      error.status = 409;
      error.details = { supersededByRecordId: original.supersededBy.id };
      throw error;
    }

    const builder = WORKFLOW_BUILDERS.get(original.workflowType);
    if (!builder) {
      const error = new Error("wellbeing.errors.workflow_not_correctable");
      error.status = 400;
      error.details = { workflowType: original.workflowType };
      throw error;
    }
    builder.validate(standardizedFields);

    /* Parandus kirjeldab SAMA hetke, mitte uut: periood ja rollirühm päritakse
       originaalilt, kui parandus neid ise ei anna. */
    const built = builder.build({
      period: payload.period === undefined ? original.period : (payload.period || null),
      roleGroup: payload.roleGroup === undefined ? original.roleGroup : (payload.roleGroup || null),
      standardizedFields
    });

    await tx.wellbeingRecord.update({
      where: { id: original.id },
      data: { aggregationEligible: false }
    });
    const record = await tx.wellbeingRecord.create({
      data: {
        ownerUserId,
        schemaVersion: built.schemaVersion,
        scoringVersion: built.scoringVersion,
        workflowType: built.workflowType,
        period: built.period,
        roleGroup: built.roleGroup,
        standardizedFields: built.standardizedFields,
        computedSignal: built.computedSignal,
        loadFactors: built.loadFactors,
        resourceFactors: built.resourceFactors,
        riskMarkers: built.riskMarkers,
        recommendedActions: built.recommendedActions,
        visibility: "private",
        aggregationEligible: built.aggregationEligible,
        supersedesRecordId: original.id,
        /* Kontrollpunkt tuleb kaasa: parandus kirjeldab sama hetke, seega ka
           sama kokkulepet. Vastasel juhul kaoks kasutaja plaan iga paranduse
           peale ära ja badge vaikiks. */
        checkpointDueOn: original.checkpointDueOn ?? null,
        checkpoint: original.checkpoint ?? null
      }
    });

    return { record, correctedRecordId: original.id };
  });
}
