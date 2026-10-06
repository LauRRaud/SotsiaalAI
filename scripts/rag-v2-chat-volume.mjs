// ADR-094, step 5: the volume trial of what the chat stores, through the real path, on the isolated local test
// database only. Synthetic conversations go through the service itself: the claim, every step's write, the publication
// with the durable record. No model is called: the provider is a stand-in that returns a query vector, a search plan, a
// selection and an answer; the search is a stand-in that returns a packet of a municipal turn's shape and size.
//   1. `--conversations` conversations of `--turns` turns each, under a plan as recommended for the opening
//      (`--audit-days 0`: no full audit kept; rows live 168 hours, conversations 90 days)
//   2. the rows pass their time (the trial moves their time back) and the purge deletes them
//   3. every conversation's history is read from its records, and `--sample` conversations go on with one more turn
//   4. the database's own vacuum, then the same number of turns again: does the file grow by a whole round?
//   5. the conversations pass their time and are deleted as the retention run deletes them
//   6. with `--purge-rows`: that many small live rows stand in the table and one purge is timed (it runs first in
//      every chat request, so its price is every request's)
// At each step: how long it took, how many bytes the database wrote to its log, what the tables hold and how large
// their files are. Everything the trial wrote is deleted at the end.
//   M4_TEST_DATABASE_URL=postgres://…@localhost:55432/sotsiaal_ai_m4_dev \
//     node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-chat-volume.mjs [--conversations 100] [--turns 3] [--purge-rows 200000]
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { DIALOGUE_VERSION } from '../lib/rag-v2/pilot/dialogue.js';
import { conversationTurns } from '../lib/rag-v2/pilot/history.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { municipalPacket } from '../tests/fixtures/rag-v2-municipal-packet.mjs';

const { values } = parseArgs({ options: { conversations: { type: 'string', default: '100' }, turns: { type: 'string', default: '3' },
  'audit-days': { type: 'string', default: '0' }, sample: { type: 'string', default: '20' }, 'purge-rows': { type: 'string', default: '0' } } });
const conversations = Number(values.conversations), turns = Number(values.turns), auditDays = Number(values['audit-days']), sample = Math.min(conversations, Number(values.sample)), purgeRows = Number(values['purge-rows']);
const url = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sotsiaal_ai_m4_dev') throw Error('explicit isolated M4_TEST_DATABASE_URL required');
// A user may send 12 turns a minute (the store's rate limit); a trial conversation stays under it.
if (!Number.isInteger(conversations) || conversations < 2 || conversations > 5000 || !Number.isInteger(turns) || turns < 1 || turns > 8
  || !Number.isInteger(auditDays) || auditDays < 0 || !Number.isInteger(sample) || sample < 1 || !Number.isInteger(purgeRows) || purgeRows < 0 || purgeRows > 1000000)
  throw Error('usage: [--conversations <2-5000>] [--turns <1-8>] [--audit-days <n>] [--sample <n>] [--purge-rows <0-1000000>]');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
const tenant = 'm4-volume', TABLES = ['M4PilotTurn', 'ConversationMessage'];
// What a turn's row takes as stored: its payload and its large parts in their own columns (ADR-094, step 4).
const STORED = '(pg_column_size(payload) + coalesce(pg_column_size(packet), 0) + coalesce(pg_column_size("requestAudit"), 0) + coalesce(pg_column_size(vector), 0))';

const number = value => (typeof value === 'bigint' ? Number(value) : value);
const one = async query => Object.fromEntries(Object.entries((await db.$queryRawUnsafe(query))[0]).map(([key, value]) => [key, number(value)]));
const mb = bytes => Math.round(bytes / 1e4) / 100, kb = bytes => Math.round(bytes / 100) / 10;
const files = async () => Object.fromEntries(await Promise.all(TABLES.map(async name => [name, (await one(`SELECT pg_total_relation_size('"${name}"') AS bytes`)).bytes])));
const logPlace = async () => (await one('SELECT pg_current_wal_lsn()::text AS place')).place;
const logBytes = async from => (await one(`SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '${from}'::pg_lsn) AS bytes`)).bytes;
const vacuum = async () => { for (const name of TABLES) await db.$executeRawUnsafe(`VACUUM "${name}"`); };
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? 0;
const high = list => [...list].sort((a, b) => a - b)[Math.min(list.length - 1, Math.floor(list.length * 0.95))] ?? 0;

// A query vector as the provider gives it: 3072 numbers of about twenty characters each.
const vector = () => { const raw = Array.from({ length: 3072 }, () => Math.random() * 2 - 1), length = Math.hypot(...raw); return raw.map(value => value / length); };

// One plan and its service. The store's own methods are counted, so the report can say how many times a turn's row is written.
function plan() {
  const config = { id: randomUUID(), configHash: randomUUID(), tenant, mode: 'real', users: [], documents: {}, dialogueVersion: DIALOGUE_VERSION, searchAssist: 'rag-v2/search-assist-1',
    embedding: embeddingConfig({ embedding_mode: 'real', provider: 'openai', model: 'text-embedding-3-large', dimensions: 3072, endpoint: 'https://api.openai.com/v1/embeddings' }),
    model: 'synthetic', reasoning: 'low', maxInputTokens: 2000000, maxOutputTokens: 1000, expiresAt: null, retentionHours: 168, auditDays,
    prices: { embeddingInput: 1, answerInput: 1, answerOutput: 1 },
    budget: { attempts: 1e9, embeddingAttempts: 1e9, answerAttempts: 1e9, tokens: Number.MAX_SAFE_INTEGER, nanoUsd: Number.MAX_SAFE_INTEGER } };
  const store = new PilotStore(db), writes = { rows: 0 };
  for (const method of ['save', 'reserve', 'sent', 'usage', 'failed', 'publish']) {
    const original = store[method].bind(store);
    store[method] = (...args) => { writes.rows += 1; return original(...args); };
  }
  let packet = null, made = 0;
  const adapters = { preflight: async () => {}, canonical: async () => {},
    search: async (current, query, vectorReady, assist) => {
      await vectorReady;
      // The records per packet vary as municipalities do.
      packet = municipalPacket({ tenant, records: 10 + (made++ * 7) % 90, queryId: `query_${randomUUID()}` });
      if (assist?.rerank) await assist.rerank(packet.evidence.slice(0, 12).map(entry => ({ id: entry.evidence_id, title: entry.bibliography.title, text: entry.source_text })));
      return packet;
    } };
  const call = async ({ stage, body }) => {
    const usage = { input: 9000, output: stage === 'embedding' ? 0 : 500 }, requestId = `synthetic-${stage}`;
    if (stage === 'embedding') return { value: Array.isArray(body.input) ? body.input.map(vector) : vector(), usage, requestId };
    if (stage === 'plan') return { value: { queries: ['koduteenuse taotlemine omavalitsuses', 'hooldusvajaduse hindamine', 'eaka toimetuleku toetamine kodus'] }, usage, requestId };
    if (stage === 'rerank') return { value: { useful: JSON.parse(body.input[0].content).passages.slice(0, 6).map(passage => passage.id) }, usage, requestId };
    // The answer cites one passage and three records, about what a real answer cites (3.9 on 06.10.2026).
    const refs = Object.keys(packet.reference_map), cited = [...new Set(['S1', refs[7], refs[Math.floor(refs.length / 2)], refs.at(-1)].filter(Boolean))];
    return { value: { kind: 'grounded', blocks: cited.map((ref, at) => ({ text: `Sünteetiline väide ${at + 1}: teenust osutatakse abivajaduse hindamise põhjal ja taotlus esitatakse elukohajärgsele omavalitsusele.`, factual: true, refs: [ref] })),
      limitations: ['Täpne summa sõltub taotleja andmetest.'], clarification: null }, usage, requestId };
  };
  return { config, store, writes, service: new PilotService({ store, readConfig: async () => config, adapters, call }) };
}

const QUESTIONS = ['Olen 67, elan üksi ja vajan kodus abi. Millist teenust saan taotleda?', 'Kuhu ma taotluse esitan ja kui kiiresti otsus tehakse?', 'Kas pean teenuse eest ise maksma?',
  'Mida teha, kui mu tervis halveneb?', 'Kas lähedane saab minu eest taotleda?', 'Millised dokumendid tuleb kaasa võtta?', 'Kas otsust saab vaidlustada?', 'Kes hindab abivajadust?'];
const created = { users: [], ledgers: [] };

/** `count` conversations of `turns` turns through the service. Returns the conversations and what the round cost. */
async function round(count) {
  const p = plan(), list = [], times = [];
  created.ledgers.push(p.config.id);
  const before = await files(), from = await logPlace(), started = Date.now();
  for (let index = 0; index < count; index++) {
    const user = await db.user.create({ data: { email: `m4-volume-${randomUUID()}@example.invalid` } });
    created.users.push(user.id); p.config.users.push(user.id);
    const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
    const ids = [];
    for (let turn = 0; turn < turns; turn++) {
      const at = Date.now();
      const result = await p.service.run(user.id, { question: QUESTIONS[turn], contextMode: turn ? 'same' : 'new', convId: conv.id, clientTurnKey: randomUUID(), language: 'et' });
      if (result.state !== 'completed') throw Error(`a trial turn ended as ${result.state}`);
      times.push(Date.now() - at); ids.push(result.id);
    }
    list.push({ userId: user.id, convId: conv.id, ids });
  }
  const written = await logBytes(from), after = await files(), total = count * turns;
  const rows = await one(`SELECT count(*)::int AS rows, coalesce(round(avg(${STORED})), 0)::int AS avg_stored, coalesce(sum(${STORED}), 0)::bigint AS sum_stored FROM "M4PilotTurn" WHERE "pilotId" = '${p.config.id}'`);
  const records = await one(`SELECT count(*)::int AS messages, coalesce(round(avg(pg_column_size(content) + pg_column_size(metadata))), 0)::int AS avg_stored, coalesce(sum(pg_column_size(content) + pg_column_size(metadata)), 0)::bigint AS sum_stored
    FROM "ConversationMessage" WHERE "conversationId" IN (SELECT id FROM "Conversation" WHERE "userId" IN (${p.config.users.map(id => `'${id}'`).join(',')}))`);
  return { ...p, list, cost: { turns: total, seconds: Math.round((Date.now() - started) / 100) / 10, a_turn_ms: { median: median(times), p95: high(times) }, row_writes_a_turn: Math.round(p.writes.rows / total * 10) / 10,
    log_written_mb: mb(written), log_a_turn_kb: kb(written / total), audit_rows: rows.rows, a_row_stored_kb: kb(rows.avg_stored), rows_stored_mb: mb(rows.sum_stored),
    a_turn_two_messages_kb: kb(records.sum_stored / total), messages_stored_mb: mb(records.sum_stored),
    audit_table_file_grew_mb: mb(after.M4PilotTurn - before.M4PilotTurn), message_table_file_grew_mb: mb(after.ConversationMessage - before.ConversationMessage) } };
}

const report = { conversations, turns_each: turns, plan: { auditDays, retentionHours: 168, conversationDays: 90 }, steps: [] };
try {
  await new PilotStore(db).purge();
  await vacuum();
  const start = await files();
  const first = await round(conversations);
  const afterFirst = await files();
  report.steps.push({ step: '1 conversations through the service', ...first.cost });

  // 2. The rows' time passes. A plan's shortest time is an hour, so the trial moves the rows' time back instead of waiting.
  await db.$executeRawUnsafe(`UPDATE "M4PilotTurn" SET "expiresAt" = now() - interval '1 minute' WHERE "pilotId" = '${first.config.id}'`);
  let from = await logPlace(), at = Date.now();
  await first.store.purge();
  report.steps.push({ step: '2 rows past their time are purged', seconds: Math.round((Date.now() - at) / 100) / 10, rows_left: await db.m4PilotTurn.count({ where: { pilotId: first.config.id } }), log_written_mb: mb(await logBytes(from)) });

  // 3. History and continuation without rows.
  at = Date.now();
  let shown = 0, whole = 0;
  for (const item of first.list) {
    const read = await conversationTurns({ db, service: first.service, config: first.config, userId: item.userId, convId: item.convId });
    shown += read.turns.length; whole += read.turns.every(turn => turn.state === 'completed' && turn.answer?.blocks?.length) ? 1 : 0;
  }
  const historySeconds = (Date.now() - at) / 1000;
  at = Date.now();
  let continued = 0;
  for (const item of first.list.slice(0, sample)) {
    const result = await first.service.run(item.userId, { question: 'Ja kui kaua see abi kestab?', contextMode: 'same', convId: item.convId, clientTurnKey: randomUUID(), language: 'et' });
    // The turn went on from the record: it counts every earlier question of the conversation as its own topic's.
    continued += result.state === 'completed' && result.context?.userTurns === turns + 1 ? 1 : 0;
  }
  report.steps.push({ step: '3 history and continuation from the records', conversations_read: first.list.length, turns_shown: shown, turns_expected: conversations * turns, conversations_whole: whole,
    a_conversation_read_ms: Math.round(historySeconds * 1000 / first.list.length), continued: `${continued}/${sample}`, a_continuing_turn_ms: Math.round((Date.now() - at) / sample) });

  // 4. Vacuum, then a second round of the same size.
  const beforeVacuum = await files();
  await vacuum();
  const afterVacuum = await files();
  // How long one purge takes with nothing to delete: the price every chat request pays today (it runs first in each).
  const purgeTimes = [];
  for (let n = 0; n < 20; n++) { const began = performance.now(); await first.store.purge(); purgeTimes.push(performance.now() - began); }
  const second = await round(conversations);
  const afterSecond = await files();
  report.steps.push({ step: '4 vacuum and the same number of turns again', vacuum_changed_audit_file_mb: mb(afterVacuum.M4PilotTurn - beforeVacuum.M4PilotTurn), ...second.cost,
    reused_share_of_audit_file: first.cost.audit_table_file_grew_mb ? Math.round((1 - second.cost.audit_table_file_grew_mb / first.cost.audit_table_file_grew_mb) * 100) / 100 : null,
    a_purge_with_nothing_to_delete_ms: Math.round(median(purgeTimes) * 10) / 10 });

  // 5. The conversations' time passes; they are deleted with the retention run's own statement, narrowed to the trial's.
  const mine = { userId: { in: created.users } };
  await db.conversation.updateMany({ where: mine, data: { expiresAt: new Date(Date.now() - 60000) } });
  from = await logPlace(); at = Date.now();
  const deleted = (await db.conversation.deleteMany({ where: { ...mine, expiresAt: { lt: new Date() } } })).count;
  report.steps.push({ step: '5 conversations past their time are deleted', conversations_deleted: deleted, seconds: Math.round((Date.now() - at) / 100) / 10, log_written_mb: mb(await logBytes(from)),
    messages_left: await db.conversationMessage.count({ where: { conversation: mine } }), audit_rows_left: await db.m4PilotTurn.count({ where: { pilotId: { in: created.ledgers } } }) });
  await vacuum();
  const end = await files();

  // 6. The purge's price with many live rows in the table. The rows are small ones of ten-turn conversations, none past
  // its time: the purge has nothing to delete and still has to find that out.
  if (purgeRows) {
    const user = await db.user.create({ data: { email: `m4-volume-${randomUUID()}@example.invalid` } }), pilotId = `m4-volume-${randomUUID()}`, later = new Date(Date.now() + 7 * 86400000);
    created.users.push(user.id); created.ledgers.push(pilotId);
    for (let done = 0; done < purgeRows; done += 5000) {
      const count = Math.min(5000, purgeRows - done), convs = Array.from({ length: Math.ceil(count / 10) }, () => randomUUID());
      const chat = Array.from({ length: count }, (_, index) => ({ id: randomUUID(), userId: user.id, conversationId: convs[Math.floor(index / 10)], clientTurnKey: randomUUID() }));
      await db.conversation.createMany({ data: convs.map(id => ({ id, userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: new Date(Date.now() + 90 * 86400000) })) });
      await db.chatTurn.createMany({ data: chat });
      await db.m4PilotTurn.createMany({ data: chat.map(turn => ({ id: randomUUID(), chatTurnId: turn.id, pilotId, configHash: 'volume', inputHash: 'volume', state: 'completed', expiresAt: later, payload: { events: [] } })) });
    }
    for (const name of ['M4PilotTurn', 'ChatTurn', 'Conversation']) await db.$executeRawUnsafe(`ANALYZE "${name}"`);
    const times = [], store = new PilotStore(db);
    for (let n = 0; n < 10; n++) { const began = performance.now(); await store.purge(); times.push(performance.now() - began); }
    report.steps.push({ step: '6 a purge with many live rows and nothing to delete', rows_in_table: await db.m4PilotTurn.count(), a_purge_ms: { median: Math.round(median(times)), p95: Math.round(high(times)) } });
  }
  report.table_files_mb = Object.fromEntries(TABLES.map(name => [name, { start: mb(start[name]), after_first_round: mb(afterFirst[name]),
    after_vacuum: mb(afterVacuum[name]), after_second_round: mb(afterSecond[name]), after_deletion_and_vacuum: mb(end[name]) }]));
} finally {
  for (let from = 0; from < created.users.length; from += 200) await db.user.deleteMany({ where: { id: { in: created.users.slice(from, from + 200) } } });
  await db.m4PilotLedger.deleteMany({ where: { id: { in: created.ledgers } } });
  await vacuum();
  report.cleaned = (await db.m4PilotTurn.count({ where: { pilotId: { in: created.ledgers } } })) === 0 && (await db.user.count({ where: { id: { in: created.users.slice(0, 200) } } })) === 0;
  await db.$disconnect();
}
console.log(JSON.stringify(report, null, 1));
