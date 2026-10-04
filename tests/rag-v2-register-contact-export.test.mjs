import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, stable } from '../lib/rag-v2/contracts.js';
import { prepareRegisterContactExport, REGISTER_EXPORT_SCHEMA } from '../lib/rag-v2/adapters/municipal-contact-export.js';
import { boundContactMatches, contactBinding, contactContent, registerContactId, registerDirectoryId, validContactBinding } from '../lib/rag-v2/adapters/verified-municipal-contact.js';
import { municipalDirectoryAdapter } from '../lib/rag-v2/adapters/municipal-directory.js';
import { municipalRecordMapping } from '../lib/rag-v2/adapters/municipal-record.js';
import { structuredRecord } from '../lib/rag-v2/structured-record.js';

// ADR-085: the register's verified contacts as a source of their own. Made-up rows; no database, no network.
const checked = new Date('2026-10-04T08:54:43.450Z');
const row = (id, slug, name, title, extra = {}) => ({ id, title, phone: '+372 5550 0000', email: `${id}@example.invalid`, sourceUrl: `https://www.${slug}.example/kontaktid`,
  sourceDocId: null, sourceNamespace: 'LEGACY_KOV_CONTACT', revision: 1, checkedAt: checked, municipalityId: `m-${slug}`, type: 'KOV_SOCIAL_CONTACT',
  description: 'Roll: sotsiaaltööspetsialist Osakond: Sotsiaalosakond', municipality: { slug, displayName: name }, ...extra });
// A stand-in for the register: the freshness rule itself is the database's (tests/rag-v2-structured-records.integration).
const register = rows => ({ serviceMapEntry: {
  findMany: async () => rows.map(item => ({ ...item })),
  findFirst: async ({ where }) => { const found = rows.find(item => item.id === where.AND[1].id && item.municipality.slug === where.AND[1].municipality.is.slug); return found ? { ...found } : null; },
} });
const recordOf = (source, id) => {
  const index = source.items.findIndex(item => item.id === id), item = source.items[index];
  return structuredRecord(item, `/items/${index}`, municipalRecordMapping(item));
};

test('every verified row without a matching document is exported; a row whose bound document still matches keeps it; each municipality gets a directory', async () => {
  const rows = [row('c1', 'noo-vald', 'Nõo vald', 'Mari Maasikas'), row('c2', 'noo-vald', 'Nõo vald', 'Jüri Tamm', { description: 'Roll: lastekaitsespetsialist' }),
    row('c3', 'kose-vald', 'Kose vald', 'Kati Kask'), row('c4', 'kose-vald', 'Kose vald', 'Peeter Paju', { revision: 3 })];
  // The store holds a package contact bound to c1 as it is now, and one bound to c4 at an earlier revision.
  const bound = [{ entry_id: 'c1', revision: 1, content_sha256: hash(stable(contactContent(rows[0]))), item_id: 'noo-contact-mari' },
    { entry_id: 'c4', revision: 2, content_sha256: hash(stable(contactContent({ ...rows[3], revision: 2 }))), item_id: 'kose-contact-peeter' }];
  const { source, counts } = await prepareRegisterContactExport({ db: register(rows), bound, now: () => new Date('2026-10-04T18:00:00Z') });
  assert.equal(source.schema_version, REGISTER_EXPORT_SCHEMA);
  assert.deepEqual(counts, { verified_rows: 4, exported_contacts: 3, kept_bound: 1, municipalities: 2, directories: 2, skipped: { no_channel: 0, page_address: 0, no_name: 0 } });
  assert.deepEqual(source.items.map(item => [item.itemType, item.id]), [['contact', 'service-map-contact:c2'], ['contact', 'service-map-contact:c3'], ['contact', 'service-map-contact:c4'],
    ['resource', 'service-map-contacts:kose_vald'], ['resource', 'service-map-contacts:noo_vald']]);
  // The contact carries the register's own values and its municipality, and nothing else.
  const second = source.items[0];
  assert.deepEqual({ ...second, registry_binding: null }, { id: 'service-map-contact:c2', canonical_item_id: 'service-map-contact:c2', itemType: 'contact', municipality_id: 'noo_vald',
    municipality_name: 'Nõo vald', source_type: 'municipal_contact', language: 'et', name: 'Jüri Tamm', role: 'lastekaitsespetsialist', phone: '+372 5550 0000',
    email: 'c2@example.invalid', officialUrl: 'https://www.noo-vald.example/kontaktid', checked_at: checked.toISOString(), registry_binding: null });
  assert.deepEqual(second.registry_binding.source_record, { register: 'service_map', item_id: 'service-map-contact:c2' });
  // The directory links to every verified contact of its municipality: the kept document by its own id.
  const [kose, noo] = source.items.slice(3);
  assert.deepEqual([noo.relatedContacts, kose.relatedContacts], [['noo-contact-mari', 'service-map-contact:c2'], ['service-map-contact:c3', 'service-map-contact:c4']]);
  assert.deepEqual([noo.title, noo.municipality_id, noo.officialUrl, noo.checked_at], ['Sotsiaalvaldkonna kontaktid: Nõo vald', 'noo_vald', 'https://www.noo-vald.example/kontaktid', checked.toISOString()]);
  // The summary names the roles the register gives, in its own words: a question about a role finds the directory.
  assert.equal(noo.summary, 'Omavalitsuse ametlikul lehel kinnitatud sotsiaalvaldkonna töötajad: nimi, amet, telefon ja e-post. Ametid: lastekaitsespetsialist, sotsiaaltööspetsialist.');
  // As records: the contact with its binding, the directory as a resource with contact links.
  const contact = recordOf(source, 'service-map-contact:c2'), directory = recordOf(source, registerDirectoryId('noo_vald'));
  assert.deepEqual([contact.kind, contact.region, contact.aliases, Object.keys(contact.bindings)], ['contact', 'noo_vald', ['service-map-contact:c2'], ['service_map']]);
  assert.deepEqual([directory.kind, directory.region, directory.links.map(link => [link.relation, link.target, link.target_kinds])],
    ['resource', 'noo_vald', [['contact', 'noo-contact-mari', ['contact']], ['contact', 'service-map-contact:c2', ['contact']]]]);
});

test('the chat releases a register contact while its row is verified and unchanged, and not after an edit', async () => {
  const rows = [row('c2', 'noo-vald', 'Nõo vald', 'Jüri Tamm')];
  const { source } = await prepareRegisterContactExport({ db: register(rows), now: () => new Date('2026-10-04T18:00:00Z') });
  const record = recordOf(source, 'service-map-contact:c2'), binding = record.bindings.service_map.value;
  assert.equal(validContactBinding(binding, record), true);
  assert.equal(boundContactMatches(rows[0], record, binding), true);
  const authorize = rows => municipalDirectoryAdapter({ ...register(rows), dataAuditLog: { findFirst: async () => null } }).authorizeContact({ record });
  assert.equal(await authorize(rows), true);
  // A re-check alone keeps it; a new phone, a new role, a new revision or the row gone end it.
  assert.equal(await authorize([{ ...rows[0], checkedAt: new Date('2026-10-11T08:00:00Z') }]), true);
  for (const change of [{ phone: '+372 5550 1111' }, { description: 'Roll: osakonnajuhataja' }, { revision: 2 }]) assert.equal(await authorize([{ ...rows[0], ...change }]), false, JSON.stringify(change));
  assert.equal(await authorize([]), false);
  // The binding names its own row: another row's binding, another item id or extra keys in the source record are refused.
  const forged = source_record => validContactBinding({ ...binding, source_record }, record);
  assert.deepEqual([forged({ register: 'service_map', item_id: registerContactId('c9') }), forged({ register: 'other', item_id: record.id }),
    forged({ register: 'service_map', item_id: record.id, path: 'contacts.json' }), forged({ register: 'service_map' })], [false, false, false, false]);
  assert.equal(validContactBinding({ ...binding, entry_id: 'c9' }, record), false);
  // A package binding is read as before.
  const packaged = contactBinding(rows[0], { path: 'KOV/noo/pakett.json', sha256: 'a'.repeat(64), pointer: '/items/3', item_id: 'service-map-contact:c2' });
  assert.equal(validContactBinding(packaged, record), true);
  assert.equal(validContactBinding({ ...packaged, source_record: { ...packaged.source_record, pointer: 'items/3' } }, record), false);
});

test('rows that cannot be shown are left out and counted; a changed row stops the export; a bad bound list is refused', async () => {
  const rows = [row('c1', 'noo-vald', 'Nõo vald', 'Mari Maasikas', { phone: null, email: '' }), row('c2', 'noo-vald', 'Nõo vald', 'Jüri Tamm', { sourceUrl: 'ftp://vald.example/kontakt' }),
    row('c3', 'noo-vald', 'Nõo vald', ' '), row('c4', 'noo-vald', 'Nõo vald', 'Kati Kask', { email: null })];
  const { source, counts } = await prepareRegisterContactExport({ db: register(rows) });
  assert.deepEqual([counts.exported_contacts, counts.directories, counts.skipped], [1, 1, { no_channel: 1, page_address: 1, no_name: 1 }]);
  assert.deepEqual([source.items[0].id, 'email' in source.items[0], source.items[1].relatedContacts], ['service-map-contact:c4', false, ['service-map-contact:c4']]);
  // The row is edited between the read and the final check.
  const good = row('c5', 'kose-vald', 'Kose vald', 'Peeter Paju');
  const edited = { serviceMapEntry: { findMany: async () => [{ ...good }], findFirst: async () => ({ ...good, phone: '+372 5550 9999' }) } };
  await assert.rejects(prepareRegisterContactExport({ db: edited }), error => error.code === 'contact_changed_during_export');
  for (const bound of [[{ entry_id: 'c5', revision: 1, content_sha256: 'x', item_id: 'a' }], [{ entry_id: 'c5', revision: 1, content_sha256: 'a'.repeat(64) }], 'c5']) {
    await assert.rejects(prepareRegisterContactExport({ db: register([good]), bound }), error => error.code === 'invalid_contact_bound_list');
  }
});

test('a large municipality is listed by department, small departments with the rest, a large group in even parts', async () => {
  // 150 contacts: 70 in one department, 40 in another, 3 in a small one, 37 without a department; the register writes
  // a reception line after some departments.
  const unit = (count, description, from) => Array.from({ length: count }, (_, index) => row(`c${from + index}`, 'suur-linn', 'Suur linn', `Inimene ${from + index}`, { description }));
  const rows = [...unit(70, 'Roll: sotsiaaltöö spetsialist Osakond: Lasnamäe sotsiaalhoolekande osakond\nVastuvõtt: E 9-12', 1000), ...unit(40, 'Roll: lastekaitsespetsialist Osakond: Laste heaolu osakond', 2000),
    ...unit(3, 'Roll: juhataja Osakond: Väike üksus', 3000), ...unit(37, 'Roll: nõunik', 4000)];
  const { source, counts } = await prepareRegisterContactExport({ db: register(rows) });
  assert.deepEqual([counts.exported_contacts, counts.municipalities, counts.directories], [150, 1, 4]);
  const directories = source.items.filter(item => item.itemType === 'resource');
  assert.deepEqual(directories.map(item => [item.title, item.relatedContacts.length]), [['Sotsiaalvaldkonna kontaktid: Suur linn', 40],
    ['Sotsiaalvaldkonna kontaktid: Suur linn, Lasnamäe sotsiaalhoolekande osakond (1/2)', 35], ['Sotsiaalvaldkonna kontaktid: Suur linn, Lasnamäe sotsiaalhoolekande osakond (2/2)', 35],
    ['Sotsiaalvaldkonna kontaktid: Suur linn, Laste heaolu osakond', 40]]);
  // Every contact is linked from exactly one directory; the names are distinct and do not depend on the rows' order.
  const linked = directories.flatMap(item => item.relatedContacts);
  assert.deepEqual([linked.length, new Set(linked).size, new Set(directories.map(item => item.id)).size], [150, 150, 4]);
  assert.match(directories.map(item => item.id).join(' '), /^service-map-contacts:suur_linn service-map-contacts:suur_linn:[a-f0-9]{12} service-map-contacts:suur_linn:[a-f0-9]{12}:p2 service-map-contacts:suur_linn:[a-f0-9]{12}$/u);
  assert.equal(directories[0].summary.endsWith('Ametid: juhataja, nõunik.'), true);
  const again = await prepareRegisterContactExport({ db: register([...rows].reverse()) });
  assert.deepEqual(again.source.items.filter(item => item.itemType === 'resource').map(item => [item.id, item.relatedContacts]), directories.map(item => [item.id, item.relatedContacts]));
  // Sixty contacts are still one directory.
  const sixty = await prepareRegisterContactExport({ db: register(rows.slice(0, 60)) });
  assert.deepEqual(sixty.source.items.filter(item => item.itemType === 'resource').map(item => [item.id, item.relatedContacts.length]), [['service-map-contacts:suur_linn', 60]]);
});

// Through the reader: the exported package is a source like a municipal package; no model, no network.
test('the exported package is read as records: the contact with its binding, the directory with a source anchor for every link', async t => {
  const fs = await import('node:fs/promises'), os = await import('node:os'), path = await import('node:path');
  const { ingest } = await import('../lib/rag-v2/ingestion.js');
  const { registeredSource } = await import('../lib/rag-v2/registered-source.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-register-contacts-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const rows = Array.from({ length: 60 }, (_, index) => row(`c${100 + index}`, 'noo-vald', 'Nõo vald', `Inimene ${index}`));
  const { source } = await prepareRegisterContactExport({ db: register(rows) });
  const text = `${JSON.stringify(source, null, 2)}\n`, entry = { role: 'source', path: 'contacts.json', sha256: hash(text) };
  await fs.writeFile(path.join(dir, 'contacts.json'), text);
  await fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: [entry] }));
  const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
  const read = async itemId => (await ingest({ tenant: 'register-contacts-test', inputRoot: dir, metadataJson: stable(await registeredSource(dir, entry, { itemId })),
    storeRoot: path.join(dir, 'store'), rights, profile })).bundle;
  const contact = await read('service-map-contact:c100'), record = contact.document.fields.structured_record.value;
  assert.deepEqual([record.kind, record.region, record.id, Object.keys(record.fields).sort()], ['contact', 'noo_vald', 'service-map-contact:c100',
    ['checked_at', 'department', 'email', 'name', 'official_url', 'phone', 'role']]);
  assert.equal(boundContactMatches(rows[0], record, record.bindings.service_map.value), true);
  // Two passages, as for a mapped contact: the contact's own values, and the binding (never answer text).
  assert.deepEqual([contact.document.fields.regions.value, contact.chunks.map(chunk => /registry_binding/u.test(chunk.retrieval_text))], [['noo_vald'], [false, true]]);
  assert.deepEqual(contact.chunks[0].retrieval_text.split(/\n+/u), ['Nõo vald > Inimene 0', 'sotsiaaltööspetsialist', 'Sotsiaalosakond', '+372 5550 0000', 'c100@example.invalid']);
  // The directory of a municipality with sixty contacts: every link has its place in the source text, so the record
  // view can show where each relation comes from (record_link_evidence_missing otherwise).
  const directory = await read(registerDirectoryId('noo_vald')), listed = directory.document.fields.structured_record.value;
  assert.deepEqual([listed.kind, listed.region, listed.links.length, listed.fields.title.value], ['resource', 'noo_vald', 60, 'Sotsiaalvaldkonna kontaktid: Nõo vald']);
  const anchored = new Set(directory.chunks.flatMap(chunk => (chunk.source_locations || []).map(location => location.path)));
  assert.deepEqual(listed.links.filter(link => !anchored.has(link.path)), []);
  assert.deepEqual(directory.document.fields.regions.value, ['noo_vald']);
});
