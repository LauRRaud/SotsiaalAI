import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, hash, id, stable, validateBundle } from './contracts.js';

export async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
export async function writeJson(file, value) { await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' }); }

export async function readInput(root, relative, maxBytes) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || path.win32.isAbsolute(relative)
    || relative.split(/[\\/]/).some(p => p === '..') || relative.includes(':')) fail('source_path_outside_root');
  const base = await fs.realpath(root);
  const target = await fs.realpath(path.resolve(base, relative)).catch(() => fail('input_not_found'));
  const rel = path.relative(base, target);
  if (rel.startsWith(`..${path.sep}`) || rel === '..' || path.isAbsolute(rel)) fail('source_path_outside_root');
  const handle = await fs.open(target, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maxBytes) fail('input_size_limit');
    // Bounded handle read also catches growth after stat. The input root is operator-controlled.
    const buffer = Buffer.alloc(maxBytes + 1);
    let total = 0, count;
    do { ({ bytesRead: count } = await handle.read(buffer, total, buffer.length - total, null)); total += count; }
    while (count && total < buffer.length);
    if (total > maxBytes) fail('input_size_limit');
    return buffer.subarray(0, total);
  } finally { await handle.close(); }
}

export async function openCatalog(root, tenant) {
  const dir = path.resolve(root, id('tenant', tenant));
  await fs.mkdir(dir, { recursive: true });
  const lockPath = path.join(dir, 'writer.lock');
  const lock = await fs.open(lockPath, 'wx').catch(error => {
    if (error.code === 'EEXIST') fail('catalog_busy');
    throw error;
  });
  await lock.writeFile(JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
  return { dir, async close() { await lock.close(); await fs.unlink(lockPath); } };
}

export async function readActive(dir) {
  try {
    const active = await readJson(path.join(dir, 'active.json'));
    if (active.schema_version !== 'rag-v2/catalog-1' || !active.documents || Array.isArray(active.documents)) fail('invalid_catalog');
    return active;
  } catch (error) {
    if (error.code === 'ENOENT') return { schema_version: 'rag-v2/catalog-1', generation: null, documents: {} };
    throw error; // Corruption must never become an empty corpus.
  }
}

export async function loadVersion(dir, versionId) {
  if (!/^version_[a-f0-9]{64}$/.test(versionId)) fail('invalid_version_id');
  const folder = path.join(dir, 'versions', versionId);
  const manifest = await readJson(path.join(folder, 'manifest.json'));
  const expected = ['bundle.json', 'original.pdf', 'metadata.json', 'provenance.json', 'chunks.json', 'spans.json', 'report.html'];
  if (Object.keys(manifest.files).sort().join('|') !== expected.sort().join('|')) fail('invalid_version_manifest');
  for (const [name, digest] of Object.entries(manifest.files)) {
    if (hash(await fs.readFile(path.join(folder, name))) !== digest) fail('version_integrity_failed');
  }
  const bundle = validateBundle(await readJson(path.join(folder, 'bundle.json')));
  if (bundle.version.id !== versionId) fail('version_identity_mismatch');
  return bundle;
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function reportHtml(bundle) {
  const f = bundle.document.fields;
  return `<!doctype html><html lang="et"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>RAG sissevõtu aruanne</title><style>body{font:17px/1.55 system-ui;max-width:980px;margin:48px auto;padding:0 24px;color:#182b30;background:#f7f8f4}h1{line-height:1.2}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #ccd5d0;padding:10px;vertical-align:top;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}article{border-top:2px solid #bccbc4;margin-top:28px}small{overflow-wrap:anywhere}a{color:#075b54}</style><h1>${escapeHtml(f.title.value)}</h1><p>Kohalik sissevõtt · ${bundle.pages.length} PDF-lehte · ${bundle.chunks.length} tekstiosa · välismudelikutseid 0.</p><p>Kvaliteet: ${escapeHtml(bundle.report.quality_state)}. Struktuursete seoste olemasolu ei tõenda semantilist õigsust.</p><h2>Andmeväljad ja päritolu</h2><table><tr><th>Väli</th><th>Väärtus</th><th>Alus</th></tr>${Object.entries(f).map(([key, field]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(JSON.stringify(field.value))}</td><td>${escapeHtml(field.provenance.map(p => p.kind + (p.path ? ` ${p.path}` : '')).join(', '))}</td></tr>`).join('')}</table><h2>Piirangud</h2><ul>${bundle.report.warnings.map(w => `<li><strong>${escapeHtml(w.code)}</strong> ${escapeHtml(w.detail || w.resolution || '')}</li>`).join('')}</ul><h2>Tekstiosad</h2>${bundle.chunks.map(c => `<article><h3>${escapeHtml(c.section_path.join(' / '))}</h3><p>PDF lk ${c.pdf_pages.join(', ')} · <a href="original.pdf#page=${c.pdf_pages[0]}">Ava algallikas</a></p><small>${c.id}</small><pre>${escapeHtml(c.source_text)}</pre><details><summary>Allikakohtade tunnused</summary><pre>${escapeHtml(c.span_ids.join('\n'))}</pre></details></article>`).join('')}</html>`;
}

export async function stageVersion(dir, bundle, pdfBytes, metadataBytes) {
  const versions = path.join(dir, 'versions');
  await fs.mkdir(versions, { recursive: true });
  const destination = path.join(versions, bundle.version.id);
  try { await fs.access(destination); return await loadVersion(dir, bundle.version.id); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staging = path.join(dir, `staging-${randomUUID()}`);
  await fs.mkdir(staging);
  const values = {
    'bundle.json': JSON.stringify(bundle, null, 2), 'original.pdf': pdfBytes, 'metadata.json': metadataBytes,
    'provenance.json': JSON.stringify(bundle.report.field_provenance, null, 2),
    'chunks.json': JSON.stringify(bundle.chunks, null, 2), 'spans.json': JSON.stringify(bundle.spans, null, 2),
    'report.html': reportHtml(bundle),
  };
  const manifest = { schema_version: 'rag-v2/version-manifest-1', files: {} };
  for (const [name, value] of Object.entries(values)) {
    await fs.writeFile(path.join(staging, name), value, { flag: 'wx' });
    manifest.files[name] = hash(value);
  }
  await writeJson(path.join(staging, 'manifest.json'), manifest);
  await fs.rename(staging, destination);
  return bundle;
}

export async function publish(dir, active, bundle) {
  const documents = { ...active.documents, [bundle.document.id]: {
    version_id: bundle.version.id, pdf_hash: bundle.version.pdf_hash, external_id: bundle.document.external_ids.document_id,
  } };
  const next = { schema_version: active.schema_version, tenant_id: bundle.tenant_id, generation: id('generation', stable(documents)), documents };
  const temporary = path.join(dir, `active-${randomUUID()}.tmp`);
  await writeJson(temporary, next);
  await fs.rename(temporary, path.join(dir, 'active.json'));
  return next;
}
