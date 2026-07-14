import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/prisma.js";
import { createEffectivePracticeService } from "../lib/effectivePractices.js";
import { buildPracticeDeployGateReport } from "../lib/practiceDeployGate.js";

// P1-E: pre-deploy readiness gate. Read-only; JSON summary; non-zero exit on any
// critical residue. Never prints practice text, emails or PII.
//
// Operator exception: the gate MAY be overridden only for a known, separately
// tracked residue (e.g. an in-flight RAG retry that a follow-up run will clear).
// An exception must NEVER be granted for `stale_references`, `published_version_
// mismatch` or `assignment_repair_needed` — those are integrity failures, not
// transient backlog.

// Fail-closed: an unset/invalid limit collapses to the strict 0 (never fail-open).
const rawResidue = Number(process.env.PRACTICE_DEPLOY_MAX_RAG_RESIDUE);
const maxRagResidue = Number.isFinite(rawResidue) && rawResidue >= 0 ? Math.floor(rawResidue) : 0;
// A published-but-unlinked practice blocks by default; this explicit opt-out is
// only for a knowingly RAG-disabled environment and is echoed in the JSON output.
const allowRagDisabled = String(process.env.PRACTICE_DEPLOY_ALLOW_RAG_DISABLED || "").trim().toLowerCase() === "true";

function migrationsUpToDate() {
  try {
    const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
    const result = spawnSync(process.execPath, [prismaCli, "migrate", "status"], { stdio: "pipe", env: process.env });
    return result.status === 0;
  } catch {
    return false;
  }
}

try {
  const service = createEffectivePracticeService(prisma);
  const report = await buildPracticeDeployGateReport({ db: prisma, service, now: new Date(), maxRagResidue, allowRagDisabled });
  const migrationsOk = migrationsUpToDate();
  const failures = [...report.failures];
  if (!migrationsOk) failures.push("migrations_not_up_to_date");
  const ok = failures.length === 0;
  process.stdout.write(`${JSON.stringify({ ok, failures, checks: { ...report.checks, migrationsUpToDate: migrationsOk } })}\n`);
  if (!ok) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
