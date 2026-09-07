import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import defaultProfile from '../domain-profiles/sotsiaalai.json' with { type: 'json' };
import { configuration, hash, id, stable, validateMetadata } from '../contracts.js';
import { ingest } from '../ingestion.js';
import { openCatalog, readJson } from '../catalog.js';
import { loadSnapshot } from '../search/snapshot.js';
import { FilePolicy } from '../search/policy.js';
import { buildMultiSourcePlan, multiSourceLedgerRoot } from '../search/multi-source-plan.js';
import { reusableEmbeddingCatalog, runPilot } from '../search/pilot-runner.js';
import { indexSnapshot } from '../search/indexing.js';
import { PostgresCatalog } from '../search/postgres.js';
import { QdrantIndex } from '../search/qdrant.js';
import { costNanos, formatUsd, nanoUsd, validatePrice } from '../search/pilot-manifest.js';
import { configFingerprint, validateAdminConfig } from './config.js';

export function intakeError(code, status = 400) { return Object.assign(new Error(code), { code, status }); }
const safeCode = error => /^[a-z][a-z0-9_]{1,80}$/.test(error?.code || '') ? error.code : 'rag_v2_intake_failed';
const jsonBytes = value => Buffer.from(JSON.stringify(value) + '\n', 'utf8');
const fingerprint = configFingerprint;
const contextFor = config => ({ tenant: config.tenant, subject: config.subject, usage: 'development_only' });

async function atomicWrite(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  const handle = await fs.open(temporary, 'wx', 0o600);
  try { await handle.writeFile(jsonBytes(value)); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temporary, file);
}
async function lock(dir) {
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'operation.lock');
  const handle = await fs.open(file, 'wx', 0o600).catch(error => {
    if (error.code === 'EEXIST') throw intakeError('rag_v2_publication_busy', 409);
    throw error;
  });
  try { await handle.writeFile(jsonBytes({ pid: process.pid, at: new Date().toISOString() })); await handle.sync(); }
  catch (error) { await handle.close(); await fs.unlink(file); throw error; }
  return async () => { await handle.close(); await fs.unlink(file); };
}
function rootFor(config) { return path.join(config.workRoot, id('intake', config.id)); }
function jobDir(config, jobId) {
  if (!/^job_[a-f0-9]{64}$/.test(jobId || '')) throw intakeError('rag_v2_job_invalid', 404);
  return path.join(rootFor(config), 'jobs', jobId);
}
export function canonicalMetadata(bytes, limit) {
  if (!Buffer.isBuffer(bytes) || bytes.length > limit) throw intakeError('invalid_metadata', 413);
  let metadata;
  try { metadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw intakeError('invalid_metadata_json'); }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw intakeError('invalid_metadata');
  // An imported path is provenance only; the request cannot choose a server file.
  metadata = { ...metadata, source_path: 'source.pdf' };
  validateMetadata(metadata);
  if (jsonBytes(metadata).length > limit) throw intakeError('invalid_metadata', 413);
  return metadata;
}
function summary(bundle) {
  return { document_id: bundle.document.id, version_id: bundle.version.id, pdf_sha256: bundle.version.pdf_hash,
    metadata_sha256: bundle.version.metadata_hash, pages: bundle.pages.length, chunks: bundle.chunks.length,
    quality: bundle.report.quality_state, warnings: bundle.report.warnings, fields: bundle.document.fields,
    excerpt: bundle.chunks.slice(0, 3).map(chunk => ({ id: chunk.id, pages: chunk.pdf_pages, text: chunk.source_text })) };
}
export function publicReceipt(receipt) {
  return { schema_version: receipt.schema_version, state: receipt.state, job_id: receipt.job_id,
    created_at: receipt.created_at, expires_at: receipt.expires_at, metadata: receipt.metadata, bundle: receipt.bundle,
    plan: receipt.prepared ? { hash: receipt.prepared.manifest_sha256, documents: receipt.prepared.plan.document_count,
      external_inputs: receipt.prepared.manifest.max_api_attempts, reused_inputs: receipt.prepared.manifest.reused_input_count,
      input_tokens: receipt.prepared.manifest.total_input_tokens } : null,
    preparation_error: receipt.preparation_error || null, publication_error: receipt.publication_error || null,
    published: receipt.state === 'published', publication: receipt.publication || null };
}
export function approvalFor(prepared, config, price, actor) {
  const manifest = prepared.manifest;
  if (manifest.total_input_tokens > config.maxInputTokens || manifest.max_api_attempts > config.maxApiAttempts
    || costNanos(manifest.total_input_tokens, price) > nanoUsd(config.maxSpendUsd)) throw intakeError('rag_v2_spend_cap_exceeded', 409);
  return { schema_version: 'rag-v2/pilot-approval-1', state: 'approved', material_egress_approved: true, spend_cap_approved: true,
    approved_by: actor, approved_at: new Date().toISOString(), approval_basis: 'Authenticated admin reviewed this frozen document intake and requested publication within the configured total cap.',
    source_plan_id: manifest.source_plan_id, egress_manifest_sha256: prepared.manifest_sha256, tenant: manifest.tenant,
    config: manifest.config, files: manifest.files, max_api_attempts: manifest.max_api_attempts,
    max_total_input_tokens: manifest.total_input_tokens, retries: 0, generation_calls: 0, currency: 'USD', approved_spend_cap: config.maxSpendUsd };
}
function emptyBudget(config) {
  return { schema_version: 'rag-v2/admin-budget-1', config_fingerprint: fingerprint(config),
    reserved_nano_usd: '0', reserved_attempts: 0, reserved_tokens: 0, plans: {} };
}
export function validateBudget(value, config) {
  const bad = () => { throw intakeError('rag_v2_budget_corrupt', 503); };
  if (value?.schema_version !== 'rag-v2/admin-budget-1' || value.config_fingerprint !== fingerprint(config)
    || !value.plans || Array.isArray(value.plans) || typeof value.plans !== 'object') bad();
  let nanos = 0n, attempts = 0, tokens = 0;
  for (const [key, entry] of Object.entries(value.plans)) {
    if (!/^[a-f0-9]{64}$/.test(key) || !['reserved', 'stopped', 'vectors_ready', 'published'].includes(entry.state)
      || !/^(0|[1-9]\d*)$/.test(entry.reserved_nano_usd || '')
      || !Number.isSafeInteger(entry.reserved_attempts) || entry.reserved_attempts < 0
      || !Number.isSafeInteger(entry.reserved_tokens) || entry.reserved_tokens < 0
      || entry.approval?.egress_manifest_sha256 !== key || !entry.price
      || entry.reserved_attempts !== entry.approval.max_api_attempts || entry.reserved_tokens !== entry.approval.max_total_input_tokens) bad();
    try { if (String(costNanos(entry.reserved_tokens, entry.price)) !== entry.reserved_nano_usd) bad(); } catch { bad(); }
    nanos += BigInt(entry.reserved_nano_usd); attempts += entry.reserved_attempts; tokens += entry.reserved_tokens;
  }
  if (String(nanos) !== value.reserved_nano_usd || attempts !== value.reserved_attempts || tokens !== value.reserved_tokens
    || !Number.isSafeInteger(attempts) || !Number.isSafeInteger(tokens) || nanos > nanoUsd(config.maxSpendUsd)
    || attempts > config.maxApiAttempts || tokens > config.maxInputTokens) bad();
  return value;
}
async function openIndex(config) {
  let connections;
  try { connections = await readJson(config.connectionsFile); } catch { throw intakeError('rag_v2_connections_not_configured', 503); }
  const postgres = new PostgresCatalog(connections.postgresUrl);
  try {
    const qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
    await Promise.all([postgres.pool.query('SELECT 1'), qdrant.request('/')]);
    return { postgres, qdrant, close: () => postgres.close() };
  } catch { await postgres.close(); throw intakeError('rag_v2_connections_unavailable', 503); }
}

/** Trusted server adapter supplies identity/config revalidation; all source and job paths are server-owned. */
export class IntakeService {
  constructor({ config, userId, assertAccess, dependencies = {} }) {
    this.config = validateAdminConfig(config);
    this.userId = userId;
    if (typeof assertAccess !== 'function') throw intakeError('rag_v2_access_checker_required', 403);
    this.assertAccess = assertAccess;
    this.deps = dependencies;
    this.policy = dependencies.policy || new FilePolicy(config.policyFile);
  }
  async access() {
    validateAdminConfig(this.config);
    if (!this.config.users.includes(this.userId)) throw intakeError('forbidden', 403);
    await this.assertAccess();
    const allowed = await this.policy.allowed(contextFor(this.config));
    return allowed.documents.filter(document => this.config.documentIds.includes(document)).sort();
  }
  async vectors(dirs) {
    if (!dirs.length) return null;
    const catalog = await (this.deps.reuseCatalog || reusableEmbeddingCatalog)(dirs, this.config.tenant);
    if (catalog.embedding?.provenance !== 'openai_https') throw intakeError('rag_v2_reuse_not_real', 409);
    return catalog;
  }
  async receipt(jobId, documents) {
    let receipt;
    try { receipt = await readJson(path.join(jobDir(this.config, jobId), 'receipt.json')); }
    catch (error) { if (error.code === 'ENOENT') throw intakeError('rag_v2_job_invalid', 404); throw error; }
    if (receipt.schema_version !== 'rag-v2/admin-intake-receipt-1' || receipt.job_id !== jobId || receipt.actor_id !== this.userId
      || receipt.config_fingerprint !== fingerprint(this.config)) throw intakeError('rag_v2_job_scope_mismatch', 403);
    if (!Number.isFinite(Date.parse(receipt.expires_at)) || Date.parse(receipt.expires_at) <= Date.now()) throw intakeError('rag_v2_job_expired', 410);
    if (!documents.includes(receipt.bundle?.document_id)) throw intakeError('rag_v2_document_not_allowed', 403);
    return receipt;
  }
  async get(jobId, asset) {
    const documents = await this.access(), receipt = await this.receipt(jobId, documents);
    if (!asset) return publicReceipt(receipt);
    if (!['pdf', 'metadata'].includes(asset)) throw intakeError('rag_v2_asset_invalid');
    const bytes = await fs.readFile(path.join(jobDir(this.config, jobId), asset === 'pdf' ? 'source.pdf' : 'metadata.json'));
    if (hash(bytes) !== receipt.bundle[asset === 'pdf' ? 'pdf_sha256' : 'metadata_sha256']) throw intakeError('version_integrity_failed', 409);
    await this.access();
    return { bytes, type: asset === 'pdf' ? 'application/pdf' : 'application/json' };
  }
  async prepare({ pdfBytes, metadataBytes, sourceUse }) {
    const documents = await this.access(), config = this.config;
    if (sourceUse !== true) throw intakeError('source_use_confirmation_required');
    if (!Buffer.isBuffer(pdfBytes) || pdfBytes.length > config.maxFileBytes) throw intakeError('invalid_pdf', 413);
    if (!pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw intakeError('invalid_pdf_signature');
    const metadata = canonicalMetadata(metadataBytes, config.maxMetadataBytes);
    const documentId = id('document', config.tenant, metadata.source_type, metadata.document_id);
    if (!documents.includes(documentId)) throw intakeError('rag_v2_document_not_approved', 403);
    const release = await lock(rootFor(config));
    try {
      const jobId = id('job', randomUUID(), this.userId, config.id), dir = jobDir(config, jobId);
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.writeFile(path.join(dir, 'source.pdf'), pdfBytes, { flag: 'wx', mode: 0o600 });
      await fs.writeFile(path.join(dir, 'metadata.json'), jsonBytes(metadata), { flag: 'wx', mode: 0o600 });
      const beforePublish = async () => {
        const current = await this.access();
        if (!current.includes(documentId)) throw intakeError('rag_v2_document_not_allowed', 403);
      };
      const result = await (this.deps.ingest || ingest)({ tenant: config.tenant, inputRoot: dir, metadataFile: 'metadata.json', storeRoot: config.storeRoot,
        profile: this.deps.profile || defaultProfile, config: configuration({ maxFileBytes: config.maxFileBytes, maxMetadataBytes: config.maxMetadataBytes }),
        rights: { access: 'local_private', usage: 'development_only' } }, { ...this.deps.ingestDependencies, beforePublish });
      const receipt = { schema_version: 'rag-v2/admin-intake-receipt-1', state: 'ingested', job_id: jobId,
        actor_id: this.userId, config_fingerprint: fingerprint(config), created_at: new Date().toISOString(),
        expires_at: new Date(Math.min(Date.now() + 86400000, Date.parse(config.expiresAt))).toISOString(),
        metadata, bundle: summary(result.bundle), source: null, prepared: null };
      // The successful upload remains reviewable if corpus/index preparation fails.
      await atomicWrite(path.join(dir, 'receipt.json'), receipt);
      try {
        const snapshot = await loadSnapshot(config.storeRoot, config.tenant, await this.access());
        if (snapshot.documents[documentId]?.version_id !== result.bundle.version.id) throw intakeError('rag_v2_source_changed', 409);
        const reuse = await this.vectors(config.embeddingReuseDirs);
        receipt.prepared = buildMultiSourcePlan({ snapshot, questionSets: [], reuseCatalog: reuse });
        receipt.source = { generation: snapshot.source_generation, hash: snapshot.snapshot_hash, documents: snapshot.documents };
        receipt.state = 'prepared';
      } catch (error) { receipt.preparation_error = safeCode(error); }
      await atomicWrite(path.join(dir, 'receipt.json'), receipt);
      await this.access();
      return publicReceipt(receipt);
    } finally { await release(); }
  }
  async snapshotFor(receipt) {
    const snapshot = await loadSnapshot(this.config.storeRoot, this.config.tenant, await this.access());
    if (!receipt.source || snapshot.source_generation !== receipt.source.generation || snapshot.snapshot_hash !== receipt.source.hash
      || stable(snapshot.documents) !== stable(receipt.source.documents)
      || snapshot.documents[receipt.bundle.document_id]?.version_id !== receipt.bundle.version_id) throw intakeError('rag_v2_source_changed', 409);
    return snapshot;
  }
  async budget() {
    const file = path.join(rootFor(this.config), 'budget.json');
    try { return validateBudget(await readJson(file), this.config); }
    catch (error) { if (error.code === 'ENOENT') return emptyBudget(this.config); throw error; }
  }
  async status() {
    await this.access();
    const budget = await this.budget();
    return { configured: true, cap_usd: this.config.maxSpendUsd, reserved_usd: formatUsd(budget.reserved_nano_usd),
      expires_at: this.config.expiresAt, document_count: this.config.documentIds.length,
      max_file_bytes: this.config.maxFileBytes, max_metadata_bytes: this.config.maxMetadataBytes };
  }
  async publish(jobId, reviewedHash) {
    const config = this.config;
    await this.access();
    const release = await lock(rootFor(config));
    let catalog, resources;
    try {
      const receipt = await this.receipt(jobId, await this.access());
      if (!receipt.prepared || reviewedHash !== receipt.prepared.manifest_sha256) throw intakeError('rag_v2_plan_changed', 409);
      catalog = await openCatalog(config.storeRoot, config.tenant);
      const snapshot = await this.snapshotFor(receipt);
      const reuse = await this.vectors(config.embeddingReuseDirs);
      const prepared = buildMultiSourcePlan({ snapshot, questionSets: [], reuseCatalog: reuse });
      if (prepared.manifest_sha256 !== reviewedHash) throw intakeError('rag_v2_plan_changed', 409);
      const budget = await this.budget(), budgetFile = path.join(rootFor(config), 'budget.json');
      let entry = budget.plans[reviewedHash];
      if (entry && ['reserved', 'stopped'].includes(entry.state)) throw intakeError('rag_v2_publication_incomplete', 409);
      // Availability is checked before any paid reservation/egress.
      resources = await (this.deps.openIndex || openIndex)(config);
      let active;
      try { active = await resources.postgres.active(config.tenant); }
      catch (error) { if (error.code !== 'no_active_search_generation') throw error; }
      if (active && Object.keys(active.snapshot.documents).some(doc => !snapshot.documents[doc])) throw intakeError('rag_v2_corpus_would_shrink', 409);
      if (entry?.state === 'published') {
        if (active?.id !== entry.publication.generation_id) throw intakeError('rag_v2_publication_superseded', 409);
        receipt.state = 'published'; receipt.publication = entry.publication;
        await atomicWrite(path.join(jobDir(config, jobId), 'receipt.json'), receipt);
        return publicReceipt(receipt);
      }
      if (!entry) {
        let price;
        try { price = await readJson(config.priceFile); validatePrice(price); } catch { throw intakeError('rag_v2_price_not_configured', 503); }
        if (prepared.manifest.max_api_attempts && !process.env.OPENAI_API_KEY && !this.deps.runPilot) throw intakeError('rag_v2_provider_not_configured', 503);
        const approval = approvalFor(prepared, config, price, this.userId);
        const reserve = costNanos(prepared.manifest.total_input_tokens, price);
        if (BigInt(budget.reserved_nano_usd) + reserve > nanoUsd(config.maxSpendUsd)
          || budget.reserved_attempts + prepared.manifest.max_api_attempts > config.maxApiAttempts
          || budget.reserved_tokens + prepared.manifest.total_input_tokens > config.maxInputTokens) throw intakeError('rag_v2_aggregate_cap_exceeded', 409);
        await this.snapshotFor(receipt);
        entry = { state: 'reserved', reserved_nano_usd: String(reserve), reserved_attempts: prepared.manifest.max_api_attempts,
          reserved_tokens: prepared.manifest.total_input_tokens, approval, price };
        budget.plans[reviewedHash] = entry;
        budget.reserved_nano_usd = String(BigInt(budget.reserved_nano_usd) + reserve);
        budget.reserved_attempts += entry.reserved_attempts; budget.reserved_tokens += entry.reserved_tokens;
        await atomicWrite(budgetFile, budget);
        try {
          const policy = { allowed: async () => ({ documents: await this.access() }) };
          const run = await (this.deps.runPilot || runPilot)({ prepared, approval, price, policy, context: contextFor(config),
            root: multiSourceLedgerRoot(rootFor(config)), execute: true, apiKey: process.env.OPENAI_API_KEY });
          if (run.state !== 'complete') throw intakeError('rag_v2_embedding_outcome_unknown', 502);
          // The runner determines this directory; a persisted receipt cannot select another ledger.
          entry.state = 'vectors_ready';
          await atomicWrite(budgetFile, budget);
          receipt.state = 'vectors_ready';
          await atomicWrite(path.join(jobDir(config, jobId), 'receipt.json'), receipt);
        } catch (error) {
          entry.state = 'stopped'; entry.error = safeCode(error);
          await atomicWrite(budgetFile, budget);
          receipt.state = 'stopped'; receipt.publication_error = entry.error;
          await atomicWrite(path.join(jobDir(config, jobId), 'receipt.json'), receipt);
          throw error;
        }
      }
      const runDir = path.join(multiSourceLedgerRoot(rootFor(config)), id('pilot', config.tenant, reviewedHash));
      const vectors = await this.vectors([...config.embeddingReuseDirs, runDir]);
      const indexed = await (this.deps.indexSnapshot || indexSnapshot)({ snapshot, postgres: resources.postgres, qdrant: resources.qdrant,
        embedding: vectors.embedding, hooks: { beforeActivate: () => this.snapshotFor(receipt) } });
      const current = await resources.postgres.active(config.tenant);
      if (current.id !== indexed.generation_id || current.state !== 'ready' || stable(current.snapshot.documents) !== stable(snapshot.documents)) throw intakeError('rag_v2_index_not_ready', 409);
      entry.state = 'published';
      entry.publication = { generation_id: indexed.generation_id, manifest_sha256: reviewedHash, published_at: new Date().toISOString(),
        units: indexed.units, embedding_calls: entry.reserved_attempts, input_tokens: entry.reserved_tokens, reserved_usd: formatUsd(entry.reserved_nano_usd),
        reused_inputs: prepared.manifest.reused_input_count };
      await atomicWrite(budgetFile, budget);
      receipt.state = 'published'; receipt.publication = entry.publication;
      await atomicWrite(path.join(jobDir(config, jobId), 'receipt.json'), receipt);
      await this.access();
      return publicReceipt(receipt);
    } finally {
      try { await resources?.close(); } finally { try { await catalog?.close(); } finally { await release(); } }
    }
  }
}
