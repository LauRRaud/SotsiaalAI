import { RECORD_MAPPING_SCHEMA } from '../structured-record.js';

/** SotsiaalAI's collected KOV package shape; the retrieval core only sees the
 * generic structured-record contract. No municipality/source names are special. */
export function municipalRecordMapping(item) {
  const kind = item.itemType || item.item_type;
  if (!['service', 'benefit', 'resource', 'contact', 'form'].includes(kind) || !item.municipality_id) return undefined;
  const fields = kind === 'contact'
    ? { name: ['name'], role: ['role'], department: ['department'], phone: ['phone'], email: ['email'] }
    : { title: ['title'], summary: ['summary'], target_group: ['targetGroup'], conditions: ['conditions'],
      amount: ['amount'], application: ['application'], deadline: ['deadline'], format: ['format'] };
  return { schema_version: RECORD_MAPPING_SCHEMA, kind, identity: ['canonical_item_id', 'id'], region: 'municipality_id',
    fields: { ...fields, official_url: ['officialUrl', 'url'], checked_at: ['last_checked', 'checked_at'] },
    links: [
      { field: 'relatedContacts', relation: 'contact', target_kinds: ['contact'] },
      { field: 'relatedForms', relation: 'form', target_kinds: ['form'] },
      { field: 'relatedTo', relation: 'about', target_kinds: ['service', 'benefit', 'resource'] },
    ] };
}
