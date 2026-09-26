import fs from 'node:fs/promises';
import { assertIndexCapacity, INDEX_CAPACITY } from './capacity.js';
import path from 'node:path';
import { DEFAULT_CONFIG, fail, hash, id, stable } from '../contracts.js';
import { openCatalog, readActive } from '../catalog.js';
import { loadPinnedSnapshot, tenantId } from './snapshot.js';
import { searchConfig, verifySearchConfig, cachedIndexVector } from './indexing.js';
import { indexUnit, validateVector } from './embedding.js';
import { ESTNLTK_LEXICAL } from './morphology.js';

export const INDEX_PLAN_SCHEMA = 'rag-v2/index-plan-1';
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;

function measured(bundle, config) {
  const units = bundle.chunks.map(chunk => indexUnit(chunk, bundle, config.embedding));
  const expanded = units.reduce((sum, unit) => sum + unit.input_text.length + unit.title.length + unit.authors.length + unit.body.length + unit.search_aids.length, 0);
  if (expanded > (bundle.version.processing_config.maxExpandedChars ?? DEFAULT_CONFIG.maxExpandedChars)) fail('expanded_index_too_large');
  return { units, item: { document_id: bundle.document.id, version_id: bundle.version.id, bundle_sha256: hash(stable(bundle)),
    units_sha256: hash(stable(units)), units: units.length, embedding_input_tokens: units.reduce((sum, unit) => sum + unit.input_tokens, 0) } };
}

export function validateIndexPlan(plan) {
  if (!plan || plan.schema_version !== INDEX_PLAN_SCHEMA) fail('invalid_index_plan');
  tenantId(plan.tenant); verifySearchConfig(plan.config);
  if (!/^generation_[a-f0-9]{64}$/.test(plan.source?.source_generation) || !plan.source.documents || Array.isArray(plan.source.documents)
    || plan.source.snapshot_hash !== hash(stable(plan.source.documents))
    || !Array.isArray(plan.items) || !plan.items.length || plan.items.length > INDEX_CAPACITY.documents) fail('invalid_index_plan');
  const seen = new Set(); let count = 0;
  for (const item of plan.items) {
    if (!item || !/^document_[a-f0-9]{64}$/.test(item.document_id) || !/^version_[a-f0-9]{64}$/.test(item.version_id)
      || seen.has(item.document_id) || plan.source.documents[item.document_id]?.version_id !== item.version_id
      || !digest(item.bundle_sha256) || !digest(item.units_sha256) || !integer(item.units, INDEX_CAPACITY.units)
      || !integer(item.embedding_input_tokens, INDEX_CAPACITY.units * 8191)) fail('invalid_index_plan');
    seen.add(item.document_id); count += item.units;
  }
  assertIndexCapacity({ documents: plan.items.length, units: count });
  if (Object.keys(plan.source.documents).length !== seen.size || count !== plan.total_units
    || plan.generation_id !== id('search_generation', plan.tenant, plan.source, plan.config)
    || stable(plan.items.map(item => item.document_id)) !== stable([...seen].sort())) fail('invalid_index_plan');
  return plan;
}

export async function planIndexJob({ storeRoot, tenant, documents: allowed, embedding, lexical = ESTNLTK_LEXICAL }) {
  tenantId(tenant);
  if (!Array.isArray(allowed) || !allowed.length || allowed.length > INDEX_CAPACITY.documents) fail('allowed_documents_required');
  const active = await readActive(path.resolve(storeRoot, id('tenant', tenant)));
  if (active.tenant_id !== tenant || active.generation !== id('generation', stable(active.documents))) fail('invalid_source_generation');
  const config = searchConfig(embedding, lexical), items = [], documents = {};
  for (const documentId of [...new Set(allowed)].sort()) {
    if (!active.documents[documentId]) fail('document_not_in_source_generation');
    documents[documentId] = active.documents[documentId];
    const snapshot = await loadPinnedSnapshot(storeRoot, tenant, active.generation, { [documentId]: active.documents[documentId] });
    items.push(measured(snapshot.bundles[0], config).item);
  }
  const source = { source_generation: active.generation, documents, snapshot_hash: hash(stable(documents)) };
  return validateIndexPlan({ schema_version: INDEX_PLAN_SCHEMA, tenant, config, source, items,
    total_units: items.reduce((sum, item) => sum + item.units, 0), generation_id: id('search_generation', tenant, source, config) });
}

export function validateIndexProgress(plan, job) {
  if (!integer(job.document_offset, plan.items.length) || !integer(job.unit_offset, 5000) || !integer(job.completed_units, plan.total_units)) fail('invalid_index_progress');
  const current = plan.items[job.document_offset];
  if ((!current && job.unit_offset !== 0) || current && job.unit_offset > current.units
    || job.completed_units !== plan.items.slice(0, job.document_offset).reduce((sum, item) => sum + item.units, 0) + job.unit_offset
    || job.state === 'ready' && job.document_offset !== plan.items.length) fail('invalid_index_progress');
}

async function loadPlannedDocument(plan, storeRoot, item) {
  const snapshot = await loadPinnedSnapshot(storeRoot, plan.tenant, plan.source.source_generation, { [item.document_id]: plan.source.documents[item.document_id] });
  const result = measured(snapshot.bundles[0], plan.config);
  if (stable(result.item) !== stable(item)) fail('index_source_changed');
  return { snapshot, bundle: snapshot.bundles[0], units: result.units };
}

async function vectorsFor(units, bundle, plan, postgres, embedding, counters, readOnly = false) {
  const vectors = [];
  for (const unit of units) {
    let { key, vector } = await cachedIndexVector({ postgres, tenant: plan.tenant, rights: bundle.document.rights,
      config: plan.config, unit, embedding, readOnly });
    if (vector) { if (!readOnly) counters.cache_hits++; }
    else {
      if (readOnly) fail('index_vector_checkpoint_missing');
      vector = validateVector(await embedding.embed(unit.input_text), plan.config.embedding);
      await postgres.cachePut(plan.tenant, key, plan.config.id, unit.input_hash, vector);
      // Verify the winning immutable cache row after a concurrent insert.
      if (stable(await postgres.cacheGet(plan.tenant, key, plan.config.id, unit.input_hash)) !== stable(vector)) fail('embedding_cache_integrity_failed');
      if (plan.config.embedding.embedding_mode === 'mock') counters.mock_vectors_created++;
    }
    vectors.push(validateVector(vector, plan.config.embedding));
  }
  return vectors;
}

async function checkSourceHead(plan, storeRoot) {
  const active = await readActive(path.resolve(storeRoot, id('tenant', plan.tenant)));
  if (active.tenant_id !== plan.tenant || active.generation !== plan.source.source_generation
    || active.generation !== id('generation', stable(active.documents))
    || plan.items.some(item => stable(active.documents[item.document_id]) !== stable(plan.source.documents[item.document_id]))) fail('index_source_generation_changed');
}

/** Persisted vectors or the local test adapter only; this worker never creates paid embeddings. */
export async function runIndexJob({ plan, storeRoot, postgres, qdrant, embedding, batchSize = 100, maxBatches = 100, leaseSeconds = 120, hooks = {} }) {
  validateIndexPlan(plan);
  if (!integer(batchSize, 100) || !batchSize || !integer(maxBatches, 10000) || !maxBatches) fail('invalid_index_batch');
  if (stable(embedding.config) !== stable(plan.config.embedding)) fail('index_embedding_config_mismatch');
  if (embedding.config.embedding_mode === 'real' && embedding.source !== 'persisted_vectors') fail('persisted_real_vectors_required');
  const storageRoot = await fs.realpath(storeRoot);
  await checkSourceHead(plan, storageRoot);
  const generation = await postgres.enqueueIndex(plan, storageRoot);
  const current = await postgres.indexJob(plan.tenant, plan.generation_id);
  const counters = { batches_completed: 0, cache_hits: 0, mock_vectors_created: 0, external_embedding_calls: 0, generation_calls: 0 };
  if (current.state === 'ready') {
    const active = await postgres.active(plan.tenant);
    if (active.id !== plan.generation_id) fail('superseded_index_job');
    return { ...await postgres.indexStatus(plan.tenant, plan.generation_id), ...counters, reused: true };
  }
  let claim = await postgres.claimIndex(plan.tenant, plan.generation_id, leaseSeconds);
  try {
    await hooks.afterClaim?.(claim);
    await qdrant.ensure(generation);
    while (claim.document_offset < plan.items.length && counters.batches_completed < maxBatches) {
      const item = plan.items[claim.document_offset], loaded = await loadPlannedDocument(plan, storageRoot, item);
      await postgres.renewIndex(claim, leaseSeconds);
      if (claim.unit_offset === 0) await postgres.importSnapshot(loaded.snapshot, generation.id, loaded.units, { partial: true });
      do {
        await postgres.renewIndex(claim, leaseSeconds);
        const units = loaded.units.slice(claim.unit_offset, claim.unit_offset + batchSize);
        const vectors = await vectorsFor(units, loaded.bundle, plan, postgres, embedding, counters);
        if (units.length) {
          await qdrant.upsert(generation, units, vectors);
          await qdrant.verifyBatch(generation, units, vectors);
        }
        await hooks.afterBatchWrite?.({ claim, generation, units });
        const offset = claim.unit_offset + units.length, complete = offset === item.units;
        claim = await postgres.advanceIndex(claim, { document_offset: claim.document_offset + (complete ? 1 : 0),
          unit_offset: complete ? 0 : offset, completed_units: claim.completed_units + units.length });
        counters.batches_completed++;
        if (complete) break;
      } while (counters.batches_completed < maxBatches);
    }
    if (claim.document_offset === plan.items.length) {
      // Check every completed checkpoint against both stores before exposing the generation.
      for (const item of plan.items) {
        await postgres.renewIndex(claim, leaseSeconds);
        const loaded = await loadPlannedDocument(plan, storageRoot, item);
        const stored = await postgres.bundles(plan.tenant, generation.id, [item.document_id]);
        const units = await postgres.units(plan.tenant, generation.id, [item.document_id]);
        if (stored.length !== 1 || hash(stable(stored[0])) !== item.bundle_sha256 || stable(units) !== stable(loaded.units)) fail('index_checkpoint_integrity_failed');
        for (let offset = 0; offset < units.length; offset += batchSize) {
          await postgres.renewIndex(claim, leaseSeconds);
          const batch = units.slice(offset, offset + batchSize);
          await qdrant.verifyBatch(generation, batch, await vectorsFor(batch, loaded.bundle, plan, postgres, embedding, counters, true));
        }
      }
      await qdrant.verifyCount(generation);
      await hooks.beforeActivate?.(generation);
      await postgres.renewIndex(claim, leaseSeconds);
      // Serialize the final source-head check with publication, not with the whole indexing run.
      const catalog = await openCatalog(storageRoot, plan.tenant);
      try {
        await checkSourceHead(plan, storageRoot);
        await postgres.activateIndex(claim, generation);
      } finally { await catalog.close(); }
    }
    return { ...await postgres.indexStatus(plan.tenant, plan.generation_id), ...counters, reused: false };
  } finally { await postgres.releaseIndex(claim); }
}
