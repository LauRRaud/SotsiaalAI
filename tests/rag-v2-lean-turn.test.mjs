import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { leanPayload, leanPacket, checkLeanTurn, isLeanTurn, LEAN_TURN } from '../lib/rag-v2/pilot/lean-turn.js';
import { isLeanPacket, packetReferences, resolveModelReference, resolveModelReferences, LEAN_PACKET } from '../lib/rag-v2/search/model-context.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { isPackedJson, unpackJson } from '../lib/rag-v2/pilot/packed-json.js';
import { readPilotConfig, validAuditDays } from '../lib/rag-v2/pilot/config.js';
import { approvedChatPlan, approvedScope, newChatPlan, renewChatPlan } from '../lib/rag-v2/pilot/chat-plan.js';
import { answerForms } from '../lib/rag-v2/pilot/presentation.js';
import { publishedDialogue } from '../lib/rag-v2/pilot/dialogue.js';
import { digest, validateAnswer } from '../lib/rag-v2/pilot/contracts.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { stable } from '../lib/rag-v2/contracts.js';
import { municipalPacket } from './fixtures/rag-v2-municipal-packet.mjs';
import { Prisma } from '../generated/prisma/client.ts';

const landed = data => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === Prisma.DbNull ? null : value]));

// ADR-093: a finished turn's row was about 0.4 MB, of which the conversation itself is about 1.3 KB. When its full
// audit is let go the row keeps what the chat shows and goes on from, and the cited evidence with its references.

const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
// A full payload as a published turn holds it: a packet of Tallinn's size, an answer citing a passage and two records.
function fullPayload() {
  const packet = municipalPacket();
  // The fixture's records declare forms from every fifth record to the second after it: R1 (S7) declares R3, R6 (S12)
  // declares R8. R1 is shown in full and R3 is a form with its address, as a municipality's service and its form are.
  const entry = key => packet.record_context.entries.find(item => item.key === key);
  entry('R1').detail = 'selected_detail';
  Object.assign(entry('R3'), { kind: 'form', fields: { title: { value: 'Näidisteenuse taotlus', refs: ['S9'] }, official_url: { value: 'https://naidislinn.example/vormid/taotlus.pdf', refs: ['S9'] }, format: { value: 'PDF', refs: ['S9'] } } });
  const answer = { kind: 'grounded', blocks: [{ text: 'Esimene väide.', factual: true, refs: ['S1'] }, { text: 'Teine väide.', factual: true, refs: ['S7', 'S12'] }], limitations: [], clarification: null };
  return { question: 'Küsimus', contextMode: 'new', previous: '', mode: 'real', tenant: packet.tenant, userId: 'u', convId: 'c', events: [{ stage: 'answer', state: 'response_received', estimatedNanoUsd: 5 }],
    query: { text: 'Küsimus', hash: 'h', language: 'et', tokens: 3 }, vector: Array.from({ length: 3072 }, (_, at) => at / 3072), dialogue: { userTurns: ['Küsimus'] },
    previousDialogueState: null, dialogueStateContext: { regions: Array.from({ length: 79 }, (_, at) => ({ id: `r${at}`, name: `Vald ${at}` })) }, dialogueState: { value: { person: 'isa' } },
    searchAssist: { places: [{ id: 'naidislinn' }], person: 'isa', plan: { queries: ['a', 'b'] }, rerank: { kept: [1, 2, 3] } },
    requestAudit: { body: { model: 'm', input: [{ role: 'user', content: JSON.stringify(packet.model_context) }] }, bodyHash: 'body-hash', promptVersion: 'p', dialogueStateVersion: 's' },
    responseAudit: { draft: { text: JSON.stringify(answer) }, validation: { valid: true } }, answer, answerVersion: 'm4-text-refs-2', messageId: 'message', timings: { phases: { total: 1 } }, packet };
}

test('the lean form keeps the conversation, the cited evidence and its references, and lets the rest go', () => {
  const full = fullPayload(), lean = leanPayload(full, new Date('2026-10-06T12:00:00Z'));
  assert(bytes(lean) < bytes(full) * 0.05, `${bytes(lean)} of ${bytes(full)}`);
  // What the chat shows and goes on from stays as it was.
  for (const key of ['question', 'contextMode', 'answer', 'answerVersion', 'messageId', 'events', 'query', 'timings', 'dialogueState', 'responseAudit']) assert.deepEqual(lean[key], full[key], key);
  // The cited evidence only, under its own refs, each reference as it was stored.
  assert.deepEqual(Object.keys(lean.packet.reference_map), ['S1', 'S7', 'S12']);
  for (const ref of ['S1', 'S7', 'S12']) assert.deepEqual(lean.packet.reference_map[ref], full.packet.reference_map[ref]);
  assert.deepEqual(lean.packet.evidence.map(entry => entry.evidence_id), ['S1', 'S7', 'S12'].map(ref => full.packet.reference_map[ref].evidence_id));
  assert(isLeanPacket(lean.packet));
  assert.equal(lean.packet.lean, LEAN_PACKET);
  const kept = lean.packet.evidence[0], whole = full.packet.evidence[0];
  for (const key of ['unit_id', 'chunk_id', 'span_ids', 'pdf_pages', 'document_id', 'evidence_id', 'source_text', 'bibliography', 'source_metadata', 'source_locations', 'document_version_id']) assert.deepEqual(kept[key], whole[key], key);
  for (const key of ['search_aids', 'selection', 'limitations', 'legal_dates']) assert.equal(key in kept, false, key);
  for (const key of ['model_context', 'retrieval_context', 'retrieval_audit', 'dependency_context', 'version_comparison']) assert.equal(key in lean.packet, false, key);
  // The cited records and the form one of them declares; the scope the next turn reads.
  assert.deepEqual(lean.packet.record_context.entries.map(entry => entry.key), ['R1', 'R3', 'R6', 'R8']);
  assert.deepEqual(lean.packet.record_context.relations, full.packet.record_context.relations.filter(link => ['R1', 'R6'].includes(link.from)));
  assert.equal(full.packet.record_context.entries.length, 98);
  assert.deepEqual(lean.packet.record_context.scope, full.packet.record_context.scope);
  // What only the turn itself needed is gone; the request keeps its hash and versions.
  for (const key of ['vector', 'dialogue', 'previousDialogueState', 'dialogueStateContext']) assert.equal(key in lean, false, key);
  assert.deepEqual(lean.requestAudit, { bodyHash: 'body-hash', promptVersion: 'p', dialogueStateVersion: 's' });
  assert.deepEqual(lean.searchAssist, { places: [{ id: 'naidislinn' }], person: 'isa' });
  // The mark: when, what was proved, and the hashes and counts of what was let go.
  assert.deepEqual(lean.lean, { version: LEAN_TURN, at: '2026-10-06T12:00:00.000Z',
    proved: { answer: digest(full.answer), dialogueState: digest(full.dialogueState), fallback: digest(null) },
    full: { packet: digest(full.packet), evidence: 104, references: 104, requestBody: 'body-hash', bytes: bytes(full) } });
  // Making a lean payload lean again changes nothing.
  assert.equal(leanPayload(lean), lean);
  assert.equal(leanPacket(lean.packet, lean.answer), lean.packet);
  // Only a published turn can be made lean.
  for (const partial of [{ ...full, answer: undefined }, { ...full, packet: undefined }]) assert.throws(() => leanPayload(partial), { code: 'lean_turn_requires_published_answer' });
  // An answer that cites nothing keeps no evidence and is still a valid turn.
  const none = leanPayload({ ...full, answer: { kind: 'unsupported', blocks: [], limitations: ['Ei tea.'], clarification: null } });
  assert.deepEqual([none.packet.evidence, none.packet.reference_map, none.packet.record_context.entries], [[], {}, []]);
});

test('everything the chat reads from a turn is the same from its lean form', () => {
  const full = fullPayload(), lean = leanPayload(full);
  const row = payload => ({ id: 'turn', state: 'completed', payload });
  assert.deepEqual(answerForms(lean.packet, lean.answer), answerForms(full.packet, full.answer));
  assert.deepEqual(answerForms(lean.packet, lean.answer), [{ title: 'Näidisteenuse taotlus', url: 'https://naidislinn.example/vormid/taotlus.pdf', format: 'pdf' }]);
  assert.deepEqual(publishedDialogue(row(lean)), publishedDialogue(row(full)));
  assert.deepEqual(validateAnswer(lean.answer, Object.keys(lean.packet.reference_map), lean.answerVersion), validateAnswer(full.answer, Object.keys(full.packet.reference_map), full.answerVersion));
  // The sources the page lists are the cited ones: title and text of each kept entry are as they were.
  for (const [ref, value] of Object.entries(lean.packet.reference_map)) {
    const find = payload => payload.packet.evidence.find(entry => entry.evidence_id === value.evidence_id);
    assert.deepEqual([find(lean).bibliography, find(lean).source_text, find(lean).source_metadata], [find(full).bibliography, find(full).source_text, find(full).source_metadata], ref);
  }
});

test('a lean packet\'s references are still checked: each against its own entry and against the corpus', async () => {
  const full = fullPayload(), lean = leanPayload(full).packet;
  assert.equal(stable(packetReferences(full.packet)), stable(full.packet.reference_map));
  assert.equal(stable(packetReferences(lean)), stable(lean.reference_map));
  const context = { tenant: lean.tenant, usage: 'development_only', subject: 'owner' };
  const policy = new LocalPolicy({ tenants: { [lean.tenant]: { owner: [...new Set(full.packet.evidence.map(entry => entry.document_id))] } } });
  const asked = [], sourceResolver = async expected => { asked.push(expected); return expected; };
  // All cited references in one read, and one reference by itself (the source view).
  assert.equal((await resolveModelReferences({ packet: lean, context, policy, sourceResolver })).length, 3);
  assert.equal(asked[0].length, 3);
  assert.deepEqual(await resolveModelReference({ packet: lean, reference: 'S7', queryId: lean.query_id, context, policy, sourceResolver }), lean.reference_map.S7);
  // A kept entry whose text changed, a reference that changed, and a reference without its entry are all refused.
  const changedText = { ...lean, evidence: lean.evidence.map((entry, at) => (at ? entry : { ...entry, source_text: `${entry.source_text} muudetud` })) };
  await assert.rejects(resolveModelReferences({ packet: changedText, context, policy, sourceResolver }), /invalid_model_reference/);
  const changedReference = { ...lean, reference_map: { ...lean.reference_map, S7: { ...lean.reference_map.S7, pdf_pages: [9] } } };
  await assert.rejects(resolveModelReference({ packet: changedReference, reference: 'S7', queryId: lean.query_id, context, policy, sourceResolver }), /invalid_model_reference/);
  const withoutEntry = { ...lean, evidence: lean.evidence.slice(1) };
  await assert.rejects(resolveModelReferences({ packet: withoutEntry, context, policy, sourceResolver }), /invalid_model_reference/);
  // The corpus still decides: a source that no longer matches, or access taken away, refuses the turn's references.
  await assert.rejects(resolveModelReferences({ packet: lean, context, policy, sourceResolver: async expected => expected.map(reference => ({ ...reference, span_ids: ['other'] })) }), /canonical_reference_mismatch/);
  await assert.rejects(resolveModelReferences({ packet: lean, context, policy: new LocalPolicy({ tenants: { [lean.tenant]: { owner: [] } } }), sourceResolver }), /reference_access_denied/);
  // A full packet is checked as before: by the position of each entry.
  assert.equal((await resolveModelReferences({ packet: full.packet, context, policy, sourceResolver })).length, 104);
  await assert.rejects(resolveModelReferences({ packet: { ...full.packet, evidence: full.packet.evidence.slice(1) }, context, policy, sourceResolver }), /invalid_model_reference/);
});

test('a lean turn is not projected again: its answer and state must be the ones proved at publication', async () => {
  const lean = leanPayload(fullPayload()), row = { id: 'turn', state: 'completed', payload: lean };
  assert(isLeanTurn(row));
  assert.doesNotThrow(() => checkLeanTurn(row));
  const service = new PilotService({ store: {}, readConfig: async () => ({}), adapters: {} });
  // The service's two re-projection checks take the lean proof instead; a full turn without the versions passes as before.
  assert.doesNotThrow(() => service.checkDialogueState({ dialogueStateVersion: 's' }, row));
  await service.checkEvidenceDraft({}, row);
  for (const changed of [{ ...lean, answer: { ...lean.answer, limitations: ['lisatud'] } }, { ...lean, dialogueState: { value: { person: 'ema' } } }, { ...lean, dialogueStateFallback: { code: 'x' } },
    { ...lean, lean: { ...lean.lean, proved: undefined } }]) {
    assert.throws(() => checkLeanTurn({ ...row, payload: changed }), { code: 'lean_turn_changed' });
    assert.throws(() => service.checkDialogueState({ dialogueStateVersion: 's' }, { ...row, payload: changed }), { code: 'lean_turn_changed' });
    await assert.rejects(service.checkEvidenceDraft({}, { ...row, payload: changed }), { code: 'lean_turn_changed' });
  }
  assert.equal(isLeanTurn({ payload: fullPayload() }), false);
  assert.equal(isLeanTurn(null), false);
});

test('the store: a plan without an audit time publishes a turn lean; old turns of a plan with one are made lean later', async () => {
  const full = fullPayload(), { answer, packet, messageId: _message, ...claimed } = full, written = [];
  const stored = { id: 'turn', state: 'needs_recovery', chatTurnId: 'chat', createdAt: new Date('2026-09-01T00:00:00Z'), updatedAt: new Date('2026-09-01T00:00:05Z'), expiresAt: null, configHash: 'config', payload: claimed };
  const tx = { $executeRaw: async () => {}, $queryRaw: async () => [], conversation: { findUnique: async () => ({ userId: 'u', metadata: { m4: true } }), update: async () => ({}) },
    conversationMessage: { create: async () => ({ id: 'message' }) }, chatTurn: { update: async () => ({}) },
    // A column the write clears comes back empty, as the database returns it.
    m4PilotTurn: { findUnique: async () => stored, count: async () => 0, update: async ({ data }) => { written.push(data); return { ...stored, ...landed(data) }; } } };
  const store = new PilotStore({ $transaction: async fn => fn(tx) }), config = days => ({ id: 'm4-plan', tenant: packet.tenant, configHash: 'config', ...(days === undefined ? {} : { auditDays: days }) });
  // No audit time: lean at publication. The caller gets the lean row back, with its packet opened.
  const published = await store.publish(config(0), stored, answer, packet);
  assert.equal(written[0].state, 'completed');
  assert(isLeanTurn({ payload: written[0].payload }));
  assert(bytes(written[0].payload) + bytes(written[0].packet) + bytes(written[0].requestAudit) < bytes(full) * 0.05);
  // ADR-094, step 4: the lean form's packet and request are in their own columns and the vector's column is cleared.
  assert.deepEqual(Object.keys(unpackJson(written[0].packet).reference_map), ['S1', 'S7', 'S12']);
  assert.deepEqual([written[0].vector, 'body' in written[0].requestAudit, ['packet', 'requestAudit', 'vector'].some(key => key in written[0].payload)], [Prisma.DbNull, false, false]);
  assert(isLeanTurn(published) && isLeanPacket(published.payload.packet) && !('vector' in published.payload));
  // An audit time, or no setting: the turn is published whole (packed), as before.
  for (const days of [7, undefined]) {
    await store.publish(config(days), stored, answer, packet);
    // This row is of the shape before the parts had columns: its vector and request are in the payload and stay
    // there; the packet it had none of goes to the packet's column.
    const whole = written.at(-1).payload;
    assert.equal('lean' in whole, false);
    assert(isPackedJson(written.at(-1).packet));
    assert.equal(stable(unpackJson(written.at(-1).packet)), stable(packet));
    assert.equal(whole.vector.length, 3072);
  }
  // Later: completed turns older than the plan's days are made lean, a few a call; a row that changed meanwhile is left.
  const rows = new Map([['old', { ...stored, id: 'old', state: 'completed', payload: full }], ['lean', { ...stored, id: 'lean', state: 'completed', payload: leanPayload(full) }],
    ['open', { ...stored, id: 'open', state: 'needs_recovery', payload: full }], ['raced', { ...stored, id: 'raced', state: 'completed', payload: full }]]);
  const queries = [], updates = [];
  const db = { $queryRaw: async (strings, ...values) => { queries.push({ sql: strings.join('?'), values }); return [...rows.keys()].map(id => ({ id })); },
    m4PilotTurn: { findUnique: async ({ where }) => rows.get(where.id) ?? null,
      updateMany: async ({ where, data }) => { if (where.id === 'raced') return { count: 0 }; updates.push({ where, data }); return { count: 1 }; } } };
  const now = new Date('2026-10-06T12:00:00Z');
  assert.equal(await new PilotStore(db).slimOld(7, { limit: 5, now }), 1);
  assert.match(queries[0].sql, /state = 'completed' AND "createdAt" >= \? AND "createdAt" < \?\s+AND NOT jsonb_exists\(payload, 'lean'\) ORDER BY "createdAt" ASC LIMIT \?/u);
  assert.deepEqual(queries[0].values, [new Date(0), new Date('2026-09-29T12:00:00Z'), 5]);
  assert.deepEqual(updates.map(update => update.where), [{ id: 'old', state: 'completed', updatedAt: stored.updatedAt }]);
  assert(isLeanTurn({ payload: updates[0].data.payload }));
  assert.equal(updates[0].data.payload.lean.at, now.toISOString());
  assert.deepEqual([isLeanPacket(unpackJson(updates[0].data.packet)), updates[0].data.vector, 'body' in updates[0].data.requestAudit, 'packet' in updates[0].data.payload], [true, Prisma.DbNull, false, false]);
  // No setting and a wrong value ask nothing of the database.
  for (const days of [undefined, null, -1, 1.5, '7']) assert.equal(await new PilotStore(db).slimOld(days), 0);
  assert.equal(queries.length, 1);
  // Zero days (a plan that publishes lean): every whole turn an earlier plan left is due, whatever its age.
  updates.length = 0;
  assert.equal(await new PilotStore(db).slimOld(0, { now }), 1);
  assert.deepEqual(queries[1].values, [new Date(0), now, 20]);
});

test('a retention run sweeps batch after batch: until nothing is due, or its time is used, and never in a loop', async () => {
  const full = fullPayload(), now = new Date('2026-10-06T12:00:00Z'), before = new Date('2026-09-29T12:00:00Z');
  const make = count => { const rows = new Map(); for (let at = 0; at < count; at++) rows.set(`t${at}`, { id: `t${at}`, state: 'completed', updatedAt: new Date(1), payload: full }); return rows; };
  const database = (rows, stuck = new Set()) => { const queries = []; return { queries, rows,
    $queryRaw: async (_strings, from, until, limit) => { queries.push({ from, until, limit }); return [...rows.values()].filter(row => !row.payload.lean).slice(0, limit).map(row => ({ id: row.id })); },
    m4PilotTurn: { findUnique: async ({ where }) => rows.get(where.id) ?? null,
      updateMany: async ({ where, data }) => { if (stuck.has(where.id)) return { count: 0 }; rows.set(where.id, { ...rows.get(where.id), payload: data.payload }); return { count: 1 }; } } }; };
  // 130 due rows in batches of 50: three batches, everything lean, and the time up to which all is lean moves on.
  const all = database(make(130));
  assert.deepEqual(await new PilotStore(all).slimDue(7, { batch: 50, now }), { slimmed: 130, more: false, clean: before });
  assert.deepEqual(all.queries.map(query => query.limit), [50, 50, 50]);
  assert([...all.rows.values()].every(row => isLeanTurn(row)));
  // The next run reads only what is newer than that time.
  const after = before, later = new Date('2026-10-07T12:00:00Z');
  assert.deepEqual(await new PilotStore(all).slimDue(7, { batch: 50, now: later, after }), { slimmed: 0, more: false, clean: new Date('2026-09-30T12:00:00Z') });
  assert.deepEqual([all.queries.at(-1).from, all.queries.at(-1).until], [after, new Date('2026-09-30T12:00:00Z')]);
  // A run whose time is used stops after the batch in hand and says more is left; the time does not move on.
  const slow = database(make(130));
  assert.deepEqual(await new PilotStore(slow).slimDue(7, { batch: 50, now, budgetMs: 0 }), { slimmed: 50, more: true, clean: null });
  // Rows that cannot be made lean (changed under the sweep every time) do not hold the run: one batch, then it ends.
  const stuck = database(make(60), new Set(Array.from({ length: 60 }, (_, at) => `t${at}`)));
  assert.deepEqual(await new PilotStore(stuck).slimDue(7, { batch: 50, now }), { slimmed: 0, more: true, clean: null });
  assert.equal(stuck.queries.length, 1);
  // A last batch with a row left whole says so and keeps the time where it was.
  const one = database(make(10), new Set(['t3']));
  assert.deepEqual(await new PilotStore(one).slimDue(7, { batch: 50, now }), { slimmed: 9, more: true, clean: null });
  // No setting asks nothing of the database.
  for (const days of [undefined, null, -1, '7']) assert.deepEqual(await new PilotStore(all).slimDue(days, { after }), { slimmed: 0, more: false, clean: after });
});

test('the plan says for how long a turn keeps its full audit: a checked, approved setting that a release keeps', async t => {
  for (const [value, ok] of [[0, true], [7, true], [365, true], [366, false], [-1, false], [1.5, false], ['7', false], [null, false]]) assert.equal(validAuditDays(value), ok, String(value));
  const original = { ...process.env };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'm4-audit-days-')), file = path.join(dir, 'config.json');
  t.after(async () => { await fs.rm(dir, { recursive: true, force: true }); for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key]; Object.assign(process.env, original); });
  Object.assign(process.env, { M4_PILOT_CONFIG: file, M4_PILOT_ENABLED: '1', NODE_ENV: 'development' });
  const base = { id: 'test-pilot', mode: 'test', users: ['tester'], tenant: 'test', usage: 'development_only', expiresAt: null, retentionHours: null, timeoutMs: 1000,
    documents: { doc: 'version' }, budget: { attempts: 4, embeddingAttempts: 8, answerAttempts: 8, tokens: 10000, nanoUsd: 0 }, profileId: 'vector-ranked-first-v1', embedding: embeddingConfig() };
  let at = 1e12;
  const write = async value => { await fs.writeFile(file, JSON.stringify(value)); at += 1000; await fs.utimes(file, new Date(at), new Date(at)); };
  await write(base);
  assert.equal((await readPilotConfig('tester')).auditDays, undefined);
  for (const days of [0, 7]) { await write({ ...base, auditDays: days }); assert.equal((await readPilotConfig('tester')).auditDays, days); }
  for (const bad of [-1, 400, '7', null]) { await write({ ...base, auditDays: bad }); await assert.rejects(readPilotConfig('tester'), { code: 'not_configured' }, String(bad)); }
  const embedding = { embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' };
  const generation = { id: `search_generation_${'1'.repeat(64)}`, config: { embedding }, snapshot: { documents: { [`document_${'a'.repeat(64)}`]: { version_id: `version_${'b'.repeat(64)}` } } } };
  const make = extra => newChatPlan({ generation, tenant: 'sotsiaalai-corpus', profileId: 'hybrid-estnltk-chat-v1', users: ['owner-user'], accountProject: 'proj_synthetic',
    prices: { embeddingInput: 130, answerInput: 125, answerOutput: 500 }, reasoning: 'low', nanoUsd: 4e9, basis: 'Synthetic owner instruction', now: new Date('2026-10-06T08:00:00Z'), ...extra });
  const plain = await make({}), week = await make({ auditDays: 7 }), none = await make({ auditDays: 0 });
  assert.equal('auditDays' in plain, false);
  assert.deepEqual([week.auditDays, none.auditDays], [7, 0]);
  assert(approvedChatPlan(week) && approvedChatPlan(none));
  assert.notEqual(approvedScope(week), approvedScope(plain));
  assert.notEqual(approvedScope(week), approvedScope(none));
  assert.equal(approvedChatPlan({ ...week, auditDays: 0 }), false, 'changing the setting breaks the approval');
  const renewed = await renewChatPlan(none, { release: 'abcdef1', now: new Date('2026-10-06T09:00:00Z') });
  assert.equal(renewed.auditDays, 0);
  assert.equal(approvedScope(renewed), approvedScope(none));
  for (const auditDays of [-1, 366, 1.5, '7']) await assert.rejects(make({ auditDays }), { code: 'invalid_audit_days' });
});
