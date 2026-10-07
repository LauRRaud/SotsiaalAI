import { randomUUID } from 'node:crypto';
import { budgetLedgerId, digest, reject, reserveBudget } from './contracts.js';
import { livePilotRows, pilotExpired, pilotExpiry, earliestExpiry, conversationExpiry } from './lifetime.js';
import { acceptDialogue, dialogueEnabled, dialogueSummary, DIALOGUE_LIMITS } from './dialogue.js';
import { Prisma } from '../../../generated/prisma/client.ts';
import { packJson, openTurn, TURN_PARTS } from './packed-json.js';
import { historyRows } from './history.js';
import { leanPayload, LEAN_TURN } from './lean-turn.js';

// ADR-052 (Codex F7, 29.09.2026): a turn in progress orders its own conversation; the pilot runs a few turns at once. The
// budget stays safe without a global lock, since every stage's reservation is checked against the caps under the ledger
// lock. A turn with no write for staleMs lost its process (a provider call ends within 60 s): it is closed as abandoned,
// its reservation stays spent and nothing is sent again. An unknown or recoverable turn blocks no one.
export const PILOT_TURN_LIMITS = Object.freeze({ concurrent: 3, staleMs: 5 * 60000 });
// ADR-094, step 5: the purge ran first in every chat request, and its price grows with the table: with 200 000 live rows
// and nothing to delete one purge took 144 ms (median of ten, local trial of 06.10.2026). No request reads what it
// removes: every read leaves out the rows past their time and the conversations that are archived or past theirs. So
// a process purges at most once in this time; the retention run purges too.
export const PURGE_EVERY_MS = 60000;
let purgedAt = 0;
export { openTurn };

// ADR-094, step 4: what a write holds, by where it goes. The large parts (packed-json.js) go to their own columns, the
// packet packed (the size limit and every check read the packet before this, as the turn made it); the rest is the
// payload. `whole` is a write that replaces all a row holds (the lean form): a part it no longer has is cleared.
// Measured before this on 06.10.2026 (scripts/rag-v2-chat-volume.mjs): 18 writes of a turn's row put about 1 MB into
// the database's log for a row that keeps 13.6 KB.
function written(values, { whole = false } = {}) {
  const payload = { ...values }, parts = {};
  for (const key of TURN_PARTS) {
    if (payload[key] !== undefined && payload[key] !== null) parts[key] = key === 'packet' ? packJson(payload[key]) : payload[key];
    else if (whole) parts[key] = Prisma.DbNull;
    delete payload[key];
  }
  return { payload, parts };
}
const without = (payload, keys) => Object.fromEntries(Object.entries(payload).filter(([key]) => !keys.includes(key)));
// A read or a write's result without the large parts: what a step needs of the row it writes to.
const SMALL = Object.freeze({ omit: Object.freeze(Object.fromEntries(TURN_PARTS.map(key => [key, true]))) });

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
          chatTurn: { conversationId: input.convId, userId } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: DIALOGUE_LIMITS.conversationTurns + 1, ...SMALL });
        // ADR-094: the conversation's other turns (an earlier plan's, or ones whose audit row is gone) from their records.
        const recorded = await this.historyRows(tx, input.convId, history);
        contextAudit = acceptDialogue(config, input, [...history, ...recorded], conversation.metadata?.m4Dialogue, rowId);
        for (const source of history.filter(r => contextAudit.sourceTurnIds.includes(r.id))) expiresAt = earliestExpiry(expiresAt, source.expiresAt);
      }
      const turn = await tx.chatTurn.create({ data: { userId, conversationId: input.convId, clientTurnKey: input.clientTurnKey } });
      const previous = contextAudit ? null : await tx.m4PilotTurn.findFirst({ where: { state: 'completed', ...livePilotRows(), configHash: config.configHash,
        chatTurn: { conversationId: input.convId, userId } }, orderBy: { createdAt: 'desc' }, ...SMALL });
      const row = await tx.m4PilotTurn.create({ data: { id: rowId, chatTurnId: turn.id, pilotId: config.id, configHash: config.configHash,
        inputHash, state: 'claimed', expiresAt,
        payload: { question: input.question, contextMode: input.contextMode, previous: previous?.payload.question || '', events: [], mode: config.mode,
          ...(input.reasoning ? { reasoning: input.reasoning } : {}),
          ...(input.userRole ? { userRole: input.userRole } : {}),
          ...(contextAudit ? { context: contextAudit.context, contextAudit, inputLanguage: input.language || 'et' } : {}),
          tenant: config.tenant, userId, convId: input.convId, profile: config.profile, generationId: config.generationId } } });
      if (contextAudit) await tx.conversation.update({ where: { id: input.convId }, data: { metadata: { ...conversation.metadata,
        // The head names its topic and person too (ADR-094): a head that gets no answer has no record, and once its row
        // has expired this is what says which topic it went on in.
        m4Dialogue: { configHash: config.configHash, turnId: row.id, revision: contextAudit.context.revision,
          scopeId: contextAudit.context.scopeId, personId: contextAudit.context.personId } } } });
      return { row, fresh: true };
    });
  }
  // Turns of this plan left in progress by a lost process (ADR-052): a call that was sent may have been billed, so the turn
  // becomes unknown; one that sent nothing stops. The reservation stays in the ledger and no call is sent again.
  async closeAbandoned(tx, config) {
    const abandoned = await tx.m4PilotTurn.findMany({ where: { pilotId: config.id, state: { in: RUNNING_STATES },
      updatedAt: { lt: new Date(Date.now() - PILOT_TURN_LIMITS.staleMs) }, ...livePilotRows() }, ...SMALL });
    for (const row of abandoned) {
      const sent = row.payload.events.some(event => event.state === 'sent_unknown');
      await tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: sent ? 'unknown' : 'stopped',
        payload: { ...row.payload, error: 'turn_abandoned', abandoned: { state: row.state, lastWriteAt: row.updatedAt.toISOString() } } }, ...SMALL });
    }
  }
  // The plan's ledger. Another plan's ledger is used only by a plan that names it (a renewal of the approved plan).
  async ledger(tx, config) {
    const ledger = await tx.m4PilotLedger.findUnique({ where: { id: budgetLedgerId(config) } });
    if (ledger && ledger.configHash !== config.configHash && config.budgetLedger !== ledger.id) reject('ledger_plan_conflict', 409);
    return ledger;
  }
  // ADR-094: the conversation's turns the running plan has no row for, as the dialogue reads them from their records
  // (history.js). rows: the plan's own rows of the conversation; turnId narrows the read to one turn.
  async historyRows(tx, convId, rows, turnId = null) {
    const messages = await tx.conversationMessage.findMany({ where: { conversationId: convId, ...(turnId ? { metadata: { path: ['m4TurnId'], equals: turnId } } : {}) },
      orderBy: { createdAt: 'asc' }, take: 2 * DIALOGUE_LIMITS.conversationTurns + 2, select: { id: true, role: true, content: true, metadata: true, createdAt: true } });
    return historyRows(messages, new Set(rows.map(row => row.id)));
  }
  // The turn a continuing turn takes its earlier answer or state from: the plan's own completed row, else (ADR-094) the
  // turn's record, marked `history`.
  async dialogueSource(config, row, turnId) {
    return this.mutate(config, row, async tx => {
      const source = await tx.m4PilotTurn.findFirst({ where: { id: turnId, configHash: config.configHash, state: 'completed', ...livePilotRows(),
        chatTurn: { conversationId: row.payload.convId, userId: row.payload.userId } } })
        ?? (await this.historyRows(tx, row.payload.convId, [], turnId)).find(item => item.id === turnId && item.state === 'completed') ?? null;
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
      if (!exists) return dialogueSummary([], null); // The normal composer allocates an ID before its first send.
      const conv = await this.conversation(tx, userId, convId);
      const rows = await tx.m4PilotTurn.findMany({ where: { ...livePilotRows(), configHash: config.configHash,
        chatTurn: { conversationId: convId, userId } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: DIALOGUE_LIMITS.conversationTurns, ...SMALL });
      return dialogueSummary([...rows, ...await this.historyRows(tx, convId, rows)], conv.metadata?.m4Dialogue);
    });
  }
  // `current` is the row as stored, without its large parts unless the step asks for them (`whole`): a step spreads
  // the payload back and writes a part only when it has a new one, so what was written stays in place. A step's result
  // is the row without the parts too; the turn holds its own packet and vector while it runs.
  async mutate(config, row, fn, { whole = false } = {}) {
    return this.locked(config, async tx => {
      await this.conversation(tx, row.payload.userId, row.payload.convId);
      const current = await tx.m4PilotTurn.findUnique({ where: { id: row.id }, ...(whole ? {} : SMALL) });
      if (!current || pilotExpired(current.expiresAt)) reject('turn_expired', 410);
      return openTurn(await fn(tx, current));
    });
  }
  async save(config, row, state, values) {
    const next = written(values), named = Object.keys(next.parts);
    // A part named here leaves the payload of a row that held it there (a turn begun before the parts had columns).
    return this.mutate(config, row, (tx, current) => tx.m4PilotTurn.update({ where: { id: row.id }, data: { state,
      payload: { ...(named.length ? without(current.payload, named) : current.payload), ...next.payload }, ...next.parts,
      ...(values.queryReuse ? { expiresAt: earliestExpiry(current.expiresAt, values.queryReuse.sourceExpiresAt) } : {}) }, ...SMALL }));
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
        events: [...current.payload.events, { stage, state: 'reserved_not_sent', reservation, ...trace, reservedAt: new Date().toISOString() }] } }, ...SMALL });
    });
  }
  // A search-assist call that failed at the provider without usage: the turn goes on without it and
  // the conservative reservation stays in the ledger, so it is not an unknown (blocking) call.
  async failed(config, row, stage, code) {
    return this.mutate(config, row, async (tx, current) => {
      const events = current.payload.events.map(e => e.stage === stage && e.state === 'sent_unknown' ? { ...e, state: 'provider_failed', code, failedAt: new Date().toISOString() } : e);
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { payload: { ...current.payload, events } }, ...SMALL });
    });
  }
  async sent(config, row, stage) {
    return this.mutate(config, row, async (tx, current) => {
      if (current.state !== `${stage}_reserved`) reject('attempt_already_sent', 409);
      const events = current.payload.events.map(e => e.stage === stage ? { ...e, state: 'sent_unknown', sentAt: new Date().toISOString() } : e);
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: `${stage}_sent`, payload: { ...current.payload, events } }, ...SMALL });
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
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { payload: { ...current.payload, events, ...(result.audit ? { responseAudit: result.audit } : {}) } }, ...SMALL });
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
      // The conversation was active now: its place in the list and its retention time go by this. Its lifetime is the
      // published 90 days from here, not the plan's time for the audit row (lifetime.js).
      const lifetime = conversationExpiry(config, at);
      await tx.conversation.update({ where: { id: row.payload.convId }, data: { lastActivityAt: at, ...(lifetime ? { expiresAt: lifetime } : {}) } });
      await tx.chatTurn.update({ where: { id: row.chatTurnId }, data: { status: 'COMPLETED', userMessageId: user.id, assistantMessageId: assistant.id, endedAt: new Date() } });
      const published = { answer, previous: '', messageId: assistant.id, timings: { ...current.payload.timings, persistedBeforeCommitAt: new Date().toISOString() } };
      // ADR-093: a plan that keeps no full audit (auditDays 0) stores the turn lean at once. The answer and its references
      // were checked by the service before this call, so the lean form's proof is of a published turn.
      if (config.auditDays === 0) {
        const lean = written(leanPayload({ ...openTurn(current).payload, ...published, packet }), { whole: true });
        return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: 'completed', payload: lean.payload, ...lean.parts } });
      }
      // The full audit stays as the turn's steps wrote it: the packet, the request and the vector are not written again.
      // Only a row that has no packet yet gets the one it is published with.
      const stored = current.packet !== null && current.packet !== undefined || current.payload.packet !== undefined;
      return tx.m4PilotTurn.update({ where: { id: row.id }, data: { state: 'completed', payload: { ...current.payload, ...published }, ...(stored ? {} : written({ packet }).parts) } });
    }, { whole: true });
  }
  async cache(config, userId, questionHash, contextCacheKey = null) {
    // The user's turns that asked the same question, by its hash: the database compares, so the rows of other questions
    // (and their vectors) are not read.
    const rows = await this.db.m4PilotTurn.findMany({ where: { configHash: config.configHash, state: 'completed', ...livePilotRows(),
      payload: { path: ['query', 'hash'], equals: questionHash },
      chatTurn: { userId, conversation: { archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } }, orderBy: { createdAt: 'desc' }, take: 20,
    select: { payload: true, vector: true } });
    const found = rows.find(r => r.payload.query?.hash === questionHash && (contextCacheKey
      ? r.payload.query.cacheKey === contextCacheKey : !r.payload.query?.cacheKey));
    return found ? found.vector ?? found.payload.vector : undefined;
  }
  async reuse(config, userId, query) {
    const source = config.queryReuse;
    const entry = source?.entries.find(e => e.queryHash === query.hash);
    if (!entry || pilotExpired(source.expiresAt)) return null;
    const row = await this.db.m4PilotTurn.findFirst({ where: { id: entry.turnId, pilotId: source.pilotId, configHash: source.configHash,
      state: { in: ['completed', 'stopped', 'answer_rejected'] }, ...livePilotRows(),
      chatTurn: { userId, conversation: { archivedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } } }, omit: { packet: true, requestAudit: true } });
    const vector = row?.vector ?? row?.payload.vector;
    if (!row || row.payload.tenant !== config.tenant || row.payload.query?.hash !== query.hash || row.payload.query?.text !== query.text
      || row.payload.query?.version !== query.version || !vector) return null;
    const embedding = row.payload.events.find(e => e.stage === 'embedding' && e.state === 'response_received');
    const bodyHash = digest({ input: query.text, model: config.embedding.model, dimensions: config.embedding.dimensions, encoding_format: 'float' });
    if (embedding?.bodyHash !== bodyHash || entry.embeddingBodyHash !== bodyHash || digest(vector) !== entry.vectorHash) reject('query_reuse_integrity_failed', 403);
    return { vector, receipt: { pilotId: source.pilotId, configHash: source.configHash, turnId: row.id,
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
      const row = await this.db.m4PilotTurn.findUnique({ where: { id } }), whole = openTurn(row)?.payload;
      if (!row || row.state !== 'completed' || whole.lean?.version === LEAN_TURN || !whole.answer || !whole.packet) continue;
      const lean = written(leanPayload(whole, now), { whole: true });
      slimmed += (await this.db.m4PilotTurn.updateMany({ where: { id, state: 'completed', updatedAt: row.updatedAt }, data: { payload: lean.payload, ...lean.parts } })).count;
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
  /** The purge a chat request asks for: done when this process has not purged within PURGE_EVERY_MS. A purge that
   *  fails is tried again by the next request. */
  async purgeDue(now = Date.now()) {
    if (now - purgedAt < PURGE_EVERY_MS) return false;
    const before = purgedAt;
    purgedAt = now;
    try { await this.purge(); } catch (error) { purgedAt = before; throw error; }
    return true;
  }
  async purge() {
    // Remove raw payloads and cached vectors on expiry/archive; shared content-free costs remain.
    await this.db.m4PilotTurn.deleteMany({ where: { OR: [{ expiresAt: { lte: new Date() } }, { chatTurn: { conversation: { archivedAt: { not: null } } } },
      { chatTurn: { conversation: { expiresAt: { lte: new Date() } } } }] } });
  }
}
