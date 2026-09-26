import fs from 'node:fs/promises';
import path from 'node:path';
import { readInput } from './catalog.js';
import { adaptMetadata, METADATA_ADAPTATION } from './metadata-adapter.js';
import { inspectXmlMetadata } from './text-source.js';
import { DEFAULT_CONFIG, fail, hash } from './contracts.js';
import { municipalRecordMapping } from './adapters/municipal-record.js';

// The registry names the exact bytes of every metadata file (role "metadata"). Source registers it
// declares (role "source_register") can name the municipality of a source by its hash; a municipal
// legal act gets its region from there, never from its file name. Both are cached per real
// directory and reused only while REGISTER.json and every declared register keep their size and
// modification time; any change re-reads and re-checks the hashes. A missing or unreadable
// registry is not cached.
const registries = new Map();
const stamp = async file => { const stat = await fs.stat(file); return `${stat.size}:${stat.mtimeMs}`; };
async function registryIndex(root) {
  const base = await fs.realpath(root);
  const cached = registries.get(base);
  if (cached) {
    const current = await Promise.all(cached.files.map(file => stamp(path.join(base, file)).catch(() => null)));
    if (current.every((value, index) => value === cached.stamps[index])) return cached.index;
  }
  const found = new Map(), metadata = new Map();
  let registry;
  try { registry = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readInput(root, 'REGISTER.json', DEFAULT_CONFIG.maxFileBytes))); }
  catch { return { municipalities: found, metadata }; }
  for (const entry of Array.isArray(registry?.entries) ? registry.entries : []) {
    if (entry?.role === 'metadata' && typeof entry.path === 'string' && typeof entry.sha256 === 'string') metadata.set(entry.path, entry.sha256);
  }
  const registers = registry?.entries?.filter(entry => entry.role === 'source_register') || [];
  for (const register of registers) {
    const bytes = await readInput(root, register.path, DEFAULT_CONFIG.maxFileBytes);
    if (hash(bytes) !== register.sha256) fail('registry_source_hash_mismatch');
    let content; try { content = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid_source_register'); }
    for (const item of Array.isArray(content?.entries) ? content.entries : []) {
      if (typeof item.sha256 === 'string' && typeof item.municipality_id === 'string' && typeof item.municipality_name === 'string') {
        found.set(item.sha256, { municipality_id: item.municipality_id, municipality_name: item.municipality_name });
      }
    }
  }
  const files = ['REGISTER.json', ...registers.map(register => register.path)], index = { municipalities: found, metadata };
  registries.set(base, { files, stamps: await Promise.all(files.map(file => stamp(path.join(base, file)))), index });
  return index;
}

// A legal act's jurisdiction: the verified register entry for its hash; otherwise its issuer. A
// council or government of a municipality the register lists ("Raasiku Vallavolikogu" -> Raasiku
// vald, "Tallinna Linnavalitsus" -> Tallinn) gives that municipality when exactly one matches;
// Riigikogu, the Government and a minister are national. Anything else stays unknown.
function jurisdictionOf(sha256, authority, bySource) {
  const registered = bySource.get(sha256);
  if (registered) return { ...registered, jurisdiction_level: 'municipal', country: 'EE', jurisdiction_basis: 'source_register_hash' };
  const issuer = typeof authority === 'string' ? authority.trim() : '';
  const local = issuer.match(/^(\p{Lu}[\p{L}-]*(?: \p{Lu}[\p{L}-]*)*) (Valla|Linna)(?:volikogu|valitsus)$/u);
  if (local) {
    const [, place, kind] = local;
    const known = new Map([...bySource.values()].map(value => [value.municipality_id, value]));
    const matches = [...known.values()].filter(({ municipality_name: name }) => {
      const base = name.replace(kind === 'Valla' ? / vald$/u : / linn$/u, '');
      if (kind === 'Valla' && !/ vald$/u.test(name)) return false;
      return place === base || place.length === base.length + 1 && place.startsWith(base);
    });
    return matches.length === 1 ? { municipality_id: matches[0].municipality_id, municipality_name: matches[0].municipality_name,
      jurisdiction_level: 'municipal', country: 'EE', jurisdiction_basis: 'issuer_name' }
      : { jurisdiction_level: 'municipal', country: 'EE', jurisdiction_basis: 'issuer_name' };
  }
  if (/^(?:Riigikogu|Vabariigi Valitsus|\p{L}+(?:- ja \p{L}+)?minister)$/u.test(issuer)) {
    return { jurisdiction_level: 'national', country: 'EE', jurisdiction_basis: 'issuer_name' };
  }
  return {};
}

/** Local corpus adapter. The general ingest core does not know the registry's folder names. */
export async function registeredSource(root, entry, options = {}) {
  if (entry.role !== 'source') fail('registry_entry_requires_reconciliation');
  const bytes = await readInput(root, entry.path, DEFAULT_CONFIG.maxFileBytes);
  if (hash(bytes) !== entry.sha256) fail('registry_source_hash_mismatch');
  const format = path.extname(entry.path).slice(1).toLowerCase();
  let original = {}, metadata;
  if (entry.metadata_path) {
    const metadataBytes = await readInput(root, entry.metadata_path, DEFAULT_CONFIG.maxMetadataBytes);
    if (hash(metadataBytes) !== (await registryIndex(root)).metadata.get(entry.metadata_path)) fail('registry_metadata_hash_mismatch');
    try { original = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadataBytes)); } catch { fail('invalid_metadata_json'); }
    metadata = adaptMetadata(original, entry.metadata_path);
    metadata = { ...metadata, source_path: entry.path, source_format: format };
  } else if (format === 'xml') {
    const inspected = inspectXmlMetadata(bytes);
    if (!inspected.metadata.act_reference || !inspected.metadata.title) fail('xml_identity_missing');
    metadata = { ...inspected.metadata, document_id: `riigiteataja:${inspected.metadata.act_reference}`,
      source_type: 'legal_act', language: 'et', source_format: 'xml', source_path: entry.path,
      source_url: `https://www.riigiteataja.ee/akt/${inspected.metadata.act_reference}`,
      ...jurisdictionOf(entry.sha256, inspected.metadata.authority, (await registryIndex(root)).municipalities) };
  } else if (format === 'json') {
    let content; try { content = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid_source_json'); }
    if (Array.isArray(content.items)) {
      if (!options.itemId) fail('source_package_item_required');
      const matching = content.items.map((item, index) => ({ item, index })).filter(({ item }) => item.id === options.itemId);
      if (matching.length !== 1) fail('source_package_item_not_unique');
      const { item, index } = matching[0];
      original = item;
      metadata = { ...adaptMetadata(item, entry.path), document_id: item.canonical_item_id || item.id, source_path: entry.path, source_format: 'json',
        source_selector: { json_pointer: `/items/${index}` }, source_type: item.source_type || 'municipal_source_record',
        language: item.language || 'et', title: item.title || item.name,
        ...(municipalRecordMapping(item) ? { record_mapping: municipalRecordMapping(item) } : {}) };
    } else if (content.organization_id) {
      original = content; metadata = { ...adaptMetadata(content, entry.path), source_path: entry.path, source_format: 'json' };
    } else fail('json_source_adapter_required');
  } else fail('source_metadata_required');
  // Original values remain in the metadata asset; the source itself stays byte-identical.
  const origins = metadata.metadata_adaptation?.origins || {};
  metadata = { ...metadata, imported_metadata: original,
    metadata_adaptation: { ...(metadata.metadata_adaptation || {}), schema_version: METADATA_ADAPTATION,
      origins: Object.fromEntries(Object.entries(origins).map(([field, location]) => [field, location === null ? null : `/imported_metadata${location}`])) },
    registry_provenance: { source_sha256: entry.sha256, registry_path: entry.path, metadata_path: entry.metadata_path || null } };
  for (const key of ['metadata_variants', 'server_metadata']) delete metadata[key];
  // Optional null legacy fields denote missing information, not valid scalar values.
  for (const [key, value] of Object.entries(metadata)) if (value === null) delete metadata[key];
  return metadata;
}
