import { buildFreshServiceMapContactWhere, loadServiceMapContactVerificationProjection } from '../../serviceMap/contactFreshnessProjection.js';
import { fail, hash, nonempty, stable } from '../contracts.js';
import { prepareRegisterContactExport } from './municipal-contact-export.js';
import { municipalDirectoryAdapter } from './municipal-directory.js';
import { CONTACT_BINDING_SCHEMA, CONTACT_SELECT, boundContactMatches, contactContent, registerRole, validContactBinding } from './verified-municipal-contact.js';

// ADR-134 (10.10.2026), the free first step. The chat's municipal contacts are a snapshot of the register (ADR-085): a
// contact is released only while its register row is verified now and is exactly the row the export read
// (municipal-directory.js authorizeContact), so after any change of the row it stays out of the answers until somebody
// exports again by hand. Before that is redesigned its size must be known. This module counts, for the contact
// documents of the active index generation, how each stands to its register row today.
//
// It counts only what the code as it is can tell: the document's binding, the row, and the register's own live rule.
// It decides nothing the chat shows, writes nothing and calls no model; a contact's name, phone, e-mail, page address
// and row id stay in memory, and only numbers and the ids of the register's own municipalities leave it.
//
// Every contact stands in exactly one class. 'shown_as_exported' is the only one the chat's gate releases; the others
// are grouped by what happened to the row. A row that differs in several ways is counted once, under the first that
// holds in the order contactDrift asks. "Shown" is the gate's decision: an answer shows a released contact where a
// record of its municipality links to it, and the links are not read here.
export const DRIFT_CLASSES = Object.freeze({
  // The row is verified now, in the record's municipality, and is not the row the export read (binding 2).
  //   same_values_new_revision: a later revision, and name, role, unit, phone, e-mail and page address are the exported ones
  //   phone_changed, email_changed, page_address_changed: a later revision of the same name, role and unit
  //   role_or_unit_changed, name_changed: at any revision
  //   changed_under_exported_revision: the name, role and unit are the exported ones, the revision too, and the row's
  //     content is not. Only this class means a writer changed a value without a new revision (a lower bound: a name
  //     or a role changed that way is counted under its own class)
  //   not_exportable_now: a later revision that has no phone and no e-mail left, or a page address the export refuses
  //   other: what none of the above names (a row at an earlier revision than its export; a record whose fields are not
  //     the ones its binding was made with). Above 0 it needs a look by hand.
  row_changed: ['same_values_new_revision', 'phone_changed', 'email_changed', 'page_address_changed', 'role_or_unit_changed', 'name_changed',
    'changed_under_exported_revision', 'not_exportable_now', 'other'],
  // not_verified_now: the row is published in the record's municipality and the register's live rule does not confirm
  //   it now (edited and waiting for the weekly check, not confirmed by the last check, a check over 90 days old, or a
  //   row that is no longer a contact row the check verifies: its type, its namespace, no page address)
  // row_hidden: not published, or tombstoned. row_gone: no row with the bound id.
  // other_municipality: the row's municipality is not active or not the record's, whether the row is verified or not.
  row_gone_or_not_verified: ['not_verified_now', 'row_hidden', 'row_gone', 'other_municipality'],
  // Not a change of the row since the export, so not counted as drift.
  //   binding_version_1: an ADR-017 binding the gate no longer releases, whatever became of its row since (changed,
  //     gone, hidden, in another municipality, not verified now). That binding also pinned the time of the check, so
  //     the first weekly check after its export ended it by itself: what the row did later is not what took the
  //     contact out of the answers. Counted as drift it would also bend the reading of two runs a week apart: such a
  //     contact would wait in not_verified_now and leave `drifted` once the check confirmed its row (review of 10.10.2026).
  //   invalid_binding: a binding that is not one, or that names another document. The gate refuses it unread.
  //   no_binding: a package contact without a binding; the gate decides it by its source id and present values, so the
  //     count takes the gate's own answer for it (no_binding_shown).
  not_bound: ['binding_version_1', 'invalid_binding', 'no_binding'],
});
const DRIFTED = new Set([...DRIFT_CLASSES.row_changed, ...DRIFT_CLASSES.row_gone_or_not_verified]);
const STANDINGS = ['shown_as_exported', ...Object.values(DRIFT_CLASSES).flat()];
const EXPORTED = ['name', 'role', 'department', 'phone', 'email', 'official_url', 'checked_at'];
// The export's own admission rule for a page address (municipal-contact-export.js).
const usableUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } };
// Why the gate's own read (readVerifiedMunicipalContact: the row by its id, in the record's own active municipality,
// under the live rule) does not find the row: the first that holds, or null when it finds it.
const unread = (record, row, verified) => !row ? 'row_gone' : row.status !== 'PUBLISHED' || row.tombstonedAt ? 'row_hidden'
  : !row.municipality?.isActive || row.municipality.slug !== record.region.replaceAll('_', '-') ? 'other_municipality' : verified ? null : 'not_verified_now';

/** How one exported contact stands to its register row now. row: the row of the binding's entry id read without any
 *  rule (null when there is none), with its status, tombstonedAt and its municipality's isActive; verified: the
 *  register's live rule confirms that row now. */
export function contactDrift({ record, row = null, verified = false }) {
  if (record.bindings === undefined) return 'no_binding';
  const binding = record.bindings?.service_map?.value;
  if (!validContactBinding(binding, record)) return 'invalid_binding';
  const away = unread(record, row, verified);
  // ADR-134, review of 10.10.2026: ADR-017's binding is asked before anything about its row. It stands as exported only
  // while the gate still releases it (the row found, and the very check the binding pinned); in every other case it is
  // binding_version_1, also when the row is gone, hidden, elsewhere or not verified, and never a class of drift.
  if (binding.schema_version !== CONTACT_BINDING_SCHEMA) return !away && boundContactMatches(row, record, binding) ? 'shown_as_exported' : 'binding_version_1';
  if (away) return away;
  if (boundContactMatches(row, record, binding)) return 'shown_as_exported';
  // The row is the very one the binding was made from, so it is the record that is not that export: no change of the row.
  if (row.revision === binding.revision && binding.content_sha256 === hash(stable(contactContent(row)))) return 'other';
  const { role, department } = registerRole(row.description), now = { name: row.title, role, department, phone: row.phone, email: row.email, official_url: row.sourceUrl };
  const differs = field => (record.fields[field]?.value ?? null) !== (now[field] || null);
  if (differs('name')) return 'name_changed';
  if (differs('role') || differs('department')) return 'role_or_unit_changed';
  if (row.revision === binding.revision) return 'changed_under_exported_revision';
  if (row.revision < binding.revision) return 'other';
  if (!nonempty(row.phone) && !nonempty(row.email) || !usableUrl(row.sourceUrl)) return 'not_exportable_now';
  if (differs('phone')) return 'phone_changed';
  if (differs('email')) return 'email_changed';
  if (differs('official_url')) return 'page_address_changed';
  // Every exported value is the row's. The record must also be the export its binding was made with, and hold nothing else.
  return (record.fields.checked_at?.value ?? null) === binding.checked_at && Object.keys(record.fields).every(field => EXPORTED.includes(field)) ? 'same_values_new_revision' : 'other';
}

const BUNDLES = 200, ROWS = 500;
/** The contact documents of the tenant's active index generation, read through the catalog's own verified reads
 *  (PostgresCatalog: active, retrievalDirectory, bundles), and how many documents the index holds for each region. */
export async function indexedContacts(catalog, tenant) {
  const generation = await catalog.active(tenant), ids = Object.keys(generation.snapshot.documents);
  const rows = await catalog.retrievalDirectory(tenant, generation, ids);
  // A generation indexed before the typed directory (retrieval-directory-1) does not say which document is a record:
  // the contacts cannot be told from the rest, and a count of none would read as "nothing drifted".
  if (!rows || rows.length !== ids.length || rows.some(row => !row?.source)) fail('contact_index_directory_unsupported');
  const documents = new Map(), contacts = [];
  for (const row of rows) for (const region of Array.isArray(row.fields?.regions?.value) ? row.fields.regions.value : []) documents.set(region, (documents.get(region) || 0) + 1);
  const wanted = rows.filter(row => row.source.record_kind === 'contact').map(row => row.document_id);
  for (let from = 0; from < wanted.length; from += BUNDLES) {
    const slice = wanted.slice(from, from + BUNDLES), bundles = await catalog.bundles(tenant, generation.id, slice, { cache: false });
    if (bundles.length !== slice.length) fail('missing_generation_source');
    for (const bundle of bundles) {
      const record = bundle.document.fields.structured_record?.value;
      if (record?.kind !== 'contact' || !nonempty(record.region)) fail('contact_index_record_mismatch');
      contacts.push({ record });
    }
  }
  return { generation: generation.id, contacts, documents };
}

/** In memory only: each contact with its binding (null unless valid), its class, whether the chat's gate releases it
 *  now, and the id of the register row its document is one of (rowId, null when that cannot be told). */
export async function contactStandings({ contacts, db, now = new Date() }) {
  const bindingOf = record => { const binding = record.bindings?.service_map?.value; return validContactBinding(binding, record) ? binding : null; };
  const ids = [...new Set(contacts.map(({ record }) => bindingOf(record)?.entry_id).filter(Boolean))], rows = new Map(), verified = new Set();
  // ADR-134, review of 10.10.2026: without a contact check record of the current version the live rule confirms no row,
  // the gate releases nothing, and every bound contact would be counted as waiting for the weekly check. That is a
  // register that holds the rows and not their check (another database behind the connection, or a check whose version
  // changed and that has not run since), not a week's drift. A record of the current version that confirms no row now
  // (every confirmation over 90 days old, or none made) is a chat that shows no contact at all, and no count of drift
  // either: both refuse, each with its own code.
  const check = await loadServiceMapContactVerificationProjection(db, { now });
  if (check.mode !== 'per_contact_verification') fail('contact_drift_check_record_missing');
  if (!check.verifiedContactIds.length) fail('contact_drift_check_confirms_none');
  const fresh = await buildFreshServiceMapContactWhere(db, { now });
  const select = { ...CONTACT_SELECT, status: true, tombstonedAt: true, municipality: { select: { ...CONTACT_SELECT.municipality.select, isActive: true } } };
  for (let from = 0; from < ids.length; from += ROWS) {
    const slice = ids.slice(from, from + ROWS);
    for (const row of await db.serviceMapEntry.findMany({ where: { id: { in: slice } }, select })) rows.set(row.id, row);
    for (const row of await db.serviceMapEntry.findMany({ where: { AND: [fresh, { id: { in: slice }, municipality: { is: { isActive: true } } }] }, select: { id: true } })) verified.add(row.id);
  }
  // Not one of the bound rows exists: this is not the register the contacts were exported from (another database behind
  // the connection), and every contact would be counted as gone.
  if (ids.length && !rows.size) fail('contact_drift_register_mismatch');
  const adapter = municipalDirectoryAdapter(db), standings = [], rowsOf = where => db.serviceMapEntry.findMany({ where, take: 2, select: { id: true } });
  for (const { record } of contacts) {
    const binding = bindingOf(record), row = binding ? rows.get(binding.entry_id) ?? null : null;
    const kind = contactDrift({ record, row, verified: Boolean(row) && verified.has(row.id) });
    // The chat's own gate decides the same contact with its own reading of the row. The class is a count of the gate's
    // decisions only while the two agree; they part when the register is written between the readings or when this
    // module's rule and the gate's have drifted apart, and then the run refuses instead of printing a number.
    const released = await adapter.authorizeContact({ record }) === true;
    if (kind !== 'no_binding' && released !== (kind === 'shown_as_exported')) fail('contact_drift_decision_mismatch');
    // ADR-134, review of 10.10.2026: the row a document is one of, for the count of rows with two documents. A valid
    // binding names it. A package contact without a binding is a row's document too, by its source id: the gate reads
    // it as the one verified row of the record's active municipality whose source id is one of the document's ids, and
    // a count by bindings alone gave 0 for such a contact beside the register's own document of the same row, both
    // released (the same person twice in one answer). The gate's own read is repeated for the id alone; where it finds
    // no row (not verified now) the only row with that source id stands for it. None or several: the row is not known
    // (no_binding_row_unknown). A document with an invalid binding is of no row: the gate never reads one for it.
    let rowId = binding?.entry_id ?? null;
    if (kind === 'no_binding') {
      const own = { sourceDocId: { in: record.aliases }, municipality: { is: { isActive: true, slug: record.region.replaceAll('_', '-') } } };
      let found = await rowsOf({ AND: [fresh, own] });
      // The gate released it by exactly one row a moment ago.
      if (released && found.length !== 1) fail('contact_drift_decision_mismatch');
      if (!found.length) found = await rowsOf(own);
      rowId = found.length === 1 ? found[0].id : null;
    }
    standings.push({ record, binding, kind, released, rowId });
  }
  return standings;
}

const add = (map, key, count = 1) => map.set(key, (map.get(key) || 0) + count);

/**
 * The drift count: one object of numbers. catalog: the index (PostgresCatalog or its like); db: the application
 * database (Prisma), read with findMany and findFirst only (serviceMapEntry, dataAuditLog, municipality).
 * nextExport: also what an export made now would hold, by today's prepareRegisterContactExport with the bound list
 * read from the index. The export script reads that list from the store's version folders and skips a document whose
 * folder it cannot open, and the server's folders of indexed versions are packed away (rag-v2-store-pack.sh,
 * 07.10.2026): there its list would come back empty. Its counts only; the items it prepares are dropped.
 * reading: called with 'index' and then 'register' as the run starts to read each, so that a failure of a driver can
 * say which of the two connections it was on (driftFailure).
 */
export async function contactDriftCount({ catalog, db, tenant, nextExport = false, now = () => new Date(), reading = () => {} }) {
  reading('index');
  const { generation, contacts, documents } = await indexedContacts(catalog, tenant), readAt = now();
  reading('register');
  const standings = await contactStandings({ contacts, db, now: readAt });
  // ADR-134, review of 10.10.2026: a region is printed only when it is a municipality of the register (its slug as the
  // index writes it). A region comes from a corpus item's municipality_id, and ingestion asks only that it is not
  // empty: a faulty item could carry any text there, a person's name too, and a rule by the shape of an id printed
  // such a text as a key. Every other region is counted under the one key 'other'. (The regions of next_export.too_large
  // are the register's own municipalities by construction.)
  const municipalities = new Set((await db.municipality.findMany({ select: { slug: true } })).map(({ slug }) => slug.replaceAll('-', '_')));
  const named = region => municipalities.has(region) ? region : 'other';
  const standing = Object.fromEntries(STANDINGS.map(name => [name, 0])), inRegion = new Map(), shownIn = new Map(), driftedIn = new Map(), ofRow = new Map(), shownOfRow = new Map();
  for (const { record, kind, released, rowId } of standings) {
    standing[kind]++;
    add(inRegion, record.region); add(shownIn, record.region, released ? 1 : 0);
    if (DRIFTED.has(kind)) add(driftedIn, record.region);
    if (rowId) { add(ofRow, rowId); add(shownOfRow, rowId, released ? 1 : 0); }
  }
  // A municipality is named only with the number of its contacts whose row changed, is gone or is no longer verified.
  const drifted = new Map();
  for (const [region, count] of [...driftedIn].sort(([a], [b]) => a.localeCompare(b, 'en'))) add(drifted, named(region), count);
  const group = names => ({ contacts: names.reduce((sum, name) => sum + standing[name], 0), ...Object.fromEntries(names.map(name => [name, standing[name]])) });
  const changed = group(DRIFT_CLASSES.row_changed), gone = group(DRIFT_CLASSES.row_gone_or_not_verified), unbound = standings.filter(({ kind }) => kind === 'no_binding');
  // What the record lane counts against its 300 documents of one municipality (structured-record-source.js): above
  // that every turn of the municipality fails, and contact documents that are never shown again still take the room.
  const largest = [...inRegion.keys()].map(region => ({ region: named(region), documents: documents.get(region) || 0 }))
    .sort((a, b) => b.documents - a.documents || a.region.localeCompare(b.region, 'en'))[0] ?? null;
  const bound = standings.filter(({ binding }) => binding?.schema_version === CONTACT_BINDING_SCHEMA)
    .map(({ binding }) => ({ entry_id: binding.entry_id, revision: binding.revision, content_sha256: binding.content_sha256, item_id: binding.source_record.item_id }));
  return { generation: generation.replace(/^search_generation_/u, '').slice(0, 8), read_at: readAt.toISOString(), contacts_in_index: contacts.length,
    shown_today: standings.filter(({ released }) => released).length, shown_as_exported: standing.shown_as_exported, drifted: changed.contacts + gone.contacts,
    row_changed: changed, row_gone_or_not_verified: gone,
    // no_binding_row_unknown: the unbound documents the two counts of rows below cannot see (their upper bound of what is missed).
    not_bound: { ...group(DRIFT_CLASSES.not_bound), no_binding_shown: unbound.filter(({ released }) => released).length, no_binding_row_unknown: unbound.filter(({ rowId }) => !rowId).length },
    municipalities: { with_contacts_in_index: inRegion.size, with_drifted_contacts: driftedIn.size, with_none_shown: [...shownIn.values()].filter(count => count === 0).length,
      drifted: Object.fromEntries(drifted) },
    // One register row with more than one contact document: a package contact (bound to the row, or the row's by its
    // source id) and the register's own after an edit. Two shown ones are the same person twice in an answer.
    rows_with_two_documents: [...ofRow.values()].filter(count => count > 1).length, rows_with_two_shown_documents: [...shownOfRow.values()].filter(count => count > 1).length,
    municipality_documents_max: largest,
    ...(nextExport ? { next_export: (await prepareRegisterContactExport({ db, bound, now })).counts } : {}) };
}

// ADR-134, review of 10.10.2026. A failure that is not one of this repository's codes printed the one code
// contact_drift_failed, and the first server run (the count's real test) could not tell a missing module from a
// refused connection or a statement that ran out of time. It is now named by one of the words below. The list is
// closed: the driver's or the runtime's own code only picks the word and is never printed (an error's code is whatever
// its thrower put there), and neither is its message (a database error's message can hold the values of its query).
const FAILURE_WORDS = Object.freeze({
  // Node: a module is not where the script looks for it. The script names the generated register client apart.
  ERR_MODULE_NOT_FOUND: 'module_missing',
  // Nobody listens at the address. Prisma gives a host name that does not resolve the same code (P1001).
  ECONNREFUSED: 'connection_refused', P1001: 'connection_refused', ENOTFOUND: 'host_unknown', EAI_AGAIN: 'host_unknown',
  ETIMEDOUT: 'connection_timeout', P1002: 'connection_timeout', P1008: 'connection_timeout', ECONNRESET: 'connection_closed', EPIPE: 'connection_closed', P1017: 'connection_closed',
  P1000: 'login_refused', P1010: 'login_refused', P1003: 'database_missing', P1011: 'tls_refused',
  // A table or a column the generated client asks for is not in the database: not this release's schema.
  P2021: 'schema_mismatch', P2022: 'schema_mismatch', P2024: 'pool_timeout', P2037: 'out_of_resources' });
// PostgreSQL's own five-character codes, by code or by class. 57014 is a cancelled statement: its time limit (the index
// pool sets 15 s) or a cancel by hand.
const SQLSTATE_WORDS = [[/^57014$/, 'statement_timeout'], [/^28/, 'login_refused'], [/^3D000$/, 'database_missing'], [/^42501$/, 'permission_refused'], [/^42(P01|703)$/, 'schema_mismatch'],
  [/^(08|57P)/, 'connection_closed'], [/^53/, 'out_of_resources']];
function driverFailure(error) {
  // Prisma refuses a query's shape before it reaches the database (a field the generated client does not have).
  if (error?.name === 'PrismaClientValidationError') return 'query_invalid';
  // Prisma's own code (code, or errorCode on a failure to start), then the database's code Prisma keeps inside an error
  // it has no code of its own for (P2010, P2039).
  for (const code of [error?.code, error?.errorCode, error?.meta?.driverAdapterError?.cause?.originalCode]) {
    if (typeof code !== 'string') continue;
    if (Object.hasOwn(FAILURE_WORDS, code)) return FAILURE_WORDS[code];
    const state = /^[0-9A-Z]{5}$/.test(code) ? SQLSTATE_WORDS.find(([pattern]) => pattern.test(code)) : null;
    if (state) return state[1];
  }
  // pg's pool gives its own time limit for a connection no code, only this text.
  return error?.message === 'timeout exceeded when trying to connect' ? 'connection_timeout' : null;
}

/** What a failed run prints: one of this repository's own codes as it is, else contact_drift_<word> from the closed
 *  list above, else contact_drift_failed; never an error's message or a driver's code. reading: 'index' or 'register',
 *  which of the two the run was reading (contactDriftCount tells it); printed where the code alone does not say it. */
export function driftFailure(error, reading = null) {
  if (typeof error?.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code)) return { ok: false, code: error.code };
  const word = driverFailure(error);
  return { ok: false, code: word ? `contact_drift_${word}` : 'contact_drift_failed', ...(reading === 'index' || reading === 'register' ? { reading } : {}) };
}

/** ADR-134, review of 10.10.2026: one output path lies outside this repository's code. Prisma's database adapter
 *  (@prisma/adapter-pg) hands every query with its arguments (row ids, municipality slugs, source ids) to Prisma's debug
 *  channel, which prints them on stderr when DEBUG names it (prisma:*, *). The channel reads the variable once, when
 *  its module is first loaded (globalThis.DEBUG, else the environment's DEBUG). A script that promises to print no row
 *  id calls this before it loads the register client; it changes the variable of its own process only. */
export function silenceDriverDebug() { delete process.env.DEBUG; globalThis.DEBUG = ''; }
