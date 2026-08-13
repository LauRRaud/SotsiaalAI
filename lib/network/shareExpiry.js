import prisma from "@/lib/prisma";
import { recordNetworkShareLifecycle } from "@/lib/network/shareLifecycle";

const EXPIRABLE_STATUSES = Object.freeze([
  "DRAFT",
  "AWAITING_CLIENT",
  "CONFIRMED",
  "SENT",
  "OPENED",
  "RESPONDED"
]);

function utcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Lõpetab tähtaja ületanud jagamised ja nende ruumipääsu. Iga jagamine on oma
 * tehing: ühe vigase rea tõrge ei jäta teisi töötlemata ning kukkunud rida jääb
 * järgmise sweep'i jaoks samasse elavasse olekusse.
 */
export async function endExpiredNetworkShares({
  db = prisma,
  now = new Date(),
  batchSize = 100,
  dryRun = false,
  shareIds = null
} = {}) {
  const today = utcDay(now);
  const take = Math.max(1, Math.min(Number(batchSize) || 100, 500));
  const due = await db.networkShare.findMany({
    where: {
      ...(Array.isArray(shareIds) ? { id: { in: shareIds.map(String) } } : {}),
      status: { in: EXPIRABLE_STATUSES },
      participationEndsOn: { lt: today }
    },
    select: { id: true, roomId: true },
    orderBy: { id: "asc" },
    take
  });
  const result = { considered: due.length, ended: 0, accessRevoked: 0, failed: 0 };
  if (dryRun) return { ...result, dryRun: true };

  for (const share of due) {
    try {
      const applied = await db.$transaction(async (tx) => {
        const ended = await tx.networkShare.updateMany({
          where: {
            id: share.id,
            status: { in: EXPIRABLE_STATUSES },
            participationEndsOn: { lt: today }
          },
          data: { status: "ENDED", updatedAt: now }
        });
        if (ended.count !== 1) return { ended: 0, accessRevoked: 0 };
        if (tx.domainEvent?.create && tx.dataAuditLog?.create) {
          const endedShare = await tx.networkShare.findFirst({ where: { id: share.id } });
          await recordNetworkShareLifecycle({
            db: tx,
            share: endedShare,
            actorKind: "job",
            actionCode: "END",
            fromStatus: "ACTIVE",
            mutationKey: `expiry:${today.toISOString().slice(0, 10)}`,
            now
          });
        }
        if (!share.roomId) return { ended: 1, accessRevoked: 0 };
        const revoked = await tx.roomMember.updateMany({
          where: { roomId: share.roomId, leftAt: null },
          data: { leftAt: now }
        });
        await tx.room.updateMany({
          where: { id: share.roomId, archivedAt: null },
          data: { archivedAt: now }
        });
        return { ended: 1, accessRevoked: Number(revoked.count || 0) };
      });
      result.ended += applied.ended;
      result.accessRevoked += applied.accessRevoked;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

export const networkShareExpiryInternals = Object.freeze({ EXPIRABLE_STATUSES, utcDay });
