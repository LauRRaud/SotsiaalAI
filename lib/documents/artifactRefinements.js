import crypto from "node:crypto"

import { prisma } from "@/lib/prisma"
import { createArtifactError } from "@/lib/documents/artifacts"
import { buildArtifactGenerationMetadata } from "@/lib/documents/artifactProvenance"

export const ARTIFACT_REFINEMENT_LIMIT = 3
export const ARTIFACT_REFINEMENT_LEASE_MS = 2 * 60_000

function conflict(key = "documents.artifacts.errors.version_conflict") {
  return createArtifactError(key, 409)
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

export function buildArtifactRefinementRequestHash(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(payload))).digest("hex")
}

async function confirmedRefinementCount(tx, ownerId, artifactId) {
  const rows = await tx.$queryRaw`
    SELECT COUNT(*)::integer AS "count"
    FROM "DocumentAudit"
    WHERE "ownerId" = ${ownerId}
      AND "artifactId" = ${artifactId}
      AND "action" = 'ARTIFACT_REFINE'::"DocumentAuditAction"
      AND COALESCE("meta"->>'pending', 'false') <> 'true'
  `
  return Number(rows?.[0]?.count || 0)
}

async function assertCurrentDraft(tx, { artifactId, ownerId, expectedUpdatedAt }) {
  const artifact = await tx.agentArtifact.findFirst({
    where: { id: artifactId, ownerId },
    select: { id: true, status: true, updatedAt: true, content: true }
  })
  if (!artifact) throw createArtifactError("documents.artifacts.errors.not_found", 404)
  if (artifact.status !== "DRAFT") {
    throw conflict("documents.artifacts.errors.final_read_only")
  }
  if (artifact.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw conflict()
  return artifact
}

export async function claimArtifactRefinement(
  {
    artifactId,
    ownerId,
    idempotencyKey,
    requestHash,
    expectedUpdatedAt,
    now = new Date(),
    leaseMs = ARTIFACT_REFINEMENT_LEASE_MS,
    limit = ARTIFACT_REFINEMENT_LIMIT
  },
  { db = prisma } = {}
) {
  const key = String(idempotencyKey || "").trim()
  if (!key) throw createArtifactError("documents.errors.invalid_payload", 400)
  const expected = expectedUpdatedAt instanceof Date ? expectedUpdatedAt : new Date(expectedUpdatedAt)
  if (Number.isNaN(expected.getTime())) throw createArtifactError("documents.errors.invalid_payload", 400)

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`artifactRefinementIntent:${ownerId}:${key}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`artifactRefinement:${artifactId}`}))`

    const existing = await tx.agentArtifactRefinement.findUnique({
      where: { ownerId_idempotencyKey: { ownerId, idempotencyKey: key } }
    })
    if (existing) {
      if (existing.artifactId !== artifactId || existing.requestHash !== requestHash) throw conflict()
      if (existing.status === "DONE") {
        return { refinement: existing, reused: true, cached: true, used: null, limit }
      }
      if (existing.status === "RUNNING" && existing.leaseExpiresAt && existing.leaseExpiresAt > now) {
        const error = conflict("documents.artifacts.errors.refinement_in_progress")
        error.retryAfter = Math.max(1, Math.ceil((existing.leaseExpiresAt.getTime() - now.getTime()) / 1000))
        throw error
      }

      await assertCurrentDraft(tx, { artifactId, ownerId, expectedUpdatedAt: expected })
      let slotAuditId = existing.slotAuditId
      let used = await confirmedRefinementCount(tx, ownerId, artifactId)
      if (!slotAuditId) {
        if (used >= limit) {
          const error = createArtifactError("api.common.rate_limited", 429)
          error.usedRefinements = used
          error.refinementLimit = limit
          throw error
        }
        const audit = await tx.documentAudit.create({
          data: {
            ownerId,
            artifactId,
            action: "ARTIFACT_REFINE",
            meta: { event: "artifact.refined", pending: true, idempotencyKey: key }
          }
        })
        slotAuditId = audit.id
      }
      const claimToken = crypto.randomUUID()
      const refinement = await tx.agentArtifactRefinement.update({
        where: { id: existing.id },
        data: {
          status: "RUNNING",
          claimToken,
          slotAuditId,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          attempts: { increment: 1 },
          lastErrorCode: null
        }
      })
      return { refinement, reused: true, cached: false, used: used + 1, limit }
    }

    await assertCurrentDraft(tx, { artifactId, ownerId, expectedUpdatedAt: expected })
    const used = await confirmedRefinementCount(tx, ownerId, artifactId)
    if (used >= limit) {
      const error = createArtifactError("api.common.rate_limited", 429)
      error.usedRefinements = used
      error.refinementLimit = limit
      throw error
    }
    const audit = await tx.documentAudit.create({
      data: {
        ownerId,
        artifactId,
        action: "ARTIFACT_REFINE",
        meta: { event: "artifact.refined", pending: true, idempotencyKey: key }
      }
    })
    const refinement = await tx.agentArtifactRefinement.create({
      data: {
        artifactId,
        ownerId,
        idempotencyKey: key,
        requestHash,
        claimToken: crypto.randomUUID(),
        expectedUpdatedAt: expected,
        status: "RUNNING",
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        slotAuditId: audit.id
      }
    })
    return { refinement, reused: false, cached: false, used: used + 1, limit }
  })
}

export async function failArtifactRefinement(
  { refinementId, claimToken, errorCode = "REFINEMENT_FAILED" },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const current = await tx.agentArtifactRefinement.findFirst({
      where: { id: refinementId, claimToken, status: "RUNNING" }
    })
    if (!current) return false
    if (current.slotAuditId) {
      await tx.documentAudit.deleteMany({
        where: { id: current.slotAuditId, meta: { path: ["pending"], equals: true } }
      })
    }
    await tx.agentArtifactRefinement.update({
      where: { id: current.id },
      data: {
        status: "FAILED",
        leaseExpiresAt: null,
        slotAuditId: null,
        lastErrorCode: String(errorCode || "REFINEMENT_FAILED").slice(0, 80),
        updatedAt: now
      }
    })
    return true
  })
}

export async function persistArtifactRefinement(
  { refinementId, claimToken, ownerId, artifactId, expectedUpdatedAt, content, debugMeta, used, commitUsage },
  { db, now = new Date() } = {}
) {
  if (!db) throw new TypeError("transaction db is required")
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`artifactRefinement:${artifactId}`}))`
  const refinement = await db.agentArtifactRefinement.findFirst({
    where: { id: refinementId, ownerId, artifactId, claimToken, status: "RUNNING" }
  })
  if (!refinement) throw conflict("documents.artifacts.errors.refinement_claim_lost")

  const expected = expectedUpdatedAt instanceof Date ? expectedUpdatedAt : new Date(expectedUpdatedAt)
  const currentArtifact = await db.agentArtifact.findFirst({
    where: { id: artifactId, ownerId },
    select: { metadata: true }
  })
  if (!currentArtifact) throw createArtifactError("documents.artifacts.errors.not_found", 404)
  const changed = await db.agentArtifact.updateMany({
    where: { id: artifactId, ownerId, status: "DRAFT", updatedAt: expected },
    data: {
      content,
      metadata: buildArtifactGenerationMetadata(currentArtifact.metadata, debugMeta),
      updatedAt: now
    }
  })
  if (changed.count !== 1) {
    const current = await db.agentArtifact.findFirst({ where: { id: artifactId, ownerId }, select: { status: true } })
    if (!current) throw createArtifactError("documents.artifacts.errors.not_found", 404)
    if (current.status !== "DRAFT") throw conflict("documents.artifacts.errors.final_read_only")
    throw conflict()
  }

  await db.documentAudit.update({
    where: { id: refinement.slotAuditId },
    data: { meta: { event: "artifact.refined", used, idempotencyKey: refinement.idempotencyKey } }
  })
  await db.agentArtifactRefinement.update({
    where: { id: refinement.id },
    data: {
      status: "DONE",
      resultContent: content,
      resultUpdatedAt: now,
      completedAt: now,
      leaseExpiresAt: null,
      lastErrorCode: null
    }
  })
  await commitUsage(db)
  return { content, updatedAt: now, jobId: refinement.id }
}
