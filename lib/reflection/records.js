import { createHash } from "node:crypto";

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

function conflict(message, details) {
  const error = new Error(message);
  error.status = 409;
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

function hasMeaningfulContent(data) {
  return Object.values(data).some((value) => value !== null && value !== undefined);
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
   kirje JÄÄB, kuvatakse „allikas kustutatud"). Sama omanik-skoop käib loomisel
   ja lugemisel; puuduva ning võõra id vastus on tahtlikult üks ja sama. */
async function resolveSourceState(prisma, ownerUserId, sourceKind, sourceId) {
  if (!sourceKind || !sourceId) return null;
  /* Enne SOL-REF-02 loodud ARTIFACT-viiteid kuvame endiselt ausalt, kuid uusi
     selliseid viiteid sisendleping enam vastu ei võta. */
  if (sourceKind === "ARTIFACT") {
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
  return null;
}

async function requireOwnedSource(prisma, ownerUserId, sourceKind, sourceId) {
  if (!sourceKind) return;
  const state = await resolveSourceState(prisma, ownerUserId, sourceKind, sourceId);
  if (state !== "present") {
    const error = new Error("reflection.errors.source_missing");
    error.status = 404;
    throw error;
  }
}

const CREATE_RATE_LIMIT = Object.freeze({ limit: 20, windowMs: 60_000 });

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key) throw invalid("reflection.errors.idempotency_key_required");
  if (key.length < 8 || key.length > 128) {
    throw invalid("reflection.errors.invalid_idempotency_key");
  }
  return key;
}

function createRequestHash(data) {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function rateLimitKey(ownerUserId) {
  return createHash("sha256")
    .update(`reflection:create\u0000${ownerUserId}`)
    .digest("hex");
}

async function consumeCreateRateLimit(prisma, ownerUserId, now = new Date()) {
  if (typeof prisma?.$queryRawUnsafe !== "function") {
    throw new Error("REFLECTION_RATE_LIMIT_STORAGE_UNAVAILABLE");
  }
  const resetAt = new Date(now.getTime() + CREATE_RATE_LIMIT.windowMs);
  const [bucket] = await prisma.$queryRawUnsafe(
    `INSERT INTO "PracticeReflectionRateLimitBucket" ("key", "count", "resetAt", "updatedAt")
     VALUES ($1, 1, $2, $3)
     ON CONFLICT ("key") DO UPDATE SET
       "count" = CASE
         WHEN "PracticeReflectionRateLimitBucket"."resetAt" <= $3 THEN 1
         ELSE "PracticeReflectionRateLimitBucket"."count" + 1
       END,
       "resetAt" = CASE
         WHEN "PracticeReflectionRateLimitBucket"."resetAt" <= $3 THEN $2
         ELSE "PracticeReflectionRateLimitBucket"."resetAt"
       END,
       "updatedAt" = $3
     RETURNING "count", "resetAt"`,
    rateLimitKey(ownerUserId),
    resetAt,
    now
  );
  const count = Number(bucket?.count || 0);
  if (count > CREATE_RATE_LIMIT.limit) {
    const bucketResetAt = bucket?.resetAt instanceof Date ? bucket.resetAt : new Date(bucket?.resetAt || resetAt);
    const error = new Error("reflection.errors.rate_limited");
    error.status = 429;
    error.details = {
      retryAfterSeconds: Math.max(1, Math.ceil((bucketResetAt.getTime() - now.getTime()) / 1000))
    };
    throw error;
  }
}

function isUniqueConflict(error) {
  return error?.code === "P2002" || error?.code === "23505";
}

function publicReflection(row) {
  if (!row) return row;
  const { idempotencyKey: _idempotencyKey, requestHash: _requestHash, ...reflection } = row;
  return reflection;
}

async function findIdempotentReflection(prisma, ownerUserId, idempotencyKey) {
  return prisma.practiceReflection.findUnique({
    where: { ownerUserId_idempotencyKey: { ownerUserId, idempotencyKey } }
  });
}

export async function createPracticeReflectionForUser(userId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const data = normalizePayload(payload);
  const sourceRef = normalizeSourceRef(payload);
  if (!hasMeaningfulContent(data)) throw invalid("reflection.errors.content_required");
  const idempotencyKey = normalizeIdempotencyKey(options.idempotencyKey);
  const requestHash = createRequestHash({ ...sourceRef, ...data });

  const createInTransaction = async (tx) => {
    const existing = await findIdempotentReflection(tx, ownerUserId, idempotencyKey);
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw conflict("reflection.errors.idempotency_conflict");
      }
      return { reflection: publicReflection(existing), replayed: true };
    }
    await requireOwnedSource(tx, ownerUserId, sourceRef.sourceKind, sourceRef.sourceId);
    if (options.rateLimit !== false) {
      await consumeCreateRateLimit(tx, ownerUserId, options.now || new Date());
    }
    const reflection = await tx.practiceReflection.create({
      data: {
        ownerUserId,
        schemaVersion: "1.0",
        idempotencyKey,
        requestHash,
        ...sourceRef,
        ...data
      }
    });
    return { reflection: publicReflection(reflection), replayed: false };
  };

  try {
    return await prisma.$transaction(createInTransaction);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await findIdempotentReflection(prisma, ownerUserId, idempotencyKey);
    if (!existing) throw error;
    if (existing.requestHash !== requestHash) {
      throw conflict("reflection.errors.idempotency_conflict");
    }
    return { reflection: publicReflection(existing), replayed: true };
  }
}

const LIST_SELECT = Object.freeze({
  id: true,
  approach: true,
  method: true,
  interimOutcome: true,
  createdAt: true
});

function encodeListCursor(row) {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }), "utf8")
    .toString("base64url");
}

function decodeListCursor(value) {
  if (value === undefined || value === null || value === "") return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    const createdAt = new Date(parsed?.createdAt);
    const id = String(parsed?.id || "").trim();
    if (!id || id.length > 128 || Number.isNaN(createdAt.getTime())) throw new Error("invalid");
    return { createdAt, id };
  } catch {
    throw invalid("reflection.errors.invalid_cursor");
  }
}

export async function listPracticeReflectionsForUser(userId, filters = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const prisma = options.prisma || defaultPrisma;
  const takeNumber = filters.take === undefined || filters.take === null || filters.take === ""
    ? 25
    : Number(filters.take);
  if (!Number.isFinite(takeNumber)) throw invalid("reflection.errors.invalid_page_size");
  const take = Math.min(Math.max(Math.trunc(takeNumber), 1), 50);

  const kindProvided = filters.sourceKind !== undefined && filters.sourceKind !== null && filters.sourceKind !== "";
  const idProvided = filters.sourceId !== undefined && filters.sourceId !== null && filters.sourceId !== "";
  if (kindProvided !== idProvided) throw invalid("reflection.errors.invalid_source_filter");
  const sourceRef = kindProvided ? normalizeSourceRef(filters) : null;
  const cursor = decodeListCursor(filters.cursor);
  const rows = await prisma.practiceReflection.findMany({
    where: {
      ownerUserId,
      ...(sourceRef ? { sourceKind: sourceRef.sourceKind, sourceId: sourceRef.sourceId } : {}),
      ...(cursor ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } }
        ]
      } : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: LIST_SELECT,
    take: take + 1
  });
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return {
    items,
    page: { nextCursor: hasMore ? encodeListCursor(items[items.length - 1]) : null }
  };
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
  return { ...publicReflection(reflection), sourceState };
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

  if (!("expectedUpdatedAt" in payload)) {
    throw invalid("reflection.errors.expected_updated_at_required");
  }
  const expectedUpdatedAt = new Date(payload.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    throw invalid("reflection.errors.invalid_expected_updated_at");
  }

  /* updateMany omanik-skoobiga: võõra/olematu kirje puhul count 0 → 404,
     olemasolu ei leki. Õnnestumisel loetakse värske rida sama skoobiga. */
  const result = await prisma.practiceReflection.updateMany({
    where: { id, ownerUserId, updatedAt: expectedUpdatedAt },
    data
  });
  if (Number(result?.count) !== 1) {
    const current = await prisma.practiceReflection.findFirst({ where: { id, ownerUserId } });
    if (current) {
      throw conflict("reflection.errors.stale_update", { current: publicReflection(current) });
    }
    const error = new Error("reflection.errors.record_missing");
    error.status = 404;
    throw error;
  }
  const reflection = await prisma.practiceReflection.findFirst({
    where: { id, ownerUserId }
  });
  return { reflection: publicReflection(reflection) };
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
