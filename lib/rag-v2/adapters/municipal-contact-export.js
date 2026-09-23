import { readInput } from '../catalog.js';
import { DEFAULT_CONFIG, fail, hash, nonempty, stable } from '../contracts.js';
import { contactBinding, contactProjection, readVerifiedMunicipalContact } from './verified-municipal-contact.js';

export const CONTACT_MAPPING_SCHEMA = 'sotsiaalai/contact-source-mapping-1';
export const CONTACT_EXPORT_SCHEMA = 'sotsiaalai/verified-contact-export-1';

function validateMapping(mapping) {
  if (mapping?.schema_version !== CONTACT_MAPPING_SCHEMA || !Array.isArray(mapping.entries)
    || !mapping.entries.length || mapping.entries.length > 100) fail('invalid_contact_mapping');
  const seen = new Set();
  for (const entry of mapping.entries) {
    if (!entry || ![entry.path, entry.item_id, entry.registry_entry_id].every(nonempty)
      || !/^[a-f0-9]{64}$/.test(entry.sha256 || '')) fail('invalid_contact_mapping');
    const key = stable([entry.path, entry.item_id]);
    if (seen.has(key)) fail('duplicate_contact_mapping');
    seen.add(key);
  }
}

/** Read-only registry adapter. The explicit mapping bridges different IDs; it
 * neither guesses names nor approves a contact, source publication or AI call. */
export async function prepareMunicipalContactExport({ db, inputRoot, mapping, now = () => new Date() }) {
  validateMapping(mapping);
  const sources = new Map(), identities = new Set(), itemIds = new Set(), items = [], rows = [];
  for (const entry of mapping.entries) {
    if (!sources.has(entry.path)) {
      const bytes = await readInput(inputRoot, entry.path, DEFAULT_CONFIG.maxFileBytes);
      let value; try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('invalid_source_json'); }
      sources.set(entry.path, { sha256: hash(bytes), value });
    }
    const source = sources.get(entry.path);
    if (source.sha256 !== entry.sha256) fail('contact_mapping_source_changed');
    if (!Array.isArray(source.value.items)) fail('source_package_required');
    const matches = source.value.items.map((item, index) => ({ item, index })).filter(({ item }) => item?.id === entry.item_id);
    if (matches.length !== 1) fail('source_package_item_not_unique');
    const { item, index } = matches[0];
    if ((item.itemType || item.item_type) !== 'contact' || !nonempty(item.municipality_id)) fail('contact_mapping_requires_contact');
    const identity = item.canonical_item_id || item.id;
    if (!nonempty(identity) || identities.has(identity)) fail('duplicate_contact_identity');
    if (itemIds.has(item.id)) fail('duplicate_export_item_id');
    identities.add(identity);
    itemIds.add(item.id);
    const row = await readVerifiedMunicipalContact(db, { entryId: entry.registry_entry_id, region: item.municipality_id, now: now() });
    if (!row) fail('contact_not_verified');
    if (!nonempty(row.title) || !nonempty(row.phone) && !nonempty(row.email)) fail('contact_channel_missing');
    let url; try { url = new URL(row.sourceUrl); } catch { fail('contact_source_url_invalid'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) fail('contact_source_url_invalid');
    const projection = contactProjection(row);
    const binding = contactBinding(row, { path: entry.path, sha256: entry.sha256, pointer: `/items/${index}`, item_id: item.id });
    // Never carry old roles, channels, status or timestamps into the new source.
    // Service -> contact links in the original service source keep their target ID.
    items.push({ id: item.id, canonical_item_id: identity, itemType: 'contact', municipality_id: projection.region,
      municipality_name: row.municipality.displayName, source_type: 'municipal_contact', language: item.language || 'et',
      name: row.title, ...(row.phone ? { phone: row.phone } : {}), ...(row.email ? { email: row.email } : {}),
      officialUrl: row.sourceUrl, checked_at: projection.checked_at, registry_binding: binding });
    rows.push({ entryId: row.id, region: projection.region, fingerprint: hash(stable(projection)) });
  }
  // Catch a registry edit/revocation during preparation; runtime repeats this
  // decision after ingestion, before sending evidence and when restoring it.
  for (const expected of rows) {
    const row = await readVerifiedMunicipalContact(db, { ...expected, now: now() });
    if (!row || hash(stable(contactProjection(row))) !== expected.fingerprint) fail('contact_changed_during_export');
  }
  return { schema_version: CONTACT_EXPORT_SCHEMA, generated_at: now().toISOString(),
    mapping_sha256: hash(stable(mapping)), items };
}
