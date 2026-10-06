// ADR-093: a volume trial of how chat turns take and give back disk space, on the isolated local test database only.
// It writes synthetic completed turns of a real turn's shape and size (a municipal packet, a query vector, the request
// as sent), lets their full audit go through the store's own sweep, and writes a second round, measuring at each step
// what the table holds and how large its file is. No model call, no real data.
//   1. `--turns` whole turns, as a plan with an audit time stores them
//   2. the sweep makes them lean (how many a second)
//   3. the database's own vacuum makes the freed space reusable
//   4. the same number of whole turns again: does the file grow by a whole round, or is the freed space used?
// Everything it wrote is deleted at the end.
//   M4_TEST_DATABASE_URL=postgres://…@localhost:55432/sotsiaal_ai_m4_dev \
//     node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-turn-volume.mjs [--turns 300]
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { packJson } from '../lib/rag-v2/pilot/packed-json.js';
import { municipalPacket } from '../tests/fixtures/rag-v2-municipal-packet.mjs';

const { values } = parseArgs({ options: { turns: { type: 'string', default: '300' } } });
const turns = Number(values.turns);
const url = new URL(process.env.M4_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/sotsiaal_ai_m4_dev') throw Error('explicit isolated M4_TEST_DATABASE_URL required');
if (!Number.isInteger(turns) || turns < 10 || turns > 5000) throw Error('usage: [--turns <10-5000>]');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
const store = new PilotStore(db), DAY = 86400000;

// A turn's payload as a plan with an audit time stores it. The records per packet vary as municipalities do; the
// answer cites one passage and three records, about what a real answer cites (3.9 on 06.10.2026).
function payload(index, userId, convId) {
  const packet = municipalPacket({ tenant: 'm4-volume', records: 10 + (index * 7) % 90, queryId: `query_${randomUUID()}` });
  const refs = Object.keys(packet.reference_map), cited = ['S1', refs[7], refs[Math.floor(refs.length / 2)], refs.at(-1)].filter(Boolean);
  const answer = { kind: 'grounded', blocks: cited.map((ref, at) => ({ text: `Sünteetiline väide ${at + 1} pöördes ${index}: teenust osutatakse abivajaduse hindamise põhjal ja taotlus esitatakse elukohajärgsele omavalitsusele.`, factual: true, refs: [ref] })),
    limitations: ['Täpne summa sõltub taotleja andmetest.'], clarification: null };
  const body = { model: 'synthetic', reasoning: { effort: 'low' }, input: [{ role: 'user', content: JSON.stringify({ question: `Sünteetiline küsimus ${index}`, evidence: packet.model_context }) }] };
  return { question: `Sünteetiline küsimus ${index}: millist abi saab eakas inimene kodus ja kuhu pöörduda?`, contextMode: 'new', previous: '', mode: 'real', tenant: 'm4-volume', userId, convId,
    events: ['plan', 'embedding', 'rerank', 'answer'].map(stage => ({ stage, state: 'response_received', reservation: { tokens: 40000, nanoUsd: 5000000 }, usage: { input: 9000, output: 500 }, estimatedNanoUsd: 1200000, timings: { total: 2100 } })),
    query: { text: `Sünteetiline küsimus ${index}`, hash: randomUUID(), language: 'et', tokens: 12, version: 'q' }, vector: Array.from({ length: 3072 }, () => Math.random() * 2 - 1),
    searchAssist: { places: [], person: null, plan: { queries: Array.from({ length: 4 }, (_, at) => `otsingupäring ${at} pöördele ${index} koduteenuse ja hoolduse kohta`) } },
    requestAudit: { body, bodyHash: randomUUID(), promptVersion: 'p', answerVersion: 'm4-text-refs-2', questionVersion: 'q', savedAt: new Date().toISOString() },
    responseAudit: { draft: { text: JSON.stringify(answer) }, validation: { valid: true, code: 'validated' } }, answer, answerVersion: 'm4-text-refs-2', messageId: randomUUID(),
    timings: { validatedDraftMs: 9000, phases: { plan: 2000, embedding: 500, search: 3500, answer: 3800, total: 9800 } }, packet: packJson(packet) };
}
const one = async query => Object.fromEntries(Object.entries((await db.$queryRawUnsafe(query))[0]).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]));
const tableBytes = async () => (await one(`SELECT pg_total_relation_size('"M4PilotTurn"') AS bytes`)).bytes;
const mb = bytes => Math.round(bytes / 1e4) / 100;
// What a turn's row takes as stored: its payload and its large parts in their own columns (ADR-094, step 4).
const STORED = '(pg_column_size(payload) + coalesce(pg_column_size(packet), 0) + coalesce(pg_column_size("requestAudit"), 0) + coalesce(pg_column_size(vector), 0))';
const user = await db.user.create({ data: { email: `m4-volume-${randomUUID()}@example.invalid` } });
const conv = await db.conversation.create({ data: { userId: user.id, role: 'CLIENT', metadata: { m4: true }, expiresAt: null } });
const pilotId = `m4-volume-${randomUUID()}`;
async function write(count, createdAt) {
  const started = Date.now(), ids = [];
  for (let index = 0; index < count; index++) {
    const turn = await db.chatTurn.create({ data: { userId: user.id, conversationId: conv.id, clientTurnKey: randomUUID() } });
    const row = await db.m4PilotTurn.create({ data: { id: randomUUID(), chatTurnId: turn.id, pilotId, configHash: 'volume', inputHash: randomUUID(), state: 'completed', createdAt, payload: payload(index, user.id, conv.id) } });
    ids.push(row.id);
  }
  return { ids, seconds: (Date.now() - started) / 1000 };
}
const stored = async ids => one(`SELECT round(avg(${STORED}))::int AS avg_stored, round(avg(octet_length(payload::text)))::int AS avg_text, sum(${STORED})::bigint AS sum_stored FROM "M4PilotTurn" WHERE id IN (${ids.map(id => `'${id}'`).join(',')})`);
const report = { turns, steps: [] };
try {
  // The sweep reads every plan's turns: what other runs left old and whole in this database is made lean first, so the
  // numbers below are of this trial's turns only.
  await store.slimDue(7, { budgetMs: 10 * 60000 });
  await db.$executeRawUnsafe('VACUUM "M4PilotTurn"');
  const start = await tableBytes();
  const first = await write(turns, new Date(Date.now() - 8 * DAY));
  const afterWrite = await tableBytes(), whole = await stored(first.ids);
  report.steps.push({ step: '1 whole turns written', table_grew_mb: mb(afterWrite - start), a_turn_stored_kb: Math.round(whole.avg_stored / 100) / 10, a_turn_text_kb: Math.round(whole.avg_text / 100) / 10, rows_a_second: Math.round(turns / first.seconds) });
  const sweepStarted = Date.now(), sweep = await store.slimDue(7, { budgetMs: 15 * 60000, batch: 50 }), sweepSeconds = (Date.now() - sweepStarted) / 1000;
  const afterSweep = await tableBytes(), lean = await stored(first.ids);
  report.steps.push({ step: '2 sweep made them lean', made_lean: sweep.slimmed, more_left: sweep.more, rows_a_second: Math.round(sweep.slimmed / sweepSeconds), a_turn_stored_kb: Math.round(lean.avg_stored / 100) / 10, a_turn_text_kb: Math.round(lean.avg_text / 100) / 10,
    live_data_mb: mb(lean.sum_stored), table_file_change_mb: mb(afterSweep - afterWrite) });
  await db.$executeRawUnsafe('VACUUM "M4PilotTurn"');
  const afterVacuum = await tableBytes();
  report.steps.push({ step: '3 vacuum', table_file_change_mb: mb(afterVacuum - afterSweep) });
  await write(turns, new Date());
  const afterSecond = await tableBytes();
  report.steps.push({ step: '4 the same number of whole turns again', table_grew_mb: mb(afterSecond - afterVacuum), first_round_grew_mb: mb(afterWrite - start),
    reused_share: Math.round((1 - (afterSecond - afterVacuum) / (afterWrite - start)) * 100) / 100 });
  report.table_file_mb = { start: mb(start), after_first_round: mb(afterWrite), after_sweep: mb(afterSweep), after_vacuum: mb(afterVacuum), after_second_round: mb(afterSecond) };
} finally {
  await db.user.delete({ where: { id: user.id } });
  await db.$executeRawUnsafe('VACUUM "M4PilotTurn"');
  report.cleaned = (await db.m4PilotTurn.count({ where: { pilotId } })) === 0;
  await db.$disconnect();
}
console.log(JSON.stringify(report, null, 1));
