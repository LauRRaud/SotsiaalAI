import { readInput } from '../catalog.js';
import { DEFAULT_CONFIG, fail, hash, nonempty, stable } from '../contracts.js';
import { buildFreshServiceMapContactWhere } from '../../serviceMap/contactFreshnessProjection.js';
import { CONTACT_SELECT, REGISTER_SOURCE, contactBinding, contactContent, contactProjection, readVerifiedMunicipalContact, registerContactId, registerDirectoryId,
  registerRole } from './verified-municipal-contact.js';

export const CONTACT_MAPPING_SCHEMA = 'sotsiaalai/contact-source-mapping-1';
export const CONTACT_EXPORT_SCHEMA = 'sotsiaalai/verified-contact-export-1';
export const REGISTER_EXPORT_SCHEMA = 'sotsiaalai/register-contact-export-1';
// A directory the chat can show in one go. Measured on corpora v52 to v54 (04.10.2026) in the record context of
// 12 000 tokens: a shown contact takes about 490 tokens (its fields and its source passage) and a directory's own
// title about 210, beside the municipality's other titles (4000 to 5500 tokens). A directory of 35 or 53 contacts was
// never shown; twelve are. A municipality with more contacts than one directory holds is listed by department, a
// department of fewer than DEPARTMENT_MIN contacts with the rest, and a group that is still larger in even parts
// ordered by role, so a part holds people of the same roles and its summary names them.
//
// A municipality with more than LARGE_MUNICIPALITY contacts is left out whole (Tallinn, 110 people): its directories
// alone, 13 of them and then 27 smaller ones, took 2900 and 5700 tokens of the context, no contact of theirs was ever
// shown, and every turn decided all 110 contacts. Its contacts wait for a cheaper view of a contact. The limit stands
// between the two measured cases: Tartu's 53 contacts in seven directories were shown, Tallinn's 110 never. After the
// contact proposals of 05.10.2026 Tartu has 74 and Tallinn 125.
const DIRECTORY_SIZE = 12, LARGE_MUNICIPALITY = 100, DEPARTMENT_MIN = 3, ROLES_SHOWN = 30;

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
    // Service -> contact links in the original service source keep their target ID, and the package's source type
    // keeps the document identity, so publishing replaces the package contact's version (ADR-045).
    items.push({ id: item.id, canonical_item_id: identity, itemType: 'contact', municipality_id: projection.region,
      municipality_name: row.municipality.displayName, source_type: item.source_type || 'municipal_contact', language: item.language || 'et',
      name: row.title, ...Object.fromEntries(Object.entries(registerRole(row.description)).filter(([, value]) => value)),
      ...(row.phone ? { phone: row.phone } : {}), ...(row.email ? { email: row.email } : {}),
      officialUrl: row.sourceUrl, checked_at: projection.checked_at, registry_binding: binding });
    rows.push({ entryId: row.id, region: projection.region, fingerprint: hash(stable(contactContent(row))) });
  }
  // Catch a registry edit/revocation during preparation (a re-check alone is not an edit); runtime repeats this
  // decision after ingestion, before sending evidence and when restoring it.
  for (const expected of rows) {
    const row = await readVerifiedMunicipalContact(db, { ...expected, now: now() });
    if (!row || hash(stable(contactContent(row))) !== expected.fingerprint) fail('contact_changed_during_export');
  }
  return { schema_version: CONTACT_EXPORT_SCHEMA, generated_at: now().toISOString(),
    mapping_sha256: hash(stable(mapping)), items };
}

const validUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } };
// The register row as a contact item: the same fields and exact register values as the mapped export writes.
const registerContact = (row, id, sourceRecord) => {
  const projection = contactProjection(row);
  return { id, canonical_item_id: id, itemType: 'contact', municipality_id: projection.region, municipality_name: row.municipality.displayName,
    source_type: 'municipal_contact', language: 'et',
    name: row.title, ...Object.fromEntries(Object.entries(registerRole(row.description)).filter(([, value]) => value)),
    ...(row.phone ? { phone: row.phone } : {}), ...(row.email ? { email: row.email } : {}),
    officialUrl: row.sourceUrl, checked_at: projection.checked_at, registry_binding: contactBinding(row, sourceRecord) };
};

const clean = value => value.replace(/\s+/gu, ' ').trim();
const cut = (value, max) => value.slice(0, max).replace(/[\uD800-\uDBFF]$/u, '');
const firstLine = (value, max) => cut(clean((value || '').split('\n')[0]), max);
/** The directories of one municipality: [{ label, part, parts, members }], label null for the municipality's own. */
function directoryGroups(members) {
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id, 'en')), groups = [];
  const limit = DIRECTORY_SIZE;
  if (sorted.length <= limit) groups.push({ label: null, members: sorted });
  else {
    const byDepartment = new Map(), rest = [];
    for (const member of sorted) byDepartment.set(member.department, [...(byDepartment.get(member.department) || []), member]);
    for (const [department, list] of [...byDepartment].sort(([a], [b]) => a.localeCompare(b, 'et'))) {
      if (!department || list.length < DEPARTMENT_MIN) rest.push(...list); else groups.push({ label: department, members: list });
    }
    if (rest.length) groups.unshift({ label: null, members: rest.sort((a, b) => a.id.localeCompare(b.id, 'en')) });
  }
  return groups.flatMap(group => {
    const count = group.members.length, parts = Math.ceil(count / limit), size = Math.floor(count / parts), larger = count % parts;
    const byRole = [...group.members].sort((a, b) => (a.role || '').localeCompare(b.role || '', 'et') || a.id.localeCompare(b.id, 'en'));
    // Even parts: the first `larger` of them hold one more.
    const from = index => index * size + Math.min(index, larger);
    return Array.from({ length: parts }, (_, index) => ({ label: group.label, part: index + 1, parts, members: byRole.slice(from(index), from(index + 1)) }));
  });
}

/**
 * ADR-085: the register's verified contacts as a source of their own, for the rows no package item is bound to.
 *
 * bound: the bindings of the contact documents the corpus already holds ({ entry_id, revision, content_sha256,
 * item_id }, read from the store). A row whose bound document still matches it keeps that document, so the services
 * that link to it keep their link; every other verified row is exported as a contact named after the row.
 *
 * The chat shows a contact only where a record links to it. Each municipality therefore gets a directory record (a
 * resource) that links to all of its verified contacts, the kept ones and the exported ones; a large municipality
 * gets one for each department (directoryGroups). Nothing is guessed: no service is linked to a person by a role or a name.
 *
 * Read-only: no registry write, no publication, no model call. A row without a channel or with an unusable page
 * address is left out and counted.
 */
export async function prepareRegisterContactExport({ db, bound = [], now = () => new Date() }) {
  if (!Array.isArray(bound) || bound.some(item => !item || ![item.entry_id, item.item_id].every(nonempty) || !Number.isSafeInteger(item.revision)
    || !/^[a-f0-9]{64}$/.test(item.content_sha256 || ''))) fail('invalid_contact_bound_list');
  const fresh = await buildFreshServiceMapContactWhere(db, { now: now() });
  const rows = await db.serviceMapEntry.findMany({ where: { AND: [fresh, { municipality: { is: { isActive: true } } }] }, select: CONTACT_SELECT, orderBy: { id: 'asc' } });
  const kept = new Map();
  for (const item of bound) kept.set(`${item.entry_id}:${item.revision}:${item.content_sha256}`, item.item_id);
  const items = [], regions = new Map(), checks = [], skipped = { no_channel: 0, page_address: 0, no_name: 0 };
  let keptBound = 0;
  // The register holds one person in several rows (one for each page or service point: 97 of 480 rows on 04.10.2026, a
  // sector head of Tallinn 18 times). One person is one contact: rows of one municipality with the same name, phone and
  // e-mail are the same person. The row whose bound document the store holds stands for them, else the first by id.
  const readable = [];
  for (const row of rows) {
    if (!nonempty(row.title)) { skipped.no_name++; continue; }
    if (!nonempty(row.phone) && !nonempty(row.email)) { skipped.no_channel++; continue; }
    if (!validUrl(row.sourceUrl)) { skipped.page_address++; continue; }
    const projection = contactProjection(row), content = hash(stable(contactContent(row)));
    readable.push({ row, projection, content, keptId: kept.get(`${row.id}:${row.revision}:${content}`) });
  }
  const people = new Set();
  let duplicates = 0;
  for (const { row, projection, content, keptId } of readable.sort((a, b) => Number(Boolean(b.keptId)) - Number(Boolean(a.keptId)) || a.row.id.localeCompare(b.row.id, 'en'))) {
    const person = stable([projection.region, clean(row.title).toLowerCase(), clean(row.phone || ''), clean(row.email || '').toLowerCase()]);
    if (people.has(person)) { duplicates++; continue; }
    people.add(person);
    const id = keptId ?? registerContactId(row.id);
    if (!regions.has(projection.region)) regions.set(projection.region, { name: row.municipality.displayName, members: [] });
    const { role, department } = registerRole(row.description);
    // The register writes a reception place or time on the lines after the department: the unit is its first line.
    regions.get(projection.region).members.push({ id, role: firstLine(role, 80), department: firstLine(department, 120), page: row.sourceUrl, checked: projection.checked_at,
      item: keptId ? null : registerContact(row, id, { register: REGISTER_SOURCE, item_id: id }), check: { entryId: row.id, region: projection.region, fingerprint: content } });
  }
  const shown = [...regions].sort(([a], [b]) => a.localeCompare(b, 'en')).filter(([, { members }]) => members.length <= LARGE_MUNICIPALITY);
  const tooLarge = [...regions].filter(([, { members }]) => members.length > LARGE_MUNICIPALITY).map(([region, { members }]) => ({ region, contacts: members.length }));
  for (const [, { members }] of shown) for (const member of members) {
    if (member.item) items.push(member.item); else keptBound++;
    checks.push(member.check);
  }
  const contacts = items.length;
  let directories = 0;
  for (const [region, { name, members }] of shown) {
    for (const group of directoryGroups(members)) {
      // A stable name: the municipality's own directory, or one named after its department, so a later export replaces it.
      const id = registerDirectoryId(region) + (group.label ? `:${hash(group.label).slice(0, 12)}` : '') + (group.part > 1 ? `:p${group.part}` : '');
      // The page most of the group's contacts were verified on; the first by address among equals.
      const pages = new Map();
      for (const member of group.members) pages.set(member.page, (pages.get(member.page) || 0) + 1);
      const page = [...pages].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'))[0][0];
      const roles = [...new Set(group.members.map(member => member.role).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'et'));
      items.push({ id, canonical_item_id: id, itemType: 'resource', municipality_id: region, municipality_name: name, source_type: 'municipal_contact_directory', language: 'et',
        title: `Sotsiaalvaldkonna kontaktid: ${name}${group.label ? `, ${group.label}` : ''}${group.parts > 1 ? ` (${group.part}/${group.parts})` : ''}`,
        // The roles are the register's own words: they let a question about a role find the directory.
        summary: `Omavalitsuse ametlikul lehel kinnitatud sotsiaalvaldkonna töötajad: nimi, amet, telefon ja e-post.${roles.length ? ` Ametid: ${roles.slice(0, ROLES_SHOWN).join(', ')}.` : ''}`,
        officialUrl: page, checked_at: group.members.map(member => member.checked).sort().at(-1), relatedContacts: group.members.map(member => member.id).sort((a, b) => a.localeCompare(b, 'en')) });
      directories++;
    }
  }
  // Catch a registry edit or revocation during preparation, as the mapped export does.
  for (const expected of checks) {
    const row = await readVerifiedMunicipalContact(db, { ...expected, now: now() });
    if (!row || hash(stable(contactContent(row))) !== expected.fingerprint) fail('contact_changed_during_export');
  }
  return { source: { schema_version: REGISTER_EXPORT_SCHEMA, generated_at: now().toISOString(), items },
    counts: { verified_rows: rows.length, exported_contacts: contacts, kept_bound: keptBound, same_person_rows: duplicates, municipalities: shown.length, directories, too_large: tooLarge, skipped } };
}
