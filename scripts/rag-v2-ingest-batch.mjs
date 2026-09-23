import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readJson, writeJson } from '../lib/rag-v2/catalog.js';
import { fail } from '../lib/rag-v2/contracts.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { planIngestBatch, prepareNextBatchItem, validateIngestBatch, verifyPreparedBatch } from '../lib/rag-v2/ingest-batch.js';
import { IngestBatchQueue } from '../lib/rag-v2/ingest-batch-postgres.js';
import { createBatchReview, publishReviewedBatch } from '../lib/rag-v2/ingest-publication.js';

let queue;
try {
  const { values } = parseArgs({ options: {
    mode: { type: 'string' }, manifest: { type: 'string' }, registry: { type: 'string' }, selection: { type: 'string' }, review: { type: 'string' },
    tenant: { type: 'string' }, profile: { type: 'string' }, 'input-root': { type: 'string' }, store: { type: 'string' },
    connections: { type: 'string', default: 'tmp/rag-v2-services/connections.json' },
    'max-items': { type: 'string', default: '100' }, 'lease-seconds': { type: 'string', default: '120' },
    'development-only': { type: 'boolean', default: false },
  } });
  if (!['plan', 'enqueue', 'run', 'status', 'verify', 'review', 'publish'].includes(values.mode) || !values.manifest || !values['development-only']) fail('invalid_batch_cli');
  if (['verify', 'review', 'publish'].includes(values.mode) && !values.store
    || ['review', 'publish'].includes(values.mode) && !values.review) fail('invalid_batch_cli');
  if (values.mode === 'plan') {
    if (!values.registry || !values.selection || !values.tenant) fail('invalid_batch_cli');
    const registryFile = path.resolve(values.registry), inputRoot = path.dirname(registryFile);
    const registry = await readJson(registryFile), selection = await readJson(values.selection);
    if (!Array.isArray(selection) || !selection.length || selection.length > 1000) fail('invalid_batch_selection');
    const inputs = [];
    for (const selected of selection) {
      if (!selected || typeof selected.source !== 'string' || Object.keys(selected).some(key => !['source', 'item'].includes(key))) fail('invalid_batch_selection');
      const entries = registry.entries.filter(entry => entry.path === selected.source);
      if (entries.length !== 1) fail('registry_source_not_found');
      inputs.push(await registeredSource(inputRoot, entries[0], { itemId: selected.item }));
    }
    const profilePath = values.profile || fileURLToPath(new URL('../lib/rag-v2/domain-profiles/sotsiaalai.json', import.meta.url));
    const plan = await planIngestBatch({ tenant: values.tenant, inputRoot, inputs, profile: await readJson(profilePath),
      rights: { access: 'local_private', usage: 'development_only' } });
    await fs.mkdir(path.dirname(path.resolve(values.manifest)), { recursive: true });
    await writeJson(values.manifest, plan);
    console.log(JSON.stringify({ batch_id: plan.id, items: plan.items.length, model_calls: 0, publication: 'not_run' }));
  } else {
    const plan = validateIngestBatch(await readJson(values.manifest));
    const limit = Number(values['max-items']), leaseSeconds = Number(values['lease-seconds']);
    if (values.mode === 'run' && (!values['input-root'] || !values.store || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000
      || !Number.isSafeInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600)) fail('invalid_batch_cli');
    const connections = await readJson(values.connections);
    queue = new IngestBatchQueue(connections.postgresUrl);
    if (['enqueue', 'run'].includes(values.mode)) await queue.enqueue(plan);
    if (values.mode === 'run') {
      for (let index = 0; index < limit; index++) {
        const result = await prepareNextBatchItem({ queue, tenant: plan.tenant, batchId: plan.id,
          inputRoot: path.resolve(values['input-root']), storeRoot: path.resolve(values.store), leaseSeconds });
        if (!result) break;
        console.log(JSON.stringify(result));
      }
    }
    const options = { queue, tenant: plan.tenant, batchId: plan.id, storeRoot: values.store && path.resolve(values.store) };
    let status;
    if (values.mode === 'review') {
      const review = await createBatchReview(options);
      await fs.mkdir(path.dirname(path.resolve(values.review)), { recursive: true });
      await writeJson(values.review, review);
      status = { batch_id: plan.id, review: 'pending', items: review.items.length,
        blocked: review.items.filter(item => item.blockers.length).length, publication: 'not_run', model_calls: 0 };
    } else if (values.mode === 'publish') {
      if ((await fs.stat(values.review)).size > 64 * 1024 * 1024) fail('review_size_limit');
      status = await publishReviewedBatch({ ...options, review: await readJson(values.review) });
    } else status = values.mode === 'verify' ? await verifyPreparedBatch(options) : await queue.status(plan.tenant, plan.id);
    console.log(JSON.stringify(status, null, 2));
    if (status.state === 'needs_review') process.exitCode = 2;
  }
} catch (error) {
  // Never print connection strings, OS paths or parser text from an exception.
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'batch_cli_failed' }));
  process.exitCode = 1;
} finally { await queue?.close(); }
