import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, hash, id, nonempty, stable } from './contracts.js';
import { openCatalog, readActive, readJson, writeActive, writeJson } from './catalog.js';
import { loadPreparedItem } from './ingest-batch.js';
import { sourceHash } from './source-locations.js';
import { verifiedBundle } from './search/snapshot.js';

export const BATCH_REVIEW_SCHEMA = 'rag-v2/ingest-review-1';
const RECEIPT_SCHEMA = 'rag-v2/ingest-publication-1';
const generationId = value => value === null || typeof value === 'string' && /^generation_[a-f0-9]{64}$/.test(value);

function checkCatalog(active, tenant) {
  if (!active || active.schema_version !== 'rag-v2/catalog-1' || !active.documents || Array.isArray(active.documents)
    || (active.generation === null ? Object.keys(active.documents).length > 0 || active.tenant_id && active.tenant_id !== tenant
      : active.tenant_id !== tenant || active.generation !== id('generation', stable(active.documents)))) fail('invalid_source_generation');
}

async function reviewSnapshot({ queue, tenant, batchId, storeRoot }) {
  const plan = await queue.manifest(tenant, batchId), status = await queue.status(tenant, batchId);
  if (status.counts.queued || status.counts.processing) fail('batch_preparation_incomplete');
  await queue.verifyStore(tenant, batchId, await fs.realpath(storeRoot));
  const bundles = new Map(), items = [];
  for (const item of plan.items) {
    const row = status.items.find(row => row.id === item.id);
    if (!row) fail('batch_item_scope_mismatch');
    const bundle = row.state === 'prepared' ? verifiedBundle(await loadPreparedItem({ storeRoot, tenant, item, result: row.result, plan }), tenant) : null;
    if (bundle) bundles.set(item.id, bundle);
    items.push({ item_id: item.id, document_id: item.document_id, source_sha256: item.source_sha256,
      state: row.state, error_code: row.error_code, version_id: bundle?.version.id ?? null,
      bundle_sha256: bundle ? hash(stable(bundle)) : null,
      report_path: bundle ? `versions/${bundle.version.id}/report.html` : null,
      fields: bundle?.document.fields ?? null, warnings: bundle?.report.warnings ?? [],
      blockers: bundle ? [...new Set([
        ...bundle.report.warnings.filter(warning => warning.code.endsWith('_conflict')).map(warning => warning.code),
        ...(bundle.report.errors.length ? ['source_report_errors'] : []),
      ])].sort() : ['source_not_prepared'], decision: 'pending', note: '' });
  }
  return { bundles, items };
}

const evidenceHash = ({ tenant, batch_id, base_generation, items }) => hash(stable({ tenant, batch_id, base_generation, items }));

/** Local operator draft: source evidence is immutable; only decision, note and reviewer are editable. */
export async function createBatchReview(options) {
  const { items } = await reviewSnapshot(options);
  const active = await readActive(path.resolve(options.storeRoot, id('tenant', options.tenant)));
  checkCatalog(active, options.tenant);
  const review = { schema_version: BATCH_REVIEW_SCHEMA, tenant: options.tenant, batch_id: options.batchId,
    base_generation: active.generation, reviewed_by: '', items };
  return { ...review, evidence_sha256: evidenceHash(review) };
}

function reviewedBundles(review, snapshot, { tenant, batchId }) {
  if (!review || review.schema_version !== BATCH_REVIEW_SCHEMA || review.tenant !== tenant || review.batch_id !== batchId
    || !generationId(review.base_generation) || !nonempty(review.reviewed_by) || review.reviewed_by.length > 200
    || !Array.isArray(review.items) || review.items.length !== snapshot.items.length) fail('invalid_batch_review');
  const expected = { schema_version: BATCH_REVIEW_SCHEMA, tenant, batch_id: batchId,
    base_generation: review.base_generation, reviewed_by: review.reviewed_by, items: [],
    evidence_sha256: evidenceHash({ tenant, batch_id: batchId, base_generation: review.base_generation, items: snapshot.items }) };
  const included = [];
  for (let index = 0; index < snapshot.items.length; index++) {
    const current = snapshot.items[index], supplied = review.items[index];
    if (!supplied || !['include', 'exclude'].includes(supplied.decision)) fail('batch_review_incomplete');
    if (typeof supplied.note !== 'string' || supplied.note.length > 2000 || supplied.note.includes('\u0000')) fail('invalid_batch_review');
    if ((supplied.decision === 'exclude' || current.warnings.length) && !nonempty(supplied.note)) fail('batch_review_reason_required');
    if (supplied.decision === 'include') {
      if (current.blockers.length) fail('batch_review_blocked');
      included.push(snapshot.bundles.get(current.item_id));
    }
    expected.items.push({ ...current, decision: supplied.decision, note: supplied.note });
  }
  // Reject removed warnings, edited field values, stale results and altered item scopes.
  if (stable(review) !== stable(expected)) fail('batch_review_changed');
  if (!included.length) fail('batch_publication_empty');
  return included;
}

function nextCatalog(active, bundles, tenant) {
  checkCatalog(active, tenant);
  const documents = { ...active.documents };
  for (const bundle of bundles) documents[bundle.document.id] = {
    version_id: bundle.version.id, pdf_hash: bundle.version.pdf_hash, source_hash: sourceHash(bundle),
    source_selector: bundle.version.source_format === 'json' ? bundle.document.legacy_metadata.source_selector?.json_pointer ?? null : null,
    external_id: bundle.document.external_ids.document_id,
  };
  // Check the final set, including pre-existing documents and overlapping package selectors.
  const sources = new Map();
  for (const document of Object.values(documents)) {
    const digest = document.source_hash ?? document.pdf_hash, selector = document.source_selector;
    const previous = sources.get(digest) || [];
    if (previous.some(other => !selector || !other || selector === other || selector.startsWith(other + '/') || other.startsWith(selector + '/'))) fail('duplicate_asset_identity_conflict');
    sources.set(digest, [...previous, selector]);
  }
  return { schema_version: active.schema_version, tenant_id: tenant, generation: id('generation', stable(documents)), documents };
}

async function saveReceipt(dir, receiptId, receipt) {
  const folder = path.join(dir, 'publications');
  await fs.mkdir(folder, { recursive: true });
  const temporary = path.join(folder, `${receiptId}-${randomUUID()}.tmp`);
  await writeJson(temporary, receipt);
  await fs.rename(temporary, path.join(folder, `${receiptId}.json`));
}

/** Local publication only. The reviewer is audit attribution, never an authentication claim. */
export async function publishReviewedBatch({ review, ...options }, hooks = {}) {
  const { storeRoot, tenant, batchId } = options;
  // Verify the namespace before creating/locking any catalog directories.
  await options.queue.manifest(tenant, batchId);
  await options.queue.verifyStore(tenant, batchId, await fs.realpath(storeRoot));
  const catalog = await openCatalog(storeRoot, tenant);
  try {
    const snapshot = await reviewSnapshot(options), bundles = reviewedBundles(review, snapshot, options);
    const active = await readActive(catalog.dir);
    checkCatalog(active, tenant);
    const receiptId = id('ingest_publication', review);
    let receipt;
    try { receipt = await readJson(path.join(catalog.dir, 'publications', `${receiptId}.json`)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (receipt !== undefined) {
      if (!receipt || receipt.schema_version !== RECEIPT_SCHEMA || receipt.id !== receiptId || !receipt.base || !receipt.target || stable(receipt.review) !== stable(review)
        || receipt.base.generation !== review.base_generation
        || stable(receipt.target) !== stable(nextCatalog(receipt.base, bundles, tenant))) fail('publication_receipt_changed');
    } else {
      if (active.generation !== review.base_generation) fail('batch_review_stale_generation');
      receipt = { schema_version: RECEIPT_SCHEMA, id: receiptId, review, base: active, target: nextCatalog(active, bundles, tenant) };
      // Durable intent precedes the single catalog switch. Retries use exactly this decision.
      await saveReceipt(catalog.dir, receiptId, receipt);
    }
    const reused = stable(active) === stable(receipt.target);
    if (!reused) {
      if (stable(active) !== stable(receipt.base)) fail('batch_review_stale_generation');
      await hooks.beforePublish?.(receipt);
      await writeActive(catalog.dir, receipt.target);
      await hooks.afterPublish?.(receipt);
    }
    return { batch_id: batchId, publication_id: receiptId, publication: 'published', reused,
      generation: receipt.target.generation, included: bundles.length, excluded: review.items.length - bundles.length,
      chunks: bundles.reduce((sum, bundle) => sum + bundle.chunks.length, 0),
      search_index: 'not_run', model_calls: 0 };
  } finally { await catalog.close(); }
}
