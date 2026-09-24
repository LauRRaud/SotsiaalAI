import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { EstnltkAnalyzer, ESTNLTK_ANALYZER_VERSION, ESTNLTK_LIMITS } from '../lib/rag-v2/search/estnltk.js';
import { lexicalFields, lexicalQuery } from '../lib/rag-v2/search/lexical-analysis.js';
import { ESTNLTK_LEXICAL, LEGACY_LEXICAL, MORPHOLOGY_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { assertProfileGeneration, retrievalProfile } from '../lib/rag-v2/search/profiles.js';
import { implementationManifest } from '../lib/rag-v2/pilot/provenance.js';

function worker(answer) {
  const children = [];
  return { children, spawnProcess(python, args, options) {
    assert.equal(python, 'test-python'); assert(args.includes('-B'));
    assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    const child = new EventEmitter(); children.push(child);
    child.stdin = new PassThrough(); child.stdout = new PassThrough();
    child.ref = child.unref = () => {};
    child.kill = () => { child.killed = true; child.emit('exit', 0); };
    child.stdin.on('data', bytes => {
      const request = JSON.parse(bytes.toString());
      const result = answer(request, children.length);
      if (result) queueMicrotask(() => child.stdout.write(`${JSON.stringify(result)}\n`));
    });
    return child;
  } };
}
const response = request => ({ id: request.id, version: request.version, texts: request.texts.map(() => 'vmetlaps') });

test('EstNLTK uses a distinct generation/profile; old contracts are still readable', async () => {
  const configs = [LEGACY_LEXICAL, MORPHOLOGY_LEXICAL, ESTNLTK_LEXICAL].map(lexical => searchConfig(undefined, lexical));
  assert.equal(new Set(configs.map(c => c.id)).size, 3);
  const profile = retrievalProfile('hybrid-estnltk-dependencies-v1');
  assert.deepEqual(retrievalProfile(), profile);
  assert.equal(profile.query.semanticGraph, true);
  assertProfileGeneration(profile, { config: configs[2] });
  for (const config of configs.slice(0, 2)) assert.throws(() => assertProfileGeneration(profile, { config }), { code: 'profile_generation_mismatch' });
  assertProfileGeneration(retrievalProfile('hybrid-multilingual-dependencies-v1'), { config: configs[1] });
  // ADR-022: the vector-weighted profile reads the same EstNLTK generation; only query-time ranking differs.
  const vector2 = retrievalProfile('hybrid-estnltk-vector2-dependencies-v1');
  assertProfileGeneration(vector2, { config: configs[2] });
  assert.deepEqual(vector2.query.channelWeights, { lexical: 1, vector: 2 });
  assert.deepEqual({ ...vector2, id: profile.id, query: { ...vector2.query, channelWeights: undefined } }, { ...profile, query: { ...profile.query, channelWeights: undefined } });
  assert.equal(profile.query.channelWeights, undefined);
  const manifest = await implementationManifest();
  assert(manifest.files['lib/rag-v2/search/estnltk-worker.py']);
  assert(manifest.files['lib/rag-v2/search/estnltk-requirements.txt']);
});

test('index/query analysis shares bounded batches, retains all input and never changes evidence', async () => {
  const calls = [], analyzer = { async analyze(texts) { calls.push(texts); return texts.map(() => 'vmetlaps'); } };
  const units = Array.from({ length: 110 }, (_, i) => Object.freeze({ title: `Title ${i}`, body: 'Lapsele abi. '.repeat(1500), search_aids: '' }));
  const fields = await lexicalFields(units, ESTNLTK_LEXICAL, analyzer);
  assert.equal(fields.length, units.length); assert(calls.length > 1);
  assert.deepEqual(calls.flat(), units.flatMap(u => [u.title, u.body, u.search_aids]));
  assert(calls.every(batch => batch.length <= ESTNLTK_LIMITS.texts && batch.join('').length <= ESTNLTK_LIMITS.batchChars));
  assert(fields[0].body.includes('vmetlaps')); assert(!fields[0].body.includes('sbet'));
  assert.equal(units[0].body, 'Lapsele abi. '.repeat(1500));
  assert.equal(await lexicalQuery(units[0].body, ESTNLTK_LEXICAL, analyzer), fields[0].body);
  await assert.rejects(lexicalQuery('a'.repeat(ESTNLTK_LIMITS.textChars + 1), ESTNLTK_LEXICAL, analyzer), { code: 'morphology_input_limit' });
  const broken = { async analyze() { throw Object.assign(new Error('morphology_unavailable'), { code: 'morphology_unavailable' }); } };
  await assert.rejects(lexicalQuery('lapsele', ESTNLTK_LEXICAL, broken), { code: 'morphology_unavailable' });
  assert.equal(await lexicalQuery('lapsele', LEGACY_LEXICAL, broken), '');
  assert((await lexicalQuery('lapsele', MORPHOLOGY_LEXICAL, broken)).startsWith('sben'));
});

test('local worker is reused, correlates simultaneous requests, and closes without retaining queries', async () => {
  const adapter = worker(response), analyzer = new EstnltkAnalyzer({ ...adapter, python: 'test-python' });
  try {
    assert.deepEqual(await Promise.all([analyzer.analyze(['laps']), analyzer.analyze(['lapse', 'lastele'])]), [['vmetlaps'], ['vmetlaps', 'vmetlaps']]);
    assert.equal(adapter.children.length, 1); assert.equal(analyzer.pending.size, 0);
    assert.equal(ESTNLTK_ANALYZER_VERSION, 'estnltk-vabamorf-1.7.5-rag-v2-1');
    await assert.rejects(analyzer.analyze(['a'.repeat(50001)]), { code: 'morphology_input_limit' });
  } finally { analyzer.close(); }
  assert(adapter.children[0].killed);
});

test('timeout kills the process and the next request starts a new worker', async () => {
  const adapter = worker((request, count) => count === 1 ? null : response(request));
  const analyzer = new EstnltkAnalyzer({ ...adapter, python: 'test-python', timeoutMs: 20 });
  try {
    await assert.rejects(analyzer.analyze(['private query']), { code: 'morphology_timeout' });
    assert(adapter.children[0].killed);
    assert.deepEqual(await analyzer.analyze(['laps']), ['vmetlaps']);
    assert.equal(adapter.children.length, 2);
  } finally { analyzer.close(); }
});

test('worker protocol corruption and missing/version-mismatched packages cannot become a silent fallback', async () => {
  for (const [answer, code] of [
    [request => ({ ...response(request), version: 'other' }), 'morphology_protocol_error'],
    [request => ({ ...response(request), id: request.id + 1 }), 'morphology_protocol_error'],
    [request => ({ ...response(request), texts: [] }), 'morphology_protocol_error'],
    [request => ({ ...response(request), texts: ['untrusted output'] }), 'morphology_protocol_error'],
    [request => ({ ...response(request), error: 'morphology_version_mismatch' }), 'morphology_version_mismatch'],
    [request => ({ ...response(request), error: 'morphology_unavailable' }), 'morphology_unavailable'],
  ]) {
    const analyzer = new EstnltkAnalyzer({ ...worker(answer), python: 'test-python' });
    try { await assert.rejects(analyzer.analyze(['private query']), { code, message: code }); }
    finally { analyzer.close(); }
  }
  const absent = new EstnltkAnalyzer({ python: 'nonexistent-rag-v2-python-executable' });
  try { await assert.rejects(absent.analyze(['private query']), { code: 'morphology_unavailable' }); }
  finally { absent.close(); }
});
