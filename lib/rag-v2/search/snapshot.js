import path from 'node:path';
import { readActive, loadVersion, readJson } from '../catalog.js';
import { fail, hash, id, nonempty, stable, validateBundle } from '../contracts.js';

export function tenantId(value) { if (!nonempty(value) || value.length > 200) fail('tenant_required'); return value; }
export function verifiedBundle(bundle, tenant) {
  validateBundle(bundle);
  if (bundle.tenant_id !== tenant || bundle.version.document_id !== bundle.document.id) fail('source_scope_mismatch');
  if (bundle.document.rights.access !== 'local_private' || bundle.document.rights.usage !== 'development_only') fail('source_rights_not_supported');
  const entities = [bundle.version, ...bundle.spans, ...bundle.sections, ...bundle.blocks, ...bundle.chunks, ...bundle.relations];
  if (entities.some(e => e.document_version_id && e.document_version_id !== bundle.version.id)) fail('source_version_mismatch');
  const chunks = new Map(bundle.chunks.map(c => [c.id, c]));
  for (const chunk of bundle.chunks) {
    const spanPages = [...new Set(chunk.span_ids.map(s => bundle.spans.find(x => x.id === s).pdf_page))];
    if (stable(spanPages) !== stable(chunk.pdf_pages)) fail('source_page_mismatch');
    if (chunk.previous_id && !chunks.has(chunk.previous_id) || chunk.next_id && !chunks.has(chunk.next_id)) fail('source_neighbor_mismatch');
  }
  return bundle;
}
export async function loadSnapshot(store, tenant, allowedDocuments) {
  tenantId(tenant);
  if (!Array.isArray(allowedDocuments) || !allowedDocuments.every(nonempty)) fail('allowed_documents_required');
  const dir = path.resolve(store, id('tenant', tenant));
  const active = await readActive(dir);
  if (active.tenant_id !== tenant || !active.generation || id('generation', stable(active.documents)) !== active.generation) fail('invalid_source_generation');
  const bundles = [], documents = {}, assets = {};
  for (const documentId of [...new Set(allowedDocuments)].sort()) {
    const selected = active.documents[documentId];
    if (!selected) fail('document_not_in_source_generation');
    const bundle = verifiedBundle(await loadVersion(dir, selected.version_id), tenant);
    if (bundle.document.id !== documentId || bundle.version.pdf_hash !== selected.pdf_hash) fail('source_identity_mismatch');
    const manifest = await readJson(path.join(dir, 'versions', selected.version_id, 'manifest.json'));
    if (manifest.files['original.pdf'] !== bundle.version.pdf_hash || manifest.files['metadata.json'] !== bundle.version.metadata_hash
      || bundle.assets.some(asset => manifest.files[asset.path] !== asset.sha256)) fail('source_asset_hash_mismatch');
    bundles.push(bundle); documents[documentId] = selected;
    assets[bundle.version.id] = { private_directory: path.join(dir, 'versions', selected.version_id),
      assets: bundle.assets.map(a => ({ id: a.id, path: a.path, sha256: a.sha256, size_bytes: a.size_bytes })) };
  }
  return { tenant, source_generation: active.generation, documents, bundles, assets, snapshot_hash: hash(stable(documents)) };
}
export function assertSnapshot(snapshot) {
  tenantId(snapshot.tenant);
  if (snapshot.snapshot_hash !== hash(stable(snapshot.documents))) fail('invalid_snapshot');
  if (snapshot.bundles.length !== Object.keys(snapshot.documents).length) fail('invalid_snapshot');
  for (const b of snapshot.bundles) {
    verifiedBundle(b, snapshot.tenant);
    if (snapshot.documents[b.document.id]?.version_id !== b.version.id) fail('invalid_snapshot');
  }
}
