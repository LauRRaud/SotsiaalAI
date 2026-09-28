import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, stable } from '../lib/rag-v2/contracts.js';
import { boundContactMatches, contactBinding, contactProjection, CONTACT_BINDING_SCHEMA, registerRole } from '../lib/rag-v2/adapters/verified-municipal-contact.js';

// ADR-045: an exported contact is bound to its register entry's identity, revision and content, not to the time of its
// last check. Whether the entry is verified now is the live freshness rule, tested with the database elsewhere
// (tests/rag-v2-structured-records.integration.test.mjs). Fictional values only.
const contact = { id: 'synthetic-contact', revision: 1, checkedAt: new Date('2026-09-20T00:00:00Z'), sourceNamespace: 'OFFICIAL_KOV_CONTACT',
  sourceDocId: null, municipalityId: 'synthetic-municipality', municipality: { slug: 'synthetic-vald' },
  title: 'Test Contact', phone: '+372 0000001', email: null, sourceUrl: 'https://example.invalid/contact',
  type: 'KOV_SOCIAL_CONTACT', description: 'Roll: synthetic specialist Osakond: Synthetic department' };
const source = { path: 'synthetic.json', sha256: 'a'.repeat(64), pointer: '/items/0', item_id: 'synthetic-contact' };
const recordFor = (row, checkedAt = row.checkedAt.toISOString(), role = registerRole(row.description)) => ({ region: 'synthetic_vald',
  aliases: ['synthetic-contact'], fields: { name: { value: row.title }, phone: { value: row.phone }, official_url: { value: row.sourceUrl },
    checked_at: { value: checkedAt }, ...(role.role ? { role: { value: role.role } } : {}), ...(role.department ? { department: { value: role.department } } : {}) } });

test('a re-check of the same revision and content keeps the export; any change of what the contact is ends it', () => {
  const binding = contactBinding(contact, source), record = recordFor(contact);
  assert.equal(binding.schema_version, CONTACT_BINDING_SCHEMA);
  assert.equal(binding.checked_at, '2026-09-20T00:00:00.000Z', 'the check the export read, kept as history');
  assert.equal(boundContactMatches(contact, record, binding), true);
  // Codex's probe (28.09): only the check time moved.
  assert.equal(boundContactMatches({ ...contact, checkedAt: new Date('2026-09-27T00:00:00Z') }, record, binding), true);
  for (const changed of [{ phone: '+372 0000099' }, { title: 'Other Name' }, { sourceUrl: 'https://example.invalid/other' }, { email: 'x@example.invalid' },
    { revision: 2 }, { municipality: { slug: 'other-vald' } }, { sourceNamespace: 'LEGACY_KOV_CONTACT' }, { id: 'another-entry' },
    { description: 'Roll: synthetic manager Osakond: Synthetic department' }, { type: 'KOV_GENERAL_CONTACT' }]) {
    assert.equal(boundContactMatches({ ...contact, ...changed }, record, binding), false, JSON.stringify(changed));
  }
  // The record must carry exactly the exported values; a forged digest, check time or role does not bind.
  assert.equal(boundContactMatches(contact, recordFor(contact, '2026-09-27T00:00:00.000Z'), binding), false);
  assert.equal(boundContactMatches(contact, recordFor(contact, undefined, { role: 'Old collected role', department: null }), binding), false);
  assert.equal(boundContactMatches(contact, recordFor(contact, undefined, { role: null, department: null }), binding), false);
  assert.equal(boundContactMatches(contact, record, { ...binding, content_sha256: 'b'.repeat(64) }), false);
  assert.equal(boundContactMatches(contact, record, { ...binding, content_sha256: undefined }), false);
});

test('the register role is read only from its own "Roll: ... Osakond: ..." form', () => {
  assert.deepEqual(registerRole('Roll: sotsiaalhoolekandespetsialist Osakond: Sotsiaal- ja tervishoiuosakond'),
    { role: 'sotsiaalhoolekandespetsialist', department: 'Sotsiaal- ja tervishoiuosakond' });
  assert.deepEqual(registerRole('Roll: noorte heaolu spetsialist'), { role: 'noorte heaolu spetsialist', department: null });
  for (const other of [null, '', 'Vastuvõtt teisipäeviti', 'Osakond: X']) assert.deepEqual(registerRole(other), { role: null, department: null });
});

test('a binding of version 1 keeps its rule: it also needed the same check time', () => {
  const projection = contactProjection(contact);
  const old = { schema_version: 'sotsiaalai/verified-contact-binding-1', entry_id: contact.id, revision: 1, checked_at: projection.checked_at,
    projection_sha256: hash(stable(projection)), source_record: source };
  // Version 1 exported no role: its record carries the five register values only.
  const oldRecord = recordFor(contact, undefined, { role: null, department: null });
  assert.equal(boundContactMatches(contact, oldRecord, old), true);
  assert.equal(boundContactMatches({ ...contact, checkedAt: new Date('2026-09-27T00:00:00Z') }, oldRecord, old), false);
  assert.equal(boundContactMatches(contact, recordFor(contact), old), false, 'a version 1 record has no role field');
  assert.equal(boundContactMatches(contact, oldRecord, { ...old, schema_version: 'sotsiaalai/verified-contact-binding-0' }), false);
});
