import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStaffFromHtml } from '../lib/serviceMap/kovStaffExtract.js';
import { contactPageChecks } from '../lib/admin/rag/contactRegistry/pageCheck.js';
import { automaticProposals, contactPageLinks, contactRowProposal, locationTemplate, newPersonProposals, nextProposalState, reviewedDecision, rowAfterProposal,
  successorPages } from '../lib/admin/rag/contactRegistry/proposals.js';
import { applyContactProposals, readContactProposals, recordContactProposalRead, revertContactProposals } from '../lib/admin/rag/contactRegistry/proposalService.js';

// The proposal layer of the contact register (ADR-073): what the register would have to change to say what the
// official page says. A proposal writes nothing; applying one needs a basis. Fictional values only.
const URL_OLD = 'https://vald.example.invalid/kontaktid';
const URL_NEW = 'https://vald.example.invalid/kontakt';
const card = (name, role, email, phone, extra = '') => `<div class="vp-employee"><div class="vp-employee__name"><p>${name}</p><p class="vp-employee__office">${role}</p></div>
  <div class="vp-employee__contact"><p>${email ? `<a href="mailto:${email}" class="vp-employee__email">${email}</a>` : ''}</p><p>${phone}</p></div><div>${extra}</div></div>`;
const html = (body, heading = 'Sotsiaalosakond') => `<html><body><main><h2>${heading}</h2>${body}</main></body></html>`;
const staff = (body, heading) => extractStaffFromHtml(html(body, heading)).people;
const row = (title, role, phone, email, more = {}) => ({ id: `synthetic-${title}`, type: 'KOV_SOCIAL_CONTACT', title, description: role ? `Roll: ${role}\nOsakond: Sotsiaalosakond` : null,
  municipalityId: 'synthetic-municipality', municipalityName: 'Näidise vald', county: 'Näidise maakond', address: 'Kooli 1, Näidise', normalizedAddress: 'kooli 1 näidise',
  phone, email, website: URL_OLD, sourceUrl: URL_OLD, sourceNamespace: 'LEGACY_KOV_CONTACT', status: 'PUBLISHED', tombstonedAt: null, geocodingStatus: 'MATCHED',
  latitude: 58.1, longitude: 25.1, adsObjectId: null, revision: 3, ...more });
const verifies = (body, entry) => contactPageChecks(Buffer.from(html(body)), [entry]).checks[0].verified;
const mari = card('Mari Maasikas', 'Sotsiaaltööspetsialist', 'mari.maasikas@example.invalid', '5550 0001');
const jaan = card('Jaan Tamm', 'Lastekaitsespetsialist', 'jaan.tamm@example.invalid', '555 0002');

test('a changed phone is proposed from the person\'s own record, and the changed row passes the check', () => {
  const entry = row('Mari Maasikas', 'sotsiaaltööspetsialist', '555 0002', 'mari.maasikas@example.invalid');
  const { state, proposal } = contactRowProposal(entry, staff(mari + jaan));
  assert.equal(state, 'changed');
  assert.deepEqual([proposal.kind, proposal.key, proposal.entryId, proposal.revision, proposal.flags], ['row', 'row|synthetic-Mari Maasikas', entry.id, 3, []]);
  assert.deepEqual(proposal.fields, { phone: { before: '555 0002', after: '5550 0001' } });
  assert.equal(verifies(mari + jaan, entry), false);
  assert.equal(verifies(mari + jaan, rowAfterProposal(entry, proposal)), true);
});

test('a row the page confirms gives no proposal; a number the page adds is left alone', () => {
  const two = card('Mari Maasikas', 'Sotsiaaltööspetsialist', 'mari.maasikas@example.invalid', '5550 0001, 555 0009');
  assert.equal(contactRowProposal(row('Mari Maasikas', 'sotsiaaltööspetsialist', '+372 5550 0001', 'mari.maasikas@example.invalid'), staff(two)).state, 'same');
  assert.equal(contactRowProposal(row('Rein Rohi', 'sotsiaaltööspetsialist', '5550 0008', null), staff(mari)).state, 'not_on_page');
});

test('several numbers and a changed e-mail; nothing in common with the register is for the owner', () => {
  const body = card('Kati Kask', 'Sotsiaaltööspetsialist', 'kati.kask@example.invalid', '555 0003, 5550 0004');
  const moved = contactRowProposal(row('Kati Kask', 'sotsiaaltööspetsialist', '555 0003', 'kati@example.invalid'), staff(body)).proposal;
  assert.deepEqual([moved.fields, moved.flags], [{ email: { before: 'kati@example.invalid', after: 'kati.kask@example.invalid' } }, []]);
  const both = contactRowProposal(row('Kati Kask', 'sotsiaaltööspetsialist', '555 0099', 'kati@example.invalid'), staff(body)).proposal;
  assert.deepEqual([both.fields.phone.after, both.fields.email.after, both.flags], ['555 0003; 5550 0004', 'kati.kask@example.invalid', ['no_channel_in_common']]);
});

test('a channel the page no longer shows is never cleared without the owner', () => {
  const proposal = contactRowProposal(row('Anne Aas', 'sotsiaaltööspetsialist', '555 0005', 'anne.aas@example.invalid'),
    staff(card('Anne Aas', 'Sotsiaaltööspetsialist', 'anne.aas@example.invalid', ''))).proposal;
  assert.deepEqual([proposal.fields, proposal.flags], [{ phone: { before: '555 0005', after: null } }, ['clears_phone']]);
  assert.deepEqual(automaticProposals([proposal], { reads: { [proposal.key]: { signature: proposal.signature, count: 2 } } }).held.map(item => item.reason), ['owner_only']);
});

test('a role the page words differently replaces the Roll line only; a person who left the social field stays hidden', () => {
  const body = card('Epp Eha', 'Lastekaitse peaspetsialist', 'epp.eha@example.invalid', '555 0006') + '<h2>Ehitusosakond</h2>' + card('Kalle Kuusk', 'Ehitusnõunik', 'kalle.kuusk@example.invalid', '555 0007');
  const entry = row('Epp Eha', 'lastekaitse vanemspetsialist', '555 0006', 'epp.eha@example.invalid', { description: 'Roll: lastekaitse vanemspetsialist\nOsakond: Sotsiaalosakond\nVastuvõtt: E 9-12' });
  const proposal = contactRowProposal(entry, staff(body)).proposal;
  assert.deepEqual(proposal.fields, { description: { before: entry.description, after: 'Roll: Lastekaitse peaspetsialist\nOsakond: Sotsiaalosakond\nVastuvõtt: E 9-12' } });
  assert.equal(contactRowProposal(row('Kalle Kuusk', 'sotsiaaltööspetsialist', '555 0007', 'kalle.kuusk@example.invalid'), staff(body)).state, 'left_social_field');
  // A general contact is not a social one to begin with: its role is brought up to date.
  const general = contactRowProposal(row('Kalle Kuusk', 'ehitusspetsialist', '555 0007', 'kalle.kuusk@example.invalid', { type: 'KOV_GENERAL_CONTACT' }), staff(body));
  assert.equal(general.proposal.fields.description.after, 'Roll: Ehitusnõunik\nOsakond: Sotsiaalosakond');
});

test('a person the page marks as away, and two people of one name, give no proposal; one person listed twice does', () => {
  assert.equal(contactRowProposal(row('Leida Lill', 'spetsialist', '555 0010', 'leida.lill@example.invalid'),
    staff(card('Leida Lill', 'Sotsiaaltööspetsialist', 'leida.lill@example.invalid', '555 0011', 'töösuhe peatatud'))).state, 'away');
  const namesakes = card('Tiit Toom', 'Sotsiaaltööspetsialist', 'tiit.toom@example.invalid', '555 0012') + card('Tiit Toom', 'Hooldustöötaja', 'tiit.toom2@example.invalid', '555 0013');
  assert.equal(contactRowProposal(row('Tiit Toom', 'sotsiaaltööspetsialist', '555 0099', 'tiit.toom@example.invalid'), staff(namesakes)).state, 'same_name_twice');
  const twice = card('Tiit Toom', 'Sotsiaaltööspetsialist', 'tiit.toom@example.invalid', '555 0012') + card('Tiit Toom', 'Eestkostespetsialist', 'tiit.toom@example.invalid', '');
  assert.deepEqual(contactRowProposal(row('Tiit Toom', 'sotsiaaltööspetsialist', '555 0099', 'tiit.toom@example.invalid'), staff(twice)).proposal.fields, { phone: { before: '555 0099', after: '555 0012' } });
});

test('a moved page: the candidate that names most of the old page\'s rows; the address moves with the person', () => {
  const rows = [row('Mari Maasikas', 'sotsiaaltööspetsialist', '5550 0001', 'mari.maasikas@example.invalid'), row('Jaan Tamm', 'lastekaitsespetsialist', '555 0099', 'jaan.tamm@example.invalid'),
    row('Rein Rohi', 'sotsiaaltööspetsialist', '555 0008', 'rein.rohi@example.invalid')];
  const ranked = successorPages(rows, [{ url: 'https://vald.example.invalid/uudised', staff: staff(card('Uku Urb', 'Toimetaja', 'uku.urb@example.invalid', '555 0014')) },
    { url: 'https://vald.example.invalid/vald', staff: staff(mari) }, { url: URL_NEW, staff: staff(mari + jaan) }]);
  assert.deepEqual(ranked.map(candidate => [candidate.url, candidate.found, candidate.rows]), [[URL_NEW, 2, 3], ['https://vald.example.invalid/vald', 1, 3]]);
  assert.deepEqual(successorPages(rows, [{ url: URL_NEW, staff: [] }]), []);
  const best = ranked[0];
  const page = { rows: best.rows, found: best.found };
  const same = contactRowProposal(rows[0], best.staff, { pageUrl: URL_NEW, page }).proposal;
  assert.deepEqual([same.fields, same.flags, same.evidence.page], [{ sourceUrl: { before: URL_OLD, after: URL_NEW }, website: { before: URL_OLD, after: URL_NEW } }, [], page]);
  const changed = contactRowProposal(rows[1], best.staff, { pageUrl: URL_NEW, page }).proposal;
  assert.deepEqual([Object.keys(changed.fields).sort(), changed.fields.phone.after], [['phone', 'sourceUrl', 'website'], '555 0002']);
  assert.equal(contactRowProposal(rows[2], best.staff, { pageUrl: URL_NEW, page }).state, 'not_on_page');
  // One name out of several is thin proof that this is the page.
  assert.deepEqual(contactRowProposal(rows[0], best.staff, { pageUrl: URL_NEW, page: { rows: 3, found: 1 } }).proposal.flags, ['weak_page_match']);
});

test('the contact pages a front page links to on its own host', () => {
  // The menu section "vald-uudised-kontakt" has the word in its name; its pages are not contact pages.
  const front = `<nav><a href="/vald-uudised-kontakt/vald/eelarve">Eelarve</a><a href="/vald/ametnikud#sotsiaal">Struktuur</a><a href="/uudised">Uudised</a>
    <a href="https://teine.example.invalid/kontakt">Kontakt</a><a href="mailto:vald@example.invalid">Kontakt</a><a href="/failid/kontaktid.pdf">Kontaktid</a>
    <a href="/kontakt">Kontakt</a><a href="/kontakt">Kontakt</a><a href="/juhtimine/t%C3%B6%C3%B6tajad">Inimesed</a><a href="/vald/inimesed">Vallavalitsuse töötajad</a></nav>`;
  // The page nearest to the front page comes first.
  assert.deepEqual(contactPageLinks(front, 'https://vald.example.invalid/'), ['https://vald.example.invalid/kontakt', 'https://vald.example.invalid/vald/ametnikud',
    'https://vald.example.invalid/juhtimine/t%C3%B6%C3%B6tajad', 'https://vald.example.invalid/vald/inimesed']);
});

test('new people: social-field staff the register does not name, with the place of the page\'s rows', () => {
  const body = mari + jaan + card('Liis Lepp', 'Sekretär', 'sotsiaal@example.invalid', '555 0015') + card('Ott Orav', 'Raamatupidaja', 'ott.orav@example.invalid', '555 0016')
    + card('Siim Saar', 'Hooldustöötaja', '', '') + card('Ülle Õun', 'Eestkostespetsialist', 'ülle.õun@example.invalid', '555 0017') + card('Epp Eha', 'Lastekaitsespetsialist', 'sotsiaal@example.invalid', '');
  const rows = [row('Mari Maasikas', 'sotsiaaltööspetsialist', '5550 0001', 'mari.maasikas@example.invalid'), row('Peeter Paju', 'juht', null, null, { address: 'Kooli 1, Näidise' }),
    row('Kati Kask', 'juht', null, null, { address: 'Pargi 2, Näidise', latitude: 58.2 })];
  const template = locationTemplate(rows);
  assert.equal(template.id, 'synthetic-Mari Maasikas');
  // The register spells a known person without diacritics and surname first.
  const { proposals, skipped } = newPersonProposals(staff(body), { pageUrl: URL_OLD, municipality: 'Näidise vald', knownNames: new Set(['maasikas mari', 'oun ulle']), template });
  assert.deepEqual(proposals.map(proposal => [proposal.name, proposal.flags]), [['Jaan Tamm', []], ['Liis Lepp', ['social_by_heading', 'email_shared_on_page']], ['Epp Eha', ['email_shared_on_page']]]);
  assert.deepEqual(skipped, { same_name_twice: 0, no_channel: 1, away: 0, other_field: 0, no_location: 0 });
  // A new person who answers a phone the register holds under another name took over a desk, or changed the name.
  assert.deepEqual(newPersonProposals(staff(jaan), { pageUrl: URL_OLD, municipality: 'Näidise vald', knownChannels: new Set(['5550002']), template }).proposals[0].flags, ['channel_of_another_row']);
  const { create, key, evidence } = proposals[0];
  assert.match(create.id, /^kov-contact-page-[a-f0-9]{24}$/u);
  assert.equal(key, `person|${create.id.slice('kov-contact-page-'.length)}`);
  assert.deepEqual({ ...create, id: null }, { id: null, type: 'KOV_SOCIAL_CONTACT', title: 'Jaan Tamm', description: 'Roll: Lastekaitsespetsialist\nOsakond: Sotsiaalosakond',
    municipalityId: 'synthetic-municipality', municipalityName: 'Näidise vald', county: 'Näidise maakond', address: 'Kooli 1, Näidise', normalizedAddress: 'kooli 1 näidise',
    latitude: 58.1, longitude: 25.1, geocodingStatus: 'MATCHED', adsObjectId: null, phone: '555 0002', email: 'jaan.tamm@example.invalid', website: URL_OLD, sourceUrl: URL_OLD,
    sourceNamespace: 'OFFICIAL_KOV_CONTACT', status: 'PUBLISHED' });
  assert.equal(evidence.locationFromEntryId, template.id);
  assert.equal(verifies(body, { ...create, revision: 1 }), true);
  // A page without a register row that has a place gives nobody a place.
  assert.deepEqual(newPersonProposals(staff(jaan), { pageUrl: URL_OLD, municipality: 'Näidise vald', template: locationTemplate([]) }).skipped.no_location, 1);
  assert.equal(newPersonProposals(staff(body), { pageUrl: URL_OLD, municipality: 'Teine vald', template }).proposals[0].key === key, false);
});

test('a department of several fields does not make its culture adviser a social worker; a role that is no job title waits for the owner', () => {
  const context = { pageUrl: URL_OLD, municipality: 'Näidise vald', template: row('Mari Maasikas', 'juht', null, null) };
  const mixed = newPersonProposals(staff(card('Mall Mets', 'Kultuurinõunik', 'mall.mets@example.invalid', '555 0023') + card('Reet Rebane', 'Sotsiaaltööspetsialist', 'reet.rebane@example.invalid', '555 0024')
    + card('Uku Urb', 'Spetsialist', 'uku.urb@example.invalid', '555 0026'), 'Haridus-, kultuuri- ja sotsiaalosakond'), context);
  assert.deepEqual([mixed.proposals.map(proposal => proposal.name), mixed.skipped.other_field], [['Reet Rebane'], 2]);
  // Under a social department a teacher of another field is left out too; the place name next to a name is no role.
  const social = newPersonProposals(staff(card('Kalle Kuusk', 'Haridusspetsialist', 'kalle.kuusk@example.invalid', '555 0027') + card('Tiina Teder', 'Veriora', 'tiina.teder@example.invalid', '555 0025')), context);
  assert.deepEqual([social.proposals.map(proposal => [proposal.name, proposal.flags]), social.skipped.other_field], [[['Tiina Teder', ['role_unusual', 'social_by_heading']]], 1]);
  // A text that is no job title never replaces a role that is one (05.10.2026: "Veriora" replaced "hooldustöötaja");
  // the other fields of the row are still proposed.
  const veriora = staff(card('Tiina Teder', 'Veriora', 'tiina.teder@example.invalid', '555 0025'));
  assert.deepEqual(contactRowProposal(row('Tiina Teder', 'hooldustöötaja', '555 0025', 'tiina.teder@example.invalid'), veriora), { state: 'role_kept' });
  const phoneOnly = contactRowProposal(row('Tiina Teder', 'hooldustöötaja', '555 0099', 'tiina.teder@example.invalid'), veriora).proposal;
  assert.deepEqual([Object.keys(phoneOnly.fields), phoneOnly.flags], [['phone'], []]);
  // The same where the register's own role is not a job title: one wording of a service does not replace another.
  assert.equal(contactRowProposal(row('Tiina Teder', 'teenuse kontakt', '555 0025', 'tiina.teder@example.invalid'), veriora).state, 'role_kept');
  // A new person's role that is no job title still waits for the owner.
  const unusual = newPersonProposals(veriora, context).proposals[0];
  assert.deepEqual(automaticProposals([unusual], { reads: { [unusual.key]: { signature: unusual.signature, count: 2 } } }).held.map(item => item.reason), ['owner_only']);
  // A row without a role takes the page's job title and keeps its department; a text that is no title is not taken.
  const bare = row('Tiina Teder', null, '555 0025', 'tiina.teder@example.invalid', { description: 'Osakond: Sotsiaalosakond' });
  const added = contactRowProposal(bare, staff(card('Tiina Teder', 'Hooldustöötaja Lasva', 'tiina.teder@example.invalid', '555 0025'))).proposal;
  assert.deepEqual([added.fields, added.flags], [{ description: { before: 'Osakond: Sotsiaalosakond', after: 'Roll: Hooldustöötaja Lasva\nOsakond: Sotsiaalosakond' } }, []]);
  assert.equal(contactRowProposal(bare, veriora).state, 'same');
  // A job title replaces a text that is none without a flag.
  const titled = contactRowProposal(row('Tiina Teder', 'Veriora', '555 0025', 'tiina.teder@example.invalid'), staff(card('Tiina Teder', 'Hooldustöötaja', 'tiina.teder@example.invalid', '555 0025'))).proposal;
  assert.deepEqual([titled.fields.description.after, titled.flags], ['Roll: Hooldustöötaja\nOsakond: Sotsiaalosakond', []]);
});

test('the two-read rule: the same result at least five days later counts, a changed or missing one starts over', () => {
  const entry = row('Mari Maasikas', 'sotsiaaltööspetsialist', '555 0002', 'mari.maasikas@example.invalid');
  const first = contactRowProposal(entry, staff(mari)).proposal;
  const other = contactRowProposal(entry, staff(card('Mari Maasikas', 'Sotsiaaltööspetsialist', 'mari.maasikas@example.invalid', '5550 0020'))).proposal;
  assert.notEqual(first.signature, other.signature);
  assert.notEqual(first.signature, contactRowProposal({ ...entry, revision: 4 }, staff(mari)).proposal.signature);
  const day = n => new Date(Date.UTC(2026, 9, 4 + n, 5, 30));
  let state = nextProposalState({}, [first], { readAt: day(0) });
  assert.deepEqual(state.reads[first.key], { signature: first.signature, count: 1, firstReadAt: day(0).toISOString(), countedAt: day(0).toISOString() });
  assert.deepEqual(automaticProposals([first], state).held.map(item => item.reason), ['one_read']);
  // The same morning again is the same read.
  state = nextProposalState(state, [first], { readAt: new Date(day(0).getTime() + 3_600_000) });
  assert.equal(state.reads[first.key].count, 1);
  state = nextProposalState(state, [first], { readAt: day(7) });
  assert.deepEqual([state.reads[first.key].count, state.reads[first.key].firstReadAt, state.reads[first.key].countedAt], [2, day(0).toISOString(), day(7).toISOString()]);
  assert.deepEqual(automaticProposals([first], state), { apply: [first], held: [] });
  assert.equal(nextProposalState(state, [other], { readAt: day(14) }).reads[other.key].count, 1);
  assert.deepEqual(nextProposalState(state, [], { readAt: day(14) }).reads, {});
  // What the owner turned down stays turned down, however many reads repeat it.
  const rejected = { ...state, rejected: { [first.signature]: { reason: 'owner' } } };
  assert.deepEqual(automaticProposals([first], rejected).held.map(item => item.reason), ['rejected']);
  assert.deepEqual(nextProposalState(rejected, [first], { readAt: day(14) }).rejected, rejected.rejected);
});

test('many changes at once are not applied without the owner', () => {
  const proposals = Array.from({ length: 11 }, (_, index) => ({ kind: 'row', key: `row|${index}`, signature: `s${index}`, pageUrl: URL_OLD, flags: [] }));
  const elsewhere = { kind: 'row', key: 'row|x', signature: 'sx', pageUrl: URL_NEW, flags: [] };
  const reads = Object.fromEntries([...proposals, elsewhere].map(proposal => [proposal.key, { signature: proposal.signature, count: 2 }]));
  const { apply, held } = automaticProposals([...proposals, elsewhere], { reads });
  assert.deepEqual([apply, new Set(held.map(item => item.reason)), held.length], [[elsewhere], new Set(['too_many_on_page']), 11]);
  const many = Array.from({ length: 41 }, (_, index) => ({ kind: 'row', key: `row|${index}`, signature: `s${index}`, pageUrl: `${URL_OLD}/${index}`, flags: [] }));
  const all = automaticProposals(many, { reads: Object.fromEntries(many.map(proposal => [proposal.key, { signature: proposal.signature, count: 2 }])) });
  assert.deepEqual([all.apply.length, all.held.every(item => item.reason === 'too_many_in_run')], [0, true]);
});

test('the answer of the owner by numbers: unflagged proposals unless excepted, flagged ones only when named, held ones wait', () => {
  const reviewed = [{ no: 1, signature: 'a', flags: [] }, { no: 2, signature: 'b', flags: ['channel_of_another_row'] }, { no: 3, signature: 'c', flags: [] }, { no: 4, signature: 'd', flags: ['social_by_heading'] },
    { no: 5, signature: 'e', flags: ['clears_phone'] }, { no: 6, signature: 'f', flags: [] }];
  assert.deepEqual(reviewedDecision(reviewed), { approve: ['a', 'b', 'c', 'f'], hold: [], reject: ['d', 'e'] });
  assert.deepEqual(reviewedDecision(reviewed, { also: ['4'], except: [3], hold: [6, 5] }), { approve: ['a', 'b', 'd'], hold: ['e', 'f'], reject: ['c'] });
  // A mistyped number stops the run instead of quietly approving something else.
  assert.throws(() => reviewedDecision(reviewed, { except: [7] }), /no proposal 7/u);
});

// A stand-in for the database: the register rows and the audit log in memory, with the filters the layer uses.
function fakeDb(rows, audits = []) {
  const matches = (record, where = {}) => Object.entries(where).every(([field, want]) => {
    if (field === 'OR') return want.some(part => matches(record, part));
    if (want && typeof want === 'object' && !(want instanceof Date)) { if ('in' in want) return want.in.includes(record[field]); throw new Error(`unsupported filter on ${field}`); }
    return (record[field] ?? null) === want;
  });
  const log = data => audits.push({ id: `audit-${audits.length + 1}`, resourceId: null, ...structuredClone(data) });
  const db = {
    serviceMapEntry: {
      findMany: async ({ where } = {}) => rows.filter(record => matches(record, where)).map(record => ({ ...record })),
      updateMany: async ({ where, data }) => {
        const hit = rows.filter(record => matches(record, where));
        for (const record of hit) for (const [field, value] of Object.entries(data)) record[field] = value?.increment ? record[field] + value.increment : value;
        return { count: hit.length };
      },
      create: async ({ data }) => { assert.equal(rows.some(record => record.id === data.id), false); rows.push({ revision: 1, tombstonedAt: null, ...data }); }
    },
    dataAuditLog: {
      findFirst: async ({ where }) => audits.findLast(record => matches(record, where)) || null,
      findMany: async ({ where }) => audits.filter(record => matches(record, where)),
      create: async ({ data }) => { log(data); },
      createMany: async ({ data }) => { data.forEach(log); }
    },
    $executeRaw: async () => 1,
    $transaction: async run => run(db)
  };
  return db;
}

test('reading the pages: confirmed rows give nothing, a moved page is found from the front page, nothing is written', async () => {
  const rows = [row('Mari Maasikas', 'sotsiaaltööspetsialist', '5550 0001', 'mari.maasikas@example.invalid'), row('Jaan Tamm', 'lastekaitsespetsialist', '555 0099', 'jaan.tamm@example.invalid'),
    row('Rein Rohi', 'sotsiaaltööspetsialist', '555 0008', 'rein.rohi@example.invalid'),
    ...[['Anne Aas', 'sotsiaaltööspetsialist', '555 0005', 'anne.aas@example.invalid'], ['Ott Orav', 'hooldustöötaja', '555 0016', null], ['Siim Saar', 'eestkostespetsialist', '555 0021', null]]
      .map(([name, role, phone, email]) => row(name, role, phone, email, { sourceUrl: 'https://linn.example.invalid/vana', website: 'https://linn.example.invalid/vana', municipalityName: 'Näidise linn' })),
    row('Kati Kask', 'sotsiaaltööspetsialist', '555 0003', 'kati.kask@example.invalid', { sourceUrl: 'https://kinni.example.invalid/kontakt', municipalityName: 'Kinnine vald' }),
    row('Hidden Person', 'hooldustöötaja', null, null, { title: 'Liis Lepp', id: 'synthetic-hidden', status: 'HIDDEN' })];
  const before = structuredClone(rows);
  const site = { [URL_OLD]: html(mari + jaan + card('Liis Lepp', 'Hooldustöötaja', 'liis.lepp@example.invalid', '555 0015') + card('Epp Eha', 'Lastekaitsespetsialist', 'epp.eha@example.invalid', '555 0018')),
    // The city's old host answers with the pages of the new one.
    'https://uus-linn.example.invalid/': '<a href="/hoolekanne/tootajad">Hoolekande töötajad</a>',
    'https://uus-linn.example.invalid/kontakt': html(card('Anne Aas', 'Sotsiaaltööspetsialist', 'anne.aas@example.invalid', '555 0005') + card('Siim Saar', 'Eestkostespetsialist', '', '555 0021')
      + card('Epp Eha', 'Eestkostespetsialist', 'epp.eha@example.invalid', '555 0019')),
    'https://uus-linn.example.invalid/hoolekanne/tootajad': html(card('Ott Orav', 'Hooldustöötaja', '', '555 0016') + card('Uku Urb', 'Hooldustöötaja', '', '555 0022')) };
  const fetchPage = async url => {
    const finalUrl = url.replace('//linn.example.invalid/', '//uus-linn.example.invalid/');
    return site[finalUrl] ? { ok: true, status: 200, body: Buffer.from(site[finalUrl]), finalUrl } : { ok: false, status: url.includes('kinni') ? 403 : 404, error: 'http_error' };
  };
  const db = fakeDb(rows);
  const result = await readContactProposals({ prisma: db, fetchPage, now: new Date('2026-10-04T05:30:00Z') });
  assert.deepEqual(rows, before);
  assert.deepEqual(result.proposals.map(proposal => [proposal.municipality, proposal.kind, proposal.name, Object.keys(proposal.fields || {}).sort(), proposal.flags]), [
    // New people come from the successor that names most rows (Uku Urb of the other one is not proposed); the row
    // only the other successor names moves there, and one name is thin proof of a page.
    ['Näidise linn', 'person', 'Epp Eha', [], []], ['Näidise linn', 'row', 'Anne Aas', ['sourceUrl', 'website'], []],
    ['Näidise linn', 'row', 'Ott Orav', ['sourceUrl', 'website'], ['weak_page_match']], ['Näidise linn', 'row', 'Siim Saar', ['sourceUrl', 'website'], []],
    // The hidden row keeps Liis Lepp out; Epp Eha of another municipality is another person.
    ['Näidise vald', 'person', 'Epp Eha', [], []], ['Näidise vald', 'row', 'Jaan Tamm', ['phone'], []]]);
  // The proposed address is the one the candidate ends up at after redirects.
  assert.equal(result.proposals.find(proposal => proposal.name === 'Ott Orav').fields.sourceUrl.after, 'https://uus-linn.example.invalid/hoolekanne/tootajad');
  assert.deepEqual(result.pages.map(page => [page.url, page.state, page.movedTo || page.status, page.tally]), [
    ['https://kinni.example.invalid/kontakt', 'unreachable', 403, {}],
    ['https://linn.example.invalid/vana', 'moved', ['https://uus-linn.example.invalid/kontakt', 'https://uus-linn.example.invalid/hoolekanne/tootajad'], { moved: 3 }],
    [URL_OLD, 'read', 200, { confirmed: 1, changed: 1, not_on_page: 1 }]]);
  assert.deepEqual({ ...result.counts }, { registerRows: 7, pages: 3, pagesRead: 1, pagesMoved: 1, pagesUnreachable: 1, rowsOnUnreachablePages: 1, confirmed: 1, movedRows: 3, changedRows: 1,
    rewordedRoles: 0, notOnPage: 1, away: 0, leftSocialField: 0, roleKept: 0, sameNameTwice: 0, unexplained: 0, newPeople: 2, proposals: 6, ownerOnly: 1 });
  // The operator's candidate is used instead of the front page.
  const named = await readContactProposals({ prisma: db, fetchPage, candidatePages: { 'https://linn.example.invalid/vana': ['https://linn.example.invalid/puudub'] } });
  assert.equal(named.pages.find(page => page.url === 'https://linn.example.invalid/vana').state, 'unreachable');
});

test('applying: a guarded write with an audit record, a row changed meanwhile is skipped, and the batch can be taken back', async () => {
  const rows = [row('Mari Maasikas', 'sotsiaaltööspetsialist', '555 0002', 'mari.maasikas@example.invalid', { checkedAt: new Date('2026-09-27T05:30:00Z') }),
    row('Kati Kask', 'sotsiaaltööspetsialist', '555 0099', 'kati.kask@example.invalid')];
  const body = mari + jaan + card('Kati Kask', 'Sotsiaaltööspetsialist', 'kati.kask@example.invalid', '555 0003');
  const audits = [];
  const db = fakeDb(rows, audits);
  const proposals = [contactRowProposal(rows[0], staff(body)).proposal, contactRowProposal(rows[1], staff(body)).proposal,
    ...newPersonProposals(staff(body), { pageUrl: URL_OLD, municipality: 'Näidise vald', knownNames: new Set(['maasikas mari', 'kask kati']), template: locationTemplate(rows) }).proposals];
  await assert.rejects(applyContactProposals({ prisma: db, proposals }), /basis/u);
  // Somebody corrected the second row after the read.
  rows[1].phone = '555 0003';
  rows[1].revision = 4;
  const now = new Date('2026-10-04T12:00:00Z');
  const applied = await applyContactProposals({ prisma: db, proposals, basis: 'owner_approval', approvedBy: 'owner', batchId: 'batch-1', now });
  assert.deepEqual(applied, { batchId: 'batch-1', updated: 1, created: 1, skipped: [{ key: proposals[1].key, reason: 'row_changed' }] });
  assert.deepEqual([rows[0].phone, rows[0].revision, rows[0].checkedAt, rows[1].phone, rows[1].revision], ['5550 0001', 4, null, '555 0003', 4]);
  const added = rows[2];
  assert.deepEqual([added.title, added.revision, added.checkedAt, added.sourceNamespace, added.sourceGeneration, added.lastSeenAt], ['Jaan Tamm', 1, null, 'OFFICIAL_KOV_CONTACT', 'contact-proposal:batch-1', now]);
  assert.deepEqual(audits.map(record => [record.action, record.resourceId]), [['SERVICE_MAP_CONTACT_PROPOSAL_APPLIED', rows[0].id], ['SERVICE_MAP_CONTACT_PROPOSAL_APPLIED', added.id],
    ['SERVICE_MAP_CONTACT_PROPOSAL_BATCH', 'batch-1']]);
  assert.deepEqual([audits[0].meta.fields, audits[0].meta.revisionBefore, audits[0].meta.revisionAfter, audits[0].meta.basis, audits[0].meta.approvedBy, audits[0].meta.officialPage],
    [{ phone: { before: '555 0002', after: '5550 0001' } }, 3, 4, 'owner_approval', 'owner', URL_OLD]);
  assert.equal(audits[1].meta.created.title, 'Jaan Tamm');
  assert.deepEqual([audits[2].meta.updated, audits[2].meta.created, audits[2].meta.skipped], [1, 1, 1]);
  // Applying the same proposals again writes nothing: the row moved on, the person is in the register.
  const again = await applyContactProposals({ prisma: db, proposals, basis: 'owner_approval', batchId: 'batch-2' });
  assert.deepEqual([again.updated, again.created, again.skipped.map(item => item.reason)], [0, 0, ['row_changed', 'row_changed', 'already_in_register']]);

  // The weekly check confirmed the added row meanwhile; that is not a change of the row.
  added.checkedAt = new Date('2026-10-11T05:30:00Z');
  const reverted = await revertContactProposals({ prisma: db, batchId: 'batch-1', now: new Date('2026-10-12T08:00:00Z') });
  assert.deepEqual(reverted, { batchId: 'batch-1', restored: 1, hidden: 1, skipped: [] });
  assert.deepEqual([rows[0].phone, rows[0].revision, rows[0].checkedAt, added.status, added.revision, rows.length], ['555 0002', 5, null, 'HIDDEN', 2, 3]);
  const state = audits.at(-1);
  assert.deepEqual([state.action, Object.keys(state.meta.rejected).sort()], ['SERVICE_MAP_CONTACT_PROPOSAL_READ', [proposals[0].signature, proposals[2].signature].sort()]);
  assert.deepEqual(await revertContactProposals({ prisma: db, batchId: 'batch-1' }), { batchId: 'batch-1', restored: 0, hidden: 0, skipped: [] });
  // The turned-down proposals are carried by the next read and never applied by the two-read rule.
  const next = await recordContactProposalRead({ prisma: db, proposals: [proposals[0]], readAt: new Date('2026-10-18T05:30:00Z') });
  assert.equal(automaticProposals([proposals[0]], next).held[0].reason, 'rejected');
});
