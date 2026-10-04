import { buildFreshServiceMapContactWhere } from '../../serviceMap/contactFreshnessProjection.js';
import { hash, nonempty, stable } from '../contracts.js';

// Binding 2 (ADR-045) binds what the contact is, not when it was last checked. Binding 1 (ADR-017) also pinned the check
// time, so the weekly re-check of an unchanged contact revoked every export; it stays readable with its old rule.
export const CONTACT_BINDING_SCHEMA = 'sotsiaalai/verified-contact-binding-2';
const CONTACT_BINDING_SCHEMA_1 = 'sotsiaalai/verified-contact-binding-1';
export const CONTACT_SELECT = Object.freeze({ id: true, title: true, phone: true, email: true, sourceUrl: true,
  sourceDocId: true, sourceNamespace: true, revision: true, checkedAt: true, municipalityId: true, type: true, description: true,
  municipality: { select: { slug: true, displayName: true } } });

/** The register writes a contact's role as "Roll: <role> Osakond: <department>"; anything else gives no role. */
export function registerRole(description) {
  const match = /^\s*Roll:\s*(.+?)\s*(?:Osakond:\s*(.+?)\s*)?$/su.exec(description || '');
  return { role: match?.[1] || null, department: match?.[2] || null };
}

export function contactProjection(row) {
  return { entry_id: row.id, revision: row.revision, checked_at: new Date(row.checkedAt).toISOString(),
    source_namespace: row.sourceNamespace, source_doc_id: row.sourceDocId, municipality_id: row.municipalityId,
    region: row.municipality.slug.replaceAll('-', '_'), name: row.title,
    phone: row.phone, email: row.email, official_url: row.sourceUrl };
}

/** What the contact is: identity, revision, municipality, channels, and the register's type and role (description),
 * without the time of its last check. A new role ends the binding like a new phone number. */
export function contactContent(row) {
  const { checked_at: _checkedAt, ...content } = contactProjection(row);
  return { ...content, type: row.type ?? null, description: row.description ?? null };
}

export async function readVerifiedMunicipalContact(db, { entryId, region, now = new Date() }) {
  const fresh = await buildFreshServiceMapContactWhere(db, { now });
  return db.serviceMapEntry.findFirst({ where: { AND: [fresh, { id: entryId,
    municipality: { is: { isActive: true, slug: region.replaceAll('_', '-') } } }] }, select: CONTACT_SELECT });
}

// ADR-085: a contact exported straight from the register has no package item behind it. Its document is named after the
// register row, and the binding's source record says so instead of pointing into a package file.
export const REGISTER_SOURCE = 'service_map';
export const registerContactId = entryId => `service-map-contact:${entryId}`;
/** The record that lists a municipality's verified contacts (ADR-085). */
export const registerDirectoryId = region => `service-map-contacts:${region}`;

export function contactBinding(row, sourceRecord) {
  const projection = contactProjection(row);
  // checked_at is the check the export read: history for the record, not part of the binding.
  return { schema_version: CONTACT_BINDING_SCHEMA, entry_id: projection.entry_id, revision: projection.revision,
    checked_at: projection.checked_at, content_sha256: hash(stable(contactContent(row))), source_record: sourceRecord };
}

export function validContactBinding(binding, record) {
  const source = binding?.source_record;
  const digestField = { [CONTACT_BINDING_SCHEMA]: 'content_sha256', [CONTACT_BINDING_SCHEMA_1]: 'projection_sha256' }[binding?.schema_version];
  return Boolean(digestField) && nonempty(binding.entry_id)
    && Number.isSafeInteger(binding.revision) && binding.revision > 0
    && typeof binding.checked_at === 'string' && Number.isFinite(Date.parse(binding.checked_at))
    && /^[a-f0-9]{64}$/.test(binding[digestField] || '')
    // The source record is a package item (path, bytes, pointer), or the register row itself (ADR-085, binding 2 only):
    // then the document carries the row's own identity.
    && (source?.register === undefined
      ? nonempty(source?.path) && /^[a-f0-9]{64}$/.test(source?.sha256 || '') && /^\/items\/\d+$/.test(source?.pointer || '')
      : binding.schema_version === CONTACT_BINDING_SCHEMA && source.register === REGISTER_SOURCE && Object.keys(source).length === 2
        && source.item_id === registerContactId(binding.entry_id))
    && nonempty(source?.item_id) && record.aliases.includes(source.item_id);
}

export function boundContactMatches(row, record, binding) {
  if (!validContactBinding(binding, record)) return false;
  const projection = contactProjection(row);
  if (projection.region !== record.region || binding.entry_id !== row.id || binding.revision !== row.revision) return false;
  // Binding 2: the same revision and content stay bound after a re-check; whether the contact is verified now is the
  // caller's live freshness rule (readVerifiedMunicipalContact). Binding 1 also required the same check time.
  const bound = binding.schema_version === CONTACT_BINDING_SCHEMA ? binding.content_sha256 === hash(stable(contactContent(row)))
    : binding.checked_at === projection.checked_at && binding.projection_sha256 === hash(stable(projection));
  if (!bound) return false;
  // All exported values are exact registry values, including absent ones; the record's check time is the export's.
  // Binding 2 also exports the register's role and department.
  const { role, department } = registerRole(row.description);
  const expected = [['name', row.title], ['phone', row.phone], ['email', row.email], ['official_url', row.sourceUrl], ['checked_at', binding.checked_at],
    ...(binding.schema_version === CONTACT_BINDING_SCHEMA ? [['role', role], ['department', department]] : [])];
  return expected.every(([field, value]) => (record.fields[field]?.value ?? null) === (value || null))
    && Object.keys(record.fields).every(field => expected.some(([name]) => name === field));
}
