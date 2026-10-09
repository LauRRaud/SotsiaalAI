// KODUTEENUS K1 — puhtad reeglid ilma andmebaasita: lipp, skoop, sisendi kontroll,
// „hiljem kirjutatud" ja „pärast eilset". Ligipääsupiiri tõend on eraldi failis
// tests/home-care.integration.test.mjs (päris andmebaas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinatorScope, isCoordinatorFor, visibleClientsWhere, personName } from '../lib/homeCare/access.js';
import { chronologyContentHash } from '../lib/homeCare/chronology.js';
import {
  CHRONOLOGY_DOCUMENT_CSP,
  CHRONOLOGY_DOCUMENT_HEADERS,
  escapeHtml,
  renderChronologyHtml
} from '../lib/homeCare/chronologyDocument.js';
import { HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { serializeEntry } from '../lib/homeCare/entries.js';
import { assertHomeCareEnabled, isHomeCareEnabled } from '../lib/homeCare/flags.js';
import { startOfYesterday } from '../lib/homeCare/overview.js';
import { entrySearchText, entrySearchWhere, searchWords } from '../lib/homeCare/search.js';
import {
  entryRequestHash,
  normalizeCardLineInput,
  normalizeClientInput,
  normalizeEntryInput,
  normalizeIsoDay,
  normalizeRequestId,
  normalizeSearchQuery
} from '../lib/homeCare/validation.js';
import { CAPABILITY_REQUIRED_MODULES, CAPABILITY_TEMPLATES, ORGANIZATION_MODULE_KEYS } from '../lib/org/constants.js';

const NOW = new Date('2026-10-09T08:00:00Z');
const units = [
  { id: 'unit_root', parentUnitId: null },
  { id: 'unit_child', parentUnitId: 'unit_root' },
  { id: 'unit_other', parentUnitId: null }
];
function context(capabilities, { membershipId = 'mem_1' } = {}) {
  return {
    kind: 'organization',
    userId: 'user_1',
    organization: { id: 'org_1', timezone: 'Europe/Tallinn' },
    membership: membershipId ? { id: membershipId } : null,
    capabilities,
    activeModules: ['HOME_CARE'],
    _unitTree: units,
    writable: true
  };
}
const orgGrant = { capability: 'HOME_CARE_COORDINATOR', scopeType: 'ORGANIZATION', scopeUnitId: null };
const unitGrant = { capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: 'unit_root' };

function rejects(fn, messageKey) {
  assert.throws(fn, (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.messageKey, messageKey);
    return true;
  });
}

test('lipp on vaikimisi väljas ja sõltub organisatsiooni tööruumi lipust', () => {
  assert.equal(isHomeCareEnabled({}), false);
  assert.equal(isHomeCareEnabled({ HOME_CARE_ENABLED: '1' }), false);
  assert.equal(isHomeCareEnabled({ ORG_WORKSPACE_ENABLED: '1' }), false);
  assert.equal(isHomeCareEnabled({ ORG_WORKSPACE_ENABLED: '1', HOME_CARE_ENABLED: 'true' }), true);
  assert.equal(isHomeCareEnabled({ ORG_WORKSPACE_ENABLED: '1', HOME_CARE_ENABLED: 'jah' }), false);
  assert.throws(() => assertHomeCareEnabled({ ORG_WORKSPACE_ENABLED: '1' }), (error) => error.status === 404);
});

test('moodul ja hooldusjuhi luba on org-konstantides seotud', () => {
  assert.ok(ORGANIZATION_MODULE_KEYS.includes('HOME_CARE'));
  assert.deepEqual(CAPABILITY_REQUIRED_MODULES.HOME_CARE_COORDINATOR, ['HOME_CARE']);
  assert.deepEqual(CAPABILITY_TEMPLATES.HOME_CARE_COORDINATOR.capabilities, ['HOME_CARE_COORDINATOR']);
});

test('hooldusjuhi skoop: kogu asutus, üksuse alampuu või mitte midagi', () => {
  assert.deepEqual(coordinatorScope(context([orgGrant])), { wholeOrg: true, unitIds: [] });
  assert.deepEqual(coordinatorScope(context([unitGrant])), { wholeOrg: false, unitIds: ['unit_root', 'unit_child'] });
  assert.equal(coordinatorScope(context([])), null);
  /* Teine capability ei tee hooldusjuhiks: UNIT_LEAD ei anna sisuõigust. */
  assert.equal(coordinatorScope(context([{ capability: 'UNIT_LEAD', scopeType: 'ORGANIZATION', scopeUnitId: null }])), null);

  assert.equal(isCoordinatorFor(context([unitGrant]), 'unit_child'), true);
  assert.equal(isCoordinatorFor(context([unitGrant]), 'unit_other'), false);
  /* Üksuseta klient kuulub kogu asutuse hooldusjuhile, mitte üksuse omale. */
  assert.equal(isCoordinatorFor(context([unitGrant]), null), false);
  assert.equal(isCoordinatorFor(context([orgGrant]), null), true);
});

test('loendi skoop filtreerib alati organisatsiooni järgi', () => {
  assert.deepEqual(visibleClientsWhere(context([orgGrant])), { organizationId: 'org_1' });
  assert.deepEqual(visibleClientsWhere(context([])), {
    organizationId: 'org_1',
    OR: [{ team: { some: { membershipId: 'mem_1', endedAt: null } } }]
  });
  assert.deepEqual(visibleClientsWhere(context([unitGrant])), {
    organizationId: 'org_1',
    OR: [
      { unitId: { in: ['unit_root', 'unit_child'] } },
      { team: { some: { membershipId: 'mem_1', endedAt: null } } }
    ]
  });
  assert.equal(visibleClientsWhere(context([], { membershipId: null })), null);
});

test('kliendi sisend: nimi kohustuslik, tühikud korrastatud, piirid', () => {
  assert.deepEqual(normalizeClientInput({ displayName: '  Linda \n  Tamm ', address: '' }), {
    displayName: 'Linda Tamm',
    address: null
  });
  rejects(() => normalizeClientInput({ displayName: '   ' }), 'home_care.errors.name_required');
  rejects(() => normalizeClientInput({ displayName: 'x'.repeat(HOME_CARE_LIMITS.DISPLAY_NAME_MAX + 1) }), 'home_care.errors.text_too_long');
  /* Osaline muutmine ei nõua nime ega puuduta välju, mida ei saadetud. */
  assert.deepEqual(normalizeClientInput({ contactPhone: ' 555 0001 ' }, { partial: true }), { contactPhone: '555 0001' });
  rejects(() => normalizeClientInput({ displayName: 'A', unitId: 'x' }), 'home_care.errors.invalid_unit');
});

test('kirje sisend: vaikeväärtused, erijuhtumi väljad ainult erijuhtumil', () => {
  const note = normalizeEntryInput({ text: ' Tõin toidu ', incidentType: 'FALL', incidentAssessment: 'ei kuulu siia' }, { now: NOW });
  assert.equal(note.kind, 'NOTE');
  assert.equal(note.contactMode, 'VISIT');
  assert.equal(note.text, 'Tõin toidu');
  assert.equal(note.occurredAt.toISOString(), NOW.toISOString());
  assert.equal(note.incidentType, null);
  assert.equal(note.incidentAssessment, null);

  rejects(() => normalizeEntryInput({ text: 'x', kind: 'MUU' }, { now: NOW }), 'home_care.errors.invalid_entry_kind');
  rejects(() => normalizeEntryInput({ text: 'x', occurredAt: 'eile' }, { now: NOW }), 'home_care.errors.invalid_occurred_at');
  rejects(() => normalizeEntryInput({ text: 'x', occurredAt: '2026-10-09T08:06:00Z' }, { now: NOW }), 'home_care.errors.occurred_at_in_future');
  /* Kellade väike erinevus on lubatud. */
  assert.ok(normalizeEntryInput({ text: 'x', occurredAt: '2026-10-09T08:04:00Z' }, { now: NOW }));
  rejects(() => normalizeEntryInput({ text: 'x'.repeat(HOME_CARE_LIMITS.ENTRY_TEXT_MAX + 1) }, { now: NOW }), 'home_care.errors.text_too_long');
  rejects(() => normalizeEntryInput({ kind: 'INCIDENT', text: 'x', incidentType: 'FALL', incidentActions: 'jah' }, { now: NOW }), 'home_care.errors.invalid_incident_actions');
});

test('kordussaatmise räsi: sama sisu annab sama räsi, muutus teise', () => {
  const a = normalizeEntryInput({ text: 'Tõin toidu', occurredAt: '2026-10-09T07:00:00Z' }, { now: NOW });
  const b = normalizeEntryInput({ text: 'Tõin toidu  ', occurredAt: '2026-10-09T07:00:00.000Z' }, { now: new Date('2026-10-09T09:00:00Z') });
  const c = normalizeEntryInput({ text: 'Tõin toidu', occurredAt: '2026-10-09T07:00:00Z', kind: 'HANDOVER' }, { now: NOW });
  assert.equal(entryRequestHash('client_1', a), entryRequestHash('client_1', b));
  assert.notEqual(entryRequestHash('client_1', a), entryRequestHash('client_1', c));
  assert.notEqual(entryRequestHash('client_1', a), entryRequestHash('client_2', a));
});

test('võti, otsing, kaardirida ja kalendripäev', () => {
  assert.equal(normalizeRequestId(undefined), null);
  assert.equal(normalizeRequestId('hc_0123456789abcdef'), 'hc_0123456789abcdef');
  rejects(() => normalizeRequestId('lühike'), 'home_care.errors.invalid_request_id');
  rejects(() => normalizeRequestId('tühik sees 12345'), 'home_care.errors.invalid_request_id');

  assert.equal(normalizeSearchQuery('  linda   t '), 'linda t');
  rejects(() => normalizeSearchQuery('l'), 'home_care.errors.search_too_short');

  assert.deepEqual(normalizeCardLineInput({ kind: 'access', text: ' Võti  naabril ' }), { kind: 'ACCESS', text: 'Võti naabril' });
  rejects(() => normalizeCardLineInput({ kind: 'ACCESS', text: '' }), 'home_care.errors.card_text_required');

  assert.deepEqual(normalizeIsoDay('2026-10-09'), { year: 2026, month: 10, day: 9 });
  assert.equal(normalizeIsoDay(''), null);
  rejects(() => normalizeIsoDay('2026-02-30'), 'home_care.errors.invalid_date');
  rejects(() => normalizeIsoDay('9.10.2026'), 'home_care.errors.invalid_date');
});

test('„hiljem kirjutatud" arvutatakse serveri salvestusajast; seadme väide märki ära ei võta', () => {
  const base = {
    id: 'e1', clientId: 'c1', kind: 'NOTE', contactMode: 'VISIT', text: 'x', authorName: 'Anu',
    authorMembershipId: 'mem_1', revision: 1, retractedAt: null, _count: { reads: 0 }
  };
  const onTime = serializeEntry({ ...base, occurredAt: new Date('2026-10-09T07:00:00Z'), createdAt: new Date('2026-10-09T07:30:00Z') });
  assert.equal(onTime.writtenLater, false);
  const late = serializeEntry({ ...base, occurredAt: new Date('2026-10-08T17:00:00Z'), createdAt: new Date('2026-10-09T07:30:00Z') });
  assert.equal(late.writtenLater, true);
  /* Seadme kirjutamisaeg on seadme väide. Kui server sai kirje kuus tundi
     pärast sündmust, on see hiljem kirjutatud, ükskõik mida seade ütleb:
     muidu saaks tagantjärele kirje jätta märgita. */
  const claimed = serializeEntry({
    ...base,
    occurredAt: new Date('2026-10-09T07:00:00Z'),
    deviceCreatedAt: new Date('2026-10-09T07:10:00Z'),
    createdAt: new Date('2026-10-09T13:00:00Z')
  });
  assert.equal(claimed.writtenLater, true);

  assert.equal(serializeEntry({ ...base, occurredAt: NOW, createdAt: NOW }, { viewerMembershipId: 'mem_1' }).isMine, true);
  assert.equal(serializeEntry({ ...base, occurredAt: NOW, createdAt: NOW }, { viewerMembershipId: 'mem_2' }).isMine, false);
  const retracted = serializeEntry({ ...base, occurredAt: NOW, createdAt: NOW, retractedAt: NOW, revision: 2 });
  assert.equal(retracted.text, null);
  assert.equal(retracted.corrected, false);
});

test('„pärast eilset" on asutuse kalendripäev, ka kellakeeramise ööl', () => {
  assert.equal(startOfYesterday(NOW, 'Europe/Tallinn').toISOString(), '2026-10-07T21:00:00.000Z');
  /* 25.10.2026 läheb Eesti talveajale: eilne päev algab veel suveaja järgi. */
  assert.equal(startOfYesterday(new Date('2026-10-26T08:00:00Z'), 'Europe/Tallinn').toISOString(), '2026-10-24T21:00:00.000Z');
  assert.equal(startOfYesterday(new Date('2026-10-27T08:00:00Z'), 'Europe/Tallinn').toISOString(), '2026-10-25T22:00:00.000Z');
});

test('töötaja nimi: profiil, muidu ametinimetus, muidu tühi', () => {
  assert.equal(personName({ user: { profile: { firstName: 'Anu', lastName: 'Hooldaja' } }, jobTitle: 'hooldaja' }), 'Anu Hooldaja');
  assert.equal(personName({ user: null, jobTitle: 'Hooldustöötaja' }), 'Hooldustöötaja');
  assert.equal(personName(null), '');
});

test('kutsemallid: hooldusjuhi malli annab ainult omanik ja ainult aktiivse mooduliga', async () => {
  const { OWNER_ONLY_INVITE_TEMPLATES, isTemplateOffered } = await import('../lib/org/constants.js');
  assert.ok(OWNER_ONLY_INVITE_TEMPLATES.includes('HOME_CARE_COORDINATOR'));
  assert.ok(OWNER_ONLY_INVITE_TEMPLATES.includes('ORG_OWNER'));
  assert.equal(isTemplateOffered('HOME_CARE_COORDINATOR', []), false);
  assert.equal(isTemplateOffered('HOME_CARE_COORDINATOR', ['HOME_CARE']), true);
  /* Varasemate mallide nähtavus ei sõltu moodulitest (ka mitte „Üksuse juht",
     mille üks õigus nõuab vastuvõtu moodulit). */
  for (const key of ['ORG_OWNER', 'MEMBER_ADMIN', 'UNIT_LEAD', 'INBOX_COORDINATOR', 'MEMBER']) {
    assert.equal(isTemplateOffered(key, []), true, key);
  }
  assert.equal(isTemplateOffered('OLEMATU', ['HOME_CARE']), false);
});

test('kordussaatmise räsi: serveri pandud aeg ei muuda räsi, päringu oma muudab', () => {
  /* Aeg saatmata: server paneb `now`; korduskatsel on `now` teine, räsi sama. */
  const first = normalizeEntryInput({ text: 'Ajata' }, { now: NOW });
  const again = normalizeEntryInput({ text: 'Ajata' }, { now: new Date('2026-10-09T08:01:00Z') });
  assert.notEqual(first.occurredAt.toISOString(), again.occurredAt.toISOString());
  assert.equal(entryRequestHash('c1', first), entryRequestHash('c1', again));
  /* Sama kehtib tehtud sammu kellaaja kohta. */
  const stepA = normalizeEntryInput({ kind: 'INCIDENT', incidentType: 'FALL', text: 'x', incidentActions: [{ code: 'CALLED_112' }] }, { now: NOW });
  const stepB = normalizeEntryInput(
    { kind: 'INCIDENT', incidentType: 'FALL', text: 'x', incidentActions: [{ code: 'CALLED_112' }] },
    { now: new Date('2026-10-09T08:02:00Z') }
  );
  assert.equal(entryRequestHash('c1', stepA), entryRequestHash('c1', stepB));
  assert.equal(stepA.incidentActions[0].at, NOW.toISOString());
  /* Päringus antud aeg on sisu: teine aeg on teine päring. */
  const timed = normalizeEntryInput({ text: 'Ajata', occurredAt: '2026-10-09T07:00:00Z' }, { now: NOW });
  assert.notEqual(entryRequestHash('c1', first), entryRequestHash('c1', timed));
});

test('parandus ei ole täisasendus: saatmata väljad jäävad kirjelt', () => {
  const stored = {
    kind: 'CONCERN',
    contactMode: 'PHONE',
    occurredAt: new Date('2026-10-08T10:00:00Z'),
    companionMembershipId: 'mem_other',
    incidentType: null,
    incidentAssessment: null,
    incidentActions: null
  };
  const fixed = normalizeEntryInput({ text: 'Täpsustatud' }, { now: NOW, base: stored });
  assert.equal(fixed.kind, 'CONCERN');
  assert.equal(fixed.contactMode, 'PHONE');
  assert.equal(fixed.occurredAt.toISOString(), '2026-10-08T10:00:00.000Z');
  assert.equal(fixed.companionMembershipId, 'mem_other');
  /* Selge `null` võtab kaaslase maha; puuduv väli ei võta. */
  assert.equal(normalizeEntryInput({ text: 'x', companionMembershipId: null }, { now: NOW, base: stored }).companionMembershipId, null);

  const incident = {
    kind: 'INCIDENT',
    contactMode: 'VISIT',
    occurredAt: new Date('2026-10-08T10:00:00Z'),
    companionMembershipId: null,
    incidentType: 'FALL',
    incidentAssessment: 'Libises',
    incidentActions: [{ code: 'CALLED_112', at: '2026-10-08T10:05:00.000Z' }]
  };
  const incidentFixed = normalizeEntryInput({ text: 'Uus tekst' }, { now: NOW, base: incident });
  assert.equal(incidentFixed.incidentType, 'FALL');
  assert.equal(incidentFixed.incidentAssessment, 'Libises');
  assert.deepEqual(incidentFixed.incidentActions, incident.incidentActions);
});

test('vigane sisend on 400, mitte erind: objektita keha, NUL-märk, seadme kell', () => {
  rejects(() => normalizeEntryInput(null, { now: NOW }), 'home_care.errors.entry_text_required');
  rejects(() => normalizeEntryInput(['x'], { now: NOW }), 'home_care.errors.entry_text_required');
  rejects(() => normalizeClientInput(null), 'home_care.errors.name_required');
  /* Objekt liigi kohal loetakse puuduvaks väljaks (vaikimisi tavaline kirje), mitte ei viska erindit. */
  assert.equal(normalizeEntryInput({ text: 'x', kind: { toString: 0 } }, { now: NOW }).kind, 'NOTE');
  const nul = String.fromCharCode(0);
  assert.equal(normalizeEntryInput({ text: `Tõin${nul} toidu` }, { now: NOW }).text, 'Tõin toidu');
  /* Seadme kirjutamisaeg hoitakse ainult mõistlikus aknas; muu jäetakse kõrvale. */
  assert.equal(normalizeEntryInput({ text: 'x', deviceCreatedAt: '2026-10-09T07:59:00Z' }, { now: NOW }).deviceCreatedAt.toISOString(), '2026-10-09T07:59:00.000Z');
  assert.equal(normalizeEntryInput({ text: 'x', deviceCreatedAt: '2026-10-09T09:00:00Z' }, { now: NOW }).deviceCreatedAt, null);
  assert.equal(normalizeEntryInput({ text: 'x', deviceCreatedAt: '2026-09-01T09:00:00Z' }, { now: NOW }).deviceCreatedAt, null);
  assert.equal(normalizeEntryInput({ text: 'x', deviceCreatedAt: 'sodi' }, { now: NOW }).deviceCreatedAt, null);
  /* Tulevikus olev sammu kellaaeg on sisestusviga. */
  rejects(
    () => normalizeEntryInput({ kind: 'INCIDENT', incidentType: 'FALL', text: 'x', incidentActions: [{ code: 'CALLED_112', at: '2026-10-09T09:00:00Z' }] }, { now: NOW }),
    'home_care.errors.invalid_incident_actions'
  );
});

test('otsinguabi: sõna, tüvi ja algvorm; morfoloogia puudumine ei takista', async () => {
  const lemmas = { võtmed: 'võti', käes: 'käsi' };
  const analyzer = { analyze: async (texts) => texts.map((text) => searchWords(text).map((word) => `vmet${lemmas[word] || word}`).join(' ')) };

  assert.deepEqual(searchWords('Võtmed, VÕTMED ja korter 4a!'), ['võtmed', 'ja', 'korter', '4a']);
  const full = await entrySearchText(['Võtmed on naabri käes', null, '  '], { analyzer });
  assert.equal(full.searchVersion, 'vm1');
  for (const token of [' wvõtmed ', ' sbetvõtme ', ' vmetvõti ', ' vmetkäsi ']) assert.ok(full.searchText.includes(token), token);
  assert.ok(full.searchText.startsWith(' ') && full.searchText.endsWith(' '));

  /* Morfoloogia puudub, viskab või ei vasta ajapiiri sees: tüved jäävad. */
  const none = await entrySearchText(['Võtmed on naabri käes'], { analyzer: null });
  assert.equal(none.searchVersion, 'sb1');
  assert.equal(none.searchText.includes('vmet'), false);
  assert.ok(none.searchText.includes(' wvõtmed '));
  const broken = await entrySearchText(['Võtmed'], { analyzer: { analyze: async () => { throw new Error('maas'); } } });
  assert.equal(broken.searchVersion, 'sb1');
  const slow = await entrySearchText(['Võtmed'], { analyzer: { analyze: () => new Promise(() => {}) }, timeoutMs: 20 });
  assert.equal(slow.searchVersion, 'sb1');
  /* Vigase kujuga vastus (vale ridade arv, võõras žetoon) jäetakse kõrvale. */
  const odd = await entrySearchText(['Võtmed'], { analyzer: { analyze: async () => ['vmetvõti DROP', 'liigne'] } });
  assert.equal(odd.searchVersion, 'sb1');
  assert.deepEqual(await entrySearchText(['', null], { analyzer }), { searchText: null, searchVersion: null });

  /* Päring: iga sõna kohta rühm; sõna algus ilma lõputühikuta, tüvi ja algvorm täpselt. */
  const where = await entrySearchWhere('  võtmed   naabri ', { analyzer });
  assert.equal(where.length, 2);
  const first = where[0].OR.map((item) => item.searchText.contains);
  assert.ok(first.includes(' wvõtmed'));
  assert.ok(first.includes(' sbetvõtme '));
  assert.ok(first.includes(' vmetvõti '));
  await assert.rejects(entrySearchWhere('v', { analyzer }), (error) => error.status === 400 && error.messageKey === 'home_care.errors.search_too_short');
  await assert.rejects(entrySearchWhere('!!', { analyzer }), (error) => error.status === 400);
  await assert.rejects(entrySearchWhere(null, { analyzer }), (error) => error.status === 400);
  /* Kuni kuus otsisõna. */
  assert.equal((await entrySearchWhere('aa bb cc dd ee ff gg hh', { analyzer: null })).length, 6);
});

test('kronoloogia dokument: kogu tekst on paotatud, skripte ei ole, pealkirjas ei ole nime', () => {
  const release = {
    clientName: 'Linda <b>Tamm</b>',
    periodFromDay: '2026-10-07',
    periodToDay: '2026-10-09',
    requester: 'PPA "uurija" & Co',
    basis: "Päring nr 12-3/45 <img src=x onerror=alert(1)>",
    registryRef: '2026/1-9/77',
    summary: 'Esimene rida\nTeine rida </p><script>alert(2)</script>',
    entryCount: 2,
    contentSha256: 'a'.repeat(64),
    createdByName: "Juta O'Juht",
    createdAt: '2026-10-09T10:00:00.000Z'
  };
  const items = [
    { position: 1, occurredAt: '2026-10-07T07:00:00.000Z', authorName: 'Anu <i>Hooldaja</i>', kind: 'NOTE', contactMode: 'VISIT', incidentType: null, text: '<script>alert(1)</script> Tõin toidu & jõin "teed".', redacted: true },
    { position: 2, occurredAt: '2026-10-09T04:00:00.000Z', authorName: 'Anu Hooldaja', kind: 'INCIDENT', contactMode: 'PHONE', incidentType: 'FALL', text: 'Leidsin köögi põrandalt.', redacted: false }
  ];
  const organization = { displayName: 'Hoolekanne <A>', legalName: null, timezone: 'Europe/Tallinn', defaultLocale: 'et' };
  const html = renderChronologyHtml({ release, items, organization });

  /* Ühtegi toorest silti kasutaja tekstist lehele ei jõua. */
  for (const raw of ['<script', '</script', '<img', '<b>', '<i>', 'onerror=alert(1)>']) assert.equal(html.includes(raw), false, raw);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; Tõin toidu &amp; jõin &quot;teed&quot;.'));
  assert.ok(html.includes('Linda &lt;b&gt;Tamm&lt;/b&gt;'));
  assert.ok(html.includes('Juta O&#39;Juht'));
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  /* Pealkirjas ei ole kliendi nime; aeg on asutuse ajavööndis; räsi on kaanelehel. */
  assert.match(html, /<title>Kliendi kronoloogia<\/title>/);
  assert.ok(html.includes('07.10.2026 10:00'));
  assert.ok(html.includes('07.10.2026 – 09.10.2026'));
  assert.ok(html.includes('a'.repeat(64)));
  assert.ok(html.includes('Kukkumine või maast leidmine'));
  assert.ok(html.includes('koostaja on teksti väljastamiseks lühendanud'));
  assert.ok(html.startsWith('<!doctype html>'));
  /* Dokument kannab poliitikat ise (rakenduse üldine päis asendab marsruudi
     oma): silt on päises enne stiili ja skriptidele luba ei ole. */
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(CHRONOLOGY_DOCUMENT_CSP)}">`;
  assert.ok(html.includes(meta));
  assert.ok(html.indexOf(meta) < html.indexOf('<style>'));
  assert.ok(CHRONOLOGY_DOCUMENT_CSP.includes("default-src 'none'"));
  assert.equal(CHRONOLOGY_DOCUMENT_CSP.includes('script-src'), false);
  /* Vastuse päised: sama poliitika teise kihina ja vahemällu ei jäeta. */
  const csp = CHRONOLOGY_DOCUMENT_HEADERS['Content-Security-Policy'];
  assert.ok(csp.startsWith(CHRONOLOGY_DOCUMENT_CSP));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(CHRONOLOGY_DOCUMENT_HEADERS['Cache-Control'].includes('no-store'));

  /* Räsi: sama sisu annab sama räsi, iga muutus teise. */
  const input = { clientName: 'Linda', fromDay: '2026-10-07', toDay: '2026-10-09', requester: 'PPA', basis: 'Päring', registryRef: null, summary: null, items };
  assert.equal(chronologyContentHash(input), chronologyContentHash({ ...input, items: items.map((item) => ({ ...item })) }));
  assert.notEqual(chronologyContentHash(input), chronologyContentHash({ ...input, requester: 'KOV' }));
  assert.notEqual(chronologyContentHash(input), chronologyContentHash({ ...input, items: [items[0]] }));
  assert.notEqual(chronologyContentHash(input), chronologyContentHash({ ...input, items: [{ ...items[0], text: 'muu' }, items[1]] }));
});
