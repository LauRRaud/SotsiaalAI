import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { configuration, fail, hash, id, nonempty, stable, validateMetadata } from './contracts.js';
import { readInput, openCatalog, readActive, loadVersion, stageVersion, publish } from './catalog.js';
import { parsePdf, structure } from './parser.js';
import { normalize } from './normalize.js';
import { KNOWLEDGE_SCHEMA } from './knowledge.js';
import { sourceFormat } from './source-locations.js';
import { parseTextSource } from './text-source.js';
import { adaptMetadata } from './metadata-adapter.js';

function settings(options) {
  const { tenant, profile } = options;
  if (!nonempty(tenant) || tenant.length > 200) fail('tenant_required');
  if (!profile || !nonempty(profile.id) || !nonempty(profile.version)) fail('profile_required');
  const rights = options.rights;
  if (!rights || rights.access !== 'local_private' || rights.usage !== 'development_only') fail('explicit_local_rights_required');
  return { tenant, profile, rights, config: configuration(options.config) };
}

async function sourceInput(options, resolved) {
  const { inputRoot, metadataFile } = options, { tenant, profile, rights, config } = resolved;
  // Batch plans preserve the exact metadata bytes, including across JSONB round trips.
  const metadataBytes = options.metadataJson !== undefined ? Buffer.from(options.metadataJson)
    : options.metadata === undefined ? await readInput(inputRoot, metadataFile, config.maxMetadataBytes) : Buffer.from(JSON.stringify(options.metadata));
  if (metadataBytes.length > config.maxMetadataBytes) fail('input_size_limit');
  let originalMetadata;
  try { originalMetadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadataBytes)); }
  catch { fail('invalid_metadata_json'); }
  const metadata = adaptMetadata(originalMetadata, metadataFile);
  validateMetadata(metadata);
  const pdfBytes = await readInput(inputRoot, metadata.source_path, config.maxFileBytes), format = sourceFormat(metadata);
  const pdfHash = hash(pdfBytes), metadataHash = hash(metadataBytes);
  if (options.expectedSourceHash !== undefined && options.expectedSourceHash !== pdfHash) fail('batch_source_changed');
  if (format === 'pdf' && !pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) fail('invalid_pdf_signature');
  const documentId = id('document', tenant, metadata.source_type, metadata.document_id);
  const versionId = id('version', tenant, documentId, pdfHash, metadataHash, config, profile, rights,
    ...(metadata.knowledge === undefined ? [] : [KNOWLEDGE_SCHEMA]));
  return { ...resolved, metadata, originalMetadata, metadataBytes, format, pdfBytes, pdfHash, metadataHash, documentId, versionId };
}

async function prepareVersion(input, dir, dependencies, mark = () => {}) {
  const { metadata, originalMetadata, metadataBytes, format, pdfBytes, pdfHash, metadataHash, documentId, versionId, tenant, config, profile, rights } = input;
  // A complete immutable version is the checkpoint. An incomplete staging directory is never reused.
  let exists = false;
  try { await fs.access(path.join(dir, 'versions', versionId)); exists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (exists) {
    const bundle = await loadVersion(dir, versionId);
    if (bundle.tenant_id !== tenant || bundle.document.id !== documentId) fail('source_scope_mismatch');
    mark('staged');
    return { bundle, reused: true };
  }
  const scope = { tenant_id: tenant, document_version_id: versionId };
  let parsed, structured;
  if (format === 'pdf') {
    parsed = await (dependencies.parsePdf || parsePdf)(pdfBytes, config);
    structured = structure(parsed, scope, config);
  } else ({ parsed, structured } = parseTextSource(pdfBytes, format, metadata, scope, config));
  mark('parsed');
  let bundle = normalize({ metadata, originalMetadata, parsed, structured, tenant, documentId, versionId, pdfHash, metadataHash,
    config, profile, rights, ingestedAt: new Date().toISOString() });
  bundle.assets[0].size_bytes = pdfBytes.length;
  bundle.assets[1].size_bytes = metadataBytes.length;
  bundle = await stageVersion(dir, bundle, pdfBytes, metadataBytes);
  mark('staged');
  return { bundle, reused: false };
}

/** Immutable preparation only: no active.json, search index, model call or catalog writer lock. */
export async function prepareIngest(options, dependencies = {}) {
  const resolved = settings(options), input = await sourceInput(options, resolved);
  const dir = path.resolve(options.storeRoot, id('tenant', resolved.tenant));
  const result = await prepareVersion(input, dir, dependencies);
  return { ...result, output: path.join(dir, 'versions', input.versionId) };
}

/** Local operator API. The tenant is an explicit namespace, never an authentication claim. */
export async function ingest(options, dependencies = {}) {
  const resolved = settings(options), { tenant } = resolved, { storeRoot } = options;
  const catalog = await openCatalog(storeRoot, tenant);
  const attempt = { id: randomUUID(), tenant_id: tenant, states: ['received'], state: 'received', model_calls: 0, errors: [] };
  const mark = state => { attempt.state = state; attempt.states.push(state); };
  try {
    const input = await sourceInput(options, resolved);
    const { metadata, format, pdfHash, documentId, versionId } = input;
    attempt.document_id = documentId; attempt.version_id = versionId;
    mark('validated');
    const active = await readActive(catalog.dir);
    const selector = metadata.source_selector?.json_pointer;
    const duplicate = Object.entries(active.documents).find(([key, doc]) => {
      if (key === documentId || (doc.source_hash ?? doc.pdf_hash) !== pdfHash) return false;
      const previous = doc.source_selector;
      return format !== 'json' || !selector || !previous || selector === previous || selector.startsWith(previous + '/') || previous.startsWith(selector + '/');
    });
    if (duplicate) fail('duplicate_asset_identity_conflict');
    if (active.documents[documentId]?.version_id === versionId) {
      const bundle = await loadVersion(catalog.dir, versionId);
      mark('published');
      return { reused: true, bundle, generation: active.generation, output: path.join(catalog.dir, 'versions', versionId) };
    }
    const { bundle } = await prepareVersion(input, catalog.dir, dependencies, mark);
    if (dependencies.beforePublish) await dependencies.beforePublish();
    const next = await publish(catalog.dir, active, bundle);
    mark('published');
    return { reused: false, bundle, generation: next.generation, output: path.join(catalog.dir, 'versions', versionId) };
  } catch (error) {
    mark('failed');
    // Parser/OS error messages may contain sensitive paths. Persist only controlled codes.
    const code = typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'ingest_failed';
    attempt.errors.push({ code });
    throw Object.assign(new Error(code), { code });
  } finally {
    try {
      const jobs = path.join(catalog.dir, 'jobs');
      await fs.mkdir(jobs, { recursive: true });
      await fs.writeFile(path.join(jobs, `${attempt.id}.json`), `${stable(attempt)}\n`, { flag: 'wx' });
    } finally { await catalog.close(); }
  }
}
