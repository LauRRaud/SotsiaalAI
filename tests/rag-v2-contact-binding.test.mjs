import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, stable } from '../lib/rag-v2/contracts.js';
import { boundContactMatches, contactBinding, contactProjection, CONTACT_BINDING_SCHEMA } from '../lib/rag-v2/adapters/verified-municipal-contact.js';

// ADR-045: an exported contact is bound to its register entry's identity, revision and content, not to the time of its
// last check. Whether the entry is verified now is the live freshness rule, tested with the database elsewhere
// (tests/rag-v2-structured-records.integration.test.mjs). Fictional values only.
const contact = { id: 'synthetic-contact', revision: 1, checkedAt: new Date('2026-09-20T00:00:00Z'), sourceNamespace: 'OFFICIAL_KOV_CONTACT',
  sourceDocId: null, municipalityId: 'synthetic-municipality', municipality: { slug: 'synthetic-vald' },
  title: 'Test Contact', phone: '+372 0000001', email: null, sourceUrl: 'https://example.invalid/contact' };
const source = { path: 'synthetic.json', sha256: 'a'.repeat(64), pointer: '/items/0', item_id: 'synthetic-contact' };
const recordFor = (row, checkedAt = row.checkedAt.toISOString()) => ({ region: 'synthetic_vald', aliases: ['synthetic-contact'], fields: {
  name: { value: row.title }, phone: { value: row.phone }, official_url: { value: row.sourceUrl }, checked_at: { value: checkedAt } } });

test('a re-check of the same revision and content keeps the export; any change of what the contact is ends it', () => {
  const binding = contactBinding(contact, source), record = recordFor(contact);
  assert.equal(binding.schema_version, CONTACT_BINDING_SCHEMA);
  assert.equal(binding.checked_at, '2026-09-20T00:00:00.000Z', 'the check the export read, kept as history');
  assert.equal(boundContactMatches(contact, record, binding), true);
  // Codex's probe (28.09): only the check time moved.
  assert.equal(boundContactMatches({ ...contact, checkedAt: new Date('2026-09-27T00:00:00Z') }, record, binding), true);
  for (const changed of [{ phone: '+372 0000099' }, { title: 'Other Name' }, { sourceUrl: 'https://example.invalid/other' }, { email: 'x@example.invalid' },
    { revision: 2 }, { municipality: { slug: 'other-vald' } }, { sourceNamespace: 'LEGACY_KOV_CONTACT' }, { id: 'another-entry' }]) {
    assert.equal(boundContactMatches({ ...contact, ...changed }, record, binding), false, JSON.stringify(changed));
  }
  // The record must carry exactly the exported values; a forged digest or check time does not bind.
  assert.equal(boundContactMatches(contact, recordFor(contact, '2026-09-27T00:00:00.000Z'), binding), false);
  assert.equal(boundContactMatches(contact, record, { ...binding, content_sha256: 'b'.repeat(64) }), false);
  assert.equal(boundContactMatches(contact, record, { ...binding, content_sha256: undefined }), false);
});

test('a binding of version 1 keeps its rule: it also needed the same check time', () => {
  const projection = contactProjection(contact);
  const old = { schema_version: 'sotsiaalai/verified-contact-binding-1', entry_id: contact.id, revision: 1, checked_at: projection.checked_at,
    projection_sha256: hash(stable(projection)), source_record: source };
  assert.equal(boundContactMatches(contact, recordFor(contact), old), true);
  assert.equal(boundContactMatches({ ...contact, checkedAt: new Date('2026-09-27T00:00:00Z') }, recordFor(contact), old), false);
  assert.equal(boundContactMatches(contact, recordFor(contact), { ...old, schema_version: 'sotsiaalai/verified-contact-binding-0' }), false);
});
