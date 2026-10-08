import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, hash, id, stable } from '../contracts.js';
import { readJson } from '../catalog.js';
import { checkedTokens, validateVector } from './embedding.js';
import { costNanos, formatUsd, nanoUsd, validateApproval, validatePrice } from './pilot-manifest.js';
import { openAITransport, validateEmbeddingResponse } from './openai-embedding.js';

// The paid-call ledger is an append-only journal: manifest.json is written once, ledger.jsonl holds
// a header line and one fsync'd line per reservation, success or unknown outcome. Each input costs
// one append, so a run of tens of thousands of inputs writes linearly. A reservation line is synced
// before its request is sent. Complete ledger.json files of earlier runs stay readable.
const LEDGER = 'rag-v2/pilot-ledger-2', JOURNAL = 'ledger.jsonl', MANIFEST = 'manifest.json', LEGACY = 'ledger.json';
const OUTCOME_FIELDS = ['vector_file', 'vector_record_hash', 'usage', 'request_id', 'duration_ms', 'finished_at',
  'error', 'http_status', 'reported_model', 'reported_usage'];

async function atomicText(file, text) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const handle = await fs.open(temp, 'wx', 0o600);
  try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
  await fs.rename(temp, file);
}
const line = value => `${JSON.stringify(value)}\n`;
async function appendLine(file, value) {
  const handle = await fs.open(file, 'a', 0o600);
  try { await handle.writeFile(line(value)); await handle.sync(); } finally { await handle.close(); }
}
const exists = file => fs.access(file).then(() => true, () => false);

/** Replays a journal into the ledger shape callers use (entries with status and totals). A torn
 *  last line (a crash while appending) is cut off: its request was never sent, or its outcome is
 *  unknown and the entry stays reserved. */
async function readJournal(directory, { repair = false } = {}) {
  const file = path.join(directory, JOURNAL), text = await fs.readFile(file, 'utf8');
  const end = text.lastIndexOf('\n') + 1;
  if (end < text.length && repair) await fs.truncate(file, Buffer.byteLength(text.slice(0, end)));
  const lines = text.slice(0, end).split('\n').slice(0, -1);
  let header, events;
  try { [header, ...events] = lines.map(line => JSON.parse(line)); } catch { fail('pilot_ledger_integrity_failed'); }
  if (header?.schema_version !== LEDGER) fail('pilot_ledger_integrity_failed');
  const manifest = await readJson(path.join(directory, MANIFEST));
  if (hash(stable(manifest)) !== header.manifest_sha256) fail('pilot_ledger_integrity_failed');
  const ledger = { schema_version: LEDGER, manifest_sha256: header.manifest_sha256, manifest, approval_hash: header.approval_hash,
    price_hash: header.price_hash, tenant: header.tenant, config: header.config, transport: header.transport, state: 'running',
    reserved_attempts: 0, reserved_tokens: 0, reserved_nano_usd: '0', entries: [] };
  const byId = new Map();
  let complete = false;
  for (const event of events) {
    if (complete) fail('pilot_ledger_integrity_failed');
    if (event?.event === 'reserved') {
      if (byId.has(event.input_id) || !Number.isSafeInteger(event.reserved_tokens) || !/^\d+$/.test(event.reserved_nano_usd || '')) fail('pilot_ledger_integrity_failed');
      const entry = { input_id: event.input_id, input_hash: event.input_hash, kind: event.kind, status: 'reserved', reserved_at: event.reserved_at,
        reserved_tokens: event.reserved_tokens, reserved_nano_usd: event.reserved_nano_usd };
      byId.set(entry.input_id, entry); ledger.entries.push(entry);
      ledger.reserved_attempts++; ledger.reserved_tokens += entry.reserved_tokens;
      ledger.reserved_nano_usd = String(BigInt(ledger.reserved_nano_usd) + BigInt(entry.reserved_nano_usd));
    } else if (event?.event === 'succeeded' || event?.event === 'unknown') {
      const entry = byId.get(event.input_id);
      if (!entry || entry.status !== 'reserved') fail('pilot_ledger_integrity_failed');
      entry.status = event.event;
      for (const key of OUTCOME_FIELDS) if (event[key] !== undefined) entry[key] = event[key];
    } else if (event?.event === 'complete') {
      complete = true;
    } else fail('pilot_ledger_integrity_failed');
  }
  if (complete) coveredLedger(ledger);
  ledger.state = complete ? 'complete' : ledger.entries.some(entry => entry.status !== 'succeeded') ? 'stopped_unknown' : 'running';
  return ledger;
}
/** A complete ledger has exactly one succeeded entry per manifest input, with its hash and tokens:
 *  a repeated entry never stands in for a missing one. */
function coveredLedger(ledger) {
  const inputs = new Map(ledger.manifest.inputs.map(input => [input.id, input]));
  const covered = new Set(ledger.entries.map(entry => entry.input_id));
  if (ledger.entries.length !== inputs.size || covered.size !== inputs.size || ledger.entries.some(entry => { const input = inputs.get(entry.input_id);
    return entry.status !== 'succeeded' || !input || input.input_hash !== entry.input_hash || input.tokens !== entry.reserved_tokens; })) fail('pilot_ledger_integrity_failed');
  return ledger;
}
// One run per plan directory. A lock whose owner process is gone on this machine (a hard stop) is
// taken over; the takeover itself is serialised by an exclusive marker, so two starting processes
// never both run. Any other lock, or a marker left by a stopped takeover, is reported as busy.
async function acquireLock(lockPath) {
  const create = async () => {
    const handle = await fs.open(lockPath, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString() })); await handle.sync();
    return handle;
  };
  try { return await create(); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const marker = `${lockPath}.takeover`;
  const takeover = await fs.open(marker, 'wx', 0o600).catch(error => { if (error.code === 'EEXIST') fail('pilot_busy'); throw error; });
  try {
    let owner; try { owner = JSON.parse(await fs.readFile(lockPath, 'utf8')); } catch { fail('pilot_busy'); }
    if (owner?.host !== os.hostname() || !Number.isSafeInteger(owner.pid) || processAlive(owner.pid)) fail('pilot_busy');
    await fs.unlink(lockPath);
    return await create().catch(error => { if (error.code === 'EEXIST') fail('pilot_busy'); throw error; });
  } finally { await takeover.close(); await fs.unlink(marker); }
}
function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; }
}
/** Whether a purchase folder is being written now: its lock names a live process of this machine, or cannot be read
 *  as such. A lock a stopped process left behind does not count; a folder without a lock is at rest. */
async function beingWritten(directory) {
  let owner;
  try { owner = JSON.parse(await fs.readFile(path.join(directory, 'pilot.lock'), 'utf8')); }
  catch (error) { return error.code !== 'ENOENT'; }
  return owner?.host !== os.hostname() || !Number.isSafeInteger(owner.pid) || processAlive(owner.pid);
}
/** The files that hold a pilot ledger: the journal and its manifest, or an earlier ledger.json. */
export async function ledgerFiles(directory) {
  return await exists(path.join(directory, JOURNAL)) ? [path.join(directory, JOURNAL), path.join(directory, MANIFEST)] : [path.join(directory, LEGACY)];
}
async function readLedger(directory) {
  if (await exists(path.join(directory, JOURNAL))) return readJournal(directory);
  return readJson(path.join(directory, LEGACY));
}
async function currentAccess(prepared, policy, context) {
  if (context.tenant !== prepared.manifest.tenant) fail('pilot_tenant_mismatch');
  const access = await policy.allowed(context), documents = new Set(access.documents);
  if (prepared.manifest.files.some(f => !documents.has(f.document_id))) fail('pilot_material_access_revoked');
}
export async function runPilot({ prepared, approval, price, policy, context, root, execute = false, apiKey, transport, onProgress }) {
  if (!execute) return { state: 'dry_run', manifest_sha256: prepared.manifest_sha256, inputs: prepared.manifest.inputs.length,
    input_tokens: prepared.manifest.total_input_tokens, matches_baseline: prepared.matches_baseline, differences: prepared.differences, api_attempts: 0 };
  // The run works on private copies of what it validates, so a caller or callback changing its own
  // objects later cannot change what is sent. The full check hashes and counts every input once;
  // per input only the price window, access and that input's own hash and tokens are checked again.
  ({ prepared, approval, price, context } = structuredClone({ prepared, approval, price, context }));
  validateApproval(prepared, approval, price);
  await currentAccess(prepared, policy, context);
  let send = transport;
  const transportKind = transport ? 'test_transport' : 'openai_https';
  const directory = path.resolve(root, id('pilot', prepared.manifest.tenant, prepared.manifest_sha256));
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const lockPath = path.join(directory, 'pilot.lock'), journal = path.join(directory, JOURNAL);
  const lock = await acquireLock(lockPath);
  try {
    const scope = ledger => ledger.manifest_sha256 === prepared.manifest_sha256 && hash(stable(ledger.manifest)) === prepared.manifest_sha256
      && ledger.approval_hash === hash(stable(approval)) && ledger.price_hash === hash(stable(price)) && ledger.tenant === context.tenant
      && stable(ledger.config) === stable(prepared.manifest.config) && ledger.transport === transportKind;
    if (!await exists(journal) && await exists(path.join(directory, LEGACY))) {
      // An earlier single-file ledger is reused only when complete; it is never extended.
      const legacy = await readJson(path.join(directory, LEGACY));
      if (!scope(legacy)) fail('pilot_ledger_scope_mismatch');
      if (legacy.state !== 'complete') fail('legacy_pilot_ledger_incomplete');
      for (const entry of coveredLedger(legacy).entries) await verifiedStoredVector(directory, entry, legacy);
      return { state: legacy.state, directory, ledger: legacy, api_attempts_this_run: 0 };
    }
    if (!await exists(journal)) {
      // A manifest left by an interrupted start must be this plan's; the header appears atomically.
      const manifestFile = path.join(directory, MANIFEST);
      if (await exists(manifestFile)) { if (hash(stable(await readJson(manifestFile))) !== prepared.manifest_sha256) fail('pilot_ledger_scope_mismatch'); }
      else await atomicText(manifestFile, JSON.stringify(prepared.manifest));
      await atomicText(journal, line({ schema_version: LEDGER, manifest_sha256: prepared.manifest_sha256, approval_hash: hash(stable(approval)),
        price_hash: hash(stable(price)), tenant: context.tenant, config: prepared.manifest.config, transport: transportKind, created_at: new Date().toISOString() }));
    }
    const ledger = await readJournal(directory, { repair: true });
    if (!scope(ledger)) fail('pilot_ledger_scope_mismatch');
    const inputs = new Map(prepared.inputs.map(input => [input.id, input]));
    if (ledger.reserved_attempts > approval.max_api_attempts || ledger.reserved_tokens > approval.max_total_input_tokens
      || BigInt(ledger.reserved_nano_usd) > nanoUsd(approval.approved_spend_cap)
      || ledger.entries.some(e => { const input = inputs.get(e.input_id);
        return !input || input.input_hash !== e.input_hash || input.tokens !== e.reserved_tokens || e.reserved_nano_usd !== String(costNanos(e.reserved_tokens, price)); })) fail('pilot_ledger_integrity_failed');
    if (ledger.state === 'complete') {
      for (const entry of ledger.entries) await verifiedStoredVector(directory, entry, ledger);
      return { state: ledger.state, directory, ledger, api_attempts_this_run: 0 };
    }
    if (ledger.entries.some(e => e.status !== 'succeeded')) return { state: 'stopped_unknown', directory, ledger, api_attempts_this_run: 0 };
    const done = new Map(ledger.entries.map(entry => [entry.input_id, entry]));
    let attempts = 0;
    for (const input of prepared.inputs) {
      const previous = done.get(input.id);
      if (previous) { await verifiedStoredVector(directory, previous, ledger); continue; }
      send ??= openAITransport(apiKey); // Reusing a complete verified ledger does not require provider credentials.
      validatePrice(price);
      await currentAccess(prepared, policy, context);
      if (hash(input.text) !== input.input_hash || checkedTokens(input.text, prepared.manifest.config) !== input.tokens) fail('pilot_input_hash_mismatch');
      const nanos = costNanos(input.tokens, price);
      if (ledger.reserved_attempts + 1 > approval.max_api_attempts || ledger.reserved_tokens + input.tokens > approval.max_total_input_tokens
        || BigInt(ledger.reserved_nano_usd) + nanos > nanoUsd(approval.approved_spend_cap)) fail('pilot_runtime_cap_exceeded');
      const entry = { input_id: input.id, input_hash: input.input_hash, kind: input.kind, status: 'reserved', reserved_at: new Date().toISOString(),
        reserved_tokens: input.tokens, reserved_nano_usd: String(nanos) };
      await appendLine(journal, { event: 'reserved', ...entry, status: undefined }); // Survives interruption BEFORE sending.
      ledger.entries.push(entry); ledger.reserved_attempts++; ledger.reserved_tokens += input.tokens;
      ledger.reserved_nano_usd = String(BigInt(ledger.reserved_nano_usd) + nanos); ledger.state = 'running';
      attempts++;
      let response, outcome;
      try {
        response = await send({ text: input.text, config: prepared.manifest.config });
        const vector = validateEmbeddingResponse(response, prepared.manifest.config, input.tokens);
        const record = { tenant: context.tenant, config: prepared.manifest.config, input_hash: input.input_hash, vector,
          usage: response.body.usage, request_id: response.request_id ?? null, duration_ms: response.duration_ms ?? null };
        const vectorFile = `vector-${input.id}.json`;
        await atomicText(path.join(directory, vectorFile), JSON.stringify(record)); // Compact: its hash does not depend on layout.
        outcome = { vector_file: vectorFile, vector_record_hash: hash(stable(record)), usage: record.usage,
          request_id: record.request_id, duration_ms: record.duration_ms, finished_at: new Date().toISOString() };
      } catch (error) {
        const outcome = { error: typeof error.code === 'string' && /^[a-z_]+$/.test(error.code) ? error.code : 'embedding_outcome_unknown',
          ...(error.status ? { http_status: error.status } : {}), ...(typeof error.requestId === 'string' ? { request_id: error.requestId } : {}) };
        if (response) Object.assign(outcome, { reported_model: typeof response.body?.model === 'string' ? response.body.model : null,
          reported_usage: { prompt_tokens: Number.isSafeInteger(response.body?.usage?.prompt_tokens) ? response.body.usage.prompt_tokens : null,
            total_tokens: Number.isSafeInteger(response.body?.usage?.total_tokens) ? response.body.usage.total_tokens : null, validated: false },
          request_id: response.request_id ?? null });
        await appendLine(journal, { event: 'unknown', input_id: input.id, ...outcome });
        Object.assign(entry, { status: 'unknown', ...outcome });
        ledger.state = 'stopped_unknown';
        return { state: ledger.state, directory, ledger, api_attempts_this_run: attempts };
      }
      // A success line that cannot be written stops the run: the reservation stays and is never resent.
      await appendLine(journal, { event: 'succeeded', input_id: input.id, ...outcome });
      Object.assign(entry, { status: 'succeeded', ...outcome });
      // Progress reporting comes after the journal is consistent; its failure ends the run but never
      // turns a recorded success into an unknown outcome.
      if (onProgress) await onProgress({ succeeded: ledger.entries.length, total: prepared.inputs.length, reserved_usd: formatUsd(ledger.reserved_nano_usd) });
    }
    await appendLine(journal, { event: 'complete', at: new Date().toISOString() });
    ledger.state = 'complete';
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
  constructor(directory, ledger, vectors, entries = null) {
    this.directory = directory; this.ledger = ledger; this.config = ledger.config; this.vectors = vectors; this.entries = entries;
    this.source = 'persisted_vectors'; this.provenance = ledger.transport; this.reads = 0;
  }
  /** `lazy`: the ledger is checked now, each vector file when its input is first asked for. A run that needs the
   *  vectors of a few new chunks then does not read the tens of thousands of a whole corpus (ADR-036 follow-up). */
  /** `stopped` (ADR-113): a purchase that ended before its last input, on a call whose outcome stayed unknown or on a
   *  hard stop, may be read for the inputs it did buy. They pass the checks a complete purchase's do: the journal
   *  replays, the manifest is the ledger's own, every entry is one of the manifest's inputs with its hash and tokens,
   *  and a vector file is verified against its recorded hash when it is read. An entry without a recorded success is
   *  never used: its input is bought again. The folder is only read, and one a live process is writing is refused. */
  static async load(directory, tenant, { lazy = false, stopped: allowStopped = false } = {}) {
    const ledger = await readLedger(directory);
    const stopped = allowStopped && ledger.schema_version === LEDGER && ['stopped_unknown', 'running'].includes(ledger.state);
    if (stopped && await beingWritten(directory)) fail('pilot_busy');
    if (!stopped && ledger.state !== 'complete' || ledger.tenant !== tenant || ledger.config.embedding_mode !== 'real'
      || hash(stable(ledger.manifest)) !== ledger.manifest_sha256 || !stopped && ledger.entries.length !== ledger.manifest.inputs.length
      || ledger.entries.length !== ledger.reserved_attempts || new Set(ledger.entries.map(e => e.input_id)).size !== ledger.entries.length) fail('complete_real_pilot_required');
    const vectors = new Map(), entries = new Map(), bought = [], inputs = new Map(ledger.manifest.inputs.map(input => [input.id, input]));
    for (const entry of ledger.entries) {
      if (entry.status !== 'succeeded' && !stopped) fail('complete_real_pilot_required');
      const input = inputs.get(entry.input_id);
      if (!input || input.input_hash !== entry.input_hash || input.tokens !== entry.reserved_tokens) fail('stored_vector_scope_mismatch');
      if (entry.status !== 'succeeded') continue;
      entries.set(entry.input_hash, entry); bought.push(entry);
      if (!lazy) vectors.set(entry.input_hash, await verifiedStoredVector(directory, entry, ledger));
    }
    const store = new StoredEmbedding(directory, ledger, vectors, lazy ? entries : null);
    store.stopped = stopped; store.bought = bought;
    return store;
  }
  /** The verified stored vector of an input, or undefined when this ledger did not buy it. */
  async vector(inputHash) {
    let vector = this.vectors.get(inputHash);
    if (!vector && this.entries?.has(inputHash)) {
      vector = await verifiedStoredVector(this.directory, this.entries.get(inputHash), this.ledger);
      this.vectors.set(inputHash, vector);
    }
    return vector;
  }
  async embed(text) {
    checkedTokens(text, this.config);
    const vector = await this.vector(hash(text)); if (!vector) fail('stored_embedding_missing');
    this.reads++; return vector;
  }
}

export class CombinedStoredEmbedding {
  /** `owners`: input hash -> the lazily loaded store that bought it; `vectors` holds what was read (or set). */
  constructor(config, vectors, provenance, sources, owners = new Map()) {
    this.config = config;
    this.vectors = vectors;
    this.owners = owners;
    this.provenance = provenance;
    this.sources = sources;
    this.source = 'persisted_vectors';
    this.reads = 0;
  }
  async embed(text) {
    checkedTokens(text, this.config);
    const inputHash = hash(text);
    let vector = this.vectors.get(inputHash);
    if (!vector && this.owners.has(inputHash)) { vector = await this.owners.get(inputHash).vector(inputHash); this.vectors.set(inputHash, vector); }
    if (!vector) fail('stored_embedding_missing');
    this.reads++;
    return vector;
  }
}

/** The vectors earlier purchases bought, by input. `stopped` (ADR-113) also takes the inputs a stopped purchase did
 *  buy; without it a folder that is not a complete purchase is refused, as before. `stoppedInputs` counts the inputs
 *  that come from stopped purchases and `stoppedManifests` names those purchases. */
export async function reusableEmbeddingCatalog(directories, tenant, { stopped = false } = {}) {
  if (!Array.isArray(directories) || !directories.length || new Set(directories).size !== directories.length) fail('stored_embedding_sources_required');
  // Ledgers are read and checked here; vector files only when an input is embedded (StoredEmbedding lazy load).
  const owners = new Map(), receipts = new Map(), sources = [], stores = [];
  let config = null;
  for (const directory of directories) {
    const store = await StoredEmbedding.load(directory, tenant, { lazy: true, stopped });
    if (config && stable(store.config) !== stable(config)) fail('stored_embedding_config_mismatch');
    config ??= store.config;
    store.ledgerHash = hash(stable(store.ledger));
    sources.push({ manifest_sha256: store.ledger.manifest_sha256, ledger_sha256: store.ledgerHash, transport: store.ledger.transport,
      ...(store.stopped ? { state: store.ledger.state, bought_inputs: store.bought.length } : {}) });
    stores.push(store);
  }
  // Complete purchases first, in the order given: an input that a complete purchase and a stopped one both bought is
  // the complete one's. The stopped one's vector is then not read or compared: a batch bought again after a stop holds
  // every input of the stopped purchase a second time, and two answers of the provider to one text need not be equal
  // to the last digit.
  let stoppedInputs = 0;
  for (const store of [...stores.filter(one => !one.stopped), ...stores.filter(one => one.stopped)]) {
    for (const entry of store.bought) {
      const prior = owners.get(entry.input_hash);
      if (prior && store.stopped) continue;
      // The same input bought twice by complete purchases: both stored vectors must agree (read now, rare).
      if (prior && stable(await prior.vector(entry.input_hash)) !== stable(await store.vector(entry.input_hash))) fail('stored_embedding_collision');
      if (!prior) { owners.set(entry.input_hash, store); if (store.stopped) stoppedInputs++; }
      if (!receipts.has(entry.input_hash)) receipts.set(entry.input_hash, {
        input_hash: entry.input_hash, input_id: entry.input_id, tokens: entry.reserved_tokens,
        source_manifest_sha256: store.ledger.manifest_sha256, source_ledger_sha256: store.ledgerHash,
        vector_record_hash: entry.vector_record_hash, transport: store.ledger.transport,
      });
    }
  }
  const transports = new Set(sources.map(source => source.transport));
  const provenance = transports.size === 1 ? sources[0].transport : 'mixed_verified_transport';
  const embedding = new CombinedStoredEmbedding(config, new Map(), provenance, sources, owners);
  return { config, vectors: embedding.vectors, receipts, sources, embedding, stoppedInputs,
    stoppedManifests: new Set(stores.filter(one => one.stopped).map(one => one.ledger.manifest_sha256)) };
}
