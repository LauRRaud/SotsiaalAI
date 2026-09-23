import { buildFreshServiceMapContactWhere } from '../../serviceMap/contactFreshnessProjection.js';
import { hash, nonempty, stable } from '../contracts.js';

export const CONTACT_BINDING_SCHEMA = 'sotsiaalai/verified-contact-binding-1';
export const CONTACT_SELECT = Object.freeze({ id: true, title: true, phone: true, email: true, sourceUrl: true,
  sourceDocId: true, sourceNamespace: true, revision: true, checkedAt: true, municipalityId: true,
  municipality: { select: { slug: true, displayName: true } } });

export function contactProjection(row) {
  return { entry_id: row.id, revision: row.revision, checked_at: new Date(row.checkedAt).toISOString(),
    source_namespace: row.sourceNamespace, source_doc_id: row.sourceDocId, municipality_id: row.municipalityId,
    region: row.municipality.slug.replaceAll('-', '_'), name: row.title,
    phone: row.phone, email: row.email, official_url: row.sourceUrl };
}

export async function readVerifiedMunicipalContact(db, { entryId, region, now = new Date() }) {
  const fresh = await buildFreshServiceMapContactWhere(db, { now });
  return db.serviceMapEntry.findFirst({ where: { AND: [fresh, { id: entryId,
    municipality: { is: { isActive: true, slug: region.replaceAll('_', '-') } } }] }, select: CONTACT_SELECT });
}

export function contactBinding(row, sourceRecord) {
  const projection = contactProjection(row);
  return { schema_version: CONTACT_BINDING_SCHEMA, entry_id: projection.entry_id, revision: projection.revision,
    checked_at: projection.checked_at, projection_sha256: hash(stable(projection)), source_record: sourceRecord };
}

export function validContactBinding(binding, record) {
  const source = binding?.source_record;
  return binding?.schema_version === CONTACT_BINDING_SCHEMA && nonempty(binding.entry_id)
    && Number.isSafeInteger(binding.revision) && binding.revision > 0
    && typeof binding.checked_at === 'string' && Number.isFinite(Date.parse(binding.checked_at))
    && /^[a-f0-9]{64}$/.test(binding.projection_sha256 || '')
    && nonempty(source?.path) && /^[a-f0-9]{64}$/.test(source?.sha256 || '')
    && /^\/items\/\d+$/.test(source?.pointer || '') && nonempty(source?.item_id)
    && record.aliases.includes(source.item_id);
}

export function boundContactMatches(row, record, binding) {
  if (!validContactBinding(binding, record)) return false;
  const projection = contactProjection(row);
  if (projection.region !== record.region || binding.entry_id !== row.id || binding.revision !== row.revision
    || binding.checked_at !== projection.checked_at || binding.projection_sha256 !== hash(stable(projection))) return false;
  // All exported channels are exact registry values, including absent ones.
  return [['name', row.title], ['phone', row.phone], ['email', row.email], ['official_url', row.sourceUrl], ['checked_at', projection.checked_at]]
    .every(([field, value]) => (record.fields[field]?.value ?? null) === (value || null))
    && Object.keys(record.fields).every(field => ['name', 'phone', 'email', 'official_url', 'checked_at'].includes(field));
}
