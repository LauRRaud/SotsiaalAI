import prisma from "@/lib/prisma";
import { usageService } from "@/lib/usage/service";

// Reaper for expired RESERVED usage reservations (PERF-P0 — quota leak).
//
// A reservation is created RESERVED and its reservedAmount is added to the bucket's
// "reserved" counter (which counts against the hard limit). Normally the request then
// commits or releases it. But if the request crashes, the client vanishes, or a
// technical error skips the release, the row stays RESERVED forever and its capacity
// is never given back — the user's quota leaks until the bucket period rolls over.
//
// This reaper finds RESERVED rows whose expiresAt has passed (with a grace window) and
// releases them through the SAME atomic service path as a normal release, so the
// bucket "reserved" counter is correctly decremented and a RELEASED event is recorded.
// It never touches COMMITTED rows (a reservation that was legitimately used between the
// scan and the release throws USAGE_RESERVATION_STATE_CONFLICT and is skipped), and it
// never touches rows without an expiresAt (deliberately non-expiring reservations).

const DEFAULT_GRACE_MS = 5 * 60 * 1000;
const DEFAULT_BATCH = 100;
const MAX_BATCH = 500;

export function getExpiredReservationWhere(now = new Date(), graceMs = DEFAULT_GRACE_MS) {
  const cutoff = new Date(now.getTime() - Math.max(0, graceMs));
  return {
    status: "RESERVED",
    // never reap a reservation without a finite expiry
    expiresAt: { not: null, lt: cutoff }
  };
}

/**
 * Release expired RESERVED reservations via the atomic usage-service path.
 * @param {object} [options]
 * @param {*} [options.db] Prisma client used to scan for expired rows.
 * @param {*} [options.service] Usage service (must expose release()). Defaults to the
 *   shared usageService; inject one built on the same client in tests.
 * @param {Date} [options.now]
 * @param {number} [options.graceMs] Only reap rows expired longer ago than this.
 * @param {number} [options.batchSize]
 */
export async function reapExpiredReservations({
  db = prisma,
  service = usageService,
  now = new Date(),
  graceMs = DEFAULT_GRACE_MS,
  batchSize = DEFAULT_BATCH
} = {}) {
  const take = Math.max(1, Math.min(Number(batchSize) || DEFAULT_BATCH, MAX_BATCH));
  const expired = await db.usageReservation.findMany({
    where: getExpiredReservationWhere(now, graceMs),
    orderBy: { expiresAt: "asc" },
    take,
    select: { id: true, userId: true, idempotencyKey: true }
  });

  const results = {
    scanned: expired.length,
    released: 0,
    skippedCommitted: 0,
    alreadyResolved: 0,
    errors: 0
  };

  for (const row of expired) {
    try {
      // release() is atomic + idempotent: it restores bucket capacity, or returns
      // early if the row was already RELEASED (counts as released — capacity is free).
      await service.release({
        userId: row.userId,
        idempotencyKey: row.idempotencyKey,
        reason: "expired_reaper",
        now
      });
      results.released += 1;
    } catch (error) {
      const code = error?.code;
      // Legitimately used between scan and release — must NOT be released (double-free).
      if (code === "USAGE_RESERVATION_STATE_CONFLICT") {
        results.skippedCommitted += 1;
        continue;
      }
      if (code === "USAGE_RESERVATION_NOT_FOUND") {
        results.alreadyResolved += 1;
        continue;
      }
      results.errors += 1;
    }
  }

  return results;
}
