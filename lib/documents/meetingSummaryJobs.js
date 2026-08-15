import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_MODEL, OPENAI_MAX_OUTPUT_TOKENS } from "@/lib/chat/settings";
import { logEvent } from "@/lib/chat/logger";
import { logDocumentsAudit } from "@/lib/documents/audit";
import {
  ensureDocumentsStorage,
  getStoredDocumentPath,
  normalizeDocumentTitle,
  resolveAgentStorageDir,
  resolveAbsoluteDocumentPath,
  publicErrorMessageKey,
  sanitizeTextFilename,
} from "@/lib/documents/server";
import { safeError } from "@/lib/privacy/safeError";
import { withStorageQuota } from "@/lib/documents/storageQuota";
import { prisma } from "@/lib/prisma";
import { normalizeServerLocale, serverT } from "@/lib/i18n/serverMessages";
import { logOpenAIUsage } from "@/lib/openaiUsage";
import { usageService } from "@/lib/usage/service";

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

const JOB_TTL_MS = readPositiveNumber(process.env.MEETING_SUMMARY_JOB_TTL_MS, 30 * 60 * 1000);
const JOB_SWEEP_MS = readPositiveNumber(process.env.MEETING_SUMMARY_JOB_SWEEP_MS, 60 * 1000);
const ACTIVE_JOB_STALE_MS = readPositiveNumber(process.env.MEETING_SUMMARY_ACTIVE_JOB_STALE_MS, 15 * 60 * 1000);
const ACTIVE_JOB_HEARTBEAT_MS = Math.max(1, Math.floor(ACTIVE_JOB_STALE_MS / 3));
// SOL-MEET-03: orvuks jäänud `.tmp` ja loetamatu `.json` ei kanna oma tähtaega endas, seega neid
// mõõdetakse faili enda muutmisaja järgi. Ooteaeg on olemas ainult selleks, et mitte kustutada
// teise protsessi POOLELIOLEVAT kirjutust.
const ORPHAN_FILE_TTL_MS = readPositiveNumber(process.env.MEETING_SUMMARY_ORPHAN_TTL_MS, 30 * 60 * 1000);
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "gpt-4o-mini-transcribe";
const SUMMARY_MAX_OUTPUT_TOKENS = Math.max(
  1,
  Math.trunc(
    readPositiveNumber(
      process.env.MEETING_SUMMARY_MAX_OUTPUT_TOKENS,
      OPENAI_MAX_OUTPUT_TOKENS || 1100
    )
  )
);

const jobs = new Map();

function nowIso() {
  return new Date().toISOString();
}

// SOL-MEET-02: pooleli jäänud arveldus elab snapshotis, seega teda ei tohi enne korduse
// õnnestumist ära visata — muidu kaob korduse ainus sisend ja „ajutine viga" muutub püsivaks.
function hasPendingUsageSettlement(job) {
  const entries = job?.usage;
  if (!entries || typeof entries !== "object") return false;
  return Object.values(entries).some(entry => entry?.state === "commit_pending");
}

export function shouldDeleteMeetingSummaryJob(job, now) {
  return shouldDelete(job, now);
}

function shouldDelete(job, now) {
  if (!job) return true;
  if (job.status === "queued" || job.status === "running") return false;
  if (hasPendingUsageSettlement(job)) return false;
  const ended = job.endedAt ? Date.parse(job.endedAt) : Date.parse(job.updatedAt || job.createdAt);
  if (!Number.isFinite(ended)) return false;
  return now - ended > JOB_TTL_MS;
}

function resolveMeetingSummaryJobsDir() {
  return path.join(resolveAgentStorageDir(), "meeting-summary-jobs");
}

function getMeetingSummaryJobFilePath(jobId) {
  const safeId = String(jobId || "").trim();
  if (!safeId) return "";
  return path.join(resolveMeetingSummaryJobsDir(), `${safeId}.json`);
}

async function ensureMeetingSummaryJobsStorage() {
  await fs.mkdir(resolveMeetingSummaryJobsDir(), { recursive: true });
}

function toPersistedJob(job) {
  if (!job?.id) return null;
  return {
    id: job.id,
    userId: String(job.userId || ""),
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    result: job.result || null,
    usage: job.usage || null,
  };
}

async function settleMeetingSummaryUsage(
  job,
  key,
  action,
  { reason = null, usage = usageService, actualAmount = null } = {}
) {
  const entry = job?.usage?.[key];
  const idempotencyKey = String(entry?.idempotencyKey || "").trim();
  if (!entry || !idempotencyKey || !job?.userId) return;
  if (action === "commit" && entry.state === "committed") return;
  if (action === "release" && entry.state === "released") return;
  if (action === "release" && entry.workCompleted) return;

  try {
    if (action === "commit") {
      await usage.commit({
        userId: job.userId,
        idempotencyKey,
        ...(actualAmount == null ? {} : { actualAmount }),
      });
      entry.state = "committed";
      if (actualAmount != null) entry.committedAmount = actualAmount;
    } else {
      await usage.release({
        userId: job.userId,
        idempotencyKey,
        reason: reason || "meeting_summary_failed"
      });
      entry.state = "released";
    }
  } catch (error) {
    entry.state = action === "commit" ? "commit_pending" : entry.state;
    try {
      console.error(`[meeting-summary][usage] ${action} failed`, error);
    } catch {}
  }
}

async function releaseIncompleteMeetingSummaryUsage(job, reason, { usage = usageService } = {}) {
  await Promise.all([
    settleMeetingSummaryUsage(job, "stt", "release", { reason, usage }),
    settleMeetingSummaryUsage(job, "document", "release", { reason, usage })
  ]);
}

async function persistMeetingSummaryJob(job) {
  const record = toPersistedJob(job);
  if (!record) return;
  const filePath = getMeetingSummaryJobFilePath(record.id);
  if (!filePath) return;
  await ensureMeetingSummaryJobsStorage();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  // SOL-MEET-01: kirjutuse või rename'i vea korral ei tohi pooleldi kirjutatud `.tmp` jääda
  // kataloogi vedelema — snapshot kannab kohtumise kokkuvõtte teksti.
  try {
    await fs.writeFile(tempPath, JSON.stringify(record), "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(tempPath);
    } catch {}
    throw error;
  }
}

async function readPersistedMeetingSummaryJob(jobId) {
  const filePath = getMeetingSummaryJobFilePath(jobId);
  if (!filePath) return null;
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function deletePersistedMeetingSummaryJob(jobId) {
  const filePath = getMeetingSummaryJobFilePath(jobId);
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

// The <jobId>.json snapshot holds the generated summary text, so it must join the fail-closed
// deletion chain rather than lingering until the 30-minute TTL sweep. Both purges return
// { ok, removed, failures }: a caller that sees ok:false keeps an honest pending/retry state
// instead of reporting a clean erasure that left content on disk.
async function purgeMeetingSummarySnapshots(matches) {
  let removed = 0;
  const failures = [];
  let ids = [];
  try {
    ids = await listPersistedMeetingSummaryJobIds();
  } catch (error) {
    return { ok: false, removed: 0, failures: [{ jobId: null, error: String(error?.message || error) }] };
  }
  for (const jobId of ids) {
    let record = null;
    try {
      record = await readPersistedMeetingSummaryJob(jobId);
    } catch (error) {
      failures.push({ jobId, error: String(error?.message || error) });
      continue;
    }
    if (!record || !matches(record)) continue;
    try {
      await deletePersistedMeetingSummaryJob(jobId);
      removed += 1;
    } catch (error) {
      failures.push({ jobId, error: String(error?.message || error) });
    }
  }
  return { ok: failures.length === 0, removed, failures };
}

export async function purgeMeetingSummarySnapshotsForUser(userId) {
  const targetUserId = String(userId || "");
  if (!targetUserId) return { ok: true, removed: 0, failures: [] };
  return purgeMeetingSummarySnapshots((record) => String(record.userId || "") === targetUserId);
}

export async function purgeMeetingSummarySnapshotsForDocument({ userId, documentId }) {
  const targetUserId = String(userId || "");
  const targetDocumentId = String(documentId || "");
  if (!targetUserId || !targetDocumentId) return { ok: true, removed: 0, failures: [] };
  return purgeMeetingSummarySnapshots(
    (record) =>
      String(record.userId || "") === targetUserId &&
      String(record.result?.document?.id || "") === targetDocumentId
  );
}

function activeJobLimitError() {
  const error = new Error("documents.agent_workspace.meeting_summary.busy");
  error.code = "ACTIVE_JOB_LIMIT";
  return error;
}

/**
 * SOL-MEET-04: AKTIIVSE TÖÖ CLAIM ON ATOMAARNE JA PROTSESSIDEÜLENE.
 *
 * Vana kontroll luges aktiivsete tööde arvu protsessi Map'ist ja snapshotikataloogist ning lisas
 * uue töö alles hiljem. Kahe põimuva `await`-iga POST-i puhul lugesid MÕLEMAD „aktiivseid ei ole"
 * ja lõid mõlemad oma töö oma kasutusvõtmega: üks kasutaja sai paralleelselt mitu mahukat
 * STT+summary tööd, mõlemad välised kulud ja mõlemad ühikud arvestati.
 *
 * `userId` unikaalsus on ainus koht, kus see võidujooks päriselt lõpeb — mälulukk ei aita üle
 * protsesside ja kataloogilugemine ei ole atomaarne.
 *
 * Aegunud claim on üle võetav, aga ainult COMPARE-AND-SWAP'iga: kustutus on seotud sama rea sama
 * `updatedAt` väärtusega, seega kaks samaaegset ülevõtjat ei saa mõlemad võita.
 */
async function acquireMeetingSummaryClaim(userId, jobId, { db = prisma, now = Date.now() } = {}) {
  const create = () => db.meetingSummaryJobClaim.create({ data: { userId, jobId } });

  try {
    return await create();
  } catch (error) {
    if (error?.code !== "P2002") throw error;
  }

  const existing = await db.meetingSummaryJobClaim.findUnique({ where: { userId } });
  if (!existing) {
    try {
      return await create();
    } catch (error) {
      if (error?.code === "P2002") throw activeJobLimitError();
      throw error;
    }
  }

  const heldFor = now - new Date(existing.updatedAt).getTime();
  if (!Number.isFinite(heldFor) || heldFor <= ACTIVE_JOB_STALE_MS) throw activeJobLimitError();

  const removed = await db.meetingSummaryJobClaim.deleteMany({
    where: { id: existing.id, updatedAt: existing.updatedAt },
  });
  if (!removed?.count) throw activeJobLimitError();

  try {
    return await create();
  } catch (error) {
    if (error?.code === "P2002") throw activeJobLimitError();
    throw error;
  }
}

/**
 * SOL-MEET-04: ELAVAT CLAIM'I EI TOHI SAADA ÜLE VÕTTA.
 *
 * Aegumine on olemas selleks, et surnud protsess ei lukustaks kasutajat igaveseks. Aga kui
 * `updatedAt` jääks loomise hetke peale seisma, muutuks üle 15 minuti kestev töö „aegunuks" ja
 * teine POST võiks ta ELUSALT üle võtta — täpselt see kahju, mille vastu see leid on.
 */
async function touchMeetingSummaryClaim(userId, jobId, { db = prisma } = {}) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedUserId || !normalizedJobId) return;
  try {
    await db.meetingSummaryJobClaim.updateMany({
      where: { userId: normalizedUserId, jobId: normalizedJobId },
      data: { jobId: normalizedJobId },
    });
  } catch (error) {
    try {
      console.error("[meeting-summary][claim] touch failed", error);
    } catch {}
  }
}

async function withMeetingSummaryClaimHeartbeat(
  operation,
  userId,
  jobId,
  { db = prisma, intervalMs = ACTIVE_JOB_HEARTBEAT_MS } = {}
) {
  const timer = setInterval(() => {
    void touchMeetingSummaryClaim(userId, jobId, { db });
  }, intervalMs);
  timer.unref?.();
  try {
    return await operation();
  } finally {
    clearInterval(timer);
  }
}

/** Claim vabaneb terminalolekus. Ta ei tohi kunagi erindiks saada: lukustamata jäänud claim on
 *  halb, aga terminalolekuni mitte jõudmine oleks halvem (vt SOL-MEET-01). */
async function releaseMeetingSummaryClaim(userId, jobId, { db = prisma } = {}) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedUserId || !normalizedJobId) return;
  try {
    await db.meetingSummaryJobClaim.deleteMany({
      where: { userId: normalizedUserId, jobId: normalizedJobId },
    });
  } catch (error) {
    try {
      console.error("[meeting-summary][claim] release failed", error);
    } catch {}
  }
}

function shouldInterruptStaleActiveJob(job, now = Date.now()) {
  if (!job || (job.status !== "queued" && job.status !== "running")) return false;
  const updated = Date.parse(job.updatedAt || job.createdAt || "");
  if (!Number.isFinite(updated)) return false;
  return now - updated > ACTIVE_JOB_STALE_MS;
}

async function markPersistedMeetingSummaryJobInterrupted(job, { usage = usageService, db = prisma } = {}) {
  if (!job?.id) return null;
  await releaseIncompleteMeetingSummaryUsage(job, "meeting_summary_interrupted", { usage });
  // SOL-MEET-04: rippuma jäänud töö peab vabastama ka claim'i, muidu ei saa kasutaja enam kunagi
  // uut tööd alustada — piirang muutuks lukuks.
  await releaseMeetingSummaryClaim(job.userId, job.id, { db });
  const interrupted = {
    ...job,
    status: "error",
    updatedAt: nowIso(),
    endedAt: nowIso(),
    error: "documents.agent_workspace.meeting_summary.error",
    result: job.result || null,
  };
  interrupted.endedAt = interrupted.updatedAt;
  await persistMeetingSummaryJob(interrupted);
  return interrupted;
}

async function listPersistedMeetingSummaryJobIds() {
  try {
    await ensureMeetingSummaryJobsStorage();
    const entries = await fs.readdir(resolveMeetingSummaryJobsDir(), { withFileTypes: true });
    return entries
      .filter(entry => entry?.isFile?.() && entry.name.endsWith(".json"))
      .map(entry => entry.name.slice(0, -5))
      .filter(Boolean);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

const JOB_STATUS_VALUES = new Set(["queued", "running", "done", "error"]);

/**
 * SOL-MEET-03: snapshoti skeem valideeritakse ENNE tema järgi otsustamist. Ilma selleta ei oska
 * sweep vahet teha „terminaaltöö, mille tähtaeg on käes" ja „fail, mille sisu ma ei mõista" vahel —
 * ja teine neist jääks igaveseks alles just seetõttu, et teda ei õnnestunud lugeda.
 */
function isValidPersistedJob(record) {
  if (!record || typeof record !== "object") return false;
  if (!String(record.id || "").trim()) return false;
  if (!JOB_STATUS_VALUES.has(record.status)) return false;
  if (typeof record.userId !== "string") return false;
  const stamps = [record.createdAt, record.updatedAt, record.endedAt, record.startedAt];
  return stamps.every(value => value == null || Number.isFinite(Date.parse(value)));
}

/**
 * SOL-MEET-03: KATALOOGI SWEEP, MIS EI SÕLTU PROTSESSI MÄLUST.
 *
 * Vana koristus käis AINULT protsessi `jobs` Map'i läbi ja kustutas snapshoti ainult sealt leitud
 * terminalobjekti puhul. Pärast restarti on Map tühi — ja kuna snapshot kannab valmis
 * `summaryText` välja, jäi kohtumise tundlik kokkuvõte `AGENT_STORAGE_DIR`-i **tähtajatult**
 * seisma. 30-minutiline TTL oli olemas ainult nende tööde jaoks, mille elas üle sama protsess.
 *
 * Siin loetakse kataloog ise. Kolm poliitikat, sest kolm eri asja:
 *   1. kehtiv terminalkirje    → tähtaeg tema enda `endedAt` järgi (sama `shouldDelete` reegel);
 *   2. kehtiv, aga rippuv töö  → `queued`/`running`, mille protsess suri: katkestatakse (see
 *                                vabastab ka reservatsiooni) ja alles siis hakkab tema tähtaeg;
 *   3. loetamatu `.json` / orb `.tmp` → FAIL-CLOSED faili muutmisaja järgi. Nende sisu me ei
 *      mõista, aga just seetõttu ei tohi nad igavesti alles jääda: tundliku teksti puhul on
 *      „ei suutnud lugeda" argument kustutamise POOLT, mitte vastu.
 */
export async function sweepMeetingSummarySnapshots({ now = Date.now(), usage = usageService, db = prisma } = {}) {
  const result = { scanned: 0, removed: 0, interrupted: 0, orphans: 0, failures: 0 };
  const dir = resolveMeetingSummaryJobsDir();

  let entries = [];
  try {
    await ensureMeetingSummaryJobsStorage();
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") result.failures += 1;
    return result;
  }

  for (const entry of entries) {
    if (!entry?.isFile?.()) continue;
    const filePath = path.join(dir, entry.name);

    // Orb pooleliolev kirjutus: tema kohta ei ole kirjet, mille järgi otsustada.
    if (entry.name.endsWith(".tmp")) {
      result.scanned += 1;
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > ORPHAN_FILE_TTL_MS) {
          await fs.unlink(filePath);
          result.orphans += 1;
        }
      } catch (error) {
        if (error?.code !== "ENOENT") result.failures += 1;
      }
      continue;
    }

    if (!entry.name.endsWith(".json")) continue;
    result.scanned += 1;

    const jobId = entry.name.slice(0, -5);
    // Elavat tööd omab protsess ise; teda koristab Map-sweep, mitte see siin.
    if (jobs.has(jobId)) continue;

    let record = null;
    let readable = true;
    try {
      record = await readPersistedMeetingSummaryJob(jobId);
    } catch {
      readable = false;
    }
    if (record === null && readable) continue; // ENOENT — keegi jõudis ette

    if (!readable || !isValidPersistedJob(record)) {
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > ORPHAN_FILE_TTL_MS) {
          await fs.unlink(filePath);
          result.orphans += 1;
        }
      } catch (error) {
        if (error?.code !== "ENOENT") result.failures += 1;
      }
      continue;
    }

    if (shouldInterruptStaleActiveJob(record, now)) {
      try {
        record = await markPersistedMeetingSummaryJobInterrupted(record, { usage, db });
        result.interrupted += 1;
      } catch {
        result.failures += 1;
        continue;
      }
    }

    if (shouldDelete(record, now)) {
      try {
        await deletePersistedMeetingSummaryJob(jobId);
        result.removed += 1;
      } catch {
        result.failures += 1;
      }
    }
  }

  return result;
}

function toPublicFromRecord(job, includeResult = false) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    ...(includeResult ? { result: job.result || null } : {}),
    userId: job.userId,
  };
}

/**
 * SOL-MEET-02: `commit_pending` OLI OLEMAS, AGA TEDA EI KORRANUD KEEGI.
 *
 * `settleMeetingSummaryUsage()` neelab commit'i vea ja jätab olekusse `commit_pending` — see märge
 * oli koodis olemas juba enne seda parandust, aga ükski rada ei lugenud teda kunagi tagasi. Ajutine
 * andmebaasi tõrge muutis seega tehtud töö tasuta tööks: reservatsioon jäi `RESERVED`-iks ja üldine
 * 24 h reaper vabastas ta hiljem kasutamata ühikuna.
 *
 * Kordus loeb snapshotid kettalt, seega ta on protsessi restardist sõltumatu — märge elab reas,
 * mitte mälus. Commit ise on idempotentne, seega kordus on ohutu ka siis, kui esimene kutse päriselt
 * läbi läks ja ainult märge jäi kirjutamata.
 */
export async function retryPendingMeetingSummaryUsageSettlements({ usage = usageService } = {}) {
  let ids = [];
  try {
    ids = await listPersistedMeetingSummaryJobIds();
  } catch {
    return { scanned: 0, committed: 0, stillPending: 0 };
  }

  let committed = 0;
  let stillPending = 0;
  for (const jobId of ids) {
    let record = null;
    try {
      record = await readPersistedMeetingSummaryJob(jobId);
    } catch {
      continue;
    }
    if (!record || !hasPendingUsageSettlement(record)) continue;

    let changed = false;
    for (const [key, entry] of Object.entries(record.usage || {})) {
      if (entry?.state !== "commit_pending") continue;
      const idempotencyKey = String(entry.idempotencyKey || "").trim();
      if (!idempotencyKey || !record.userId) continue;
      try {
        // Historical snapshots may have marked document work complete before UserDocument was
        // created. Only a persisted document id proves that this reservation is safe to commit;
        // otherwise release it so a failed job neither consumes quota nor lives forever.
        if (key === "document" && !String(record.result?.document?.id || "").trim()) {
          await usage.release({
            userId: record.userId,
            idempotencyKey,
            reason: "meeting_summary_document_missing",
          });
          entry.state = "released";
        } else {
          await usage.commit({ userId: record.userId, idempotencyKey });
          entry.state = "committed";
          committed += 1;
        }
        changed = true;
      } catch (error) {
        stillPending += 1;
        try {
          console.error(`[meeting-summary][usage] retry commit failed (${key})`, error);
        } catch {}
      }
    }

    if (changed) {
      try {
        await persistMeetingSummaryJob(record);
        const live = jobs.get(jobId);
        if (live?.usage) {
          for (const [key, entry] of Object.entries(record.usage || {})) {
            if (live.usage[key]) live.usage[key].state = entry.state;
          }
        }
      } catch {}
    }
  }

  return { scanned: ids.length, committed, stillPending };
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (shouldDelete(job, now)) {
      jobs.delete(id);
      void deletePersistedMeetingSummaryJob(id).catch(() => {});
    }
  }
  void retryPendingMeetingSummaryUsageSettlements().catch(() => {});
  // SOL-MEET-03: kataloogi sweep käib mälusweepi KÕRVAL, sest just restardi järel ei ole mälus
  // enam midagi, mille järgi tundlikku snapshotti kustutada.
  void sweepMeetingSummarySnapshots().catch(() => {});
}, JOB_SWEEP_MS).unref?.();

function languageFromLocale(locale) {
  const base = String(locale || "").trim().toLowerCase().split("-")[0];
  if (!base || base === "auto") return undefined;
  if (base.length === 2) return base;
  return undefined;
}

function summaryLanguageLabel(locale) {
  const base = String(locale || "").trim().toLowerCase().split("-")[0];
  if (base === "ru") return "Russian";
  if (base === "en") return "English";
  return "Estonian";
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function serializeDocument(document) {
  return {
    id: document.id,
    title: document.title,
    originalName: document.originalName,
    kind: document.kind,
    templateFor: document.templateFor,
    agentAllowed: Boolean(document.agentAllowed),
    mime: document.mime,
    size: document.size,
    readOnly: false,
    frameworkAcceptance: null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toPublic(job, includeResult = false) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    ...(includeResult ? { result: job.result || null } : {}),
  };
}

// SOL-MEET-01: `persist` on süstitav AINULT veasüsti jaoks. Päris failisüsteemiga ei saa siin
// kirjutuse etappi eraldi katkestada — aktiivsete tööde loendus teeb enne seda sama `mkdir`-i,
// nii et iga kataloogitasandi viga tabaks loendust, mitte kirjutust.
export async function createMeetingSummaryJob(
  { userId, payload, usage = null },
  { persist = persistMeetingSummaryJob, db = prisma } = {}
) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("documents.agent_workspace.meeting_summary.error");
    error.code = "INVALID_USER";
    throw error;
  }
  const createdAt = nowIso();
  const job = {
    id: crypto.randomUUID(),
    userId: normalizedUserId,
    payload,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
    usage,
  };
  // SOL-MEET-04: claim ENNE kõike muud. Ta on ainus samm, mis kahe samaaegse POST-i vahel
  // päriselt otsustab; kaotaja saab siit `ACTIVE_JOB_LIMIT` ja route vabastab tema
  // reservatsioonid. Vana loendus (Map + kataloog) ei olnud atomaarne ja on siit kadunud.
  await acquireMeetingSummaryClaim(normalizedUserId, job.id, { db });

  // SOL-MEET-01: töö muutub nähtavaks ALLES pärast õnnestunud snapshotti. Vana järjekord pani
  // ta esmalt `jobs` Map'i ja kirjutas alles siis: kirjutuse vea korral vabastas route küll
  // reservatsioonid ja vastas 500-ga, aga Map'i jäänud queued-tööd ei eemaldanud keegi — sweep
  // ei kustuta queued/running olekut — ja kasutaja aktiivse töö limiit oli protsessi elueaks
  // lukus. Nüüd on vea korral kompensatsioon täielik: kettale ei jää rida, Map'i tööd ega claim'i.
  try {
    await persist(job);
  } catch (error) {
    try {
      await deletePersistedMeetingSummaryJob(job.id);
    } catch {}
    await releaseMeetingSummaryClaim(normalizedUserId, job.id, { db });
    throw error;
  }
  jobs.set(job.id, job);
  return job;
}

function getMeetingSummaryJob(jobId) {
  return jobs.get(String(jobId || "").trim());
}

export function getMeetingSummaryJobPublic(jobId) {
  return toPublic(getMeetingSummaryJob(jobId), false);
}

export async function getMeetingSummaryJobSnapshot(jobId) {
  const normalizedJobId = String(jobId || "").trim();
  if (!normalizedJobId) return null;
  const liveJob = getMeetingSummaryJob(normalizedJobId);
  if (liveJob) {
    return {
      ...toPublic(liveJob, true),
      userId: liveJob.userId,
    };
  }

  let record = await readPersistedMeetingSummaryJob(normalizedJobId);
  if (!record) return null;
  if (shouldInterruptStaleActiveJob(record)) {
    record = await markPersistedMeetingSummaryJobInterrupted(record);
  }
  return toPublicFromRecord(record, true);
}

export async function getMeetingSummaryJobResult(jobId) {
  const snapshot = await getMeetingSummaryJobSnapshot(jobId);
  if (!snapshot) return null;
  return {
    id: snapshot.id,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    error: snapshot.error || null,
    result: snapshot.result || null,
  };
}

export function assertMeetingSummaryAccess(job, userId) {
  return Boolean(job) && String(job.userId) === String(userId);
}

// SOL-MEET-04: siin oli `getActiveMeetingSummaryJobCount()` — loendus üle Map'i ja kataloogi. Ta
// EI OLNUD atomaarne ja oligi kogu leiu põhjus, seega ta on kadunud, mitte parandatud. Tema
// kõrvalülesande — rippuma jäänud snapshotide katkestamise ja nende kvoodi vabastamise — võttis
// SOL-MEET-03 kataloogisweep üle ja teeb seda tsükliliselt, mitte alles siis, kui keegi uut tööd
// proovib alustada.

function markMeetingSummaryRunning(job) {
  const startedAt = nowIso();
  job.status = "running";
  job.startedAt = startedAt;
  job.updatedAt = startedAt;
}

async function markMeetingSummaryDone(job, result, { db = prisma } = {}) {
  const endedAt = nowIso();
  job.status = "done";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.payload = null;
  job.result = result;
  await releaseMeetingSummaryClaim(job.userId, job.id, { db });
  await persistMeetingSummaryJob(job);
}

// SOL-MEET-01: terminalolek on FAIL-CLOSED. Olek pannakse paika mälus ENNE ketast, ja ketta viga
// ei tohi seda tagasi pöörata — just failisüsteemi tõrge on see, mis meid siia tõi. Kui see viga
// erindiks jääks, jääks töö `queued`/`running` olekusse, mida sweep ei korista, ja kasutaja
// järgmine katse saaks igavesti „busy".
// SOL-MEET-06: AVALIK VIGA ON ALLOWLISTITUD VÕTI, TOORVIGA LÄHEB AINULT LOGISSE.
//
// Varem anti siia otse `String(error.message)` ja see salvestati snapshoti `error` välja, kust
// detailmarsruut tagastas ta kliendile muutmata. OpenAI SDK, failisüsteemi või andmebaasi täpne
// veatekst võis nii lekkida autenditud kasutajale JA püsivasse JSON-faili — koos sisemiste
// teede, teenusepakkuja detailide ja diagnostilise kontekstiga.
//
// Erinevalt varasemast salvestatakse siin VÕTI, mitte tõlgitud tekst: katkestusrada tegi seda
// juba (`documents.agent_workspace.meeting_summary.error`), aga kaks teist rada salvestasid
// tõlgitud lause — sama väli kandis kaht eri kuju.
async function markMeetingSummaryFailed(job, errorOrKey, { db = prisma } = {}) {
  const endedAt = nowIso();
  const publicKey = publicErrorMessageKey(
    typeof errorOrKey === "string" ? { message: errorOrKey } : errorOrKey,
    "documents.agent_workspace.meeting_summary.error"
  );
  if (typeof errorOrKey !== "string" && errorOrKey) {
    try {
      console.error("[meeting-summary][job] failed", safeError(errorOrKey));
    } catch {}
  }
  job.status = "error";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.payload = null;
  job.error = publicKey;
  await releaseMeetingSummaryClaim(job.userId, job.id, { db });
  try {
    await persistMeetingSummaryJob(job);
  } catch (error) {
    try {
      console.error("[meeting-summary][job] terminal snapshot write failed", error);
    } catch {}
  }
}

/**
 * SOL-MEET-02: DOKUMENT JA TEMA ÜHIK SÜNNIVAD ÜHES TEHINGUS.
 *
 * Vana kood commit'is `DOCUMENT_GENERATE` ühiku ENNE selle funktsiooni kutsumist. Kui rea või faili
 * loomine siis kukkus, kutsus catch küll üldise release'i, aga `settleMeetingSummaryUsage()`
 * keeldub release'ist kohe, kui `workCompleted` on tõene — kasutaja oli ühiku kulutanud ja
 * dokumenti ei olnud kuskilt leida.
 *
 * Nüüd käivad kvoodikontroll, `UserDocument` rida ja ühiku commit ühes tehingus ühe kasutajapõhise
 * nõuandeluku all: kas kõik kolm maanduvad või mitte ükski. Kvooti saab siin JÕUSTADA just
 * sellepärast, et commit on tehingu sees — üle kvoodi jäänud kasutajat ei ole enne tehingut millegi
 * eest arveldatud, seega ei jää tasutud töö õhku rippuma.
 */
export async function persistMeetingSummaryDocument({ userId, role, locale, text, usageCommit = null }) {
  const baseLocale = normalizeServerLocale(locale) || "et";
  const prefix = serverT(
    baseLocale,
    "documents.agent_workspace.meeting_summary.document_title",
    undefined,
    "Meeting summary"
  );
  const stamp = new Intl.DateTimeFormat(baseLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(/[/:]/g, "-");
  const title = normalizeDocumentTitle(`${prefix} ${stamp}`, `${prefix}.txt`);
  const originalName = sanitizeTextFilename(`${title}.txt`, "meeting-summary.txt");
  const storagePath = getStoredDocumentPath(originalName);
  const absolutePath = resolveAbsoluteDocumentPath(storagePath);
  const buffer = Buffer.from(String(text || ""), "utf8");
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  await ensureDocumentsStorage();
  await fs.writeFile(absolutePath, buffer);

  try {
    const document = await withStorageQuota(
      { userId, role, addBytes: buffer.byteLength },
      {},
      async (tx) => {
        const created = await tx.userDocument.create({
          data: {
            ownerId: userId,
            title,
            originalName,
            kind: "MATERIAL",
            templateFor: null,
            agentAllowed: true,
            mime: "text/plain",
            size: buffer.byteLength,
            sha256,
            storagePath,
          },
          select: {
            id: true,
            title: true,
            originalName: true,
            kind: true,
            templateFor: true,
            agentAllowed: true,
            mime: true,
            size: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        // Ühik võetakse SAMAS tehingus. Kui see rida siin puuduks, oleks tulemus täpselt vana kood.
        if (usageCommit?.idempotencyKey) {
          await (usageCommit.usage || usageService).commit({
            tx,
            userId,
            idempotencyKey: usageCommit.idempotencyKey,
          });
        }

        return created;
      }
    );

    await logDocumentsAudit("document.uploaded", {
      userId,
      documentId: document.id,
      title: document.title,
      originalName: document.originalName,
      kind: document.kind,
      generatedBy: "meeting_summary_job",
    });

    return serializeDocument(document);
  } catch (error) {
    try {
      await fs.unlink(absolutePath);
    } catch {}
    throw error;
  }
}

function buildSystemPrompt() {
  return [
    "You are SotsiaalAI's meeting-summary assistant for social work workflows.",
    "Create a concise factual meeting summary from dictated notes.",
    "Return only the summary text in markdown.",
    "Do not invent facts, names, dates, decisions, or risks that are not in the transcript.",
    "Keep wording neutral, professional, and usable as source material for a later formal report.",
  ].join(" ");
}

function buildUserPrompt({ transcript, locale }) {
  return [
    `Write in ${summaryLanguageLabel(locale)}.`,
    "Goal: create a practical meeting summary that can later be used as source material for a report.",
    "Suggested structure:",
    "- Meeting summary",
    "- Main facts",
    "- Needs and agreed actions",
    "- Risks or follow-up",
    "Keep it concise. Prefer bullets when useful. Omit anything uncertain instead of guessing.",
    "",
    "TRANSCRIPT",
    String(transcript || "").trim(),
  ].join("\n");
}

// SOL-MEET-01: `loadOpenAI` ja `usage` on süstitavad AINULT selleks, et veasüst saaks katkestada
// impordi ja mõõta kasutuse settle'i; vaikeväärtused on päris teenused.
export async function runMeetingSummaryJob(
  job,
  {
    loadOpenAI = () => import("openai"),
    usage = usageService,
    persistDocument = persistMeetingSummaryDocument,
    db = prisma,
    claimHeartbeatMs = ACTIVE_JOB_HEARTBEAT_MS,
  } = {}
) {
  if (!job?.payload) return;

  const locale = normalizeServerLocale(job.payload.locale) || "et";

  // SOL-MEET-01: KOGU jooksu algus on ühe fail-closed katuse all. Varem jäid running-märge,
  // tema snapshot ja `import("openai")` try'st VÄLJA — nende viga jõudis ainult route'i
  // `queueMicrotask(...).catch` logisse, tööd ei märgitud error'iks ega vabastatud kasutust.
  try {
    if (!process.env.OPENAI_API_KEY) {
      await releaseIncompleteMeetingSummaryUsage(job, "meeting_summary_not_configured", { usage });
      await markMeetingSummaryFailed(job, "api.stt.not_configured", { db });
      return;
    }

    markMeetingSummaryRunning(job);
    await persistMeetingSummaryJob(job);
    await touchMeetingSummaryClaim(job.userId, job.id, { db });

    const { default: OpenAI } = await loadOpenAI();
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const file = new File([job.payload.audioBuffer], job.payload.fileName || "meeting-summary.webm", {
      type: job.payload.mimeType || "audio/webm",
    });
    const language = languageFromLocale(locale);

    const sttStartedAt = Date.now();
    const transcription = await withMeetingSummaryClaimHeartbeat(
      () => client.audio.transcriptions.create({
        file,
        model: OPENAI_STT_MODEL,
        response_format: "json",
        ...(language ? { language } : {}),
      }),
      job.userId,
      job.id,
      { db, intervalMs: claimHeartbeatMs }
    );
    const transcriptText = String(transcription?.text || "").trim();
    if (!transcriptText) {
      throw new Error("api.stt.transcription_failed");
    }
    // `transcriptionUsage` on PROVIDERI mõõt (sekundid/tokenid). Ta kandis varem nime `usage` ja
    // seisis kaks rida allpool `job.usage` arveldusest — kaks eri asja sama nimega.
    const transcriptionUsage = transcription?.usage;
    const usageType = String(transcriptionUsage?.type || "").trim() || null;
    const isTokenUsage = usageType === "tokens";
    const isDurationUsage = usageType === "duration";
    const measuredDurationSeconds =
      (isDurationUsage ? toNullableNumber(transcriptionUsage?.seconds) : null) ??
      toNullableNumber(job.payload.inputDurationSeconds);

    // SOL-MEET-05: mõõt arvutatakse ENNE commit'i, sest just tema on see, mille eest tohib arvet
    // esitada. Varem käis commit siit kaks tosinat rida eespool ja ilma `actualAmount`-ita, seega
    // võeti alati kogu reserveeritud maht — tundmatu kestuse korral fikseeritud 60 sekundit.
    // Klammerdus reservatsiooni piiri: rohkem kui reserveeritud ei tohi kunagi võtta.
    const reservedSttSeconds = toNullableNumber(job.usage?.stt?.reservedAmount);
    const sttActualSeconds =
      measuredDurationSeconds != null && measuredDurationSeconds > 0
        ? Math.max(
            1,
            Math.min(
              reservedSttSeconds != null && reservedSttSeconds > 0 ? reservedSttSeconds : Number.MAX_SAFE_INTEGER,
              Math.ceil(measuredDurationSeconds)
            )
          )
        : null;

    if (job.usage?.stt) job.usage.stt.workCompleted = true;
    await settleMeetingSummaryUsage(job, "stt", "commit", { usage, actualAmount: sttActualSeconds });
    await persistMeetingSummaryJob(job);
    // Transkriptsioon on tehtud; kokkuvõte võib omakorda kaua võtta.
    await touchMeetingSummaryClaim(job.userId, job.id, { db });

    await logEvent("stt_cost_usage", {
      userId: job.userId,
      role: job.payload.role,
      provider: "openai",
      model: OPENAI_STT_MODEL,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_transcribe",
      latency_ms: Date.now() - sttStartedAt,
      request_size_bytes: toNullableNumber(job.payload.fileSizeBytes),
      file_size_bytes: toNullableNumber(job.payload.fileSizeBytes),
      duration_seconds: measuredDurationSeconds,
      text_chars: transcriptText.length,
      input_tokens: isTokenUsage ? toNullableNumber(transcriptionUsage?.input_tokens) : null,
      output_tokens: isTokenUsage ? toNullableNumber(transcriptionUsage?.output_tokens) : null,
      total_tokens: isTokenUsage ? toNullableNumber(transcriptionUsage?.total_tokens) : null,
      audio_tokens: isTokenUsage ? toNullableNumber(transcriptionUsage?.input_token_details?.audio_tokens) : null,
      text_tokens: isTokenUsage ? toNullableNumber(transcriptionUsage?.input_token_details?.text_tokens) : null,
      mime_type: job.payload.mimeType || null,
      language: String(language || locale || "auto"),
      usage_type: usageType,
      cost_read_directly: Boolean(usageType),
      cost_estimation_basis: null,
    });

    await logEvent("stt_request", {
      userId: job.userId,
      role: job.payload.role,
      provider: "openai",
      locale: String(language || locale || "auto"),
      fileSizeBytes: job.payload.fileSizeBytes,
      mimeType: job.payload.mimeType || null,
      textLength: transcriptText.length,
      durationSeconds: measuredDurationSeconds,
    });

    await logEvent("chat_request", {
      userId: job.userId,
      role: job.payload.role,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_summarize",
      textLength: transcriptText.length,
      source: "meeting_summary_job",
    });

    const summaryStartedAt = Date.now();
    const summaryResponse = await withMeetingSummaryClaimHeartbeat(
      () => client.responses.create({
        model: DEFAULT_MODEL,
        max_output_tokens: SUMMARY_MAX_OUTPUT_TOKENS,
        text: {
          verbosity: "low",
        },
        reasoning: {
          effort: "low",
        },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: buildSystemPrompt() }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: buildUserPrompt({ transcript: transcriptText, locale }) }],
          },
        ],
      }),
      job.userId,
      job.id,
      { db, intervalMs: claimHeartbeatMs }
    );

    await logOpenAIUsage({
      response: summaryResponse,
      model: DEFAULT_MODEL,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_summarize",
      latencyMs: Date.now() - summaryStartedAt,
      userId: job.userId,
      role: job.payload.role,
    });

    const summaryText = String(summaryResponse?.output_text || "").trim();
    if (!summaryText) {
      throw new Error("documents.agent_workspace.meeting_summary.error");
    }
    // SOL-MEET-02: ühikut EI võeta enne dokumenti. Ta võetakse dokumendi reaga samas tehingus,
    // seega kukkumine jätab kasutaja arveldamata ja release'i tee lahti.
    const documentUsageKey = String(job.usage?.document?.idempotencyKey || "").trim();
    const document = await persistDocument({
      userId: job.userId,
      role: job.payload.role,
      locale,
      text: summaryText,
      usageCommit: documentUsageKey ? { idempotencyKey: documentUsageKey, usage } : null,
    });

    // Tehing läks läbi → ühik ON võetud ja dokument ON olemas. Alles nüüd tohib `workCompleted`
    // tõene olla, sest just tema keelab hiljem release'i.
    if (job.usage?.document) {
      job.usage.document.workCompleted = true;
      job.usage.document.state = "committed";
    }
    await persistMeetingSummaryJob(job);

    await logEvent("meeting_summary_job", {
      userId: job.userId,
      role: job.payload.role,
      route: "api/documents/meeting-summary/jobs",
      stage: "meeting_summary_done",
      duration_seconds: measuredDurationSeconds,
      transcript_chars: transcriptText.length,
      summary_chars: summaryText.length,
      document_id: document.id,
    });

    await markMeetingSummaryDone(job, {
      summaryText,
      document,
    }, { db });
  } catch (error) {
    await releaseIncompleteMeetingSummaryUsage(job, "meeting_summary_failed", { usage });
    await markMeetingSummaryFailed(job, error, { db });
  }
}
