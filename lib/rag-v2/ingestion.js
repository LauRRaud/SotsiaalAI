import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { configuration, fail, hash, id, nonempty, stable, validateMetadata } from './contracts.js';
import { readInput, openCatalog, readActive, loadVersion, stageVersion, publish } from './catalog.js';
import { parsePdf, structure } from './parser.js';
import { normalize } from './normalize.js';

/** Local operator API. The tenant is an explicit namespace, never an authentication claim. */
export async function ingest(options, dependencies = {}) {
  const { tenant, inputRoot, metadataFile, storeRoot, profile } = options;
  if (!nonempty(tenant) || tenant.length > 200) fail('tenant_required');
  if (!profile || !nonempty(profile.id) || !nonempty(profile.version)) fail('profile_required');
  const rights = options.rights;
  if (!rights || rights.access !== 'local_private' || rights.usage !== 'development_only') fail('explicit_local_rights_required');
  const config = configuration(options.config);
  const catalog = await openCatalog(storeRoot, tenant);
  const attempt = { id: randomUUID(), tenant_id: tenant, states: ['received'], state: 'received', model_calls: 0, errors: [] };
  const mark = state => { attempt.state = state; attempt.states.push(state); };
  try {
    const metadataBytes = await readInput(inputRoot, metadataFile, config.maxMetadataBytes);
    let metadata;
    try { metadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadataBytes)); }
    catch { fail('invalid_metadata_json'); }
    validateMetadata(metadata);
    const pdfBytes = await readInput(inputRoot, metadata.source_path, config.maxFileBytes);
    if (!pdfBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) fail('invalid_pdf_signature');
    const pdfHash = hash(pdfBytes), metadataHash = hash(metadataBytes);
    const documentId = id('document', tenant, metadata.source_type, metadata.document_id);
    const versionId = id('version', tenant, documentId, pdfHash, metadataHash, config, profile, rights);
    attempt.document_id = documentId; attempt.version_id = versionId;
    mark('validated');
    const active = await readActive(catalog.dir);
    const duplicate = Object.entries(active.documents).find(([key, doc]) => key !== documentId && doc.pdf_hash === pdfHash);
    if (duplicate) fail('duplicate_asset_identity_conflict');
    if (active.documents[documentId]?.version_id === versionId) {
      const bundle = await loadVersion(catalog.dir, versionId);
      mark('published');
      return { reused: true, bundle, generation: active.generation, output: path.join(catalog.dir, 'versions', versionId) };
    }
    const parsed = await (dependencies.parsePdf || parsePdf)(pdfBytes, config);
    const structured = structure(parsed, { tenant_id: tenant, document_version_id: versionId }, config);
    mark('parsed');
    let bundle = normalize({ metadata, parsed, structured, tenant, documentId, versionId, pdfHash, metadataHash,
      config, profile, rights, ingestedAt: new Date().toISOString() });
    bundle.assets[0].size_bytes = pdfBytes.length;
    bundle.assets[1].size_bytes = metadataBytes.length;
    bundle = await stageVersion(catalog.dir, bundle, pdfBytes, metadataBytes);
    mark('staged');
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
