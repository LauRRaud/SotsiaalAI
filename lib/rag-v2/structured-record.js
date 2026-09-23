import { fail, nonempty, stable } from './contracts.js';

export const RECORD_SCHEMA = 'rag-v2/structured-record-1';
export const RECORD_MAPPING_SCHEMA = 'rag-v2/record-mapping-1';
const part = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
const scalar = value => typeof value === 'string' && nonempty(value);
const fieldText = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);

/** Declarative source adapter: values and links are read from the selected JSON,
 * never from generated descriptions or a language model. */
export function structuredRecord(object, pointer, mapping) {
  if (!mapping) return null;
  if (mapping.schema_version !== RECORD_MAPPING_SCHEMA || !nonempty(mapping.kind)
    || !Array.isArray(mapping.identity) || !mapping.identity.length || !mapping.identity.every(nonempty)
    || !nonempty(mapping.region) || !mapping.fields || Array.isArray(mapping.fields)
    || !Array.isArray(mapping.links) || typeof pointer !== 'string') fail('invalid_record_mapping');
  const identities = mapping.identity.map(key => object[key]).filter(scalar);
  if (!identities.length || !scalar(object[mapping.region])) fail('structured_record_identity_missing');
  const fields = {};
  for (const [name, keys] of Object.entries(mapping.fields)) {
    if (!nonempty(name) || !Array.isArray(keys) || !keys.length || !keys.every(nonempty)) fail('invalid_record_mapping');
    const present = keys.filter(key => object[key] !== undefined && object[key] !== null && object[key] !== '');
    if (!present.length) continue;
    // Aliases within one semantic field may not silently replace each other.
    if (present.some(key => stable(object[key]) !== stable(object[present[0]]))) fail('structured_record_field_conflict');
    const key = present[0], value = object[key];
    const serialized = fieldText(value);
    if (typeof serialized !== 'string' || serialized.length > 30000 || !serialized.isWellFormed() || serialized.includes('\u0000')) fail('invalid_record_field');
    fields[name] = { value, path: `${pointer}/${part(key)}` };
  }
  const links = [];
  for (const { field, relation, target_kinds: kinds } of mapping.links) {
    if (!nonempty(field) || !nonempty(relation) || !Array.isArray(kinds) || !kinds.length || !kinds.every(nonempty)) fail('invalid_record_mapping');
    if (object[field] == null) continue;
    if (!Array.isArray(object[field]) || object[field].length > 200 || !object[field].every(nonempty)) fail('invalid_record_links');
    for (const [index, target] of object[field].entries()) links.push({ relation, target, target_kinds: kinds, path: `${pointer}/${part(field)}/${index}` });
  }
  const record = { schema_version: RECORD_SCHEMA, id: identities[0], aliases: [...new Set(identities)], kind: mapping.kind,
    region: object[mapping.region], path: pointer, fields, links };
  validateStructuredRecord(record);
  return record;
}

export function validateStructuredRecord(record) {
  if (!record || record.schema_version !== RECORD_SCHEMA || ![record.id, record.kind, record.region].every(nonempty)
    || typeof record.path !== 'string' || !Array.isArray(record.aliases) || !record.aliases.includes(record.id)
    || record.aliases.some(value => !nonempty(value)) || !record.fields || Array.isArray(record.fields)
    || !Array.isArray(record.links)) fail('invalid_structured_record');
  for (const field of Object.values(record.fields)) {
    const serialized = field && fieldText(field.value);
    if (typeof serialized !== 'string' || serialized.length > 30000 || !serialized.isWellFormed() || typeof field.path !== 'string'
      || !field.path.startsWith(record.path + '/')) fail('invalid_record_field');
  }
  for (const link of record.links) {
    if (![link.relation, link.target, link.path].every(nonempty) || !link.path.startsWith(record.path + '/')
      || !Array.isArray(link.target_kinds) || !link.target_kinds.length || !link.target_kinds.every(nonempty)) fail('invalid_record_links');
  }
}

export function validateStructuredRecordSources(record, units) {
  const byPath = new Map(units.map(unit => [unit.locator.path, unit.raw_text]));
  for (const field of Object.values(record.fields)) if (byPath.get(field.path) !== fieldText(field.value)) fail('record_field_source_mismatch');
  for (const link of record.links) if (byPath.get(link.path) !== link.target) fail('record_link_source_mismatch');
}
