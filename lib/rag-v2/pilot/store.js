import { randomUUID } from 'node:crypto';
import { budgetLedgerId, digest, reject, reserveBudget } from './contracts.js';
import { livePilotRows, pilotExpired, pilotExpiry, earliestExpiry } from './lifetime.js';
import { acceptDialogue, dialogueEnabled, dialogueSummary, DIALOGUE_LIMITS } from './dialogue.js';
import { isPackedJson, packJson, unpackJson } from './packed-json.js';
import { leanPayload, LEAN_TURN } from './lean-turn.js';

// ADR-052 (Codex F7, 29.09.2026): a turn in progress orders its own conversation; the pilot runs a few turns at once. The
// budget stays safe without a global lock, since every stage's reservation is checked against the caps under the ledger
// lock. A turn with no write for staleMs lost its process (a provider call ends within 60 s): it is closed as abandoned,
// its reservation stays spent and nothing is sent again. An unknown or recoverable turn blocks no one.
export const PILOT_TURN_LIMITS = Object.freeze({ concurrent: 3, staleMs: 5 * 60000 });
/** A turn's row with its audit packet as the turn made it. A packet is stored packed (packed-json.js: each repeated
 *  part once; ADR-089); every row that leaves the store, and every row read beside it, goes through this before its
 *  packet is read. A row whose packet was stored as it is (every turn before 06.10.2026), and a row without one, pass
 *  unchanged. */
export const openTurn = row => (row && isPackedJson(row.payload?.packet) ? { ...row, payload: { ...row.payload, packet: unpackJson(row.payload.packet) } } : row);

// What a step writes: its packet packed. The size limit and every check read the packet before this, as the turn made it.
const packedValues = values => (values.packet ? { ...values, packet: packJson(values.packet) } : values);

const RUNNING_STATES = ['claimed', 'plan_reserved', 'plan_sent', 'embedding_reserved', 'embedding_sent', 'rerank_reserved', 'rerank_sent',
  'answer_reserved', 'answer_sent'];

export class PilotStore {
  constructor(db) { this.db = db; }
  async locked(config, fn) {
    return this.db.$transaction(async tx => {
      // Plans that share a ledger (renewals) serialize on it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`m4/${budgetLedgerId(config)}`}, 0))`;
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
      return openTurn(existing.m4Pilot);
    });
  }
  async claim(config, userId, input) {
    return this.locked(config, async tx => {
      const conversation = await this.conversation(tx, userId, input.convId);
      const inputHash = digest({ tenant: config.tenant, userId, ...input });
      const existing = await tx.chatTurn.findUnique({ where: { userId_clientTurnKey: { userId, clientTurnKey: input.clientTurnKey } }, include: { m4Pilot: true } });
      if (existing) {
        if (!existing.m4Pilot || existing.m4Pilot.inputHash !== inputHash || existing.m4Pilot.configHash !== config.configHash) reject('idempotency_conflict', 409);
        return { row: openTurn(existing.m4Pilot), fresh: false };
      }
      const ledger = await this.ledger(tx, config);
      if (ledger && (!Number.isSafeInteger(ledger.totals.embeddingAttempts) || !Number.isSafeInteger(ledger.totals.answerAttempts))) reject('ledger_stage_counters_missing', 409);
      if (ledger && ledger.totals.answerAttempts >= config.budget.answerAttempts) reject('pilot_stage_budget_exhausted', 429);
      await this.closeAbandoned(tx, config);
      const active = { pilotId: config.id, state: { in: RUNNING_STATES }, ...livePilotRows() };
      if (await tx.m4PilotTurn.count({ where: { ...active, chatTurn: { conversationId: input.convId } } })) reject('conversation_busy', 429);
      // Codex J4: a validated answer awaiting publication keeps its conversation's order (the service publishes it first,
      // without a model call). It blocks only its own conversation, not the pilot. A turn of an earlier plan is not
      // recoverable under this one (access) and not in this plan's context, so only this plan's turns count.
      if (await tx.m4PilotTurn.count({ where: { configHash: config.configHash, state: 'needs_recovery', ...livePilotRows(),
        chatTurn: { conversationId: input.convId } } })) reject('conversation_recovery_pending', 409);
      if (await tx.m4PilotTurn.count({ where: active }) >= PILOT_TURN_LIMITS.concurrent) reject('pilot_busy', 429);
      const recent = await tx.chatTurn.count({ where: { userId, startedAt: { gt: new Date(Date.now() - 60000) }, m4Pilot: { isNot: null } } });
      if (recent >= 12) reject('pilot_rate_limit', 429);
      const rowId = randomUUID();
      let contextAudit = null, expiresAt = pilotExpiry(config);
      if (dialogueEnabled(config)) {
        const history = await tx.m4PilotTurn.findMany({ where: { ...livePilotRows(), configHash: config.configHash,
          chatTurn: { conversationId: input.convId, userId } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: DIALOGUE_LIMITS.conversationTurns + 1 });
        contextAudit = acceptDialogue(config, input, history, conversation.metadata?.m4Dialogue, rowId);
        for (const source of history.filter(r => contextAudit.sourceTurnIds.includes(r.id))) expiresAt = earliestExpiry(expiresAt, source.expiresAt);
      }
      const turn = await tx.chatTurn.create({ data: { userId, conversationId: input.convId, clientTurnKey: input.clientTurnKey } });
      const previous = contextAudit ? null : await tx.m4PilotTurn.findFirst({ where: { state: 'completed', ...livePilotRows(), configHash: config.configHash,
        chatTurn: { conversationId: input.convId, userId } }, orderBy: { createdAt: 'desc' } });
      const row = await tx.m4PilotTurn.create({ data: { id: rowId, chatTurnId: turn.id, pilotId: config.id, configHash: config.configHash,
        inputHash, state: 'claimed', expiresAt,
        payload: { question: input.question, contextMode: input.contextMode, previous: previous?.payload.question || '', events: [], mode: config.mode,
          ...(input.reasoning ? { reasoning: input.reasoning } : {}),
          ...(contextAudit ? { context: contextAudit.context, contextAudit, inputLanguage: input.language || 'et' } : {}),
          tenant: config.tenant, userId, convId: input.convId, profile: config.profile, generationId: config.generationId } } });
      if (contextAudit) await tx.conversation.update({ where: { id: input.convId }, data: { metadata: { ...conversation.metadata,
        m4Dialogue: { configHash: config.configHash, turnId: row.id, revision: contextAudit.context.revision } } } });
      return { row, fresh: true };
    });
  }
  // Turns of this plan left in progress by a lost process (ADR-052): a call that was sent may have been billed, so the turn
  // becomes unknown; one that sent nothing stops. The reservation stays in the ledger and no call is sent again.
  async closeAbandoned(tx, config) {
    const abandoned = await tx.m4PilotTurn.findMany({ where: { pilotId: config.id, state: { in: RUNNING_STATES },
      updatedAt: { lt: new Date(Date.now() - PILOT_TURN_LIMITS.staleMs) }, ...livePilotRows() } });
    for (const row of abandoned) {
      const sent = row.payload.events.some(event => event.state === 'sent_unknown');
      await tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: sent ? 'unknown' : 'stopped',
        payload: { ...row.payload, error: 'turn_abandoned', abandoned: { state: row.state, lastWriteAt: row.updatedAt.toISOString() } } } });
    }
  }
  // The plan's ledger. Another plan's ledger is used only by a plan that names it (a renewal of the approved plan).
  async ledger(tx, config) {
    const ledger = await tx.m4PilotLedger.findUnique({ where: { id: budgetLedgerId(config) } });
    if (ledger && ledger.configHash !== config.configHash && config.budgetLedger !== ledger.id) reject('ledger_plan_conflict', 409);
    return ledger;
  }
  async dialogueSource(config, row, turnId) {
    return this.mutate(config, row, async tx => {
      const source = await tx.m4PilotTurn.findFirst({ where: { id: turnId, configHash: config.configHash, state: 'completed', ...livePilotRows(),
        chatTurn: { conversationId: row.payload.convId, userId: row.payload.userId } } });
      // The topic's own turn, or the answer or state the full topic it continues handed over (ADR-070).
      const carry = row.payload.contextAudit?.selection.carried;
      const handed = carry && source?.payload.context?.scopeId === carry.scopeId && [carry.stateTurnId, carry.assistantTurnId].includes(turnId);
      if (!source || source.payload.context?.scopeId !== row.payload.context?.scopeId && !handed) reject('context_reference_unavailable', 403);
      return source;
    });
  }
  async contextSummary(config, userId, convId) {
    return this.locked(config, async tx => {
      const exists = await tx.conversation.findUnique({ where: { id: convId }, select: { id: true } });
      if (!exists) return dialogueSummary([], null, config); // The normal composer allocates an ID before its first send.
      const conv = await this.conversation(tx, userId, convId);
      const rows = await tx.m4PilotTurn.findMany({ where: { ...livePilotRows(), configHash: config.configHash,
        chatTurn: { conversationId: convId, userId } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: DIALOGUE_LIMITS.conversationTurns });
      return dialogueSummary(rows, conv.metadata?.m4Dialogue, config);
    });
  }
  async mutate(config, row, fn) {
    return this.locked(config, async tx => {
      await this.conversation(tx, row.payload.userId, row.payload.convId);
      const current = await tx.m4PilotTurn.findUnique({ where: { id: row.id } });
      if (!current || pilotExpired(current.expiresAt)) reject('turn_expired', 410);
      // `current` is the row as stored: a step spreads its payload back and never reads its packet.
      return openTurn(await fn(tx, current));
    });
  }
  async save(config, row, state, values) {
    return this.mutate(config, row, (tx, current) => tx.m4PilotTurn.update({ where: { id: row.id }, data: { state, payload: { ...current.payload, ...packedValues(values) },
      ...(values.queryReuse ? { expiresAt: earliestExpiry(current.expiresAt, values.queryReuse.sourceExpiresAt) } : {}) } }));
  }
  async reserve(config, row, stage, reservation, trace) {
    return this.mutate(config, row, async (tx, current) => {
      if (current.payload.events.some(e => e.stage === stage)) reject('attempt_already_reserved', 409);
      const ledger = await this.ledger(tx, config);
      if (!['embedding', 'answer', 'plan', 'rerank'].includes(stage)) reject('invalid_attempt_stage');
      // The search assist's query plan and evidence selection are model calls: at most two of each per
      // answer attempt, so failed turns cannot exhaust them before the answers.
      const stageCap = stage === 'embedding' ? config.budget?.embeddingAttempts : stage === 'answer' ? config.budget?.answerAttempts : config.budget?.answerAttempts * 2;
      if (!Number.isSafeInteger(stageCap) || stageCap < 0) reject('stage_budget_not_configured', 503);
      // Old aggregate-only ledgers cannot silently acquire zero stage counters.
      if (ledger && (!Number.isSafeInteger(ledger.totals.embeddingAttempts) || !Number.isSafeInteger(ledger.totals.answerAttempts))) reject('ledger_stage_counters_missing', 409);
      const totals = reserveBudget(ledger?.totals || { attempts: 0, tokens: 0, nanoUsd: 0 }, reservation, config.budget);
      totals.embeddingAttempts = (ledger?.totals.embeddingAttempts || 0) + (stage === 'embedding' ? 1 : 0);
      totals.answerAttempts = (ledger?.totals.answerAttempts || 0) + (stage === 'answer' ? 1 : 0);
      for (const assist of ['plan', 'rerank']) totals[`${assist}Attempts`] = (ledger?.totals[`${assist}Attempts`] || 0) + (stage === assist ? 1 : 0);
      const counter = { embedding: 'embeddingAttempts', answer: 'answerAttempts', plan: 'planAttempts', rerank: 'rerankAttempts' }[stage];
      if (totals[counter] > stageCap) reject('pilot_stage_budget_exhausted', 429);
      await tx.m4PilotLedger.upsert({ where: { id: budgetLedgerId(config) }, create: { id: budgetLedgerId(config), configHash: config.configHash, totals }, update: { totals } });
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: `${stage}_reserved`, payload: { ...current.payload,
        events: [...current.payload.events, { stage, state: 'reserved_not_sent', reservation, ...trace, reservedAt: new Date().toISOString() }] } } });
    });
  }
  // A search-assist call that failed at the provider without usage: the turn goes on without it and
  // the conservative reservation stays in the ledger, so it is not an unknown (blocking) call.
  async failed(config, row, stage, code) {
    return this.mutate(config, row, async (tx, current) => {
      const events = current.payload.events.map(e => e.stage === stage && e.state === 'sent_unknown' ? { ...e, state: 'provider_failed', code, failedAt: new Date().toISOString() } : e);
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { payload: { ...current.payload, events } } });
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
        const ledger = await this.ledger(tx, config);
        await tx.m4PilotLedger.update({ where: { id: budgetLedgerId(config) }, data: { totals: { ...ledger.totals,
          tokens: ledger.totals.tokens + Math.max(0, result.usage.input + result.usage.output - reservation.tokens),
          nanoUsd: ledger.totals.nanoUsd + Math.max(0, estimatedNanoUsd - reservation.nanoUsd) } } });
      }
      // Keep conservative reservations: actual usage is separately recorded; no automatic refund can overspend.
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { payload: { ...current.payload, events, ...(result.audit ? { responseAudit: result.audit } : {}) } } });
    });
  }
  // This plan's validated answers of a conversation that wait for publication, oldest first (Codex J4).
  async pendingRecovery(config, userId, convId) {
    return (await this.db.m4PilotTurn.findMany({ where: { configHash: config.configHash, state: 'needs_recovery', ...livePilotRows(),
      chatTurn: { conversationId: convId, userId } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map(openTurn);
  }
  // `history` (ADR-094): the turn's durable record as its two messages. Without it (an earlier caller) the messages are
  // the placeholders the pilot began with.
  async publish(config, row, answer, packet, history = null) {
    return this.mutate(config, row, async (tx, current) => {
      if (current.state === 'completed') return current;
      // A late answer never lands after a younger turn of its conversation that is already published (Codex J4).
      if (await tx.m4PilotTurn.count({ where: { configHash: current.configHash, state: 'completed', createdAt: { gt: current.createdAt },
        chatTurn: { conversationId: row.payload.convId } } })) reject('turn_superseded', 409);
      // Both messages are written in one transaction; the answer is dated a millisecond after its question, so every
      // reader that orders a conversation by time (the list's preview, the export) has the question first.
      const at = new Date();
      const user = await tx.conversationMessage.create({ data: { conversationId: row.payload.convId, authorId: row.payload.userId, role: 'USER', createdAt: at,
        content: history?.user.content ?? '[Kaitstud M4 sisepiloodi küsimus]', metadata: history?.user.metadata ?? { m4TurnId: row.id } } });
      const assistant = await tx.conversationMessage.create({ data: { conversationId: row.payload.convId, role: 'ASSISTANT', createdAt: new Date(at.getTime() + 1),
        content: history?.assistant.content ?? '[Kaitstud M4 sisepiloodi vastus]', metadata: history?.assistant.metadata ?? { m4TurnId: row.id } } });
      // The conversation was active now: its place in the list and its retention time go by this.
      await tx.conversation.update({ where: { id: row.payload.convId }, data: { lastActivityAt: at } });
      await tx.chatTurn.update({ where: { id: row.chatTurnId }, data: { status: 'COMPLETED', userMessageId: user.id, assistantMessageId: assistant.id, endedAt: new Date() } });
      const payload = { ...current.payload, answer, packet, previous: '', messageId: assistant.id,
        timings: { ...current.payload.timings, persistedBeforeCommitAt: new Date().toISOString() } };
      // ADR-093: a plan that keeps no full audit (auditDays 0) stores the turn lean at once. The answer and its references
      // were checked by the service before this call, so the lean form's proof is of a published turn.
      const kept = config.auditDays === 0 ? leanPayload(payload) : payload;
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: 'completed', payload: { ...kept, packet: packJson(kept.packet) } } });
    });
  }
  async cache(config, userId, questionHash, contextCacheKey = null) {
    const rows = await this.db.m4PilotTurn.findMany({ where: { configHash: config.configHash, state: 'completed', ...livePilotRows(),
      chatTurn: { userId, conversation: { archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.find(r => r.payload.query?.hash === questionHash && (contextCacheKey
      ? r.payload.query.cacheKey === contextCacheKey : !r.payload.query?.cacheKey))?.payload.vector;
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
  // ADR-093: completed turns older than `days` let their full audit go. A turn was proved when it was published; the lean
  // form keeps what the chat reads and the hashes of the rest. A few rows a call, oldest first, so a backlog never holds
  // the caller; a row that changed between the read and the write is left for the next call. With 0 days (a plan that
  // publishes lean) every whole turn is due: the ones an earlier plan left.
  async slimOld(days, options = {}) { return (await this.slimBatch(days, options)).slimmed; }
  // One batch: how many rows were due and how many of them were made lean. `after` is a time up to which every
  // completed turn is known to be lean already, so those rows are not read again.
  async slimBatch(days, { limit = 20, now = new Date(), after = null } = {}) {
    if (!Number.isInteger(days) || days < 0) return { due: 0, slimmed: 0 };
    const before = new Date(now.getTime() - days * 86400000), from = after instanceof Date ? after : new Date(0);
    const due = await this.db.$queryRaw`SELECT id FROM "M4PilotTurn" WHERE state = 'completed' AND "createdAt" >= ${from} AND "createdAt" < ${before}
      AND NOT jsonb_exists(payload, 'lean') ORDER BY "createdAt" ASC LIMIT ${limit}`;
    let slimmed = 0;
    for (const { id } of due) {
      const row = await this.db.m4PilotTurn.findUnique({ where: { id } });
      if (!row || row.state !== 'completed' || row.payload.lean?.version === LEAN_TURN || !row.payload.answer || !row.payload.packet) continue;
      const lean = leanPayload(openTurn(row).payload, now);
      slimmed += (await this.db.m4PilotTurn.updateMany({ where: { id, state: 'completed', updatedAt: row.updatedAt }, data: { payload: { ...lean, packet: packJson(lean.packet) } } })).count;
    }
    return { due: due.length, slimmed };
  }
  // A retention run's sweep: batch after batch until nothing is due or the time is used (Codex, 06.10.2026: one batch
  // of 200 every six hours is 800 rows a day, whatever the arrivals). `more` says due rows are left for the next run;
  // `clean` is the time up to which every completed turn is now lean (the next run's `after`). A batch that makes no
  // row lean ends the run, so a row that cannot be made lean never holds it in a loop.
  async slimDue(days, { budgetMs = 60000, batch = 50, now = new Date(), after = null } = {}) {
    const started = Date.now(), unchanged = { slimmed: 0, more: false, clean: after };
    if (!Number.isInteger(days) || days < 0) return unchanged;
    let slimmed = 0;
    for (;;) {
      const done = await this.slimBatch(days, { limit: batch, now, after });
      slimmed += done.slimmed;
      if (done.due < batch) return { slimmed, more: done.slimmed < done.due, clean: done.slimmed < done.due ? after : new Date(now.getTime() - days * 86400000) };
      if (!done.slimmed || Date.now() - started >= budgetMs) return { slimmed, more: true, clean: after };
    }
  }
  async purge() {
    // Remove raw payloads and cached vectors on expiry/archive; shared content-free costs remain.
    await this.db.m4PilotTurn.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { chatTurn: { conversation: { archivedAt: { not: null } } } },
      { chatTurn: { conversation: { expiresAt: { lte: new Date() } } } }] } });
  }
}
