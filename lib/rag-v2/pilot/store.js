import { randomUUID } from 'node:crypto';
import { digest, reject, reserveBudget } from './contracts.js';
import { livePilotRows, pilotExpired, pilotExpiry, earliestExpiry } from './lifetime.js';

export class PilotStore {
  constructor(db) { this.db = db; }
  async locked(config, fn) {
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m4/${config.id}`}, 0))`;
      return fn(tx);
    }, { timeout: 15000 });
  }
  async conversation(tx, userId, convId) {
    // Locks against both the existing archive endpoint and physical retention deletion.
    await tx.$queryRaw`SELECT id FROM "Conversation" WHERE id=${convId} FOR UPDATE`;
    const conv = await tx.conversation.findUnique({ where: { id: convId } });
    if (!conv || conv.userId !== userId || conv.archivedAt || conv.expiresAt && conv.expiresAt <= new Date() || conv.metadata?.m4 !== true) reject('conversation_unavailable', 403);
    return conv;
  }
  async existing(config, userId, input) {
    return this.locked(config, async tx => {
      await this.conversation(tx, userId, input.convId);
      const existing = await tx.chatTurn.findUnique({ where: { userId_clientTurnKey: { userId, clientTurnKey: input.clientTurnKey } }, include: { m4Pilot: true } });
      if (!existing) return null;
      if (!existing.m4Pilot || existing.m4Pilot.inputHash !== digest({ tenant: config.tenant, userId, ...input })
        || existing.m4Pilot.configHash !== config.configHash) reject('idempotency_conflict', 409);
      return existing.m4Pilot;
    });
  }
  async claim(config, userId, input) {
    return this.locked(config, async tx => {
      await this.conversation(tx, userId, input.convId);
      const inputHash = digest({ tenant: config.tenant, userId, ...input });
      const existing = await tx.chatTurn.findUnique({ where: { userId_clientTurnKey: { userId, clientTurnKey: input.clientTurnKey } }, include: { m4Pilot: true } });
      if (existing) {
        if (!existing.m4Pilot || existing.m4Pilot.inputHash !== inputHash || existing.m4Pilot.configHash !== config.configHash) reject('idempotency_conflict', 409);
        return { row: existing.m4Pilot, fresh: false };
      }
      const ledger = await tx.m4PilotLedger.findUnique({ where: { id: config.id } });
      if (ledger && ledger.configHash !== config.configHash) reject('ledger_plan_conflict', 409);
      if (ledger && (!Number.isSafeInteger(ledger.totals.embeddingAttempts) || !Number.isSafeInteger(ledger.totals.answerAttempts))) reject('ledger_stage_counters_missing', 409);
      if (ledger && ledger.totals.answerAttempts >= config.budget.answerAttempts) reject('pilot_stage_budget_exhausted', 429);
      const running = await tx.m4PilotTurn.count({ where: { pilotId: config.id, state: { in: ['claimed', 'embedding_reserved', 'answer_reserved', 'embedding_sent', 'answer_sent', 'needs_recovery', 'unknown'] }, ...livePilotRows() } });
      if (running) reject('pilot_busy_or_unknown', 429);
      const recent = await tx.chatTurn.count({ where: { userId, startedAt: { gt: new Date(Date.now() - 60000) }, m4Pilot: { isNot: null } } });
      if (recent >= 12) reject('pilot_rate_limit', 429);
      const turn = await tx.chatTurn.create({ data: { userId, conversationId: input.convId, clientTurnKey: input.clientTurnKey } });
      const previous = await tx.m4PilotTurn.findFirst({ where: { state: 'completed', ...livePilotRows(), configHash: config.configHash,
        chatTurn: { conversationId: input.convId, userId } }, orderBy: { createdAt: 'desc' } });
      const row = await tx.m4PilotTurn.create({ data: { id: randomUUID(), chatTurnId: turn.id, pilotId: config.id, configHash: config.configHash,
        inputHash, state: 'claimed', expiresAt: pilotExpiry(config),
        payload: { question: input.question, contextMode: input.contextMode, previous: previous?.payload.question || '', events: [], mode: config.mode,
          tenant: config.tenant, userId, convId: input.convId, profile: config.profile, generationId: config.generationId } } });
      return { row, fresh: true };
    });
  }
  async mutate(config, row, fn) {
    return this.locked(config, async tx => {
      await this.conversation(tx, row.payload.userId, row.payload.convId);
      const current = await tx.m4PilotTurn.findUnique({ where: { id: row.id } });
      if (!current || pilotExpired(current.expiresAt)) reject('turn_expired', 410);
      return fn(tx, current);
    });
  }
  async save(config, row, state, values) {
    return this.mutate(config, row, (tx, current) => tx.m4PilotTurn.update({ where: { id: row.id }, data: { state, payload: { ...current.payload, ...values },
      ...(values.queryReuse ? { expiresAt: earliestExpiry(current.expiresAt, values.queryReuse.sourceExpiresAt) } : {}) } }));
  }
  async reserve(config, row, stage, reservation, trace) {
    return this.mutate(config, row, async (tx, current) => {
      if (current.payload.events.some(e => e.stage === stage)) reject('attempt_already_reserved', 409);
      const ledger = await tx.m4PilotLedger.findUnique({ where: { id: config.id } });
      if (ledger && ledger.configHash !== config.configHash) reject('ledger_plan_conflict', 409);
      if (!['embedding', 'answer'].includes(stage)) reject('invalid_attempt_stage');
      const stageCap = config.budget?.[stage === 'embedding' ? 'embeddingAttempts' : 'answerAttempts'];
      if (!Number.isSafeInteger(stageCap) || stageCap < 0) reject('stage_budget_not_configured', 503);
      // Old aggregate-only ledgers cannot silently acquire zero stage counters.
      if (ledger && (!Number.isSafeInteger(ledger.totals.embeddingAttempts) || !Number.isSafeInteger(ledger.totals.answerAttempts))) reject('ledger_stage_counters_missing', 409);
      const totals = reserveBudget(ledger?.totals || { attempts: 0, tokens: 0, nanoUsd: 0 }, reservation, config.budget);
      totals.embeddingAttempts = (ledger?.totals.embeddingAttempts || 0) + (stage === 'embedding' ? 1 : 0);
      totals.answerAttempts = (ledger?.totals.answerAttempts || 0) + (stage === 'answer' ? 1 : 0);
      if (totals[stage === 'embedding' ? 'embeddingAttempts' : 'answerAttempts'] > stageCap) reject('pilot_stage_budget_exhausted', 429);
      await tx.m4PilotLedger.upsert({ where: { id: config.id }, create: { id: config.id, configHash: config.configHash, totals }, update: { totals } });
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: `${stage}_reserved`, payload: { ...current.payload,
        events: [...current.payload.events, { stage, state: 'reserved_not_sent', reservation, ...trace, reservedAt: new Date().toISOString() }] } } });
    });
  }
  async sent(config, row, stage) {
    return this.mutate(config, row, async (tx, current) => {
      if (current.state !== `${stage}_reserved`) reject('attempt_already_sent', 409);
      const events = current.payload.events.map(e => e.stage === stage ? { ...e, state: 'sent_unknown', sentAt: new Date().toISOString() } : e);
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: `${stage}_sent`, payload: { ...current.payload, events } } });
    });
  }
  async usage(config, row, stage, result) {
    return this.mutate(config, row, async (tx, current) => {
      const unitPrice = stage === 'embedding' ? config.prices?.embeddingInput : config.prices?.answerInput;
      const estimatedNanoUsd = config.mode === 'test' ? 0 : result.usage.input * unitPrice + result.usage.output * (config.prices?.answerOutput || 0);
      const events = current.payload.events.map(e => e.stage === stage ? { ...e, state: 'response_received', usage: result.usage,
        estimatedNanoUsd, estimateUsesConservativeInputRate: true, requestId: result.requestId, timings: result.timings || null } : e);
      const reservation = current.payload.events.find(e => e.stage === stage)?.reservation;
      if (reservation && (result.usage.input + result.usage.output > reservation.tokens || estimatedNanoUsd > reservation.nanoUsd)) {
        const ledger = await tx.m4PilotLedger.findUnique({ where: { id: config.id } });
        await tx.m4PilotLedger.update({ where: { id: config.id }, data: { totals: { ...ledger.totals,
          tokens: ledger.totals.tokens + Math.max(0, result.usage.input + result.usage.output - reservation.tokens),
          nanoUsd: ledger.totals.nanoUsd + Math.max(0, estimatedNanoUsd - reservation.nanoUsd) } } });
      }
      // Keep conservative reservations: actual usage is separately recorded; no automatic refund can overspend.
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { payload: { ...current.payload, events, ...(result.audit ? { responseAudit: result.audit } : {}) } } });
    });
  }
  async publish(config, row, answer, packet) {
    return this.mutate(config, row, async (tx, current) => {
      if (current.state === 'completed') return current;
      const user = await tx.conversationMessage.create({ data: { conversationId: row.payload.convId, authorId: row.payload.userId, role: 'USER',
        content: '[Kaitstud M4 sisepiloodi küsimus]', metadata: { m4TurnId: row.id } } });
      const assistant = await tx.conversationMessage.create({ data: { conversationId: row.payload.convId, role: 'ASSISTANT',
        content: '[Kaitstud M4 sisepiloodi vastus]', metadata: { m4TurnId: row.id } } });
      await tx.chatTurn.update({ where: { id: row.chatTurnId }, data: { status: 'COMPLETED', userMessageId: user.id, assistantMessageId: assistant.id, endedAt: new Date() } });
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: 'completed', payload: { ...current.payload, answer, packet, previous: '', messageId: assistant.id,
        timings: { ...current.payload.timings, persistedBeforeCommitAt: new Date().toISOString() } } } });
    });
  }
  async cache(config, userId, questionHash) {
    const rows = await this.db.m4PilotTurn.findMany({ where: { configHash: config.configHash, state: 'completed', ...livePilotRows(),
      chatTurn: { userId, conversation: { archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.find(r => r.payload.query?.hash === questionHash)?.payload.vector;
  }
  async reuse(config, userId, query) {
    const source = config.queryReuse;
    const entry = source?.entries.find(e => e.queryHash === query.hash);
    if (!entry || pilotExpired(source.expiresAt)) return null;
    const row = await this.db.m4PilotTurn.findFirst({ where: { id: entry.turnId, pilotId: source.pilotId, configHash: source.configHash,
      state: { in: ['completed', 'stopped', 'answer_rejected'] }, ...livePilotRows(),
      chatTurn: { userId, conversation: { archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } } });
    if (!row || row.payload.tenant !== config.tenant || row.payload.query?.hash !== query.hash || row.payload.query?.text !== query.text
      || row.payload.query?.version !== query.version || !row.payload.vector) return null;
    const embedding = row.payload.events.find(e => e.stage === 'embedding' && e.state === 'response_received');
    const bodyHash = digest({ input: query.text, model: config.embedding.model, dimensions: config.embedding.dimensions, encoding_format: 'float' });
    if (embedding?.bodyHash !== bodyHash || entry.embeddingBodyHash !== bodyHash || digest(row.payload.vector) !== entry.vectorHash) reject('query_reuse_integrity_failed', 403);
    return { vector: row.payload.vector, receipt: { pilotId: source.pilotId, configHash: source.configHash, turnId: row.id,
      queryHash: query.hash, vectorHash: entry.vectorHash, embeddingBodyHash: bodyHash, sourceExpiresAt: row.expiresAt?.toISOString() || null } };
  }
  async purge() {
    // Remove raw payloads and cached vectors on expiry/archive; shared content-free costs remain.
    await this.db.m4PilotTurn.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { chatTurn: { conversation: { archivedAt: { not: null } } } },
      { chatTurn: { conversation: { expiresAt: { lte: new Date() } } } }] } });
  }
}
