// Read-only speed audit, executed from the pinned active release directory by the companion launcher.
// No model calls, user message/body reads, ANALYZE, index writes, or configuration changes.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'package.json'));
const { Pool } = require('pg');
const load = file => import(pathToFileURL(path.resolve(file)).href);
const { PostgresCatalog } = await load('lib/rag-v2/search/postgres.js');
const { QdrantIndex } = await load('lib/rag-v2/search/qdrant.js');
const { LEXICAL_RANK_PLAIN } = await load('lib/rag-v2/search/ranking.js');
const safeFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  const u = new URL(url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new Error('external_network_forbidden');
  return safeFetch(url, options);
};
const makePool = connectionString => new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000,
  options: '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000',
  application_name: 'rag-speed-audit-readonly-20261008' });
const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
await postgres.pool.end();
postgres.pool = makePool(process.env.RAG_V2_POSTGRES_URL);
const app = makePool(process.env.DATABASE_URL);
const out = { measuredAt: new Date().toISOString(), release: path.basename(process.cwd()), paidCalls: 0, readOnly: true };
const timed = async fn => { const start = performance.now(); const value = await fn(); return { ms: Math.round(performance.now() - start), value }; };
try {
  const plan = JSON.parse(fs.readFileSync(process.env.M4_PILOT_CONFIG, 'utf8'));
  out.plan = Object.fromEntries(['generationId', 'profile', 'searchAssist', 'promptVersion', 'model', 'reasoning', 'reasoningChoices'].filter(k => k in plan).map(k => [k, plan[k]]));
  const generation = await postgres.readyGeneration(plan.tenant, plan.generationId);
  const documents = Object.keys(generation.snapshot.documents);
  out.generation = { id: generation.id, documents: documents.length, units: generation.expected_count };
  out.postgres = (await postgres.pool.query("SELECT version(), current_setting('max_parallel_workers') AS workers, current_setting('max_worker_processes') AS processes, current_setting('default_statistics_target') AS statistics_target")).rows[0];
  out.statistics = (await postgres.pool.query("SELECT relname,n_live_tup,n_mod_since_analyze,last_analyze,last_autoanalyze FROM pg_stat_user_tables WHERE relname IN ('rag_v2_generation','rag_v2_generation_document','rag_v2_version_unit') ORDER BY relname")).rows;
  out.indexes = (await postgres.pool.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE tablename IN ('rag_v2_generation_document','rag_v2_version_unit') ORDER BY tablename,indexname")).rows;
  out.estimate = (await postgres.pool.query('EXPLAIN (FORMAT JSON) SELECT version_id FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2', [plan.tenant, generation.id])).rows[0]['QUERY PLAN'][0].Plan['Plan Rows'];
  // Explicit projection: never select payload, requestAudit, packet, messages, or identities wholesale.
  out.turnMetrics = (await app.query(`SELECT "createdAt"::text AS created_at,state,
    payload->>'generationId' AS generation,
    COALESCE("requestAudit"#>>'{body,reasoning,effort}',payload#>>'{requestAudit,body,reasoning,effort}') AS reasoning,
    payload#>'{timings,phases}' AS phases,payload#>'{timings,search}' AS search,
    (SELECT jsonb_agg(jsonb_build_object('stage',e->>'stage','timings',e->'timings','usage',e->'usage'))
      FROM jsonb_array_elements(COALESCE(payload->'events','[]'::jsonb)) e) AS calls
    FROM "M4PilotTurn" WHERE "createdAt">='2026-10-06' ORDER BY "createdAt" LIMIT 1000`)).rows;
  const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
  const root = await qdrant.request('/');
  const info = await qdrant.request(qdrant.route(generation));
  out.qdrant = { version: root.version, status: info.status, points_count: info.points_count, indexed_vectors_count: info.indexed_vectors_count,
    payload_schema: info.payload_schema, params: info.config?.params, hnsw_config: info.config?.hnsw_config };
  // Only existing public synthetic benchmark text. Serial execution bounds additional load.
  out.lexical = [];
  for (const text of ['koduteenus eakale', 'toimetulekutoetuse taotlemine dokumendid']) {
    for (const rank of [null, LEXICAL_RANK_PLAIN]) {
      const samples = [];
      for (let i = 0; i < 2; i++) {
        const r = await timed(() => postgres.lexical(plan.tenant, generation.id, documents, text, 80, null, rank ? { rank } : {}));
        samples.push({ elapsedMs: r.ms, found: r.value.length });
      }
      out.lexical.push({ text, rank: rank || 'ts_rank_cd_default_capacity_benchmark', samples });
    }
  }
  // Capture the exact SQL emitted by the active implementation, including real morphology and parallel settings.
  out.explains = [];
  const read = postgres.parallelRead.bind(postgres);
  postgres.parallelRead = async (sql, values) => {
    const rows = await read('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + sql, values);
    const raw = rows[0]['QUERY PLAN'][0];
    const clean = node => Object.fromEntries(Object.entries(node).filter(([k]) => !['Filter', 'Index Cond', 'Recheck Cond', 'Output'].includes(k))
      .map(([k, v]) => [k, k === 'Plans' ? v.map(clean) : v]));
    out.explains.push({ text: values[3], rank: sql.includes('ts_rank_cd(') ? 'ts_rank_cd' : 'ts_rank', plan: clean(raw.Plan),
      planningMs: raw['Planning Time'], executionMs: raw['Execution Time'] });
    return [];
  };
  for (const text of ['koduteenus eakale', 'toimetulekutoetuse taotlemine dokumendid']) {
    await postgres.lexical(plan.tenant, generation.id, documents, text, 80, null, { rank: LEXICAL_RANK_PLAIN });
  }
  // Previously purchased synthetic vector, never a user's vector or a new embedding request.
  const vector = JSON.parse(fs.readFileSync('/home/ubuntu/rag-v2-work/st/father-vector.json', 'utf8'));
  out.vectors = [];
  for (let i = 0; i < 3; i++) {
    const r = await timed(() => qdrant.query(generation, documents, vector, 80));
    out.vectors.push({ elapsedMs: r.ms, serverMs: r.value.server_ms, found: r.value.length });
  }
} finally { await app.end(); await postgres.close(); }
console.log('SPEED_AUDIT_RESULT ' + JSON.stringify(out));
process.exit(0);
