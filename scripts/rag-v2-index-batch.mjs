import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fail } from '../lib/rag-v2/contracts.js';
import { readJson, writeJson } from '../lib/rag-v2/catalog.js';
import { FilePolicy } from '../lib/rag-v2/search/policy.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { reusableEmbeddingCatalog } from '../lib/rag-v2/search/pilot-runner.js';
import { ESTNLTK_LEXICAL } from '../lib/rag-v2/search/morphology.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { IndexJobStore } from '../lib/rag-v2/search/index-jobs-postgres.js';
import { planIndexJob, runIndexJob, validateIndexPlan } from '../lib/rag-v2/search/index-jobs.js';

let postgres;
try {
  const { values } = parseArgs({ options: {
    mode: { type: 'string' }, tenant: { type: 'string' }, subject: { type: 'string' }, policy: { type: 'string' },
    store: { type: 'string' }, manifest: { type: 'string' }, lexical: { type: 'string', default: ESTNLTK_LEXICAL },
    vectors: { type: 'string', multiple: true },
    connections: { type: 'string', default: 'tmp/rag-v2-services/connections.json' },
    'batch-size': { type: 'string', default: '100' }, 'max-batches': { type: 'string', default: '100' },
    'development-only': { type: 'boolean', default: false },
  } });
  if (!['plan', 'run', 'status'].includes(values.mode) || !values['development-only'] || !values.policy || !values.manifest
    || values.mode !== 'status' && !values.store) fail('invalid_index_cli');
  const context = { tenant: values.tenant, subject: values.subject, usage: 'development_only' }, policy = new FilePolicy(values.policy);
  const allowed = await policy.allowed(context);
  const embedding = values.mode === 'status' ? null : values.vectors?.length
    ? (await reusableEmbeddingCatalog(values.vectors, context.tenant)).embedding : new MockEmbedding();
  if (values.mode === 'plan') {
    const plan = await planIndexJob({ storeRoot: values.store, tenant: context.tenant, documents: allowed.documents,
      embedding: embedding.config, lexical: values.lexical });
    await fs.mkdir(path.dirname(path.resolve(values.manifest)), { recursive: true });
    await writeJson(values.manifest, plan);
    console.log(JSON.stringify({ generation_id: plan.generation_id, documents: plan.items.length, units: plan.total_units,
      embedding_mode: plan.config.embedding.embedding_mode, external_embedding_calls: 0 }));
  } else {
    if ((await fs.stat(values.manifest)).size > 16 * 1024 * 1024) fail('index_plan_size_limit');
    const plan = validateIndexPlan(await readJson(values.manifest));
    const assertAllowed = async () => {
      const current = await policy.allowed(context);
      if (context.tenant !== plan.tenant || plan.items.some(item => !current.documents.includes(item.document_id))) fail('index_plan_not_allowed');
    };
    await assertAllowed();
    const connections = await readJson(values.connections);
    postgres = new IndexJobStore(connections.postgresUrl);
    const result = values.mode === 'status' ? await postgres.indexStatus(plan.tenant, plan.generation_id)
      : await runIndexJob({ plan, storeRoot: values.store, postgres, qdrant: new QdrantIndex(connections.qdrantUrl, connections.qdrantKey),
        embedding, batchSize: Number(values['batch-size']), maxBatches: Number(values['max-batches']), hooks: { beforeActivate: assertAllowed } });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'index_cli_failed' }));
  process.exitCode = 1;
} finally { await postgres?.close(); }
