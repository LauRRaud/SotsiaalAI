import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { usageService } from "@/lib/usage/service";
import { buildIntentSignature } from "@/lib/usage/intentKey";

function readPositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
}

function readPositiveInteger(value, fallback) {
  return Math.max(1, Math.trunc(readPositiveNumber(value, fallback)));
}

const JOB_TTL_MS = readPositiveNumber(process.env.RESEARCH_JOB_TTL_MS, 30 * 60 * 1000);
const JOB_SWEEP_MS = readPositiveNumber(process.env.RESEARCH_JOB_SWEEP_MS, 60 * 1000);
const ACTIVE_JOB_STALE_MS = readPositiveNumber(process.env.RESEARCH_ACTIVE_JOB_STALE_MS, 15 * 60 * 1000);
const DB_JOB_RETENTION_MS = readPositiveNumber(process.env.RESEARCH_DB_JOB_RETENTION_MS, 14 * 24 * 60 * 60 * 1000);
const DB_JOB_SWEEP_MS = readPositiveNumber(process.env.RESEARCH_DB_JOB_SWEEP_MS, 60 * 60 * 1000);
const DEFAULT_WORKER_LEASE_MS = readPositiveNumber(process.env.RESEARCH_WORKER_LEASE_MS, 10 * 60 * 1000);
const DEFAULT_WORKER_MAX_ATTEMPTS = readPositiveInteger(process.env.RESEARCH_WORKER_MAX_ATTEMPTS, 3);
/**
 * SOL-RES-03 — KES SEDA TÖÖD PÄRISELT JOOKSUTAB.
 *
 * Töö loonud frontend-protsess pani IGA uue töö oma lokaalsesse `jobs` Map'i. Worker-režiimis
 * claim'ib sama DB-rea aga eraldi protsess ja uuendab OMA runtime-objekti — päritoluprotsessi Map
 * neid sündmusi kunagi ei saa. Kuna snapshot, result ja SSE eelistasid kõik Map'i andmebaasile,
 * võis töö DB-s edukalt lõppeda, samal ajal kui teda loonud protsess andis detailis ja voos
 * lõputult `queued`. Stale objekti ei koristanud keegi, sest sweep ei kustuta queued/running seisu.
 *
 * REEGEL: runtime-objekt on ainult sellel protsessil, kes tööd PÄRISELT jooksutab. Kes teda ei
 * jooksuta, loeb andmebaasist — ja andmebaas on siis ainus tõde, mitte kaks võistlevat.
 */
const RESEARCH_JOB_MODE = String(
  process.env.RESEARCH_JOB_MODE || process.env.RESEARCH_RUNNER_MODE || "inline"
).trim().toLowerCase();

const ACTIVE_STATUSES = ["queued", "running"];
const TERMINAL_STATUSES = ["done", "error", "cancelled"];

const jobs = new Map();
let seq = 1;
let lastDbSweepAt = 0;

function nowIso() {
  return new Date().toISOString();
}

function clampStatus(status) {
  if (status === "running" || status === "done" || status === "error" || status === "cancelled") {
    return status;
  }
  return "queued";
}

function emitToSubscribers(job, event) {
  if (!job?.subscribers?.size) return;
  for (const cb of job.subscribers) {
    try {
      cb(event);
    } catch {}
  }
}

function appendEvent(job, event) {
  if (!Array.isArray(job.events)) job.events = [];
  const fullEvent = {
    seq: seq++,
    at: nowIso(),
    ...event,
  };
  job.events.push(fullEvent);
  if (job.events.length > 200) {
    job.events = job.events.slice(-200);
  }
  emitToSubscribers(job, fullEvent);
  return fullEvent;
}

function toPublic(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: clampStatus(job.status),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error || null,
    metrics: job.metrics || null,
  };
}

function toPublicFromRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    status: clampStatus(record.status),
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
    startedAt: record.startedAt?.toISOString?.() || record.startedAt || null,
    endedAt: record.endedAt?.toISOString?.() || record.endedAt || null,
    error: record.error || null,
    metrics: record.metrics || null,
    result: record.result || null,
    userId: record.userId,
    attempts: record.attempts || 0,
    workerId: record.workerId || null,
    leaseUntil: record.leaseUntil?.toISOString?.() || record.leaseUntil || null,
  };
}

function terminalStatus(status) {
  return status === "done" || status === "error" || status === "cancelled";
}

export async function markStaleActiveJobsInterrupted({
  prismaClient = prisma,
  service = usageService,
  now = new Date()
} = {}) {
  if (!Number.isFinite(ACTIVE_JOB_STALE_MS) || ACTIVE_JOB_STALE_MS <= 0) return;
  const endedAt = now instanceof Date ? now : new Date(now);
  const cutoff = new Date(endedAt.getTime() - ACTIVE_JOB_STALE_MS);
  const candidates = await prismaClient.researchJob.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      updatedAt: { lt: cutoff },
      leaseUntil: null,
    },
    select: {
      id: true,
      userId: true,
      payload: true,
    },
  });

  let interrupted = 0;
  for (const job of candidates) {
    const result = await prismaClient.researchJob.updateMany({
      where: {
        id: job.id,
        status: { in: ACTIVE_STATUSES },
        updatedAt: { lt: cutoff },
        leaseUntil: null,
      },
      data: {
        status: "error",
        error: "research.error.interrupted",
        endedAt,
      },
    });
    if (!result?.count) continue;
    interrupted += 1;
    const runtimeJob = jobs.get(job.id);
    if (runtimeJob && !terminalStatus(runtimeJob.status)) {
      runtimeJob.status = "error";
      runtimeJob.updatedAt = endedAt.toISOString();
      runtimeJob.endedAt = endedAt.toISOString();
      runtimeJob.error = "research.error.interrupted";
      try {
        runtimeJob.abortController?.abort?.();
      } catch {}
      appendEvent(runtimeJob, { type: "error", message: runtimeJob.error });
      appendEvent(runtimeJob, { type: "status", status: "error" });
      appendEvent(runtimeJob, { type: "done" });
    }
    await settleResearchUsage(job, "release", "research_interrupted", service);
  }
  return interrupted;
}

function toRuntimeJob(record, { owned = true } = {}) {
  if (!record?.id) return null;
  const existing = jobs.get(record.id);
  if (existing && !terminalStatus(existing.status)) return existing;
  const createdAt = record.createdAt?.toISOString?.() || nowIso();
  const updatedAt = record.updatedAt?.toISOString?.() || createdAt;
  const job = {
    id: record.id,
    userId: record.userId,
    payload: record.payload || {},
    status: clampStatus(record.status),
    createdAt,
    updatedAt,
    startedAt: record.startedAt?.toISOString?.() || null,
    endedAt: record.endedAt?.toISOString?.() || null,
    error: record.error || null,
    result: record.result || null,
    metrics: record.metrics || null,
    attempts: record.attempts || 0,
    workerId: record.workerId || null,
    leaseUntil: record.leaseUntil?.toISOString?.() || null,
    cancelRequested: record.status === "cancelled",
    abortController: new AbortController(),
    events: [],
    subscribers: new Set(),
    ownedByThisProcess: owned,
  };
  if (!owned) return job;
  jobs.set(job.id, job);
  return job;
}

/**
 * SOL-RES-04 — FENCING. Kirjutaja tohib kirjutada ainult siis, kui rida kuulub TEMALE.
 *
 * `workerId: null` on inline-jooksja tunnus: kui keegi on rea vahepeal claim'inud (workerId
 * seatud), siis inline-jooksja kaotab — ja vastupidi. Nii ei ole vaja eraldi fencing-veergu:
 * `workerId` ON juba see märk, kes praegu tohib kirjutada.
 */
function leaseFence(job) {
  return { workerId: job?.workerId || null };
}

/**
 * Lease on kaotatud: rida kuulub kellelegi teisele. Lokaalne töö tuleb katkestada, muidu jätkab ta
 * mudeli- ja RAG-kutseid ning võib hiljem teise workeri tulemuse üle kirjutada.
 */
function abandonLostLease(job, reason = "research.error.lease_lost") {
  if (!job || job.leaseLost) return;
  job.leaseLost = true;
  try {
    job.abortController?.abort?.();
  } catch {}
  try {
    appendEvent(job, { type: "status", status: clampStatus(job.status) });
  } catch {}
  try {
    console.error("[research][jobStore] lease lost, aborting local work", { jobId: job.id, reason });
  } catch {}
}

export function hasLostResearchLease(job) {
  return Boolean(job?.leaseLost);
}

/**
 * @returns `true`, kui kirjutus läks läbi. `false` tähendab, et rida ei ole enam meie oma — ja siis
 * EI kirjutata rohkem midagi, vaid lokaalne töö katkestatakse.
 */
async function persistJobUpdate(job, data) {
  if (!job?.id) return false;
  if (job.leaseLost) return false;
  try {
    const result = await prisma.researchJob.updateMany({
      where: { id: job.id, ...leaseFence(job) },
      data,
    });
    if (!result?.count) {
      abandonLostLease(job);
      return false;
    }
    return true;
  } catch (error) {
    try {
      console.error("[research][jobStore] persist update failed", error);
    } catch {}
    return false;
  }
}

/**
 * @param fence `true` = workeri kirjutus: tohib ainult praegune omanik.
 *              `false` = väline juhttoiming (cancel): tohib ka keegi teine protsess, sest peatamine
 *              ei ole tulemus. Ilma selle vaheteta kukuks omaniku enda Stop worker-režiimis läbi.
 */
async function transitionResearchJobToTerminal(job, data, { fence = true } = {}) {
  if (!job?.id) return false;
  const result = await prisma.researchJob.updateMany({
    where: {
      id: job.id,
      status: { in: ACTIVE_STATUSES },
      ...(fence ? leaseFence(job) : {})
    },
    data
  });
  if (!result?.count && fence) {
    abandonLostLease(job);
  }
  return Boolean(result?.count);
}

/**
 * SOL-RES-06 — ARVELDUS EI TOHI OLLA BEST-EFFORT.
 *
 * `markResearchDone()` muutis rea esmalt `done`-iks ja kutsus alles siis kasutuse commit'i, mille
 * vead NEELATI täielikult. Research-reservatsiooni TTL on 24 tundi, seega edukaks märgitud töö võis
 * commit'i vea järel jääda RESERVED-iks ja üldine reaper vabastas ta hiljem kui KASUTAMATA ühiku —
 * töö tulemust see enam tagasi ei pööranud. Edukas tasuline uuring jäi paketikasutuses arvestamata.
 *
 * Teine pool: tühistatud töö arveldust ei saanud DB-snapshotist üldse teha, sest `toPublicFromRecord()`
 * ei säilita payload'i ja võtit otsiti just sealt. Nüüd loetakse võti vajadusel reast juurde.
 *
 * KOLM MUUDATUST: võti on alati leitav · õnnestumine ja ebaõnnestumine JÄÄVAD reale kirja
 * (`usageSettledAt` / `usageSettlePending`) · pooleli jäänud arveldusi korratakse
 * (`retryPendingResearchUsageSettlements`), kuni teenus kinnitab. Commit ja release on ise
 * idempotentsed, seega kordamine on ohutu.
 */
async function resolveResearchUsageKey(job) {
  const direct = String(job?.payload?.usageIdempotencyKey || "").trim();
  if (direct) return direct;
  if (!job?.id) return "";
  try {
    const record = await prisma.researchJob.findUnique({
      where: { id: String(job.id) },
      select: { payload: true }
    });
    return String(record?.payload?.usageIdempotencyKey || "").trim();
  } catch {
    return "";
  }
}

/** Kirjutab arvelduse tulemuse reale, et teda saaks hiljem korrata või kontrollida. */
async function markUsageSettlement(jobId, patch) {
  if (!jobId) return;
  try {
    const record = await prisma.researchJob.findUnique({
      where: { id: String(jobId) },
      select: { payload: true }
    });
    const payload = record?.payload && typeof record.payload === "object" ? record.payload : {};
    await prisma.researchJob.update({
      where: { id: String(jobId) },
      data: { payload: { ...payload, ...patch } }
    });
  } catch (error) {
    try {
      console.error("[research][jobStore] usage settlement marker failed", error);
    } catch {}
  }
}

async function settleResearchUsage(job, action, reason = null, service = usageService) {
  const userId = String(job?.userId || "").trim();
  const idempotencyKey = await resolveResearchUsageKey(job);
  if (!idempotencyKey || !userId) return false;
  try {
    if (action === "commit") {
      await service.commit({ userId, idempotencyKey });
    } else {
      await service.release({
        userId,
        idempotencyKey,
        reason: reason || "research_not_completed"
      });
    }
    await markUsageSettlement(job?.id, {
      usageSettledAt: nowIso(),
      usageSettledAction: action,
      usageSettlePending: null
    });
    return true;
  } catch (error) {
    try {
      console.error(`[research][jobStore] usage ${action} failed`, error);
    } catch {}
    /* Vaikimine oleks siin kõige halvem: rida jääks „edukaks" ja arveldus lahkneks nähtamatult.
       Märge teeb temast korratava töö. */
    await markUsageSettlement(job?.id, {
      usageSettlePending: { action, reason: reason || null, at: nowIso() }
    });
    return false;
  }
}

/**
 * Kordab pooleli jäänud arveldusi. Commit ja release on idempotentsed, seega kordus on ohutu ka
 * siis, kui esimene kutse päriselt läbi läks ja ainult märge jäi kirjutamata.
 */
export async function retryPendingResearchUsageSettlements({
  db = prisma,
  service = usageService,
  limit = 25
} = {}) {
  let rows;
  try {
    rows = await db.researchJob.findMany({
      where: { payload: { path: ["usageSettlePending", "action"], not: Prisma.DbNull } },
      select: { id: true, userId: true, payload: true },
      take: Math.max(1, Math.min(100, Number(limit) || 25))
    });
  } catch {
    return { scanned: 0, settled: 0 };
  }

  let settled = 0;
  for (const row of rows) {
    const pending = row?.payload?.usageSettlePending;
    if (!pending?.action) continue;
    const done = await settleResearchUsage(
      { id: row.id, userId: row.userId, payload: row.payload },
      pending.action,
      pending.reason,
      service
    );
    if (done) settled += 1;
  }
  return { scanned: rows.length, settled };
}

/* SOL-RES-06: pooleli jäänud arveldust korratakse oma tempos (vaikimisi minut), mitte
   säilitussweepi tunnise rütmiga — muidu võiks edukas töö tunde arvestamata seista. */
const SETTLEMENT_RETRY_MS = readPositiveNumber(process.env.RESEARCH_USAGE_SETTLE_RETRY_MS, 60 * 1000);
let lastSettlementRetryAt = 0;

async function maybeRetryPendingSettlements() {
  const now = Date.now();
  if (now - lastSettlementRetryAt < SETTLEMENT_RETRY_MS) return;
  lastSettlementRetryAt = now;
  try {
    await retryPendingResearchUsageSettlements();
  } catch (error) {
    try {
      console.error("[research][jobStore] settlement retry sweep failed", error);
    } catch {}
  }
}

async function sweepExpiredPersistedJobs() {
  await maybeRetryPendingSettlements();
  if (!Number.isFinite(DB_JOB_RETENTION_MS) || DB_JOB_RETENTION_MS <= 0) return;
  const now = Date.now();
  if (now - lastDbSweepAt < DB_JOB_SWEEP_MS) return;
  lastDbSweepAt = now;
  const cutoff = new Date(now - DB_JOB_RETENTION_MS);
  try {
    await prisma.researchJob.deleteMany({
      where: {
        status: { in: TERMINAL_STATUSES },
        endedAt: { lt: cutoff },
      },
    });
  } catch (error) {
    try {
      console.error("[research][jobStore] persisted sweep failed", error);
    } catch {}
  }
}

function shouldDelete(job, now) {
  if (!job) return true;
  // Võõra protsessi tööd ei tohi siin üldse olla; kui ta kuidagi tekib, ei jää ta igaveseks.
  if (job.ownedByThisProcess === false) return true;
  if (job.status === "running" || job.status === "queued") return false;
  const ended = job.endedAt ? Date.parse(job.endedAt) : Date.parse(job.updatedAt || job.createdAt || nowIso());
  if (!Number.isFinite(ended)) return false;
  return now - ended > JOB_TTL_MS;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (shouldDelete(job, now)) jobs.delete(id);
  }
}, JOB_SWEEP_MS).unref?.();

/**
 * SOL-RES-02 — kavatsuse allkiri. Volatiilsed väljad jäetakse välja: nad tulevad võtmest endast
 * või serverist, mitte kasutaja valikust, ja nende kaasamine teeks igast korduskatsest „uue
 * kavatsuse".
 */
function intentFingerprint(payload) {
  const {
    usageIdempotencyKey: _usageKey,
    idempotencyKey: _clientKey,
    intentFingerprint: _fingerprint,
    ...rest
  } = payload && typeof payload === "object" ? payload : {};
  return crypto.createHash("sha256").update(buildIntentSignature(rest)).digest("hex");
}

/**
 * SOL-RES-02 — ÜKS KAVATSUS = ÜKS TÖÖ.
 *
 * Vana kood reserveeris kasutuse kliendi võtmega, aga lõi töö ALATI uue juhusliku UUID-ga; võtme ja
 * `ResearchJob` vahel ei olnud mingit seost. Usage-teenus tagastab sama võtme olemasoleva
 * reservatsiooni — ka terminalse — `reused: true` vastusena, seega sama võtit teadlikult korrates
 * sai ühe kuulimiidi ühikuga käivitada järjest piiramatult uusi täismahus uuringuid. Tavaklient ei
 * saatnud võtit üldse, mistõttu võrgu- või vastusevea kordus lõi vastupidi UUE võtme ja UUE
 * tasulise töö. Idempotentsus toimis kahes kihis vastupidise tähendusega.
 *
 * @returns `{ outcome: "created" | "reused", job }` või viskab `INTENT_CONFLICT` (sama võti,
 *          teine sisend) / `ACTIVE_JOB_LIMIT`.
 */
export async function claimResearchJobForIntent({ userId, payload, clientIntentKey }) {
  const key = String(clientIntentKey || "").trim() || null;
  if (!key) {
    return { outcome: "created", job: await createResearchJob({ userId, payload }) };
  }

  const normalizedUserId = String(userId || "").trim();
  const fingerprint = intentFingerprint(payload);

  const existing = await prisma.researchJob.findFirst({
    where: { userId: normalizedUserId, clientIntentKey: key },
  });
  if (existing) {
    return { outcome: "reused", job: reuseExistingIntent(existing, fingerprint) };
  }

  try {
    const job = await createResearchJob({
      userId: normalizedUserId,
      payload: { ...(payload || {}), intentFingerprint: fingerprint },
      clientIntentKey: key,
    });
    return { outcome: "created", job };
  } catch (error) {
    if (error?.code !== "INTENT_RACE") throw error;
    // Kaks päringut sama võtmega korraga: unikaalne indeks otsustas, kes võitis.
    const raced = await prisma.researchJob.findFirst({
      where: { userId: normalizedUserId, clientIntentKey: key },
    });
    if (!raced) throw error;
    return { outcome: "reused", job: reuseExistingIntent(raced, fingerprint) };
  }
}

function reuseExistingIntent(record, fingerprint) {
  const stored = String(record?.payload?.intentFingerprint || "");
  if (stored && stored !== fingerprint) {
    const conflict = new Error("research.error.intent_conflict");
    conflict.code = "INTENT_CONFLICT";
    throw conflict;
  }
  /* Lõppseisu autoriteet on ANDMEBAAS, mitte protsessimälu. Protsessi `jobs` Map võib kanda sama
     töö vana seisu (nt kui lõpetajaks oli teine protsess) — sond tabas selle kohe: taaskasutatud
     töö vastas „queued", kuigi ta oli ammu `done`. Lokaalset objekti kasutame ainult siis, kui töö
     ON veel aktiivne, sest tal on voo jaoks vaja sündmusi ja tellijaid. */
  const local = jobs.get(record.id);
  if (local && !terminalStatus(record.status)) return local;
  return toPublicFromRecord(record);
}

export async function createResearchJob({ userId, payload, clientIntentKey = null }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    const error = new Error("research.error.invalid_user");
    error.code = "INVALID_USER";
    throw error;
  }
  if ((await getActiveResearchJobCount(normalizedUserId)) > 0) {
    const error = new Error("research.error.active_job_limit");
    error.code = "ACTIVE_JOB_LIMIT";
    throw error;
  }
  await sweepExpiredPersistedJobs();
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const job = {
    id,
    userId: normalizedUserId,
    payload,
    status: "queued",
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    endedAt: null,
    error: null,
    result: null,
    metrics: null,
    attempts: 0,
    workerId: null,
    leaseUntil: null,
    cancelRequested: false,
    abortController: new AbortController(),
    events: [],
    subscribers: new Set(),
    // Worker-režiimis EI jooksuta seda tööd see protsess, seega tal ei ole ka runtime-objekti.
    ownedByThisProcess: RESEARCH_JOB_MODE !== "worker",
  };
  try {
    await prisma.researchJob.create({
      data: {
        id,
        userId: normalizedUserId,
        payload: payload || {},
        clientIntentKey: clientIntentKey || null,
        status: "queued",
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      /* Kaks eri unikaalsust, kaks eri tähendust: „üks aktiivne töö kasutaja kohta" ja
         „üks kavatsus = üks töö". Neid ei tohi ühe veateate alla suruda, sest kutsuja teeb
         nende peale eri asju. */
      const target = String(error?.meta?.target || "");
      if (target.includes("clientIntentKey")) {
        const raceError = new Error("research.error.intent_conflict");
        raceError.code = "INTENT_RACE";
        throw raceError;
      }
      const activeJobError = new Error("research.error.active_job_limit");
      activeJobError.code = "ACTIVE_JOB_LIMIT";
      throw activeJobError;
    }
    throw error;
  }
  if (job.ownedByThisProcess) {
    jobs.set(id, job);
  }
  appendEvent(job, { type: "status", status: "queued" });
  return job;
}

export function getResearchJob(jobId) {
  return jobs.get(String(jobId));
}

export function getResearchJobPublic(jobId) {
  return toPublic(getResearchJob(jobId));
}

export async function getResearchJobSnapshot(jobId) {
  await sweepExpiredPersistedJobs();
  const liveJob = getResearchJob(jobId);
  if (liveJob) {
    return {
      ...toPublic(liveJob),
      result: liveJob.result || null,
      userId: liveJob.userId,
    };
  }
  const record = await prisma.researchJob.findUnique({
    where: { id: String(jobId || "") },
  });
  return toPublicFromRecord(record);
}

export function subscribeResearchJob(jobId, callback) {
  const job = getResearchJob(jobId);
  if (!job || typeof callback !== "function") {
    return () => {};
  }
  for (const event of job.events) {
    try {
      callback(event);
    } catch {}
  }
  job.subscribers.add(callback);
  return () => {
    try {
      job.subscribers.delete(callback);
    } catch {}
  };
}

export async function publishResearchProgress(job, payload) {
  if (!job) return;
  job.updatedAt = nowIso();
  appendEvent(job, { type: "progress", ...payload });
  const data = { updatedAt: new Date(job.updatedAt) };
  if (job.workerId && job.leaseUntil) {
    data.workerId = job.workerId;
    data.leaseUntil = new Date(job.leaseUntil);
  }
  await persistJobUpdate(job, data);
}

export async function markResearchRunning(job) {
  if (!job) return;
  job.status = "running";
  job.startedAt = nowIso();
  job.updatedAt = job.startedAt;
  appendEvent(job, { type: "status", status: "running" });
  const data = {
    status: "running",
    startedAt: new Date(job.startedAt),
  };
  if (job.workerId && job.leaseUntil) {
    data.workerId = job.workerId;
    data.leaseUntil = new Date(job.leaseUntil);
  }
  await persistJobUpdate(job, data);
}

export async function markResearchDone(job, result, metrics = null) {
  if (!job || terminalStatus(job.status)) return;
  const endedAt = nowIso();
  const persisted = await transitionResearchJobToTerminal(job, {
    status: "done",
    error: null,
    result: result || null,
    metrics: metrics || null,
    workerId: null,
    leaseUntil: null,
    endedAt: new Date(endedAt),
  });
  if (!persisted) return;
  job.status = "done";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.result = result || null;
  job.metrics = metrics || null;
  appendEvent(job, { type: "result", result: job.result, metrics: job.metrics });
  appendEvent(job, { type: "status", status: "done" });
  appendEvent(job, { type: "done" });
  await settleResearchUsage(job, "commit");
}

export async function markResearchFailed(job, errorMessage, metrics = null) {
  if (!job || terminalStatus(job.status)) return;
  const endedAt = nowIso();
  const error = String(errorMessage || "research.error.failed");
  const persisted = await transitionResearchJobToTerminal(job, {
    status: "error",
    error,
    metrics: metrics || null,
    workerId: null,
    leaseUntil: null,
    endedAt: new Date(endedAt),
  });
  if (!persisted) return;
  job.status = "error";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.error = error;
  job.metrics = metrics || null;
  appendEvent(job, { type: "error", message: job.error, metrics: job.metrics });
  appendEvent(job, { type: "status", status: "error" });
  appendEvent(job, { type: "done" });
  await settleResearchUsage(job, "release", "research_failed");
}

export async function cancelResearchJob(job, message = "research.error.cancelled") {
  if (!job) return;
  if (terminalStatus(job.status)) return;
  const endedAt = nowIso();
  const error = String(message || "research.error.cancelled");
  const persisted = await transitionResearchJobToTerminal(job, {
    status: "cancelled",
    error,
    workerId: null,
    leaseUntil: null,
    endedAt: new Date(endedAt),
  // Frontendi Stop ei oma lease'i ja peab jääma fence'imata. Pipeline'is lease'i kaotanud worker
  // jõuab siia sama cancellation-raja kaudu, kuid tema vana workerId ei tohi uue omaniku rida
  // tühistada. `abandonLostLease()` märgib selle olukorra enne AbortControlleri katkestamist.
  }, { fence: hasLostResearchLease(job) });
  if (!persisted) return;
  job.cancelRequested = true;
  try {
    job.abortController?.abort?.();
  } catch {}
  job.status = "cancelled";
  job.updatedAt = endedAt;
  job.endedAt = endedAt;
  job.error = error;
  appendEvent(job, { type: "error", message: job.error });
  appendEvent(job, { type: "status", status: "cancelled" });
  appendEvent(job, { type: "done" });
  await settleResearchUsage(job, "release", "research_cancelled");
}

/**
 * SOL-RES-01 — PÄRIS kustutus, mitte tühistus.
 *
 * Vana DELETE kutsus ainult `cancelResearchJob()`. Terminaltöö puhul tagastas see kohe midagi
 * muutmata ja marsruut vastas ikkagi eduga „cancelled" — kasutajale öeldi „kustutatud", aga rida
 * jäi alles ja ilmus kohe uuesti nimekirja. Kustutus ja peatamine on kaks ERI toimingut ning
 * ainult üks neist eemaldab rea.
 *
 * @returns `"deleted"` · `"active"` (tuleb enne peatada) · `"missing"` (ei ole olemas VÕI ei ole
 *          sinu oma — sama vastus, et ei tekiks olemasolu-oraaklit).
 */
export async function deleteResearchJobForOwner({ jobId, userId }) {
  const id = String(jobId || "").trim();
  if (!id || !userId) return "missing";

  const local = jobs.get(id);
  const record = await prisma.researchJob.findUnique({ where: { id } }).catch(() => null);
  if (!local && !record) return "missing";

  const ownerId = record?.userId ?? local?.userId;
  if (String(ownerId) !== String(userId)) return "missing";

  const status = record?.status || local?.status;
  if (!terminalStatus(status)) return "active";

  const { count } = await prisma.researchJob.deleteMany({ where: { id, userId: String(userId) } });
  jobs.delete(id);
  return count > 0 || Boolean(local) ? "deleted" : "missing";
}

export function isResearchCancelled(job) {
  return Boolean(job?.cancelRequested || job?.status === "cancelled");
}

export async function syncResearchCancellation(job) {
  if (!job?.id || isResearchCancelled(job)) return isResearchCancelled(job);
  try {
    const record = await prisma.researchJob.findUnique({
      where: { id: job.id },
      select: { status: true, error: true, workerId: true },
    });
    /* SOL-RES-04: kaotatud lease peatab töö samamoodi nagu tühistus. Pipeline küsis varem ainult
       „kas tühistatud", seega aegunud lease'i pealt üle võetud töö jooksis vanas workeris edasi. */
    if (record && String(record.workerId || "") !== String(job.workerId || "")) {
      abandonLostLease(job);
      return true;
    }
    if (record?.status === "cancelled") {
      job.cancelRequested = true;
      job.status = "cancelled";
      job.error = record.error || "research.error.cancelled";
      try {
        job.abortController?.abort?.();
      } catch {}
      return true;
    }
  } catch (error) {
    try {
      console.error("[research][jobStore] cancellation sync failed", error);
    } catch {}
  }
  return false;
}

export function assertResearchAccess(job, userId) {
  if (!job) return false;
  return String(job.userId) === String(userId);
}

export async function getResearchJobResult(jobId) {
  await sweepExpiredPersistedJobs();
  const job = getResearchJob(jobId);
  if (job) {
    return {
      ...toPublic(job),
      result: job.result || null,
    };
  }
  const record = await prisma.researchJob.findUnique({
    where: { id: String(jobId || "") },
  });
  return toPublicFromRecord(record);
}

export async function getActiveResearchJobCount(userId) {
  const targetUserId = String(userId || "").trim();
  if (!targetUserId) return 0;
  await sweepExpiredPersistedJobs();
  await markStaleActiveJobsInterrupted();
  return prisma.researchJob.count({
    where: {
      userId: targetUserId,
      status: { in: ACTIVE_STATUSES },
    },
  });
}

export async function hasActiveResearchJob(userId) {
  return (await getActiveResearchJobCount(userId)) > 0;
}

// Owner-scoped list item for the unified "My documents" workspace (E3). Only the owner's
// own rows are ever read (the route enforces auth); the shape is deliberately minimal —
// no full report/result content, only status, timestamps and the owner's own query text.
function toOwnerListItem(record) {
  if (!record) return null;
  const payload = record?.payload && typeof record.payload === "object" ? record.payload : {};
  const query = String(payload.query || "").trim();
  const convId = typeof payload.convId === "string" && payload.convId.trim() ? payload.convId.trim() : null;
  return {
    id: record.id,
    status: clampStatus(record.status),
    createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
    endedAt: record.endedAt?.toISOString?.() || record.endedAt || null,
    query: query ? query.slice(0, 200) : "",
    convId,
    profile: payload.profile === "light" ? "light" : "standard"
  };
}

// Read the owner's research jobs, newest first, for the unified workspace list. Reads from
// the persisted table (kept in sync by the runtime) so it survives process restarts.
export async function listResearchJobsForOwner({
  userId,
  limit = 20,
  offset = 0,
  convId = null,
  intentKey = null,
  activeOnly = false,
  search = ""
} = {}) {
  const targetUserId = String(userId || "").trim();
  if (!targetUserId) return { total: 0, jobs: [] };
  const take = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 20)));
  const skip = Math.max(0, Math.trunc(Number(offset) || 0));
  /* SOL-RES-07: vestluse avamisel peab klient leidma SAMA omaniku ja SAMA vestluse aktiivse töö.
     `convId` elab payload'is, seega filtreeritakse JSON-tee järgi; ilma selle filtrita ei olnud
     kliendil ühtki teed aktiivse tööni tagasi. */
  const conversationId = String(convId || "").trim();
  const normalizedIntentKey = String(intentKey || "").trim().slice(0, 200);
  const query = String(search || "").trim().slice(0, 200);
  const payloadFilters = [
    ...(conversationId ? [{ payload: { path: ["convId"], equals: conversationId } }] : []),
    ...(query ? [{ payload: { path: ["query"], string_contains: query } }] : [])
  ];
  const where = {
    userId: targetUserId,
    ...(normalizedIntentKey ? { clientIntentKey: normalizedIntentKey } : {}),
    ...(activeOnly ? { status: { in: ACTIVE_STATUSES } } : {}),
    ...(payloadFilters.length ? { AND: payloadFilters } : {})
  };
  await sweepExpiredPersistedJobs();
  const [total, rows] = await prisma.$transaction([
    prisma.researchJob.count({ where }),
    prisma.researchJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take
    })
  ]);
  return { total, jobs: rows.map(toOwnerListItem).filter(Boolean) };
}

export async function claimNextResearchJob(options = {}) {
  await sweepExpiredPersistedJobs();
  const workerId = String(options.workerId || `research-worker-${process.pid}`).trim();
  const leaseMs = Math.max(30_000, Number(options.leaseMs) || DEFAULT_WORKER_LEASE_MS);
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || DEFAULT_WORKER_MAX_ATTEMPTS);
  const staleMs = Math.max(30_000, Number(options.staleMs) || ACTIVE_JOB_STALE_MS);
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + leaseMs);
  const staleCutoff = new Date(now.getTime() - staleMs);

  await prisma.researchJob.updateMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      attempts: { gte: maxAttempts },
      OR: [
        { status: "queued" },
        { leaseUntil: { lt: now } },
        { leaseUntil: null, updatedAt: { lt: staleCutoff } },
      ],
    },
    data: {
      status: "error",
      error: "research.error.failed",
      workerId: null,
      leaseUntil: null,
      endedAt: now,
    },
  });

  const rows = await prisma.$queryRaw`
    UPDATE "public"."ResearchJob"
    SET
      "status" = 'running',
      "workerId" = ${workerId},
      "leaseUntil" = ${leaseUntil},
      "attempts" = "attempts" + 1,
      "startedAt" = COALESCE("startedAt", ${now}),
      "updatedAt" = ${now},
      "error" = NULL
    WHERE "id" = (
      SELECT "id"
      FROM "public"."ResearchJob"
      WHERE
        (
          "status" = 'queued'
          OR (
            "status" = 'running'
            AND (
              "leaseUntil" < ${now}
              OR ("leaseUntil" IS NULL AND "updatedAt" < ${staleCutoff})
            )
          )
        )
        AND "attempts" < ${maxAttempts}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `;
  const record = Array.isArray(rows) ? rows[0] : null;
  return toRuntimeJob(record);
}

export function startResearchJobLeaseHeartbeat(job, options = {}) {
  if (!job?.id) return () => {};
  const workerId = String(options.workerId || job.workerId || "").trim();
  const leaseMs = Math.max(30_000, Number(options.leaseMs) || DEFAULT_WORKER_LEASE_MS);
  const intervalMs = Math.max(5_000, Math.min(60_000, Number(options.intervalMs) || Math.trunc(leaseMs / 3)));
  let stopped = false;

  const renew = async () => {
    if (stopped || terminalStatus(job.status)) return;
    const leaseUntil = new Date(Date.now() + leaseMs);
    job.leaseUntil = leaseUntil.toISOString();
    try {
      const result = await prisma.researchJob.updateMany({
        where: {
          id: job.id,
          status: "running",
          ...(workerId ? { workerId } : {}),
        },
        data: {
          leaseUntil,
          updatedAt: new Date(),
        },
      });
      /* SOL-RES-04: `count === 0` tähendab, et rida ei kuulu enam meile — kas uus worker on ta
         aegunud lease'i pealt üle võtnud või on töö lõppenud. Vana kood ei vaadanud seda arvu
         kunagi ja jätkas rahulikult mudeli- ja RAG-kutseid. */
      if (!result?.count) {
        stopped = true;
        clearInterval(timer);
        abandonLostLease(job);
      }
    } catch (error) {
      try {
        console.error("[research][jobStore] lease renewal failed", error);
      } catch {}
    }
  };

  const timer = setInterval(() => {
    void renew();
  }, intervalMs);
  timer.unref?.();
  void renew();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
