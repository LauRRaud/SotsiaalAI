import prisma from "@/lib/prisma";

// Detector for expired RESERVED usage reservations (PERF-P0 — quota leak).
//
// A reservation is created RESERVED and its reservedAmount is added to the bucket's
// "reserved" counter (which counts against the hard limit). Normally the request then
// commits or releases it. But if the request crashes, the client vanishes, or a
// technical error skips the release, the row stays RESERVED forever and its capacity
// is never given back — the user's quota leaks until the bucket period rolls over.
//
// Expiry is not proof that the owning request has stopped: provider work can legitimately
// outlive its TTL. Therefore this job may detect stale-looking rows for operations/alerts,
// but must not settle them. Only the request that owns a reservation may commit or release
// it; otherwise a live request could receive a paid result after this job released its hold.

const DEFAULT_GRACE_MS = 5 * 60 * 1000;
const DEFAULT_BATCH = 100;
const MAX_BATCH = 500;

export function getExpiredReservationWhere(now = new Date(), graceMs = DEFAULT_GRACE_MS) {
  const cutoff = new Date(now.getTime() - Math.max(0, graceMs));
  return {
    status: "RESERVED",
    // never flag a reservation without a finite expiry
    expiresAt: { not: null, lt: cutoff }
  };
}

/**
 * Detect expired RESERVED reservations without settling them.
 * @param {object} [options]
 * @param {*} [options.db] Prisma client used to scan for expired rows.
 * @param {Date} [options.now]
 * @param {number} [options.graceMs] Only flag rows expired longer ago than this.
 * @param {number} [options.batchSize]
 */
export async function reapExpiredReservations({
  db = prisma,
  now = new Date(),
  graceMs = DEFAULT_GRACE_MS,
  batchSize = DEFAULT_BATCH
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || DEFAULT_BATCH, MAX_BATCH));
  const expired = await db.usageReservation.findMany({
    where: getExpiredReservationWhere(now, graceMs),
    orderBy: { expiresAt: "asc" },
    take,
    select: { id: true }
  });

  const results = {
    scanned: expired.length,
    released: 0,
    skippedCommitted: 0,
    alreadyResolved: 0,
    errors: 0,
    deferred: expired.length
  };

  return results;
}
