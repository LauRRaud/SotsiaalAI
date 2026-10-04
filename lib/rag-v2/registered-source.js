import fs from 'node:fs/promises';
import path from 'node:path';
import { readInput } from './catalog.js';
import { adaptMetadata, METADATA_ADAPTATION } from './metadata-adapter.js';
import { inspectXmlMetadata, xmlSections } from './text-source.js';
import { DEFAULT_CONFIG, fail, hash, nonempty } from './contracts.js';
import { municipalRecordMapping } from './adapters/municipal-record.js';
import { rtAnnexFiles } from './adapters/rt-annex.js';
import { metadataValue } from './metadata-values.js';
import { validateKnowledgeInput } from './knowledge.js';

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
  const found = new Map(), metadata = new Map(), links = new Map(), sources = new Map(), knowledge = new Map();
  let registry;
  try { registry = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readInput(root, 'REGISTER.json', DEFAULT_CONFIG.maxFileBytes))); }
  catch { return { municipalities: found, metadata, links, sources, knowledge }; }
  for (const entry of Array.isArray(registry?.entries) ? registry.entries : []) {
    if (entry?.role === 'metadata' && typeof entry.path === 'string' && typeof entry.sha256 === 'string') metadata.set(entry.path, entry.sha256);
    if (entry?.role === 'source' && typeof entry.path === 'string' && typeof entry.sha256 === 'string') sources.set(entry.path, entry.sha256);
    if (entry?.role === 'knowledge' && typeof entry.path === 'string' && typeof entry.sha256 === 'string') knowledge.set(entry.path, entry.sha256);
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
    // A municipal package's register names its source pages by key (KOV/<m>/<m>.sources.json).
    const pages = new Map();
    for (const source of Array.isArray(content?.sources) ? content.sources : []) {
      const key = source?.key ?? source?.source_key;
      if (nonempty(key) && typeof source.url === 'string' && HTTPS_URL.test(source.url) && !pages.has(key)) pages.set(key, source.url);
    }
    if (pages.size) links.set(register.path, { sha256: register.sha256, pages });
  }
  const files = ['REGISTER.json', ...registers.map(register => register.path)], index = { municipalities: found, metadata, links, sources, knowledge };
  registries.set(base, { files, stamps: await Promise.all(files.map(file => stamp(path.join(base, file)))), index });
  return index;
}

// A record that declares no link of its own (577 of 4876 KOV records, 410 of them contacts) gets the pages its
// source keys name in its municipality's hash-verified register, so the source view can open the original page.
// A record's own link always wins; the register only fills a missing one.
const HTTPS_URL = /^https:\/\/[^\s"<>]+$/u;
function registeredPages(item, packagePath, registers) {
  if (['officialUrl', 'url_canonical', 'url', 'source_url'].some(key => nonempty(item[key]))) return {};
  const keys = [...new Set([...(item.sourceKeys || []), ...(item.source_keys || [])].filter(nonempty))];
  const register = registers.get(packagePath.replace(/\.json$/u, '.sources.json'));
  const urls = register ? [...new Set(keys.map(key => register.pages.get(key)).filter(Boolean))] : [];
  return urls.length ? { source_urls: urls } : {};
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

// A table read from a Riigi Teataja act's annex (ADR-050) names the XML and the annex file it came from. Both are
// checked again here: the XML is a registered source with that hash, the annex is in it with that hash, and the act
// identity and validity are the XML's own. A version in force with no end gives its annex the same open end.
async function checkedRtAnnex(root, metadata) {
  const annex = metadata.rt_annex;
  if (!annex || typeof annex !== 'object' || Array.isArray(annex) || ['xml_path', 'xml_sha256', 'act_reference', 'file_name', 'pdf_sha256']
    .some(key => typeof annex[key] !== 'string' || !annex[key])) fail('invalid_rt_annex');
  if ((await registryIndex(root)).sources.get(annex.xml_path) !== annex.xml_sha256) fail('rt_annex_source_not_registered');
  const xml = await readInput(root, annex.xml_path, DEFAULT_CONFIG.maxFileBytes);
  if (hash(xml) !== annex.xml_sha256) fail('registry_source_hash_mismatch');
  const act = inspectXmlMetadata(xml).metadata, file = rtAnnexFiles(xml).find(entry => entry.file_name === annex.file_name);
  if (!file || file.sha256 !== annex.pdf_sha256) fail('rt_annex_file_mismatch');
  const date = (field, value) => (value ? metadataValue(field, value) : null);
  if (act.act_reference !== annex.act_reference || metadata.source_type !== 'legal_act'
    || date('valid_from', act.valid_from) !== date('valid_from', metadata.valid_from) || date('valid_to', act.valid_to) !== date('valid_to', metadata.valid_to)) fail('rt_annex_act_mismatch');
  return { ...annex, open_end: Boolean(act.valid_from && !act.valid_to) };
}

export const REGISTERED_KNOWLEDGE_SCHEMA = 'rag-v2/registered-knowledge-1';
async function registeredKnowledge(root, entry) {
  if (typeof entry.knowledge_path !== 'string' || !entry.knowledge_path) fail('invalid_registered_knowledge');
  const bytes = await readInput(root, entry.knowledge_path, DEFAULT_CONFIG.maxFileBytes);
  if (hash(bytes) !== (await registryIndex(root)).knowledge.get(entry.knowledge_path)) fail('registry_knowledge_hash_mismatch');
  let value; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid_registered_knowledge'); }
  if (!value || value.schema_version !== REGISTERED_KNOWLEDGE_SCHEMA || value.source_path !== entry.path || value.source_sha256 !== entry.sha256
    || !value.preparation || typeof value.preparation !== 'object' || Array.isArray(value.preparation)
    || value.preparation.verification_state !== 'source_anchored_unreviewed') fail('invalid_registered_knowledge');
  validateKnowledgeInput(value.knowledge);
  return { knowledge: value.knowledge, knowledge_preparation: value.preparation };
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
    if (original.rt_annex !== undefined) {
      metadata.rt_annex = await checkedRtAnnex(root, metadata);
      // The derived source names the same act version, so the same annex in two versions is two sources (ADR-053).
      let derived; try { derived = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid_source_json'); }
      if (derived?.act_reference !== metadata.rt_annex.act_reference) fail('rt_annex_act_mismatch');
      // A text annex (ADR-053) names no jurisdiction of its own: it is its act's, read the same way from the registered XML.
      if (!metadata.jurisdiction_level) Object.assign(metadata, jurisdictionOf(metadata.rt_annex.xml_sha256, metadata.authority,
        (await registryIndex(root)).municipalities));
    }
  } else if (format === 'xml') {
    const inspected = inspectXmlMetadata(bytes);
    if (!inspected.metadata.act_reference || !inspected.metadata.title) fail('xml_identity_missing');
    metadata = { ...inspected.metadata, document_id: `riigiteataja:${inspected.metadata.act_reference}`,
      source_type: 'legal_act', language: 'et', source_format: 'xml', source_path: entry.path,
      source_url: `https://www.riigiteataja.ee/akt/${inspected.metadata.act_reference}`,
      // ADR-076: the registry may name the sections of the act this source is; the file stays Riigi Teataja's own bytes.
      ...(entry.xml_sections !== undefined ? { source_selector: { xml_sections: xmlSections({ source_selector: { xml_sections: entry.xml_sections } }) } } : {}),
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
        ...(municipalRecordMapping(item) ? { record_mapping: municipalRecordMapping(item) } : {}),
        ...registeredPages(item, entry.path, (await registryIndex(root)).links) };
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
  // ADR-054: source-anchored knowledge prepared for this source in a batch, as the registry names its exact bytes. The
  // ingest checks every anchor against the document's own text; the preparation record says how it was made.
  if (entry.knowledge_path !== undefined) Object.assign(metadata, await registeredKnowledge(root, entry));
  // Optional null legacy fields denote missing information, not valid scalar values.
  for (const [key, value] of Object.entries(metadata)) if (value === null) delete metadata[key];
  return metadata;
}
