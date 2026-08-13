import crypto from "node:crypto";

import { buildRagHeaders, ragServiceRequest } from "@/lib/documents/ragService";
import { prisma as defaultPrisma } from "@/lib/prisma";

const LEASE_MS = 2 * 60 * 1000;

function payloadHash(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function retryAt(now, attempts) {
  return new Date(now.getTime() + Math.min(60 * 60 * 1000, 5_000 * (2 ** Math.min(attempts, 7))));
}

export async function queueServiceProviderProfileRagJob({ db, profile, payload, now = new Date() }) {
  if (!db?.serviceProviderProfileRagJob || !profile?.id || !profile?.updatedAt || !payload?.doc_id) {
    throw new TypeError("service provider profile RAG job transaction client is required");
  }
  return db.serviceProviderProfileRagJob.upsert({
    where: { profileId_revisionAt: { profileId: profile.id, revisionAt: profile.updatedAt } },
    create: {
      profileId: profile.id,
      revisionAt: profile.updatedAt,
      documentId: payload.doc_id,
      payload,
      payloadSha256: payloadHash(payload),
      status: "PENDING",
      nextAttemptAt: now
    },
    update: {},
    select: { id: true }
  });
}

async function defaultSend(job) {
  const payload = job.payload;
  return ragServiceRequest("/ingest/text", {
    method: "POST",
    headers: buildRagHeaders("application/json", {
      route: "service-provider/profile",
      stage: "rag_ingest_job",
      userId: payload.owner_id || undefined
    }),
    body: JSON.stringify({ doc_id: payload.doc_id, text: payload.text, metadata: payload.metadata })
  }, "service_provider_profile.errors.rag_sync_failed");
}

export async function readServiceProviderProfileRagDocument(documentId) {
  try {
    return await ragServiceRequest(`/documents/${encodeURIComponent(documentId)}`, {
      method: "GET",
      headers: buildRagHeaders(null, { route: "service-provider/profile", stage: "rag_reconcile" })
    }, "service_provider_profile.errors.rag_reconcile_failed");
  } catch (error) {
    if (Number(error?.status || error?.payload?.status || 0) === 404) return null;
    throw error;
  }
}

async function markSuperseded(db, job, leaseToken, now) {
  await db.serviceProviderProfileRagJob.updateMany({
    where: { id: job.id, status: "PROCESSING", leaseToken },
    data: { status: "SUPERSEDED", leaseToken: null, leaseExpiresAt: null, completedAt: now, lastErrorCode: null }
  });
}

export async function processServiceProviderProfileRagJobs({
  db = defaultPrisma,
  send = defaultSend,
  now = new Date(),
  limit = 20,
  jobId = null,
  afterRemoteSuccess = null
} = {}) {
  const candidates = await db.serviceProviderProfileRagJob.findMany({
    where: {
      ...(jobId ? { id: jobId } : {}),
      nextAttemptAt: { lte: now },
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "PROCESSING", leaseExpiresAt: { lt: now } }
      ]
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(Number(limit) || 20, 100))
  });
  const summary = { claimed: 0, succeeded: 0, failed: 0, superseded: 0 };
  for (const candidate of candidates) {
    const leaseToken = crypto.randomUUID();
    const claimed = await db.serviceProviderProfileRagJob.updateMany({
      where: {
        id: candidate.id,
        OR: [
          { status: { in: ["PENDING", "FAILED"] } },
          { status: "PROCESSING", leaseExpiresAt: { lt: now } }
        ]
      },
      data: {
        status: "PROCESSING",
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        attempts: { increment: 1 },
        lastErrorCode: null
      }
    });
    if (claimed.count !== 1) continue;
    summary.claimed += 1;
    const job = await db.serviceProviderProfileRagJob.findUnique({ where: { id: candidate.id } });
    const profile = await db.serviceProviderProfile.findUnique({
      where: { id: job.profileId },
      select: { id: true, updatedAt: true, status: true, assistantRecommendationAllowed: true }
    });
    if (!profile || profile.updatedAt.getTime() !== job.revisionAt.getTime() ||
        profile.status !== "PUBLISHED" || profile.assistantRecommendationAllowed !== true) {
      await markSuperseded(db, job, leaseToken, now);
      summary.superseded += 1;
      continue;
    }
    try {
      const response = await send(job);
      if (afterRemoteSuccess) await afterRemoteSuccess(job, response);
      const finalized = await db.$transaction(async (tx) => {
        const linked = await tx.serviceProviderProfile.updateMany({
          where: {
            id: job.profileId,
            updatedAt: job.revisionAt,
            status: "PUBLISHED",
            assistantRecommendationAllowed: true
          },
          data: {
            ragSourceId: job.documentId,
            updatedAt: job.revisionAt,
            ragMetadata: {
              ...job.payload.metadata,
              syncStatus: "synced",
              inserted: response?.inserted ?? null,
              checkedAt: now.toISOString()
            }
          }
        });
        if (linked.count !== 1) return false;
        const finished = await tx.serviceProviderProfileRagJob.updateMany({
          where: { id: job.id, status: "PROCESSING", leaseToken },
          data: { status: "SUCCEEDED", leaseToken: null, leaseExpiresAt: null, completedAt: now, lastErrorCode: null }
        });
        return finished.count === 1;
      });
      if (!finalized) {
        await markSuperseded(db, job, leaseToken, now);
        summary.superseded += 1;
      } else {
        summary.succeeded += 1;
      }
    } catch {
      await db.serviceProviderProfileRagJob.updateMany({
        where: { id: job.id, status: "PROCESSING", leaseToken },
        data: {
          status: "FAILED",
          leaseToken: null,
          leaseExpiresAt: null,
          nextAttemptAt: retryAt(now, job.attempts),
          lastErrorCode: "rag_ingest_failed"
        }
      });
      summary.failed += 1;
    }
  }
  return summary;
}
