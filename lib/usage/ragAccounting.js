import { createUsageService } from './service.js';
import { nanoUsdToEur } from './exchangeRate.js';
import { priceProviderUsage } from '../rag-v2/pilot/cost.js';

export const AI_COST_METRIC = 'AI_COST_NANO_EUR';
const callId = (row, stage) => `${row.id}:${stage}`;

// Product adapter: the RAG core does not know subscriptions, roles or EUR budgets.
export function createRagAccounting(db, exchangeRate) {
  const usage = createUsageService({ prismaClient: db });
  return {
    async reserve(tx, config, row, stage, reservation) {
      if (config.mode !== 'real') return;
      const id = callId(row, stage), reservationKey = `rag-cost:${id}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`ai-cost/${row.payload.userId}`}, 0))`;
      const euros = nanoUsdToEur(reservation.nanoUsd, exchangeRate);
      await usage.reserve({ tx, userId: row.payload.userId, metric: AI_COST_METRIC,
        amount: euros, idempotencyKey: reservationKey,
        // Monetary uncertainty does not expire like an unused feature reservation.
        expiresAt: null, metadata: { scope: 'rag-provider-cost', turnId: row.id, stage, currency: 'EUR' } });
      await tx.aiProviderCall.create({ data: { id, userId: row.payload.userId, turnId: row.id,
        projectId: config.accountProject, stage, model: stage === 'embedding' ? config.embedding.model : config.model,
        reservationKey, reservedNanoUsd: BigInt(reservation.nanoUsd), reservedNanoEur: euros,
        usdPerEurMicros: exchangeRate.usdPerEurMicros, exchangeRateDate: exchangeRate.date } });
    },
    async sent(tx, config, row, stage) {
      if (config.mode !== 'real') return;
      const changed = await tx.aiProviderCall.updateMany({ where: { id: callId(row, stage), state: 'reserved' }, data: { state: 'sent' } });
      if (changed.count !== 1) throw Object.assign(new Error('cost_reservation_not_active'), { code: 'cost_reservation_not_active', status: 409 });
    },
    async settle(config, row, stage, result) {
      if (config.mode !== 'real') return;
      // Independent of session/conversation lifetime; serialize duplicate receipts before crediting any reserve.
      return db.$transaction(async tx => {
        const id = callId(row, stage);
        await tx.$queryRaw`SELECT id FROM "AiProviderCall" WHERE id=${id} FOR UPDATE`;
        const receipt = await tx.aiProviderCall.findUnique({ where: { id } });
        if (!receipt || receipt.state === 'settled') return;
        const cost = priceProviderUsage({ stage, usage: result.usage, billing: result.billing,
          model: config.model, embeddingModel: config.embedding.model, mode: config.mode });
        const known = cost.status === 'priced';
        const euros = known ? nanoUsdToEur(cost.nanoUsd, receipt) : null;
        if (known && receipt.userId) {
          await usage.commit({ tx, userId: receipt.userId, idempotencyKey: receipt.reservationKey,
            actualAmount: euros, allowOverLimit: true, metadata: { nanoUsd: String(cost.nanoUsd), currency: 'USD', rateVersion: cost.rateVersion,
              exchangeRateDate: receipt.exchangeRateDate, usdPerEurMicros: receipt.usdPerEurMicros } });
        }
        await tx.aiProviderCall.update({ where: { id }, data: {
          state: known ? 'settled' : 'unknown', requestId: result.requestId || undefined,
          responseId: result.billing?.responseId || undefined, usage: result.usage || undefined, pricing: cost,
          ...(known ? { billedNanoUsd: BigInt(cost.nanoUsd), billedNanoEur: euros } : {}) } });
      });
    },
    async stop(tx, config, row) {
      if (config.mode !== 'real') return;
      // Only a never-sent call is free. Sent/unknown receipts remain reserved even after deletion or timeout.
      const unsent = await tx.aiProviderCall.findMany({ where: { turnId: row.id, state: 'reserved' } });
      for (const receipt of unsent) {
        const changed = await tx.aiProviderCall.updateMany({ where: { id: receipt.id, state: 'reserved' }, data: { state: 'not_sent', billedNanoUsd: 0n, billedNanoEur: 0n } });
        if (!changed.count) continue;
        if (receipt.userId) await usage.release({ tx, userId: receipt.userId, idempotencyKey: receipt.reservationKey, reason: 'not_sent' });
      }
    },
    async sweepUnsent(userId, now = new Date()) {
      const rows = await db.aiProviderCall.findMany({ where: { userId, state: 'reserved', createdAt: { lt: new Date(now - 5 * 60000) } }, take: 50,
        select: { turnId: true } });
      for (const row of rows) await db.$transaction(tx => this.stop(tx, { mode: 'real' }, { id: row.turnId }));
    },
  };
}
