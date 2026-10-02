import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PostgresCatalog, VERIFIED_MARKS, verifiedMark } from '../lib/rag-v2/search/postgres.js';
import { warmPilotAtStart, vectorWarmState } from '../lib/rag-v2/pilot/retrieval.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/pilot/retrieval-plan.js';
import { ESTNLTK_ANALYZER_VERSION } from '../lib/rag-v2/search/estnltk.js';

// ADR-069: marks of full checks outlive their process. No database: a table of marks stands in for
// rag_v2_verified_read, and the catalog's pool is never connected.
function table() {
  const marks = new Set(), sql = [];
  return { marks, sql, async end() {}, async query(text, values = []) {
    sql.push(String(text));
    if (/^DELETE FROM rag_v2_verified_read WHERE verified_at/u.test(text)) return { rows: [] };
    if (/^DELETE FROM rag_v2_verified_read$/u.test(text)) { marks.clear(); return { rows: [] }; }
    if (/^SELECT mark FROM rag_v2_verified_read/u.test(text)) return { rows: [...marks].map(mark => ({ mark })) };
    if (/^INSERT INTO rag_v2_verified_read/u.test(text)) { for (const mark of JSON.parse(values[0])) marks.add(mark); return { rows: [] }; }
    throw new Error(`unexpected sql: ${text}`);
  } };
}
function catalog(pool) {
  const postgres = new PostgresCatalog('postgresql://rag_v2_dev:unused@127.0.0.1:55432/rag_v2_dev');
  postgres.pool = pool;
  return postgres;
}
const failure = code => Object.assign(new Error(code), { code });

test('a mark names the read, its row versions, the checks and the analyzer; a process without inherited marks keeps none', async () => {
  assert.ok(VERIFIED_MARKS.endsWith(ESTNLTK_ANALYZER_VERSION));
  assert.match(verifiedMark('bundle\0t\0g\0v\0h', '7/8'), /^[0-9a-f]{64}$/u);
  assert.notEqual(verifiedMark('a', '1/2'), verifiedMark('a', '1/3'));
  assert.notEqual(verifiedMark('a\0b', 'c'), verifiedMark('a', 'b\0c'.slice(2)));
  const pool = table(), postgres = catalog(pool);
  postgres.rememberVerified('a', '1/2');
  assert.deepEqual([postgres.known('a', '1/2'), postgres.known('a', '1/2', true), postgres.known('a', '1/3'), postgres.unsaved.size, postgres.saveTimer], [true, true, false, 0, null]);
  assert.equal(pool.sql.length, 0, 'nothing is written before the marks are inherited');
});

test('the next process knows a read by the mark the last one saved, but not as its own check', async () => {
  const pool = table(), first = catalog(pool);
  assert.equal(await first.inheritVerified(), 0);
  first.rememberVerified('bundle\0t\0g\0v1\0h1', '11/12'); first.rememberVerified('units\0t\0c\0d\0v1\0estnltk', '2/11,12');
  assert.ok(first.saveTimer, 'a save is scheduled');
  assert.equal(await first.saveVerified(), 2);
  assert.deepEqual([...pool.marks].sort(), [verifiedMark('bundle\0t\0g\0v1\0h1', '11/12'), verifiedMark('units\0t\0c\0d\0v1\0estnltk', '2/11,12')].sort());
  await first.close();

  const next = catalog(pool);
  assert.equal(next.known('bundle\0t\0g\0v1\0h1', '11/12'), false, 'not before the marks are read');
  assert.equal(await next.inheritVerified(), 2);
  // The same read at the same row versions is known; a changed row version, another read and the own check are not.
  assert.deepEqual([next.known('bundle\0t\0g\0v1\0h1', '11/12'), next.known('bundle\0t\0g\0v1\0h1', '11/13'), next.known('bundle\0t\0g\0v2\0h2', '11/12'),
    next.known('bundle\0t\0g\0v1\0h1', '11/12', true)], [true, false, false, false]);
  // Its own full check makes the read its own, and the mark is saved again (the row's time moves on).
  next.rememberVerified('bundle\0t\0g\0v1\0h1', '11/12');
  assert.deepEqual([next.known('bundle\0t\0g\0v1\0h1', '11/12', true), next.unsaved.size], [true, 1]);
  // A save that fails keeps the marks for the next one.
  const query = pool.query; pool.query = async () => { throw failure('57014'); };
  await assert.rejects(next.saveVerified(), { code: '57014' });
  assert.equal(next.unsaved.size, 1);
  pool.query = query;
  assert.equal(await next.saveVerified(), 1);
  assert.equal(next.unsaved.size, 0);
  await next.close();
});

test('the warm-up checks every source itself, and one that fails ends the inherited trust here and in the table', async () => {
  const pool = table();
  pool.marks.add(verifiedMark('bundle\0t\0g\0v1\0h1', '11/12')); pool.marks.add(verifiedMark('bundle\0t\0g\0v2\0h2', '21/22'));
  const postgres = catalog(pool), calls = [];
  assert.equal(await postgres.inheritVerified(), 2);
  postgres.bundles = async (tenant, generation, ids, options) => { calls.push(['bundles', ids, options]); };
  postgres.units = async (tenant, generation, ids, options) => { calls.push(['units', ids, options]); };
  await postgres.warm('t', 'g', ['a', 'b', 'c'], { batch: 2 });
  assert.deepEqual(calls, [['bundles', ['a', 'b'], { cache: false, own: true }], ['units', ['a', 'b'], { own: true }],
    ['bundles', ['c'], { cache: false, own: true }], ['units', ['c'], { own: true }]]);
  assert.equal(postgres.inherited.size, 2, 'a warm-up that passes leaves the marks');

  postgres.units = async () => { throw failure('index_morphology_integrity_failed'); };
  await assert.rejects(postgres.warm('t', 'g', ['a']), { code: 'index_morphology_integrity_failed' });
  assert.deepEqual([postgres.inherited.size, pool.marks.size, postgres.known('bundle\0t\0g\0v1\0h1', '11/12')], [0, 0, false]);
  // Its own checks stand and are saved afterwards; a later failure without inherited marks leaves the table alone.
  postgres.rememberVerified('bundle\0t\0g\0v2\0h2', '21/22');
  assert.equal(await postgres.saveVerified(), 1);
  await assert.rejects(postgres.warm('t', 'g', ['a']), { code: 'index_morphology_integrity_failed' });
  assert.deepEqual([pool.marks.size, postgres.known('bundle\0t\0g\0v2\0h2', '21/22', true)], [1, true]);
  await postgres.close();
});

test('with inherited marks the warm-up waits for a moment without a chat turn, but not for ever; without them it does not wait', async () => {
  const quiet = { quietMs: 120, maxWaitMs: 400, stepMs: 10 };
  const run = async (inherited, busy) => {
    const pool = table();
    if (inherited) pool.marks.add(verifiedMark('a', '1'));
    const postgres = catalog(pool), started = Date.now();
    await postgres.inheritVerified();
    let first = null;
    postgres.bundles = async () => { first ??= Date.now() - started; }; postgres.units = async () => {};
    postgres.foreground();
    const turn = busy ? setInterval(() => postgres.foreground(), 20) : null;
    try { await postgres.warm('t', 'g', ['a'], { quiet }); } finally { clearInterval(turn); await postgres.close(); }
    return first;
  };
  assert.ok(await run(false, true) < 100, 'no inherited marks: the warm-up runs at once, as before');
  const waited = await run(true, false);
  assert.ok(waited >= 110 && waited < 390, `one turn just before: waits for the quiet moment (${waited} ms)`);
  const capped = await run(true, true);
  assert.ok(capped >= 390, `turns without a pause: starts after the longest wait (${capped} ms)`);
});

test('the start warm-up inherits the marks, reads the vectors at once and again after the sources', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-marks-')), file = path.join(dir, 'plan.json');
  const url = `postgresql://127.0.0.1:1/marks-start-${Date.now()}`; // never connected: the catalog below stands in for it
  const generation = { id: `marks-start-${Date.now()}`, tenant: 'marks', snapshot: { documents: { guide: { version_id: 'v1' } } } };
  const order = [];
  let release;
  const sources = new Promise(resolve => { release = resolve; });
  (globalThis[Symbol.for('sotsiaalai.rag-v2.postgres-catalogs')] ||= new Map()).set(url, { active: async () => generation, retrievalDirectory: async () => [],
    inheritVerified: async () => { order.push('inherit'); return 3; }, warm: async () => { order.push('sources start'); await sources; order.push('sources done'); } });
  class Qdrant { async warm() { order.push('vectors'); return 1; } }
  const env = { M4_PILOT_ENABLED: '1', M4_PILOT_CONFIG: file, RAG_V2_POSTGRES_URL: url, RAG_V2_QDRANT_URL: 'http://127.0.0.1:56333', RAG_V2_QDRANT_KEY: 'k'.repeat(24) };
  try {
    await fs.writeFile(file, JSON.stringify({ mode: 'real', tenant: generation.tenant, generationId: generation.id, documents: { guide: 'v1' }, retrievalRouting: UNIFIED_RETRIEVAL_VERSION }));
    assert.equal(await warmPilotAtStart({ env, Qdrant }), true);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(order, ['inherit', 'sources start', 'vectors'], 'the vectors do not wait for the sources');
    assert.equal(vectorWarmState(generation.id), 'done');
    release();
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(order, ['inherit', 'sources start', 'vectors', 'sources done', 'vectors']);
    // A second start in the same process: nothing is warmed again (the marks are read again, which is harmless).
    assert.equal(await warmPilotAtStart({ env, Qdrant }), false);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(order.filter(step => step !== 'inherit'), ['sources start', 'vectors', 'sources done', 'vectors']);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
