import { configuration, fail, hash, id, nonempty, stable, validateMetadata } from './contracts.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { readInput, readJson, loadVersion } from './catalog.js';
import { adaptMetadata } from './metadata-adapter.js';
import { prepareIngest } from './ingestion.js';
import { sourceAsset, sourceFormat, sourceHash } from './source-locations.js';
import { TOKENIZER, tokenCount } from './search/embedding.js';

export const INGEST_BATCH_SCHEMA = 'rag-v2/ingest-batch-1';
const MAX_ITEMS = 1000, MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const compare = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

function batchSettings(value) {
  if (!nonempty(value.tenant) || value.tenant.length > 200) fail('tenant_required');
  if (!nonempty(value.profile?.id) || !nonempty(value.profile?.version)) fail('profile_required');
  if (value.rights?.access !== 'local_private' || value.rights?.usage !== 'development_only') fail('explicit_local_rights_required');
  return { schema_version: INGEST_BATCH_SCHEMA, tenant: value.tenant, profile: value.profile,
    rights: value.rights, config: configuration(value.config) };
}

function itemMetadata(item, tenant) {
  if (!item || typeof item.metadata_json !== 'string') fail('invalid_batch_metadata');
  let original;
  try { original = JSON.parse(item.metadata_json); } catch { fail('invalid_batch_metadata'); }
  const metadata = adaptMetadata(original);
  validateMetadata(metadata);
  if (item.document_id !== id('document', tenant, metadata.source_type, metadata.document_id)
    || !digest(item.source_sha256) || !Number.isSafeInteger(item.source_bytes) || item.source_bytes < 1
    || item.id !== id('ingest_item', item.document_id, item.source_sha256, item.metadata_json)) fail('invalid_batch_item');
  return metadata;
}

/** Freeze exact metadata and source hashes. No parsing, publication or external model calls. */
export async function planIngestBatch({ inputRoot, inputs, ...options }) {
  const base = batchSettings(options);
  if (!Array.isArray(inputs) || !inputs.length || inputs.length > MAX_ITEMS) fail('invalid_batch_size');
  const items = [];
  for (const original of inputs) {
    const metadata = adaptMetadata(original);
    validateMetadata(metadata);
    // Canonical JSON makes the plan independent of object key and selection order.
    const metadataJson = stable(original);
    if (Buffer.byteLength(metadataJson) > base.config.maxMetadataBytes) fail('input_size_limit');
    const bytes = await readInput(inputRoot, metadata.source_path, base.config.maxFileBytes);
    const documentId = id('document', base.tenant, metadata.source_type, metadata.document_id);
    const sourceHash = hash(bytes);
    if (original.registry_provenance?.source_sha256 && original.registry_provenance.source_sha256 !== sourceHash) fail('registry_source_hash_mismatch');
    items.push({ id: id('ingest_item', documentId, sourceHash, metadataJson), document_id: documentId,
      source_sha256: sourceHash, source_bytes: bytes.length, metadata_json: metadataJson });
  }
  const body = { ...base, items: items.sort(compare) };
  return validateIngestBatch({ ...body, id: id('ingest_batch', body) });
}

export function validateIngestBatch(plan) {
  if (!plan || plan.schema_version !== INGEST_BATCH_SCHEMA || Buffer.byteLength(stable(plan)) > MAX_MANIFEST_BYTES) fail('invalid_batch_manifest');
  const base = batchSettings(plan);
  if (!Array.isArray(plan.items) || !plan.items.length || plan.items.length > MAX_ITEMS) fail('invalid_batch_size');
  const documents = new Set(), sources = new Map();
  for (const item of plan.items) {
    const metadata = itemMetadata(item, plan.tenant);
    if (Buffer.byteLength(item.metadata_json) > base.config.maxMetadataBytes || item.source_bytes > base.config.maxFileBytes) fail('input_size_limit');
    if (documents.has(item.document_id)) fail('batch_document_conflict');
    documents.add(item.document_id);
    const selector = sourceFormat(metadata) === 'json' ? metadata.source_selector?.json_pointer || '' : '';
    const previous = sources.get(item.source_sha256) || [];
    if (previous.some(value => !value || !selector || value === selector || value.startsWith(selector + '/') || selector.startsWith(value + '/'))) fail('batch_duplicate_source');
    sources.set(item.source_sha256, [...previous, selector]);
  }
  const body = { ...base, items: [...plan.items].sort(compare) };
  if (plan.id !== id('ingest_batch', body) || stable(plan) !== stable({ ...body, id: plan.id })) fail('batch_manifest_changed');
  return plan;
}

export function preparedMeasurements(bundle) {
  return { source_format: bundle.version.source_format, document_id: bundle.document.id, version_id: bundle.version.id,
    chunks: bundle.chunks.length, source_units: bundle.source_units.length,
    source_chars: bundle.source_units.reduce((sum, unit) => sum + unit.raw_text.length, 0),
    embedding_input_tokens: bundle.chunks.reduce((sum, chunk) => sum + tokenCount(chunk.retrieval_text), 0),
    tokenizer: TOKENIZER, embedding_input_version: bundle.version.processing_config.embeddingInputVersion,
    warnings: [...new Set(bundle.report.warnings.map(warning => warning.code))].sort(),
    model_calls: 0, embedding_calls: 0, knowledge_preparation: 'not_run', search_index: 'not_run' };
}

/** A queue result is a checkpoint, not a substitute for checking the persisted assets. */
export async function loadPreparedItem({ storeRoot, tenant, item, result, plan }) {
  if (!result) fail('batch_result_mismatch');
  const dir = path.resolve(storeRoot, id('tenant', tenant));
  const bundle = await loadVersion(dir, result.version_id);
  if (bundle.tenant_id !== tenant || bundle.document.id !== item.document_id
    || sourceHash(bundle) !== item.source_sha256
    || bundle.version.metadata_hash !== hash(item.metadata_json)
    || bundle.version.profile_hash !== hash(stable(plan.profile))
    || stable(bundle.version.processing_config) !== stable(plan.config)
    || stable(bundle.document.rights) !== stable(plan.rights)
    || stable(preparedMeasurements(bundle)) !== stable(result)) fail('batch_result_mismatch');
  const manifest = await readJson(path.join(dir, 'versions', result.version_id, 'manifest.json'));
  if (manifest.files[sourceAsset(bundle)] !== item.source_sha256 || manifest.files['metadata.json'] !== hash(item.metadata_json)
    || bundle.assets.some(asset => manifest.files[asset.path] !== asset.sha256)) fail('source_asset_hash_mismatch');
  return bundle;
}

/** Revalidate immutable assets before a separate publication/indexing decision. */
export async function verifyPreparedBatch({ queue, tenant, batchId, storeRoot }) {
  const plan = await queue.manifest(tenant, batchId), status = await queue.status(tenant, batchId);
  if (status.state !== 'prepared') fail('batch_not_prepared');
  await queue.verifyStore(tenant, batchId, await fs.realpath(storeRoot));
  const bundles = [];
  for (const item of plan.items) {
    const result = status.items.find(row => row.id === item.id).result;
    bundles.push(await loadPreparedItem({ storeRoot, tenant, item, result, plan }));
  }
  return { batch_id: batchId, verified: bundles.length, chunks: bundles.reduce((sum, b) => sum + b.chunks.length, 0),
    embedding_input_tokens: status.items.reduce((sum, row) => sum + row.result.embedding_input_tokens, 0),
    publication: 'not_checked', model_calls: 0 };
}

/** Claim one local preparation job. Lease fencing protects completion, immutable output protects retries. */
export async function prepareNextBatchItem({ queue, tenant, batchId, inputRoot, storeRoot, leaseSeconds = 120 }, dependencies = {}) {
  const plan = await queue.manifest(tenant, batchId);
  await fs.mkdir(storeRoot, { recursive: true });
  await queue.bindStore(tenant, batchId, await fs.realpath(storeRoot));
  const claim = await queue.claim(tenant, batchId, leaseSeconds);
  if (!claim) return null;
  const item = plan.items.find(item => item.id === claim.id);
  if (!item || item.document_id !== claim.document_id) fail('batch_item_scope_mismatch');
  await dependencies.afterClaim?.(claim);
  let result;
  try {
    const prepared = await prepareIngest({ tenant, inputRoot, storeRoot, profile: plan.profile, rights: plan.rights,
      config: plan.config, metadataJson: item.metadata_json, expectedSourceHash: item.source_sha256 }, dependencies);
    if (prepared.bundle.document.id !== item.document_id) fail('batch_item_scope_mismatch');
    result = preparedMeasurements(prepared.bundle);
  } catch (error) {
    const code = typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'batch_preparation_failed';
    await queue.finish(claim, { error: code });
    return { item_id: item.id, state: 'needs_review', error: code };
  }
  // Failure here simulates death after durable preparation and before queue acknowledgement.
  await dependencies.afterPrepared?.(result);
  await queue.finish(claim, { result });
  return { item_id: item.id, state: 'prepared', result };
}
