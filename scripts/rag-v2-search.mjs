import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { readJson } from '../lib/rag-v2/catalog.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { FilePolicy } from '../lib/rag-v2/search/policy.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { evidenceHtml } from '../lib/rag-v2/search/export.js';

let postgres;
try {
  const { values } = parseArgs({ options: { mode: { type: 'string' }, tenant: { type: 'string' }, subject: { type: 'string' },
    store: { type: 'string' }, policy: { type: 'string' }, query: { type: 'string' }, language: { type: 'string', default: 'et' },
    connections: { type: 'string', default: 'tmp/rag-v2-services/connections.json' }, output: { type: 'string' }, graph: { type: 'boolean', default: false },
    'development-only': { type: 'boolean', default: false } } });
  if (!values['development-only'] || !['index', 'retrieve'].includes(values.mode) || !values.policy) throw new Error('local_cli_arguments_required');
  const connections = await readJson(values.connections), context = { tenant: values.tenant, subject: values.subject, usage: 'development_only' };
  const policy = new FilePolicy(values.policy), allowed = await policy.allowed(context);
  postgres = new PostgresCatalog(connections.postgresUrl);
  const qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey), embedding = new MockEmbedding();
  if (values.mode === 'index') {
    const snapshot = await loadSnapshot(values.store, context.tenant, allowed.documents);
    console.log(JSON.stringify(await indexSnapshot({ snapshot, postgres, qdrant, embedding }), null, 2));
  } else {
    if (!values.output) throw new Error('private_output_required');
    const out = path.resolve(values.output), privateRoot = path.resolve('tmp');
    if (!out.startsWith(privateRoot + path.sep)) throw new Error('output_must_be_under_tmp');
    const bundle = await retrieve({ postgres, qdrant, embedding, policy, context, query: { text: values.query, language: values.language, graph: values.graph } });
    const versions = await Promise.allSettled([postgres.pool.query('SHOW server_version'), qdrant.request('/')]);
    bundle.measurements.environment = { node: process.version, platform: process.platform, arch: process.arch, measured_query_runs: 1,
      postgres: versions[0].status === 'fulfilled' ? versions[0].value.rows[0].server_version : 'unavailable',
      qdrant: versions[1].status === 'fulfilled' ? versions[1].value.version : 'unavailable' };
    await fs.mkdir(out, { recursive: true });
    await fs.writeFile(path.join(out, 'evidence.json'), JSON.stringify(bundle, null, 2));
    await fs.writeFile(path.join(out, 'evidence.html'), evidenceHtml(bundle));
    console.log(JSON.stringify({ state: bundle.state, error: bundle.error, generation: bundle.generation_id, embedding_mode: bundle.embedding_mode,
      evidence_count: bundle.evidence.length, measurements: bundle.measurements, output: out }, null, 2));
    if (bundle.state === 'error') process.exitCode = 1;
  }
} catch (error) { console.error(JSON.stringify({ ok: false, code: error.code || 'search_cli_failed' })); process.exitCode = 1; }
finally { if (postgres) await postgres.close(); }
