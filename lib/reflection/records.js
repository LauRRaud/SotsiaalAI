import { prisma as defaultPrisma } from "../prisma.js";
import {
  INTERIM_OUTCOME,
  REFLECTION_SOURCE_KIND,
  REFLECTION_TEXT_FIELDS,
  REFLECTION_TEXT_MAX_LENGTH,
  isInterimOutcome,
  isReflectionSourceKind,
  isSupportNeed
} from "./constants.js";

/* Meetodipeegli kirjete CRUD (T21 P3, O-CW-3; analüüsidoc ptk 3.3).
   Iga päring on omanik-skoobitud SAMA mustriga mis wellbeing/records.js:
   `findFirst`/`deleteMany`/`updateMany` where-omanik-skoobiga, et võõra kirje
   ID annaks 404 ilma olemasolu lekitamata. Admin-rada EI OLE olemas — kirjete
   olemasolu fakt ei ole nähtav kellelegi peale omaniku (ptk 3.6 p3). */

function requireUserId(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) {
    const error = new Error("reflection.errors.unauthorized");
    error.status = 401;
    throw error;
  }
  return normalized;
}

function requireReflectionId(reflectionId) {
  const normalized = String(reflectionId || "").trim();
  if (!normalized) {
    const error = new Error("reflection.errors.record_missing");
    error.status = 400;
    throw error;
  }
  return normalized;
}

function invalid(message, details) {
  const error = new Error(message);
  error.status = 400;
  if (details) error.details = details;
  return error;
}

function normalizeText(value, field) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw invalid("reflection.errors.invalid_field", { field });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > REFLECTION_TEXT_MAX_LENGTH) {
    throw invalid("reflection.errors.field_too_long", {
      field,
      max: REFLECTION_TEXT_MAX_LENGTH
    });
  }
  return trimmed;
}

/* Sisendleping: tundmatud võtmed EI kandu andmebaasi (extra-forbid vaimus —
   sama kaitseklass mis rag-service AgentDocumentSearchIn). Ainult siin loetletud
   väljad loetakse payload'ist; kõik muu ignoreeritakse vaikimisi. */
function normalizePayload(payload = {}) {
  const data = {};
  for (const field of REFLECTION_TEXT_FIELDS) {
    if (field in payload) data[field] = normalizeText(payload[field], field);
  }

  if ("supportNeed" in payload) {
    const value = payload.supportNeed === null || payload.supportNeed === ""
      ? null
      : String(payload.supportNeed);
    if (value !== null && !isSupportNeed(value)) {
      throw invalid("reflection.errors.invalid_support_need", { value });
    }
    data.supportNeed = value;
  }

  if ("interimOutcome" in payload) {
    const value = payload.interimOutcome === null || payload.interimOutcome === ""
      ? null
      : String(payload.interimOutcome);
    if (value !== null && !isInterimOutcome(value)) {
      throw invalid("reflection.errors.invalid_interim_outcome", { value });
    }
    data.interimOutcome = value;
  }

  return data;
}

/* Allikaviide on lubatud AINULT loomisel: refleksioon on tegevuse kohta ja
   sideme hilisem ümbertõstmine teeks kirje ajaloo valeks. */
function normalizeSourceRef(payload = {}) {
  const kindRaw = payload.sourceKind ?? null;
  const idRaw = payload.sourceId ?? null;
  if (kindRaw === null && idRaw === null) return { sourceKind: null, sourceId: null };

  const kind = String(kindRaw || "").trim().toUpperCase();
  const id = String(idRaw || "").trim();
  if (!isReflectionSourceKind(kind)) {
    throw invalid("reflection.errors.invalid_source_kind", { value: kindRaw });
  }
  if (!id || id.length > 128) {
    throw invalid("reflection.errors.invalid_source_id");
  }
  return { sourceKind: kind, sourceId: id };
}

/* Allika olemasolu lahendamine lugemisel (ptk 3.3 „Seos": allika kustumisel
   kirje JÄÄB, kuvatakse „allikas kustutatud"). Lahendus on omanik-skoobitud —
   võõra objekti olemasolu ei lehita ka siit. Lahendatavad on liigid, millel on
   üheselt omanik-skoobitav mudel: ARTIFACT (AgentArtifact.ownerId) ja
   PRE_INQUIRY (vastuvõtja PreInquiry.recipientOwnerId). MEETING/CALL viide
   kuvatakse ilma olemasoluväiteta (state: "unresolved") — nende omanikupiir
   käib ruumi-/protsessiliikmesuse, mitte üksiku välja kaudu, ja see lahendus
   tuleb koos vastava sisenemispunktiga. */
async function resolveSourceState(prisma, ownerUserId, sourceKind, sourceId) {
  if (!sourceKind || !sourceId) return null;
  if (sourceKind === REFLECTION_SOURCE_KIND.ARTIFACT) {
    const row = await prisma.agentArtifact.findFirst({
      where: { id: sourceId, ownerId: ownerUserId },
      select: { id: true }
    });
    return row ? "present" : "deleted";
  }
  if (sourceKind === REFLECTION_SOURCE_KIND.PRE_INQUIRY) {
    const row = await prisma.preInquiry.findFirst({
      where: { id: sourceId, recipientOwnerId: ownerUserId },
      select: { id: true }
    });
    return row ? "present" : "deleted";
  }
  return "unresolved";
}

export async function createPracticeReflectionForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const data = normalizePayload(payload);
  const sourceRef = normalizeSourceRef(payload);

  const reflection = await prisma.practiceReflection.create({
    data: {
      ownerUserId,
      schemaVersion: "1.0",
      ...sourceRef,
      ...data
    }
  });
  return { reflection };
}

export async function listPracticeReflectionsForUser(userId, filters = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const takeNumber = Number(filters.take);
  const take = Number.isFinite(takeNumber)
    ? Math.min(Math.max(Math.trunc(takeNumber), 1), 100)
    : 50;

  const sourceRef = (() => {
    try {
      const ref = normalizeSourceRef(filters);
      return ref.sourceKind ? ref : null;
    } catch {
      return null;
    }
  })();

  return prisma.practiceReflection.findMany({
    where: {
      ownerUserId,
      ...(sourceRef ? { sourceKind: sourceRef.sourceKind, sourceId: sourceRef.sourceId } : {})
    },
    orderBy: { createdAt: "desc" },
    take
  });
}

export async function getPracticeReflectionForUser(userId, reflectionId, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireReflectionId(reflectionId);
  const prisma = options.prisma || defaultPrisma;

  const reflection = await prisma.practiceReflection.findFirst({
    where: { id, ownerUserId }
  });
  if (!reflection) return null;

  const sourceState = await resolveSourceState(
    prisma,
    ownerUserId,
    reflection.sourceKind,
    reflection.sourceId
  );
  return { ...reflection, sourceState };
}

export async function updatePracticeReflectionForUser(userId, reflectionId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireReflectionId(reflectionId);
  const prisma = options.prisma || defaultPrisma;
  const data = normalizePayload(payload);

  if ("sourceKind" in payload || "sourceId" in payload) {
    throw invalid("reflection.errors.source_ref_immutable");
  }
  if (Object.keys(data).length === 0) {
    throw invalid("reflection.errors.empty_update");
  }

  /* updateMany omanik-skoobiga: võõra/olematu kirje puhul count 0 → 404,
     olemasolu ei leki. Õnnestumisel loetakse värske rida sama skoobiga. */
  const result = await prisma.practiceReflection.updateMany({
    where: { id, ownerUserId },
    data
  });
  if (Number(result?.count) !== 1) {
    const error = new Error("reflection.errors.record_missing");
    error.status = 404;
    throw error;
  }
  const reflection = await prisma.practiceReflection.findFirst({
    where: { id, ownerUserId }
  });
  return { reflection };
}

export async function deletePracticeReflectionForUser(userId, reflectionId, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireReflectionId(reflectionId);
  const prisma = options.prisma || defaultPrisma;
  const result = await prisma.practiceReflection.deleteMany({
    where: { id, ownerUserId }
  });
  return { deleted: Number(result?.count) === 1, count: Number(result?.count) || 0 };
}

/* Kirje suunatud kokkuvõte K1 adapterile: AINULT ajatemplid. Sisu (meetod,
   vaatlused, tõlgendus) EI välju siit kunagi — adapter on sisutu (W-INV-7
   analoog; ptk 3.6). */
export async function getReflectionActivityForUser(userId, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const latest = await prisma.practiceReflection.findFirst({
    where: { ownerUserId },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true }
  });
  return latest ? { lastActivityAt: latest.updatedAt } : null;
}

export { INTERIM_OUTCOME };
