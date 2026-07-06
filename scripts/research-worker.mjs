import process from "node:process";
import { claimNextResearchJob, startResearchJobLeaseHeartbeat } from "../lib/research/jobStore.js";
import { runDeepResearchJob } from "../lib/research/pipeline.js";
import { prisma } from "../lib/prisma.js";
import { safeError } from "../lib/privacy/safeError.js";

function toInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const workerId = String(process.env.RESEARCH_WORKER_ID || `research-worker-${process.pid}`).trim();
const pollMs = toInt(process.env.RESEARCH_WORKER_POLL_MS, 2500, 250, 60_000);
const leaseMs = toInt(process.env.RESEARCH_WORKER_LEASE_MS, 10 * 60 * 1000, 30_000, 60 * 60 * 1000);
const maxAttempts = toInt(process.env.RESEARCH_WORKER_MAX_ATTEMPTS, 3, 1, 10);
const staleMs = toInt(process.env.RESEARCH_WORKER_STALE_MS, 15 * 60 * 1000, 30_000, 60 * 60 * 1000);

let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
  });
}

async function runOnce() {
  const job = await claimNextResearchJob({
    workerId,
    leaseMs,
    maxAttempts,
    staleMs,
  });
  if (!job) return false;

  const stopHeartbeat = startResearchJobLeaseHeartbeat(job, {
    workerId,
    leaseMs,
  });
  try {
    console.log(`[research-worker] running job ${job.id}`);
    await runDeepResearchJob(job);
    console.log(`[research-worker] finished job ${job.id}`);
  } catch (error) {
    console.error(`[research-worker] job ${job.id} failed`, safeError(error));
  } finally {
    stopHeartbeat();
  }
  return true;
}

async function main() {
  console.log(`[research-worker] started ${workerId}`);
  while (!stopping) {
    const didWork = await runOnce();
    if (!didWork && !stopping) {
      await sleep(pollMs);
    }
  }
  await prisma.$disconnect();
  console.log(`[research-worker] stopped ${workerId}`);
}

main().catch(async error => {
  console.error("[research-worker] fatal", safeError(error));
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
