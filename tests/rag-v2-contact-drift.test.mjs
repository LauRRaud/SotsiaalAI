import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { fail, hash, stable } from '../lib/rag-v2/contracts.js';
import { DRIFT_CLASSES, contactDrift, contactDriftCount, contactStandings, driftFailure, indexedContacts } from '../lib/rag-v2/adapters/contact-drift.js';
import { prepareRegisterContactExport } from '../lib/rag-v2/adapters/municipal-contact-export.js';
import { municipalDirectoryAdapter } from '../lib/rag-v2/adapters/municipal-directory.js';
import { municipalRecordMapping } from '../lib/rag-v2/adapters/municipal-record.js';
import { CONTACT_BINDING_SCHEMA, boundContactMatches, contactBinding, contactProjection, registerRole } from '../lib/rag-v2/adapters/verified-municipal-contact.js';
import { structuredRecord } from '../lib/rag-v2/structured-record.js';
import { CONTACT_VERIFICATION_VERSION } from '../lib/serviceMap/contactFreshnessProjection.js';

// ADR-134 (10.10.2026): the free count of the chat's contacts whose register row is no longer the exported one.
// Invented people and rows, through the repository's own export, binding, live freshness rule and gate
// (municipal-contact-export.js, verified-municipal-contact.js, contactFreshnessProjection.js, municipal-directory.js).
// No database, no network. The check times are relative to today: the live rule reads a check of the last 90 days.
const DAY = 86400000, checked = new Date(Date.now() - 3 * DAY), rechecked = new Date(Date.now() - DAY);
const row = (id, slug, name, extra = {}) => ({ id: `row-${id}`, title: `Inimene ${id}`, phone: '+372 5550 0000', email: `${id}@${slug}.example`, sourceUrl: `https://www.${slug}.example/kontaktid`,
  sourceDocId: null, sourceNamespace: 'LEGACY_KOV_CONTACT', revision: 1, checkedAt: checked, municipalityId: `m-${slug}`, type: 'KOV_SOCIAL_CONTACT', status: 'PUBLISHED', tombstonedAt: null,
  description: 'Roll: sotsiaaltööspetsialist Osakond: Sotsiaalosakond', municipality: { slug, displayName: name, isActive: true }, ...extra });

// A stand-in for the register that answers the filters the repository's own readers send, and only the fields they
// select. The freshness rule is the real one: it reads a check record shaped like the weekly check's. A row edited
// since (no check time) was last confirmed at revision 1; `confirmed: false` is a row the last check did not confirm.
const matches = (item, where) => Object.entries(where).every(([key, want]) => key === 'AND' ? want.every(part => matches(item, part)) : key === 'OR' ? want.some(part => matches(item, part))
  : key === 'municipality' ? Boolean(item.municipality) && matches(item.municipality, want.is)
  : want === null || typeof want !== 'object' ? (item[key] ?? null) === want
  : 'in' in want ? want.in.includes(item[key]) : 'not' in want ? (item[key] ?? null) !== want.not
  : 'equals' in want ? item[key]?.getTime() === want.equals.getTime() : assert.fail(`a filter the stand-in does not know: ${key}`));
const pick = (item, select) => Object.fromEntries(Object.entries(select).map(([key, part]) => [key, part === true ? item[key] : item[key] && pick(item[key], part.select)]));
const checkRecord = (rows, change = {}) => ({ meta: { contactVerificationVersion: CONTACT_VERIFICATION_VERSION, verifiedContactIds: rows.filter(item => item.confirmed !== false).map(item => item.id),
  contactDecisionObservedAt: Object.fromEntries(rows.map(item => [item.id, (item.checkedAt ?? checked).toISOString()])),
  contactDecisionRevision: Object.fromEntries(rows.map(item => [item.id, item.checkedAt ? item.revision : 1])), ...change } });
// check: the latest contact check record (null: the register holds none). The municipality table holds the
// municipalities of the rows, whether active or not.
const register = (rows, { check = checkRecord(rows) } = {}) => ({
  dataAuditLog: { findFirst: async () => check },
  municipality: { findMany: async ({ select }) => [...new Set(rows.map(item => item.municipality?.slug).filter(Boolean))].map(slug => pick({ slug }, select)) },
  serviceMapEntry: { findMany: async ({ where, select, take }) => rows.filter(item => matches(item, where)).slice(0, take).map(item => pick(item, select)),
    findFirst: async ({ where, select }) => { const found = rows.find(item => matches(item, where)); return found ? pick(found, select) : null; } } });

// The contact documents as the register export makes them, read as records.
const exported = async rows => {
  const { source } = await prepareRegisterContactExport({ db: register(rows) });
  return source.items.map((item, index) => structuredRecord(item, `/items/${index}`, municipalRecordMapping(item))).filter(record => record.kind === 'contact');
};
// A package contact as the mapped export writes it (ADR-045): bound to its register row, or with binding null a
// package contact that was never bound.
const packageSource = (source, id) => ({ path: `KOV/${source.municipality.slug}/pakett.json`, sha256: 'a'.repeat(64), pointer: '/items/3', item_id: id });
const packaged = (source, binding = contactBinding(source, packageSource(source, `package-${source.id}`))) => {
  const { role, department } = registerRole(source.description);
  const item = { id: `package-${source.id}`, itemType: 'contact', municipality_id: source.municipality.slug.replaceAll('-', '_'), name: source.title, ...(role ? { role } : {}), ...(department ? { department } : {}),
    phone: source.phone, email: source.email, officialUrl: source.sourceUrl, checked_at: source.checkedAt.toISOString(), ...(binding ? { registry_binding: binding } : {}) };
  return structuredRecord(item, '/items/3', municipalRecordMapping(item));
};
// ADR-017's binding: it also pinned the time of the check, and exported no role.
const bindingV1 = source => ({ schema_version: 'sotsiaalai/verified-contact-binding-1', entry_id: source.id, revision: source.revision, checked_at: contactProjection(source).checked_at,
  projection_sha256: hash(stable(contactProjection(source))), source_record: packageSource(source, `package-${source.id}`) });

// The index as the catalog hands it over: a directory row for every document, a bundle for those asked for.
const catalogOf = (records, others = []) => {
  const documents = [...records.map((record, at) => ({ id: `document-${String(at).padStart(3, '0')}`, kind: 'contact', regions: [record.region], record })), ...others];
  const byId = new Map(documents.map(document => [document.id, document])), asked = [];
  const generation = { id: `search_generation_${'3dfe55b3'.padEnd(64, '0')}`, snapshot: { documents: Object.fromEntries(documents.map(document => [document.id, { version_id: `version-${document.id}` }])) } };
  return { asked, active: async () => generation,
    retrievalDirectory: async (_tenant, _generation, ids) => ids.map(id => byId.get(id)).map(document => ({ document_id: document.id, fields: { regions: { value: document.regions } },
      ...(document.legacy ? {} : { source: { record_kind: document.kind, journal: false } }) })),
    bundles: async (_tenant, _generationId, ids) => { asked.push(...ids); return ids.map(id => byId.get(id)).filter(document => !document.missing)
      .map(document => ({ document: { id: document.id, fields: { structured_record: { value: document.record } } }, version: { id: `version-${document.id}` } })); } };
};

// One contact, row by row: the table of the classes. `now` is the row as the register holds it today.
const base = row('p1', 'noo-vald', 'Nõo vald'), later = { revision: 2, checkedAt: rechecked };
test('a contact stands in one class: as exported, changed (by what), no longer verified or gone, or not bound', async () => {
  const [record] = await exported([base]), binding = record.bindings.service_map.value, at = (now, verified = true) => contactDrift({ record, row: now && { ...base, ...now }, verified });
  assert.equal(binding.schema_version, CONTACT_BINDING_SCHEMA);
  // The weekly check alone keeps it (ADR-045).
  assert.deepEqual([at({}), at({ checkedAt: rechecked })], ['shown_as_exported', 'shown_as_exported']);
  // A later revision of the same name, role and unit: nothing a reader sees changed, or a channel or the page did.
  // Both channels changed is counted once, under the phone.
  assert.deepEqual([at(later), at({ ...later, phone: '+372 5550 0099' }), at({ ...later, phone: '+372 5550 0099', email: 'uus@noo-vald.example' }), at({ ...later, email: null }),
    at({ ...later, sourceUrl: 'https://www.noo-vald.example/sotsiaal' })], ['same_values_new_revision', 'phone_changed', 'phone_changed', 'email_changed', 'page_address_changed']);
  // A new role, unit or name at any revision; the name before the role, the role before a channel. The register writes
  // a reception line into the unit, so it is a change of the unit.
  assert.deepEqual([at({ ...later, description: 'Roll: osakonnajuhataja Osakond: Sotsiaalosakond', phone: '+372 5550 0099' }), at({ description: 'Roll: sotsiaaltööspetsialist' }),
    at({ ...later, description: `${base.description}\nVastuvõtt: E 9-12` }), at({ ...later, title: 'Inimene p1 uus', description: 'Roll: osakonnajuhataja' }), at({ title: 'Inimene p1 uus' })],
  ['role_or_unit_changed', 'role_or_unit_changed', 'role_or_unit_changed', 'name_changed', 'name_changed']);
  // A value the export does not show (type, namespace, source id, municipality id, the description outside its role
  // form): under the exported revision some writer forgot the revision; at a later one nothing a reader sees changed.
  for (const unseen of [{ type: 'KOV_GENERAL_CONTACT' }, { sourceNamespace: 'OFFICIAL_KOV_CONTACT' }, { sourceDocId: 'kov:p1' }, { municipalityId: 'm-noo' },
    { description: 'Roll:  sotsiaaltööspetsialist   Osakond:  Sotsiaalosakond ' }]) {
    assert.deepEqual([at(unseen), at({ ...later, ...unseen })], ['changed_under_exported_revision', 'same_values_new_revision'], JSON.stringify(unseen));
  }
  assert.deepEqual([at({ phone: '+372 5550 0099' }), at({ sourceUrl: 'https://www.noo-vald.example/sotsiaal' })], ['changed_under_exported_revision', 'changed_under_exported_revision']);
  // A later revision the export would refuse is not a change under the exported revision.
  assert.deepEqual([at({ ...later, phone: null, email: '' }), at({ ...later, sourceUrl: 'ftp://noo-vald.example/kontakt' })], ['not_exportable_now', 'not_exportable_now']);
  // No longer verified, hidden, gone, or in another municipality: the municipality is asked before the verification.
  const moved = { municipalityId: 'm-kose-vald', municipality: { slug: 'kose-vald', displayName: 'Kose vald', isActive: true } };
  assert.deepEqual([at({ revision: 2, checkedAt: null, phone: '+372 5550 0099' }, false), at({}, false), at({ status: 'HIDDEN' }, false), at({ tombstonedAt: rechecked }, false), at(null, false),
    at(moved), at(moved, false), at({ municipality: { ...base.municipality, isActive: false } }), at({ municipality: null, municipalityId: null }, false)],
  ['not_verified_now', 'not_verified_now', 'row_hidden', 'row_hidden', 'row_gone', 'other_municipality', 'other_municipality', 'other_municipality', 'other_municipality']);
  // Not bound: no binding at all, a binding that is not one, a binding that names another row's document.
  const { bindings: _bindings, ...unbound } = record;
  assert.deepEqual([contactDrift({ record: unbound, row: base, verified: true }), contactDrift({ record: { ...record, bindings: {} }, row: base, verified: true }),
    contactDrift({ record: { ...record, bindings: { service_map: { value: { ...binding, content_sha256: 'x' } } } }, row: base, verified: true }),
    contactDrift({ record: { ...record, aliases: ['another-document'] }, row: base, verified: true })], ['no_binding', 'invalid_binding', 'invalid_binding', 'invalid_binding']);
  // ADR-017's binding holds until the next check and then names its own class, never a change of the row.
  const old = row('p2', 'noo-vald', 'Nõo vald', { description: null }), oldRecord = packaged(old, bindingV1(old)), v1 = (now, verified = true) => contactDrift({ record: oldRecord, row: now && { ...old, ...now }, verified });
  assert.deepEqual([v1({}), v1({ checkedAt: rechecked }), v1({ ...later, phone: '+372 5550 0099' })], ['shown_as_exported', 'binding_version_1', 'binding_version_1']);
  // Nor is it drift when its row is not verified now, hidden, gone or elsewhere: the check had ended the binding
  // before, and as not_verified_now it would leave `drifted` at the next check (review of 10.10.2026).
  assert.deepEqual([v1({}, false), v1({ revision: 2, checkedAt: null }, false), v1({ status: 'HIDDEN' }, false), v1({ tombstonedAt: rechecked }, false), v1(null, false), v1(moved), v1(moved, false),
    v1({ municipality: { ...old.municipality, isActive: false } })], Array(8).fill('binding_version_1'));
  // What no class names: the row is the bound one and the record is not that export (a forged or extra field), or the
  // row stands at an earlier revision than its export.
  const forged = { ...record, fields: { ...record.fields, phone: { ...record.fields.phone, value: '+372 5550 0099' } } }, extra = { ...record, fields: { ...record.fields, note: { value: 'x', path: '/items/0/note' } } };
  assert.deepEqual([contactDrift({ record: forged, row: base, verified: true }), contactDrift({ record: extra, row: base, verified: true }), contactDrift({ record: extra, row: { ...base, ...later }, verified: true }),
    contactDrift({ record, row: { ...base, revision: 0 }, verified: true })], ['other', 'other', 'other', 'other']);
  // Every class is one of the declared ones, and the gate's own match holds exactly for the first.
  const all = ['shown_as_exported', ...Object.values(DRIFT_CLASSES).flat()];
  assert.equal(new Set(all).size, all.length);
  for (const now of [{}, later, { ...later, phone: '+372 5550 0099' }, { phone: '+372 5550 0099' }, { ...later, title: 'Inimene p1 uus' }]) {
    assert.equal(all.includes(at(now)), true);
    assert.equal(boundContactMatches({ ...base, ...now }, record, binding), at(now) === 'shown_as_exported', JSON.stringify(now));
  }
});

// Four municipalities since the export. Each entry: the row as it was exported, what the register holds in its place
// now (null: no row), and the class its contact document must stand in.
const scenario = async () => {
  const noo = id => row(id, 'noo-vald', 'Nõo vald'), kose = id => row(id, 'kose-vald', 'Kose vald'), suur = (id, extra) => row(id, 'suur-linn', 'Suur linn', extra), tapa = id => row(id, 'tapa-vald', 'Tapa vald');
  const drifted = [
    [noo('n1'), {}, 'shown_as_exported'], [noo('n2'), { checkedAt: rechecked }, 'shown_as_exported'],
    [noo('n3'), later, 'same_values_new_revision'], [noo('n4'), { ...later, type: 'KOV_GENERAL_CONTACT', sourceDocId: 'kov:n4' }, 'same_values_new_revision'],
    [noo('n5'), { ...later, phone: '+372 5550 0099' }, 'phone_changed'], [noo('n6'), { ...later, phone: '+372 5550 0098', email: 'uus@noo-vald.example' }, 'phone_changed'],
    [noo('n7'), { revision: 3, checkedAt: rechecked, email: null }, 'email_changed'], [noo('n8'), { ...later, sourceUrl: 'https://www.noo-vald.example/sotsiaal' }, 'page_address_changed'],
    [noo('n9'), { ...later, description: 'Roll: osakonnajuhataja Osakond: Sotsiaalosakond', phone: '+372 5550 0097' }, 'role_or_unit_changed'],
    [noo('n10'), { ...later, description: 'Roll: sotsiaaltööspetsialist Osakond: Sotsiaalosakond\nVastuvõtt: E 9-12' }, 'role_or_unit_changed'],
    [noo('n11'), { ...later, title: 'Inimene n11 uus' }, 'name_changed'],
    [noo('n12'), { phone: '+372 5550 0096' }, 'changed_under_exported_revision'], [noo('n13'), { sourceNamespace: 'OFFICIAL_KOV_CONTACT' }, 'changed_under_exported_revision'],
    [noo('n14'), { ...later, phone: null, email: '' }, 'not_exportable_now'], [noo('n15'), { ...later, sourceUrl: 'ftp://noo-vald.example/kontakt' }, 'not_exportable_now'],
    // Edited and waiting for the check; not confirmed by the last check; hidden; tombstoned; deleted; moved; its municipality closed.
    [kose('k1'), { revision: 2, checkedAt: null, phone: '+372 5550 0095' }, 'not_verified_now'], [kose('k2'), { confirmed: false }, 'not_verified_now'],
    [kose('k3'), { status: 'HIDDEN' }, 'row_hidden'], [kose('k4'), { tombstonedAt: rechecked }, 'row_hidden'], [kose('k5'), null, 'row_gone'],
    [kose('k6'), { municipalityId: 'm-noo-vald', municipality: { slug: 'noo-vald', displayName: 'Nõo vald', isActive: true } }, 'other_municipality'],
    [kose('k7'), { municipality: { slug: 'kose-vald', displayName: 'Kose vald', isActive: false } }, 'other_municipality'],
    [tapa('t1'), {}, 'shown_as_exported'], [tapa('t2'), { checkedAt: rechecked }, 'shown_as_exported'],
  ];
  const records = await exported(drifted.map(([before]) => before)), expected = new Map(drifted.map(([before, , kind]) => [`service-map-contact:${before.id}`, kind]));
  const rows = drifted.filter(([, now]) => now).map(([before, now]) => ({ ...before, ...now }));
  const add = (record, kind, now) => { records.push(record); expected.set(record.id, kind); if (now) rows.push(now); };
  // Suur linn: package contacts. Two ADR-017 bindings, one of them re-checked since; a binding that is not one; two
  // contacts that were never bound, one of them with a new phone.
  const s1 = suur('s1', { description: null }), s2 = suur('s2', { description: null }), s3 = suur('s3'), s4 = suur('s4', { sourceDocId: 'package-row-s4' }), s5 = suur('s5', { sourceDocId: 'package-row-s5' });
  add(packaged(s1, bindingV1(s1)), 'shown_as_exported', s1); add(packaged(s2, bindingV1(s2)), 'binding_version_1', { ...s2, checkedAt: rechecked });
  add({ ...packaged(s3), bindings: {} }, 'invalid_binding', s3);
  add(packaged(s4, null), 'no_binding', s4); add(packaged(s5, null), 'no_binding', { ...s5, phone: '+372 5550 0094' });
  // One row with two documents: the package contact bound before an edit and the register's own contact after it
  // (the export gives a changed package contact a new document); and one row whose two documents are both the row's.
  const s6 = suur('s6'), s6now = { ...s6, ...later, phone: '+372 5550 0093' }, s7 = suur('s7');
  add(packaged(s6), 'phone_changed', s6now); add((await exported([s6now]))[0], 'shown_as_exported');
  add(packaged(s7), 'shown_as_exported', s7); add((await exported([s7]))[0], 'shown_as_exported');
  // A row that stands at an earlier revision than its export (a restored register).
  const s8 = suur('s8', { revision: 3 }); add(packaged(s8), 'other', { ...s8, revision: 2 });
  // Review of 10.10.2026: a package contact that was never bound is its row's document by its source id. Beside the
  // register's own document of that row: both released (s9: the same person twice in an answer); the package contact
  // left behind by an edit (s10); neither released, the row not confirmed by the last check, so that the gate's own
  // read finds no row and the only row with the source id stands for it (s12). And one whose row is not in the
  // register (s11): its row is not known.
  const twin = id => suur(id, { sourceDocId: `package-row-${id}` }), s9 = twin('s9'), s10 = twin('s10'), s10now = { ...s10, ...later, phone: '+372 5550 0092' }, s12 = twin('s12');
  add(packaged(s9, null), 'no_binding', s9); add((await exported([s9]))[0], 'shown_as_exported');
  add(packaged(s10, null), 'no_binding', s10now); add((await exported([s10now]))[0], 'shown_as_exported');
  add(packaged(twin('s11'), null), 'no_binding');
  add(packaged(s12, null), 'no_binding', { ...s12, confirmed: false }); add((await exported([s12]))[0], 'not_verified_now');
  // ADR-017's binding whose row is gone, hidden, or not confirmed by the last check: binding_version_1, not drift.
  const s13 = suur('s13', { description: null }), s14 = suur('s14', { description: null }), s15 = suur('s15', { description: null });
  add(packaged(s13, bindingV1(s13)), 'binding_version_1'); add(packaged(s14, bindingV1(s14)), 'binding_version_1', { ...s14, status: 'HIDDEN' });
  add(packaged(s15, bindingV1(s15)), 'binding_version_1', { ...s15, confirmed: false });
  return { records, rows, expected };
};

test('the count over an index and a register: counts only, the gate agrees with every class, and no value leaves it', async () => {
  const { records, rows, expected } = await scenario(), db = register(rows);
  // Forty service documents of Suur linn and a law that names no region: neither is loaded.
  const others = [...Array.from({ length: 40 }, (_, at) => ({ id: `service-${at}`, kind: 'service', regions: ['suur_linn'] })), { id: 'law-1', kind: null, regions: null }];
  const catalog = catalogOf(records, others), read = await indexedContacts(catalog, 'tenant');
  assert.deepEqual([read.contacts.length, read.documents.get('suur_linn'), read.documents.get('noo_vald'), catalog.asked.length, catalog.asked.some(id => !id.startsWith('document-'))], [44, 60, 15, 44, false]);
  // Each contact stands where the fixture says, and the gate (the repository's own adapter, its own reading of the
  // register) releases exactly the contacts that stand as exported; a contact without a binding is the gate's alone.
  const standings = await contactStandings({ contacts: read.contacts, db }), adapter = municipalDirectoryAdapter(db);
  assert.deepEqual(Object.fromEntries(standings.map(({ record, kind }) => [record.id, kind])), Object.fromEntries(expected));
  for (const { record, kind, released } of standings) {
    assert.equal(await adapter.authorizeContact({ record }), released, record.id);
    if (kind !== 'no_binding') assert.equal(released, kind === 'shown_as_exported', record.id);
  }
  // A contact without a binding: whether the gate releases it, and the row it is a document of (by its source id).
  assert.deepEqual(standings.filter(({ kind }) => kind === 'no_binding').map(({ record, released, rowId }) => [record.id, released, rowId]), [['package-row-s4', true, 'row-s4'], ['package-row-s5', false, 'row-s5'],
    ['package-row-s9', true, 'row-s9'], ['package-row-s10', false, 'row-s10'], ['package-row-s11', false, null], ['package-row-s12', false, 'row-s12']]);
  // A document with an invalid binding is of no row; every other bound document is of the row its binding names.
  assert.deepEqual(standings.filter(({ kind }) => kind !== 'no_binding').filter(({ binding, rowId }) => rowId !== (binding?.entry_id ?? null)), []);
  assert.deepEqual(standings.filter(({ kind }) => kind === 'invalid_binding').map(({ rowId }) => rowId), [null]);
  const at = new Date(), sides = [], result = await contactDriftCount({ catalog, db, tenant: 'tenant', now: () => at, reading: side => sides.push(side) });
  assert.deepEqual(sides, ['index', 'register']);
  assert.deepEqual(result, { generation: '3dfe55b3', read_at: at.toISOString(), contacts_in_index: 44, shown_today: 12, shown_as_exported: 10, drifted: 23,
    row_changed: { contacts: 15, same_values_new_revision: 2, phone_changed: 3, email_changed: 1, page_address_changed: 1, role_or_unit_changed: 2, name_changed: 1,
      changed_under_exported_revision: 2, not_exportable_now: 2, other: 1 },
    row_gone_or_not_verified: { contacts: 8, not_verified_now: 3, row_hidden: 2, row_gone: 1, other_municipality: 2 },
    // ADR-017's bindings that no longer hold are four: one re-checked row, and three whose row is gone, hidden or not
    // confirmed. None of them is drift.
    not_bound: { contacts: 11, binding_version_1: 4, invalid_binding: 1, no_binding: 6, no_binding_shown: 2, no_binding_row_unknown: 1 },
    // Per municipality only the number of its drifted contacts: Tapa vald, where none drifted, is not listed, and of
    // Suur linn's contacts that are not shown those that were never bound by binding 2 are not drift. Kose vald is the
    // one municipality with no contact shown at all.
    municipalities: { with_contacts_in_index: 4, with_drifted_contacts: 3, with_none_shown: 1, drifted: { kose_vald: 7, noo_vald: 13, suur_linn: 3 } },
    // Five rows have two documents: two by their bindings (s6, s7) and three where one of the two is an unbound package
    // contact (s9, s10, s12). Two of the five are shown twice: s7 and, seen only by the source id, s9.
    rows_with_two_documents: 5, rows_with_two_shown_documents: 2, municipality_documents_max: { region: 'suur_linn', documents: 60 } });
  assert.equal(result.contacts_in_index, result.shown_as_exported + result.drifted + result.not_bound.contacts);
  // Nothing but numbers, the generation's short name, the time and municipality ids: no name, phone, e-mail, page
  // address, role, row id or document id of the fixture.
  const leaves = (value, path = []) => value && typeof value === 'object' ? Object.entries(value).flatMap(([key, part]) => leaves(part, [...path, key])) : [[path.join('.'), value]];
  assert.deepEqual(leaves(result).filter(([, value]) => typeof value !== 'number').map(([path]) => path), ['generation', 'read_at', 'municipality_documents_max.region']);
  assert.doesNotMatch(JSON.stringify(result), /Inimene|example|5550|https?:|ftp:|row-|package-|document-|spetsialist|juhataja|Osakond|Vastuvõtt|pakett/u);
  // --next-export: today's export counts with the bound list read from the index, and nothing of what it prepared.
  const bound = standings.filter(({ binding }) => binding?.schema_version === CONTACT_BINDING_SCHEMA)
    .map(({ binding }) => ({ entry_id: binding.entry_id, revision: binding.revision, content_sha256: binding.content_sha256, item_id: binding.source_record.item_id }));
  const { next_export: next, ...same } = await contactDriftCount({ catalog, db, tenant: 'tenant', nextExport: true, now: () => at });
  assert.deepEqual([same, next], [result, (await prepareRegisterContactExport({ db, bound })).counts]);
  // Of the 28 rows verified now the export refuses two (no channel, an ftp page) and keeps the eight whose document of
  // binding 2 is still the row's (n1, n2, t1, t2, s6, s7, s9, s10); it would write the other eighteen again: the
  // changed rows, and every package contact without such a binding as a second document.
  assert.deepEqual([Object.keys(next), next.verified_rows, next.exported_contacts, next.kept_bound, next.skipped],
    [['verified_rows', 'exported_contacts', 'kept_bound', 'same_person_rows', 'municipalities', 'directories', 'too_large', 'skipped'], 28, 18, 8, { no_channel: 1, page_address: 1, no_name: 0 }]);
  assert.doesNotMatch(JSON.stringify(next), /Inimene|example|5550|row-|package-/u);
});

test('a region is printed only when it is a municipality of the register: any other is counted under one key', async () => {
  const one = row('x1', 'noo-vald', 'Nõo vald'), closed = row('x2', 'vana-vald', 'Vana vald', { municipality: { slug: 'vana-vald', displayName: 'Vana vald', isActive: false } });
  const [record, old] = await exported([one, { ...closed, municipality: { ...closed.municipality, isActive: true } }]);
  // The gate refuses such a record whatever the register holds; the count must still not print the region. A free
  // text, and a text with the very shape of a municipality id (review of 10.10.2026: a rule by shape printed it).
  const odd = { ...record, region: 'Nõo vald, Inimene x1' }, shaped = { ...record, region: 'inimene_x1_5550000' };
  const result = await contactDriftCount({ catalog: catalogOf([odd, shaped, record, old, shaped]), db: register([one, closed]), tenant: 'tenant' });
  // A municipality the register has closed is still one of its municipalities: its id is printed.
  assert.deepEqual([result.contacts_in_index, result.shown_today, result.municipalities, result.municipality_documents_max],
    [5, 1, { with_contacts_in_index: 4, with_drifted_contacts: 3, with_none_shown: 3, drifted: { other: 3, vana_vald: 1 } }, { region: 'other', documents: 2 }]);
  assert.doesNotMatch(JSON.stringify(result), /inimene|Nõo|5550/iu);
});

test('the count refuses when it cannot tell', async () => {
  const rows = [row('r1', 'noo-vald', 'Nõo vald'), row('r2', 'noo-vald', 'Nõo vald')], records = await exported(rows), db = register(rows), code = wanted => error => error.code === wanted;
  // An index whose directory does not say which document is a record, or has no directory; a document the index names and cannot hand over; a contact document that is not a contact record.
  await assert.rejects(indexedContacts(catalogOf(records, [{ id: 'old-1', kind: null, regions: null, legacy: true }]), 'tenant'), code('contact_index_directory_unsupported'));
  await assert.rejects(indexedContacts({ ...catalogOf(records), retrievalDirectory: async () => null }, 'tenant'), code('contact_index_directory_unsupported'));
  await assert.rejects(indexedContacts(catalogOf(records, [{ id: 'lost-1', kind: 'contact', regions: ['noo_vald'], missing: true }]), 'tenant'), code('missing_generation_source'));
  await assert.rejects(indexedContacts(catalogOf(records, [{ id: 'odd-1', kind: 'contact', regions: ['noo_vald'], record: { kind: 'service', region: 'noo_vald' } }]), 'tenant'), code('contact_index_record_mismatch'));
  await assert.rejects(contactDriftCount({ catalog: { ...catalogOf(records), active: async () => fail('no_active_search_generation') }, db, tenant: 'tenant' }), code('no_active_search_generation'));
  // A register that holds none of the bound rows is another database, not 2 deleted contacts.
  await assert.rejects(contactDriftCount({ catalog: catalogOf(records), db: register([row('z9', 'noo-vald', 'Nõo vald')]), tenant: 'tenant' }), code('contact_drift_register_mismatch'));
  // Review of 10.10.2026: a register without a contact check record of the current version (none at all, one of an
  // earlier version, one without the list) confirms no row, and counted it would read as every contact waiting for
  // the weekly check; so would a record of the current version whose every confirmation is over 90 days old.
  const noCheck = check => contactDriftCount({ catalog: catalogOf(records), db: register(rows, { check }), tenant: 'tenant' });
  for (const check of [null, { meta: null }, checkRecord(rows, { contactVerificationVersion: CONTACT_VERIFICATION_VERSION - 1 }), checkRecord(rows, { verifiedContactIds: 'r1' })]) {
    await assert.rejects(noCheck(check), code('contact_drift_check_record_missing'), JSON.stringify(check?.meta?.contactVerificationVersion ?? null));
  }
  const long = new Date(Date.now() - 100 * DAY).toISOString();
  for (const change of [{ verifiedContactIds: [] }, { contactDecisionObservedAt: Object.fromEntries(rows.map(item => [item.id, long])) }]) await assert.rejects(noCheck(checkRecord(rows, change)), code('contact_drift_check_confirms_none'));
  // The register is written between the count's reading and the gate's: the class and the gate part.
  const written = { ...db, serviceMapEntry: { ...db.serviceMapEntry, findFirst: async input => { const found = await db.serviceMapEntry.findFirst(input); return found && { ...found, phone: '+372 5550 0099' }; } } };
  await assert.rejects(contactDriftCount({ catalog: catalogOf(records), db: written, tenant: 'tenant' }), code('contact_drift_decision_mismatch'));
  // The same for a contact without a binding: the gate released it by one row, and a moment later the read of that
  // row's id (the gate's own read, asked for the id alone) finds none.
  const source = row('r3', 'noo-vald', 'Nõo vald', { sourceDocId: 'package-row-r3' }), loose = register([...rows, source]);
  const moved = { ...loose, serviceMapEntry: { ...loose.serviceMapEntry, findMany: async input => input.take === 2 && input.select.id ? [] : loose.serviceMapEntry.findMany(input) } };
  assert.equal((await contactDriftCount({ catalog: catalogOf([...records, packaged(source, null)]), db: loose, tenant: 'tenant' })).not_bound.no_binding_shown, 1);
  await assert.rejects(contactDriftCount({ catalog: catalogOf([...records, packaged(source, null)]), db: moved, tenant: 'tenant' }), code('contact_drift_decision_mismatch'));
  // A database error carries the query's values in its message; what a failed run prints is a code alone, and which
  // of the two connections the run was reading.
  const refusal = Object.assign(new Error('Invalid `findMany()` invocation: Inimene r1, +372 5550 0000, r1@noo-vald.example'), { code: 'P2010' });
  const broken = { ...db, serviceMapEntry: { ...db.serviceMapEntry, findMany: async () => { throw refusal; } } };
  let side = null;
  const thrown = await contactDriftCount({ catalog: catalogOf(records), db: broken, tenant: 'tenant', reading: name => { side = name; } }).catch(error => error);
  assert.match(thrown.message, /Inimene r1/u);
  assert.equal(JSON.stringify(driftFailure(thrown, side)), '{"ok":false,"code":"contact_drift_failed","reading":"register"}');
  const lost = await contactDriftCount({ catalog: { ...catalogOf(records), retrievalDirectory: async () => { throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:55432'), { code: 'ECONNREFUSED' }); } },
    db, tenant: 'tenant', reading: name => { side = name; } }).catch(error => error);
  assert.equal(JSON.stringify(driftFailure(lost, side)), '{"ok":false,"code":"contact_drift_connection_refused","reading":"index"}');
});

test('a failed run prints a code that tells the failures apart, and never a value', () => {
  const coded = (code, more = {}) => Object.assign(new Error('Inimene r1, +372 5550 0000'), { code, ...more }), codeOf = (error, reading) => driftFailure(error, reading).code;
  // One of the repository's own codes passes as it is, and says by itself what was being read.
  assert.deepEqual(driftFailure(coded('contact_drift_register_mismatch'), 'register'), { ok: false, code: 'contact_drift_register_mismatch' });
  // Review of 10.10.2026: the first server run must tell a module Node cannot find, a refused connection and a
  // statement that ran out of time apart. The same failure reaches the run in two shapes: from pg (the index) with
  // the database's or the system's own code, from Prisma (the register) with Prisma's code, which for a database
  // error it has no code for (P2010, P2039) keeps the database's code inside.
  const prisma = (code, originalCode) => coded(code, { meta: { driverAdapterError: { cause: { kind: 'postgres', originalCode, originalMessage: 'Inimene r1' } } } });
  assert.deepEqual([coded('ERR_MODULE_NOT_FOUND'), coded('ECONNREFUSED'), coded('P1001'), Object.assign(new Error('x'), { errorCode: 'P1001' }), coded('57014'), prisma('P2039', '57014'), prisma('P2010', '57014')].map(error => codeOf(error)),
    ['contact_drift_module_missing', 'contact_drift_connection_refused', 'contact_drift_connection_refused', 'contact_drift_connection_refused', 'contact_drift_statement_timeout', 'contact_drift_statement_timeout',
      'contact_drift_statement_timeout']);
  assert.deepEqual([coded('ENOTFOUND'), coded('ETIMEDOUT'), new Error('timeout exceeded when trying to connect'), coded('ECONNRESET'), coded('57P01'), coded('28P01'), coded('P1000'), coded('3D000'), coded('42501'),
    coded('42P01'), coded('P2022'), prisma('P2039', '42703'), coded('53300'), Object.assign(new Error('Invalid `findMany()` invocation: Inimene r1'), { name: 'PrismaClientValidationError' })].map(error => codeOf(error)),
  ['host_unknown', 'connection_timeout', 'connection_timeout', 'connection_closed', 'connection_closed', 'login_refused', 'login_refused', 'database_missing', 'permission_refused', 'schema_mismatch', 'schema_mismatch',
    'schema_mismatch', 'out_of_resources', 'query_invalid'].map(word => `contact_drift_${word}`));
  // Anything else is the one general code: a code the list does not hold, a number for a code (a DOMException's), no
  // error at all, a bare text. A driver's own code is never printed, whatever it holds.
  assert.deepEqual([coded('P2010'), prisma('P2039', '23505'), coded('INIMENE_R1'), coded('55500'), coded(23), null, undefined, 'Inimene r1', new Error('Inimene r1')].map(error => codeOf(error)), Array(9).fill('contact_drift_failed'));
  // Which connection the run was reading is one of two fixed words, or it is not printed.
  assert.deepEqual([driftFailure(coded('ECONNREFUSED'), 'index'), driftFailure(coded('P1001'), 'register'), driftFailure(coded('P1001'), 'Inimene r1'), driftFailure(coded('P1001'))],
    [{ ok: false, code: 'contact_drift_connection_refused', reading: 'index' }, { ok: false, code: 'contact_drift_connection_refused', reading: 'register' }, { ok: false, code: 'contact_drift_connection_refused' },
      { ok: false, code: 'contact_drift_connection_refused' }]);
  // Every printed code of every failure above is a lowercase word of the list, with no digit a value could bring.
  for (const error of [coded('INIMENE_R1'), coded('55500'), prisma('P2039', '5550 0000'), coded('+372 5550 0000'), 'Inimene r1']) assert.match(JSON.stringify(driftFailure(error, 'register')), /^\{"ok":false,"code":"contact_drift_[a-z_]+","reading":"register"\}$/u);
});

test('the export admits a row exactly where the count calls a later revision exportable', async () => {
  // The count repeats the export's admission rule for a channel and a page address; this pins the two together.
  const rows = [row('e1', 'noo-vald', 'Nõo vald'), row('e2', 'noo-vald', 'Nõo vald'), row('e3', 'noo-vald', 'Nõo vald'), row('e4', 'noo-vald', 'Nõo vald')], records = await exported(rows);
  // No channel left; a page that is not a web page; a page address with a user name in it; a page that only moved.
  const now = [{ phone: null, email: '' }, { sourceUrl: 'ftp://noo-vald.example/kontakt' }, { sourceUrl: 'https://kasutaja@noo-vald.example/kontakt' }, { sourceUrl: 'https://www.noo-vald.example/uus' }]
    .map((change, at) => ({ ...rows[at], ...later, ...change }));
  const { counts } = await prepareRegisterContactExport({ db: register(now) });
  assert.deepEqual([counts.skipped, counts.exported_contacts], [{ no_channel: 1, page_address: 2, no_name: 0 }, 1]);
  assert.deepEqual(records.map((record, at) => contactDrift({ record, row: now[at], verified: true })), ['not_exportable_now', 'not_exportable_now', 'not_exportable_now', 'page_address_changed']);
});

// The command of the script's header: the repository root, the node source loader, the script.
const root = fileURLToPath(new URL('..', import.meta.url)), node = (args, env = {}) => promisify(execFile)(process.execPath, ['--import', './scripts/register-node-source-loader.mjs', ...args],
  { cwd: root, env: { ...process.env, RAG_V2_POSTGRES_URL: '', RAG_CONTACT_EXPORT_DATABASE_URL: '', DATABASE_URL: '', ...env }, timeout: 60000, windowsHide: true });
const run = (args, env) => node(['scripts/rag-v2-contact-drift.mjs', ...args], env);
// Exit 1, nothing on stdout, one line of JSON with a code on stderr.
const refused = (args, env) => run(args, env).then(() => 'ran', error => [error.code, error.stdout, error.stderr.trim()]), exits = name => [1, '', `{"ok":false,"code":"${name}"}`];
const generatedClient = fileURLToPath(new URL('../generated/prisma/client.ts', import.meta.url));

test('the script refuses by code before it opens a connection, and says how it is run', async () => {
  // No connection is named here, so nothing is opened; the generated register client is not needed either.
  // No register connection under the default name or the named one; the register named and no index; a variable name
  // that is not one; an option the script does not have (the design's --lane).
  assert.deepEqual(await Promise.all([refused([]), refused(['--database-url-env', 'DATABASE_URL']), refused(['--database-url-env', 'DATABASE_URL'], { DATABASE_URL: 'postgres://register.example/app' }),
    refused(['--database-url-env', 'database_url']), refused(['--lane'])]),
  [exits('contact_drift_database_required'), exits('contact_drift_database_required'), exits('contact_drift_index_required'), exits('invalid_contact_drift_cli'), exits('invalid_contact_drift_cli')]);
  const help = await run(['--help']);
  assert.match(help.stdout, /--import \.\/scripts\/register-node-source-loader\.mjs scripts\/rag-v2-contact-drift\.mjs --database-url-env DATABASE_URL/u);
  assert.equal(help.stderr, '');
});

// Review of 10.10.2026: a missing generated register client has its own code, apart from every other module Node cannot
// find. Both connections are named and nothing is opened: the script refuses before it loads a database client. Where
// the generated client is present (after prisma generate) the same command would go on to open the connections, so
// the case is not run there.
test('the script names a missing generated register client by its own code', { skip: existsSync(generatedClient) && 'the generated register client is present' }, async () => {
  assert.deepEqual(await refused(['--database-url-env', 'DATABASE_URL'], { DATABASE_URL: 'postgres://register.example/app', RAG_V2_POSTGRES_URL: 'postgres://index.example/index', DEBUG: '*' }),
    exits('contact_drift_generated_client_missing'));
});

// Review of 10.10.2026: the database adapter's debug channel is the one output path outside the script. A child
// process with DEBUG set runs one query with an invented row id through the real adapter over a pool that connects
// to nothing: without the script's guard the id is printed on stderr, with it nothing is.
test('the database adapter prints no query once its debug channel is silenced', async () => {
  const child = guard => node(['--input-type=module', '-e', `${guard}
    const [{ default: pg }, { PrismaPg }] = await Promise.all([import('pg'), import('@prisma/adapter-pg')]);
    class Still extends pg.Pool { async query() { return { fields: [], rows: [] }; } }
    const adapter = await new PrismaPg(new Still()).connect();
    await adapter.queryRaw({ sql: 'SELECT 1', args: ['row-x1'], argTypes: [{ scalarType: 'string', arity: 'scalar' }] });
    process.stdout.write(JSON.stringify([process.env.DEBUG ?? null, globalThis.DEBUG]));`], { DEBUG: 'prisma:*', DEBUG_COLORS: 'false' });
  const loud = await child(''), quiet = await child("(await import('./lib/rag-v2/adapters/contact-drift.js')).silenceDriverDebug();");
  // The control: the channel is what the header says it is. If it fails, the adapter has changed how it reports and
  // the guard must be looked at again.
  assert.deepEqual([loud.stdout, /row-x1/u.test(loud.stderr)], ['["prisma:*","prisma:*"]', true]);
  assert.deepEqual([quiet.stdout, quiet.stderr], ['[null,""]', '']);
});

// Verification of 10.10.2026: the two guards against a debug channel stand in the script itself, before any database
// client is loaded. The helper's own test above does not show that the script calls it, or when.
test('the script refuses under NODE_DEBUG and silences the driver before it loads a database client', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../scripts/rag-v2-contact-drift.mjs', import.meta.url), 'utf8');
  const at = text => { const index = source.indexOf(text); assert.ok(index >= 0, text); return index; };
  const loads = at("import('../generated/prisma/client.ts')");
  assert.ok(at("if (process.env.NODE_DEBUG) fail('contact_drift_node_debug_set');") < loads);
  assert.ok(at('    silenceDriverDebug();') < loads);
  assert.ok(at("import('@prisma/adapter-pg')") > at('    silenceDriverDebug();') && at("import('../lib/rag-v2/search/postgres.js')") > at('    silenceDriverDebug();'));
  // No static import of a database client: every one is loaded after the guards.
  assert.ok(!/^import .*(?:prisma|postgres.js|['"]pg['"])/mu.test(source));
});
