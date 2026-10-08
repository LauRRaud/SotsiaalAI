import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresCatalog, GENERATION_TABLES } from '../lib/rag-v2/search/postgres.js';
import { GENERATION_LAYOUT, VERSION_LAYOUT } from '../lib/rag-v2/search/layout.js';

// ADR-108: an activation refreshes the planner's statistics of the tables a search reads by generation, before the head
// moves. No database: the catalogue's own activate() against a client that records what it is sent.
function catalogue({ failAnalyze = false } = {}) {
  const sent = [];
  const client = { release() {}, async query(sql) {
    const text = String(sql).replace(/\s+/gu, ' ').trim();
    sent.push(text);
    if (failAnalyze && text.startsWith('ANALYZE')) throw Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
    if (text.startsWith('SELECT * FROM rag_v2_head')) return { rows: [{ requested_sequence: 7 }] };
    if (text.startsWith('SELECT count(*)')) return { rows: [{ count: 3 }] };
    return { rows: [] };
  } };
  const postgres = Object.create(PostgresCatalog.prototype);
  postgres.pool = { connect: async () => client };
  return { postgres, sent };
}
const generation = layout => ({ id: 'search_generation_test', sequence: 7, expected_count: 3, layout, config: { id: 'config' } });

test('an activation refreshes the statistics of the generation tables after the count check and before the generation is ready', async () => {
  const { postgres, sent } = catalogue();
  await postgres.activate('tenant', generation(VERSION_LAYOUT));
  const at = text => sent.findIndex(line => line.startsWith(text));
  assert.deepEqual(sent.filter(line => line.startsWith('ANALYZE')), ['ANALYZE rag_v2_generation', 'ANALYZE rag_v2_generation_document', 'ANALYZE rag_v2_version_unit']);
  assert.ok(at('SELECT count(*)') < at('SAVEPOINT generation_statistics') && at('SAVEPOINT generation_statistics') < at('ANALYZE rag_v2_generation'));
  assert.ok(at('ANALYZE rag_v2_version_unit') < at('RELEASE SAVEPOINT generation_statistics') && at('RELEASE SAVEPOINT generation_statistics') < at("UPDATE rag_v2_generation SET state='ready'"));
  assert.ok(at("UPDATE rag_v2_generation SET state='ready'") < at('UPDATE rag_v2_head SET active_id') && sent.at(-1) === 'COMMIT');
  // The older layout has its own unit table and no document rows of a generation.
  const legacy = catalogue();
  await legacy.postgres.activate('tenant', generation(GENERATION_LAYOUT));
  assert.deepEqual(legacy.sent.filter(line => line.startsWith('ANALYZE')), ['ANALYZE rag_v2_generation', 'ANALYZE rag_v2_unit']);
  // Fixed table names only: nothing of a generation or a tenant goes into the statement.
  for (const tables of Object.values(GENERATION_TABLES)) for (const table of tables) assert.match(table, /^rag_v2_[a-z_]+$/u);
});

test('a refresh that fails does not stop the activation: the search stays correct, and the failure is logged', async () => {
  const { postgres, sent } = catalogue({ failAnalyze: true });
  const logged = [], original = console.error;
  console.error = (...parts) => logged.push(parts.join(' '));
  try { await postgres.activate('tenant', generation(VERSION_LAYOUT)); } finally { console.error = original; }
  assert.deepEqual(sent.filter(line => /SAVEPOINT/u.test(line)), ['SAVEPOINT generation_statistics', 'ROLLBACK TO SAVEPOINT generation_statistics']);
  assert.ok(sent.includes("UPDATE rag_v2_generation SET state='ready' WHERE tenant=$1 AND id=$2") && sent.at(-1) === 'COMMIT');
  assert.deepEqual(logged, ['[rag-v2] generation statistics not refreshed 57014']);
  // A wrong count still stops it before any statistics are touched.
  const wrong = catalogue();
  await assert.rejects(wrong.postgres.activate('tenant', { ...generation(VERSION_LAYOUT), expected_count: 4 }), /index_count_mismatch/);
  assert.equal(wrong.sent.some(line => line.startsWith('ANALYZE')), false);
  assert.equal(wrong.sent.at(-1), 'ROLLBACK');
});
