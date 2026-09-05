import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, hash, id, stable } from '../contracts.js';
import { readJson } from '../catalog.js';
import { checkedTokens, validateVector } from './embedding.js';
import { costNanos, formatUsd, nanoUsd, validateApproval } from './pilot-manifest.js';
import { openAITransport, validateEmbeddingResponse } from './openai-embedding.js';

async function atomicJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temp, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value, null, 2)); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temp, file);
}
async function currentAccess(prepared, policy, context) {
  if (context.tenant !== prepared.manifest.tenant) fail('pilot_tenant_mismatch');
  const access = await policy.allowed(context);
  if (prepared.manifest.files.some(f => !access.documents.includes(f.document_id))) fail('pilot_material_access_revoked');
}
export async function runPilot({ prepared, approval, price, policy, context, root, execute = false, apiKey, transport, onProgress }) {
  if (!execute) return { state: 'dry_run', manifest_sha256: prepared.manifest_sha256, inputs: prepared.manifest.inputs.length,
    input_tokens: prepared.manifest.total_input_tokens, matches_baseline: prepared.matches_baseline, differences: prepared.differences, api_attempts: 0 };
  validateApproval(prepared, approval, price);
  await currentAccess(prepared, policy, context);
  let send = transport;
  const transportKind = transport ? 'test_transport' : 'openai_https';
  const directory = path.resolve(root, id('pilot', prepared.manifest.tenant, prepared.manifest_sha256));
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const lockPath = path.join(directory, 'pilot.lock'), file = path.join(directory, 'ledger.json');
  const lock = await fs.open(lockPath, 'wx', 0o600).catch(error => { if (error.code === 'EEXIST') fail('pilot_busy'); throw error; });
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); await lock.sync();
    let ledger;
    try { ledger = await readJson(file); }
    catch (e) { if (e.code !== 'ENOENT') throw e; ledger = { schema_version: 'rag-v2/pilot-ledger-1', manifest_sha256: prepared.manifest_sha256,
      manifest: prepared.manifest, approval_hash: hash(stable(approval)), price_hash: hash(stable(price)), tenant: context.tenant, config: prepared.manifest.config,
      transport: transportKind, state: 'running', reserved_attempts: 0, reserved_tokens: 0, reserved_nano_usd: '0', entries: [] }; }
    if (ledger.manifest_sha256 !== prepared.manifest_sha256 || hash(stable(ledger.manifest)) !== prepared.manifest_sha256 || ledger.approval_hash !== hash(stable(approval)) || ledger.price_hash !== hash(stable(price))
      || ledger.tenant !== context.tenant || stable(ledger.config) !== stable(prepared.manifest.config) || ledger.transport !== transportKind) fail('pilot_ledger_scope_mismatch');
    const sum = ledger.entries.reduce((n, e) => ({ attempts: n.attempts + 1, tokens: n.tokens + e.reserved_tokens, nanos: n.nanos + BigInt(e.reserved_nano_usd) }), { attempts: 0, tokens: 0, nanos: 0n });
    if (sum.attempts !== ledger.reserved_attempts || sum.tokens !== ledger.reserved_tokens || String(sum.nanos) !== ledger.reserved_nano_usd
      || ledger.reserved_attempts > approval.max_api_attempts || ledger.reserved_tokens > approval.max_total_input_tokens || sum.nanos > nanoUsd(approval.approved_spend_cap)
      || new Set(ledger.entries.map(e => e.input_id)).size !== ledger.entries.length || ledger.entries.some(e => !prepared.inputs.some(i => i.id === e.input_id && i.input_hash === e.input_hash && i.tokens === e.reserved_tokens)
        || e.reserved_nano_usd !== String(costNanos(e.reserved_tokens, price)) || !['reserved', 'succeeded', 'unknown'].includes(e.status))) fail('pilot_ledger_integrity_failed');
    if (ledger.entries.some(e => e.status !== 'succeeded')) return { state: 'stopped_unknown', directory, ledger, api_attempts_this_run: 0 };
    let attempts = 0;
    for (const input of prepared.inputs) {
      const previous = ledger.entries.find(e => e.input_id === input.id);
      if (previous) { await verifiedStoredVector(directory, previous, ledger); continue; }
      send ??= openAITransport(apiKey); // Reusing a complete verified ledger does not require provider credentials.
      validateApproval(prepared, approval, price);
      await currentAccess(prepared, policy, context);
      if (hash(input.text) !== input.input_hash || checkedTokens(input.text, prepared.manifest.config) !== input.tokens) fail('pilot_input_hash_mismatch');
      const nanos = costNanos(input.tokens, price);
      if (ledger.reserved_attempts + 1 > approval.max_api_attempts || ledger.reserved_tokens + input.tokens > approval.max_total_input_tokens
        || BigInt(ledger.reserved_nano_usd) + nanos > nanoUsd(approval.approved_spend_cap)) fail('pilot_runtime_cap_exceeded');
      const entry = { input_id: input.id, input_hash: input.input_hash, kind: input.kind, status: 'reserved', reserved_at: new Date().toISOString(),
        reserved_tokens: input.tokens, reserved_nano_usd: String(nanos) };
      ledger.entries.push(entry); ledger.reserved_attempts++; ledger.reserved_tokens += input.tokens;
      ledger.reserved_nano_usd = String(BigInt(ledger.reserved_nano_usd) + nanos); ledger.state = 'running';
      await atomicJson(file, ledger); // Reservation survives process interruption BEFORE sending.
      attempts++;
      let response;
      try {
        response = await send({ text: input.text, config: prepared.manifest.config });
        const vector = validateEmbeddingResponse(response, prepared.manifest.config, input.tokens);
        const record = { tenant: context.tenant, config: prepared.manifest.config, input_hash: input.input_hash, vector,
          usage: response.body.usage, request_id: response.request_id ?? null, duration_ms: response.duration_ms ?? null };
        const vectorFile = `vector-${input.id}.json`;
        await atomicJson(path.join(directory, vectorFile), record);
        Object.assign(entry, { status: 'succeeded', vector_file: vectorFile, vector_record_hash: hash(stable(record)), usage: record.usage,
          request_id: record.request_id, duration_ms: record.duration_ms, finished_at: new Date().toISOString() });
        await atomicJson(file, ledger);
        if (onProgress) await onProgress({ succeeded: ledger.entries.length, total: prepared.inputs.length, reserved_usd: formatUsd(ledger.reserved_nano_usd) });
      } catch (error) {
        entry.status = 'unknown'; entry.error = typeof error.code === 'string' && /^[a-z_]+$/.test(error.code) ? error.code : 'embedding_outcome_unknown';
        if (error.status) entry.http_status = error.status;
        if (typeof error.requestId === 'string') entry.request_id = error.requestId;
        if (response) {
          entry.reported_model = typeof response.body?.model === 'string' ? response.body.model : null;
          entry.reported_usage = { prompt_tokens: Number.isSafeInteger(response.body?.usage?.prompt_tokens) ? response.body.usage.prompt_tokens : null,
            total_tokens: Number.isSafeInteger(response.body?.usage?.total_tokens) ? response.body.usage.total_tokens : null, validated: false };
          entry.request_id = response.request_id ?? null;
        }
        ledger.state = 'stopped_unknown'; await atomicJson(file, ledger);
        return { state: ledger.state, directory, ledger, api_attempts_this_run: attempts };
      }
    }
    ledger.state = 'complete'; await atomicJson(file, ledger);
    return { state: ledger.state, directory, ledger, api_attempts_this_run: attempts };
  } finally { await lock.close(); await fs.unlink(lockPath); }
}
async function verifiedStoredVector(directory, entry, ledger) {
  if (entry.vector_file !== `vector-${entry.input_id}.json` || !/^pilot_input_[a-f0-9]{64}$/.test(entry.input_id)) fail('invalid_vector_file');
  const record = await readJson(path.join(directory, entry.vector_file));
  if (hash(stable(record)) !== entry.vector_record_hash || record.tenant !== ledger.tenant || record.input_hash !== entry.input_hash
    || stable(record.config) !== stable(ledger.config)) fail('stored_vector_integrity_failed');
  return validateVector(record.vector, ledger.config);
}
export class StoredEmbedding {
  constructor(directory, ledger, vectors) { this.directory = directory; this.ledger = ledger; this.config = ledger.config; this.vectors = vectors; this.source = 'persisted_vectors'; this.provenance = ledger.transport; this.reads = 0; }
  static async load(directory, tenant) {
    const ledger = await readJson(path.join(directory, 'ledger.json'));
    if (ledger.state !== 'complete' || ledger.tenant !== tenant || ledger.config.embedding_mode !== 'real'
      || hash(stable(ledger.manifest)) !== ledger.manifest_sha256 || ledger.entries.length !== ledger.manifest.inputs.length
      || ledger.entries.length !== ledger.reserved_attempts || new Set(ledger.entries.map(e => e.input_id)).size !== ledger.entries.length) fail('complete_real_pilot_required');
    const vectors = new Map();
    for (const entry of ledger.entries) {
      if (entry.status !== 'succeeded') fail('complete_real_pilot_required');
      if (!ledger.manifest.inputs.some(i => i.id === entry.input_id && i.input_hash === entry.input_hash && i.tokens === entry.reserved_tokens)) fail('stored_vector_scope_mismatch');
      vectors.set(entry.input_hash, await verifiedStoredVector(directory, entry, ledger));
    }
    return new StoredEmbedding(directory, ledger, vectors);
  }
  async embed(text) {
    checkedTokens(text, this.config);
    const vector = this.vectors.get(hash(text)); if (!vector) fail('stored_embedding_missing');
    this.reads++; return vector;
  }
}

export class CombinedStoredEmbedding {
  constructor(config, vectors, provenance, sources) {
    this.config = config;
    this.vectors = vectors;
    this.provenance = provenance;
    this.sources = sources;
    this.source = 'persisted_vectors';
    this.reads = 0;
  }
  async embed(text) {
    checkedTokens(text, this.config);
    const vector = this.vectors.get(hash(text));
    if (!vector) fail('stored_embedding_missing');
    this.reads++;
    return vector;
  }
}

export async function reusableEmbeddingCatalog(directories, tenant) {
  if (!Array.isArray(directories) || !directories.length || new Set(directories).size !== directories.length) fail('stored_embedding_sources_required');
  const vectors = new Map(), receipts = new Map(), sources = [];
  let config = null;
  for (const directory of directories) {
    const store = await StoredEmbedding.load(directory, tenant);
    if (config && stable(store.config) !== stable(config)) fail('stored_embedding_config_mismatch');
    config ??= store.config;
    const ledgerHash = hash(stable(store.ledger));
    sources.push({ manifest_sha256: store.ledger.manifest_sha256, ledger_sha256: ledgerHash, transport: store.ledger.transport });
    for (const entry of store.ledger.entries) {
      const vector = store.vectors.get(entry.input_hash), prior = vectors.get(entry.input_hash);
      if (prior && stable(prior) !== stable(vector)) fail('stored_embedding_collision');
      vectors.set(entry.input_hash, vector);
      if (!receipts.has(entry.input_hash)) receipts.set(entry.input_hash, {
        input_hash: entry.input_hash, input_id: entry.input_id, tokens: entry.reserved_tokens,
        source_manifest_sha256: store.ledger.manifest_sha256, source_ledger_sha256: ledgerHash,
        vector_record_hash: entry.vector_record_hash, transport: store.ledger.transport,
      });
    }
  }
  const transports = new Set(sources.map(source => source.transport));
  const provenance = transports.size === 1 ? sources[0].transport : 'mixed_verified_transport';
  return { config, vectors, receipts, sources, embedding: new CombinedStoredEmbedding(config, vectors, provenance, sources) };
}
