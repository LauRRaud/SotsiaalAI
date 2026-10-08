import { getUsagePeriodRange } from './periods.js';

async function readCostSnapshot(db, userId, now) {
  const range = getUsagePeriodRange('MONTHLY', now, 'Europe/Tallinn');
  const where = { ...(userId ? { userId } : {}), createdAt: { gte: range.start, lt: range.end } };
  const [groups, recent] = await Promise.all([
    db.aiProviderCall.groupBy({ by: ['state', 'stage'], where,
      _sum: { billedNanoUsd: true, reservedNanoUsd: true }, _count: { _all: true } }),
    db.aiProviderCall.findMany({ where, orderBy: { createdAt: 'desc' }, take: 40,
      select: { id: true, turnId: true, stage: true, state: true, model: true, requestId: true, usage: true,
        billedNanoUsd: true, reservedNanoUsd: true, billedNanoEur: true, exchangeRateDate: true, usdPerEurMicros: true, createdAt: true } })
  ]);
  let billed = 0n, pending = 0n, calls = 0, unresolved = 0;
  for (const group of groups) {
    calls += group._count._all;
    billed += group._sum.billedNanoUsd ?? 0n;
    if (['reserved', 'sent', 'unknown'].includes(group.state)) {
      pending += group._sum.reservedNanoUsd ?? 0n;
      unresolved += group._count._all;
    }
  }
  return { currency: 'USD', basis: 'provider_usage_and_published_tariff', invoiceReconciled: false,
    periodStart: range.start.toISOString(), periodEnd: range.end.toISOString(), billedNanoUsd: billed.toString(),
    pendingNanoUsd: pending.toString(), calls, unresolved,
    recent: recent.map(row => ({ ...row, billedNanoUsd: row.billedNanoUsd?.toString() ?? null,
      reservedNanoUsd: row.reservedNanoUsd.toString(), billedNanoEur: row.billedNanoEur?.toString() ?? null,
      createdAt: row.createdAt.toISOString() })) };
}

export function getUserCostSnapshot(db, userId, now = new Date()) {
  if (typeof userId !== 'string' || !userId) throw new TypeError('userId required');
  return readCostSnapshot(db, userId, now);
}

export function getPlatformCostSnapshot(db, now = new Date()) { return readCostSnapshot(db, null, now); }
