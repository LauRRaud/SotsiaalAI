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
import { GENERATION_LAYOUT, VERSION_LAYOUT, indexLayout } from '../lib/rag-v2/search/layout.js';
import { planIndexJob, runIndexJob, validateIndexPlan, verifyIndexJob } from '../lib/rag-v2/search/index-jobs.js';

let postgres;
try {
  const { values } = parseArgs({ options: {
    mode: { type: 'string' }, tenant: { type: 'string' }, subject: { type: 'string' }, policy: { type: 'string' },
    store: { type: 'string' }, manifest: { type: 'string' }, lexical: { type: 'string', default: ESTNLTK_LEXICAL },
    // versions-v1 (ADR-036): versions indexed under the same config are listed, not indexed again.
    layout: { type: 'string', default: VERSION_LAYOUT },
    vectors: { type: 'string', multiple: true },
    connections: { type: 'string', default: 'tmp/rag-v2-services/connections.json' },
    'batch-size': { type: 'string', default: '100' }, 'max-batches': { type: 'string', default: '100' },
    'development-only': { type: 'boolean', default: false },
  } });
  if (!['plan', 'run', 'status', 'verify'].includes(values.mode) || !values['development-only'] || !values.policy || !values.manifest
    || values.mode !== 'status' && !values.store) fail('invalid_index_cli');
  const layout = indexLayout(values.layout);
  const context = { tenant: values.tenant, subject: values.subject, usage: 'development_only' }, policy = new FilePolicy(values.policy);
  const allowed = await policy.allowed(context);
  const embedding = values.mode === 'status' ? null : values.vectors?.length
    // A --vectors folder may be a purchase that stopped part-way: the vectors it did buy are read (ADR-113).
    ? (await reusableEmbeddingCatalog(values.vectors, context.tenant, { stopped: true })).embedding : new MockEmbedding();
  if (values.mode === 'plan') {
    // The version layout reads which versions are already sealed; nothing is written.
    if (layout === VERSION_LAYOUT) postgres = new IndexJobStore((await readJson(values.connections)).postgresUrl);
    const plan = await planIndexJob({ storeRoot: values.store, tenant: context.tenant, documents: allowed.documents,
      embedding: embedding.config, lexical: values.lexical, ...(layout === GENERATION_LAYOUT ? {} : {
        layout, sealedItems: (configId, versions) => postgres.sealedItems(context.tenant, configId, versions) }) });
    await fs.mkdir(path.dirname(path.resolve(values.manifest)), { recursive: true });
    await writeJson(values.manifest, plan);
    const sealed = layout === VERSION_LAYOUT ? await postgres.sealedItems(plan.tenant, plan.config.id, plan.items.map(item => item.version_id)) : new Map();
    const pending = plan.items.filter(item => !sealed.has(item.version_id));
    console.log(JSON.stringify({ generation_id: plan.generation_id, layout, documents: plan.items.length, units: plan.total_units,
      documents_to_index: pending.length, units_to_index: pending.reduce((sum, item) => sum + item.units, 0),
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
    const qdrant = values.mode === 'status' ? null : new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
    const result = values.mode === 'status' ? await postgres.indexStatus(plan.tenant, plan.generation_id)
      : values.mode === 'verify' ? await verifyIndexJob({ plan, storeRoot: values.store, postgres, qdrant, embedding, batchSize: Number(values['batch-size']) })
        : await runIndexJob({ plan, storeRoot: values.store, postgres, qdrant,
          embedding, batchSize: Number(values['batch-size']), maxBatches: Number(values['max-batches']), hooks: { beforeActivate: assertAllowed } });
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'index_cli_failed' }));
  process.exitCode = 1;
} finally { await postgres?.close(); }
