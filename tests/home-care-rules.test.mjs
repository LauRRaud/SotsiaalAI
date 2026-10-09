// KODUTEENUS K1 — puhtad reeglid ilma andmebaasita: lipp, skoop, sisendi kontroll,
// „hiljem kirjutatud" ja „pärast eilset". Ligipääsupiiri tõend on eraldi failis
// tests/home-care.integration.test.mjs (päris andmebaas).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { coordinatorScope, isCoordinatorFor, visibleClientsWhere, personName } from '../lib/homeCare/access.js';
import { resolveCallMonth } from '../lib/homeCare/calls.js';
import { chronologyContentHash } from '../lib/homeCare/chronology.js';
import {
  CHRONOLOGY_DOCUMENT_CSP,
  CHRONOLOGY_DOCUMENT_HEADERS,
  escapeHtml,
  renderChronologyHtml
} from '../lib/homeCare/chronologyDocument.js';
import {
  CLIENT_IMPORT_MAX_ROWS,
  ClientImportStatus,
  detectDelimiter,
  parseDelimited,
  planClientImport,
  readClientTable,
  rowsToCreate
} from '../lib/homeCare/clientTable.js';
import { CARE_EXPORT_REASONS, HOME_CARE_LIMITS } from '../lib/homeCare/constants.js';
import { appendDictatedText } from '../lib/homeCare/dictation.js';
import { renderDoorTagHtml } from '../lib/homeCare/doorTagDocument.js';
import { doorTagPath, doorTagUrl, isDoorTagToken, newDoorTagToken } from '../lib/homeCare/doorTags.js';
import { serializeEntry } from '../lib/homeCare/entries.js';
import {
  HOME_CARE_EXPORT_COLLECTIONS,
  HOME_CARE_EXPORT_EXCLUSIONS,
  HOME_CARE_EXPORT_FORMAT,
  HOME_CARE_EXPORT_KEYS,
  HOME_CARE_EXPORT_VERSION,
  checkHomeCareExport
} from '../lib/homeCare/exportFormat.js';
import {
  HISTORY_BLOCK_MAX,
  HISTORY_BLOCK_TARGET,
  historyContentHash,
  normalizeHistoryText,
  splitHistoryText
} from '../lib/homeCare/historyBlocks.js';
import { assertHomeCareEnabled, isHomeCareEnabled } from '../lib/homeCare/flags.js';
import {
  DRAFT_MAX_AGE_MS,
  OUTBOX_LIMIT,
  OutboxState,
  SendOutcome,
  afterAttempt,
  bodyForSend,
  canEnqueue,
  isDraftExpired,
  isBlocked,
  isDraftWorthKeeping,
  isUnreachable,
  needsPerson,
  newQueueItem,
  outboxSummary,
  previewText,
  sendOutcome,
  sortQueue
} from '../lib/homeCare/outbox.js';
import { startOfYesterday } from '../lib/homeCare/overview.js';
import { encodeQr, qrCapacityBytes, qrSvgPath } from '../lib/homeCare/qr.js';
import { entrySearchText, entrySearchWhere, searchWords } from '../lib/homeCare/search.js';
import {
  entryRequestHash,
  normalizeCardLineInput,
  normalizeClientInput,
  normalizeEntryInput,
  normalizeIsoDay,
  normalizeRequestId,
  normalizeSearchQuery,
  normalizeWaitedMs
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

test('võrguta kirje: ooteaeg annab sündmuse aja, kordus jääb korduseks, märk ei kao', () => {
  const HOUR = 60 * 60 * 1000;
  /* Kohe saadetud kirje: sündmuse aeg on serveri kell, ooteaega ei ole. */
  const plain = normalizeEntryInput({ text: 'Tõin toidu.' }, { now: NOW });
  assert.equal(plain.occurredAt.toISOString(), NOW.toISOString());
  assert.equal(plain.deviceQueuedSec, null);

  /* Kolm tundi seadmes oodanud kirje: sündmus oli salvestamise vajutusel. */
  const waited = normalizeEntryInput({ text: 'Tõin toidu.', waitedMs: 3 * HOUR }, { now: NOW });
  assert.equal(waited.occurredAt.toISOString(), '2026-10-09T05:00:00.000Z');
  assert.equal(waited.deviceQueuedSec, 3 * 3600);

  /* KORDUS: sama kirje teine saatmine kannab teist ooteaega. Räsi ei tohi
     sellest muutuda, muidu oleks kaotsi läinud vastuse järel uus katse konflikt. */
  const again = normalizeEntryInput({ text: 'Tõin toidu.', waitedMs: 5 * HOUR }, { now: new Date(NOW.getTime() + 2 * HOUR) });
  assert.equal(entryRequestHash('c1', waited), entryRequestHash('c1', plain));
  assert.equal(entryRequestHash('c1', waited), entryRequestHash('c1', again));

  /* Inimese sisestatud aeg jääb; ooteaeg salvestub ikka. */
  const typed = normalizeEntryInput({ text: 'x', occurredAt: '2026-10-09T04:00:00Z', waitedMs: HOUR }, { now: NOW });
  assert.equal(typed.occurredAt.toISOString(), '2026-10-09T04:00:00.000Z');
  assert.equal(typed.deviceQueuedSec, 3600);

  /* Sisestatud aeg ei tohi olla hilisem salvestamise vajutusest (sama reegel
     mis võrgus): kirje oodanud kaks tundi, vajutus oli 06:00, sisestatud 07:30. */
  assert.throws(
    () => normalizeEntryInput({ text: 'x', occurredAt: '2026-10-09T07:30:00Z', waitedMs: 2 * HOUR }, { now: NOW }),
    (error) => error.status === 400 && error.messageKey === 'home_care.errors.occurred_at_in_future'
  );

  /* Erijuhtumi samm ilma kellaajata saab sama nihutatud aja; antud kellaaeg jääb. */
  const incident = normalizeEntryInput(
    {
      kind: 'INCIDENT',
      incidentType: 'FALL',
      text: 'Leidsin põrandalt.',
      waitedMs: HOUR,
      incidentActions: [{ code: 'CALLED_112' }, { code: 'INFORMED_RELATIVE', at: '2026-10-09T06:30:00Z' }]
    },
    { now: NOW }
  );
  assert.deepEqual(incident.incidentActions, [
    { code: 'CALLED_112', at: '2026-10-09T07:00:00.000Z' },
    { code: 'INFORMED_RELATIVE', at: '2026-10-09T06:30:00.000Z' }
  ]);

  /* PARANDUS ooteaega ei arvesta: sündmuse aeg jääb kirjelt. */
  const base = { kind: 'NOTE', contactMode: 'VISIT', occurredAt: new Date('2026-10-08T10:00:00Z'), companionMembershipId: null };
  const corrected = normalizeEntryInput({ text: 'Parandus', waitedMs: 5000 }, { now: NOW, base });
  assert.equal(corrected.occurredAt.toISOString(), '2026-10-08T10:00:00.000Z');
  assert.equal(corrected.deviceQueuedSec, null);

  /* Sisendi kontroll: ainult arv, mitte negatiivne, mitte üle piiri. */
  assert.equal(normalizeWaitedMs(undefined), null);
  assert.equal(normalizeWaitedMs(null), null);
  assert.equal(normalizeWaitedMs(''), null);
  assert.equal(normalizeWaitedMs(0), 0);
  assert.equal(normalizeWaitedMs(1500.6), 1501);
  assert.equal(normalizeWaitedMs(HOME_CARE_LIMITS.QUEUE_WAIT_MAX_MS), HOME_CARE_LIMITS.QUEUE_WAIT_MAX_MS);
  for (const bad of [-1, '5000', Number.NaN, Infinity, HOME_CARE_LIMITS.QUEUE_WAIT_MAX_MS + 1, {}, true, [1]]) {
    assert.throws(
      () => normalizeWaitedMs(bad),
      (error) => error.status === 400 && error.messageKey === 'home_care.errors.invalid_waited',
      String(bad)
    );
  }

  /* MÄRGID. Seadmes oodatud aeg ei ole kirjutamisega viivitamine, aga hiljem
     kohale jõudnud kirje ei jää kunagi märgita. */
  const row = {
    id: 'e1', clientId: 'c1', kind: 'NOTE', contactMode: 'VISIT', text: 'x', authorName: 'Anu',
    authorMembershipId: 'mem_1', revision: 1, retractedAt: null, _count: { reads: 0 }
  };
  const at = (iso) => new Date(iso);
  const queued = serializeEntry({ ...row, occurredAt: at('2026-10-09T05:00:00Z'), createdAt: at('2026-10-09T08:00:00Z'), deviceQueuedSec: 3 * 3600 });
  assert.deepEqual([queued.writtenLater, queued.sentLater], [false, true]);
  /* Sündmus 04:00, salvestus vajutati 07:00 (kolm tundi hiljem), kohale jõudis 08:00. */
  const both = serializeEntry({ ...row, occurredAt: at('2026-10-09T04:00:00Z'), createdAt: at('2026-10-09T08:00:00Z'), deviceQueuedSec: 3600 });
  assert.deepEqual([both.writtenLater, both.sentLater], [true, true]);
  /* Lühike katkestus ei vääri märki. */
  const blip = serializeEntry({ ...row, occurredAt: at('2026-10-09T07:59:30Z'), createdAt: at('2026-10-09T08:00:00Z'), deviceQueuedSec: 30 });
  assert.deepEqual([blip.writtenLater, blip.sentLater], [false, false]);
  const direct = serializeEntry({ ...row, occurredAt: NOW, createdAt: NOW, deviceQueuedSec: null });
  assert.deepEqual([direct.writtenLater, direct.sentLater], [false, false]);
  /* Alla märgi piiri jääv ooteaeg ei nihuta „hiljem kirjutatud" piiri: muidu
     saaks 2 t 9 min hiljem kohale jõudnud kirje jääda mõlemast märgist ilma. */
  const nudged = serializeEntry({ ...row, occurredAt: at('2026-10-09T05:51:00Z'), createdAt: at('2026-10-09T08:00:00Z'), deviceQueuedSec: 599 });
  assert.deepEqual([nudged.writtenLater, nudged.sentLater], [true, false]);
  /* Vigane väärtus veerus ei tee kirjet varasemaks. */
  const odd = serializeEntry({ ...row, occurredAt: at('2026-10-09T02:00:00Z'), createdAt: at('2026-10-09T08:00:00Z'), deviceQueuedSec: -500 });
  assert.deepEqual([odd.writtenLater, odd.sentLater], [true, false]);
});

test('seadme järjekord: mida uuesti proovida, mida inimesele näidata, mida saata', () => {
  /* Server ei jõudnud otsuseni või ligipääs võib taastuda: kirje jääb ootele. */
  for (const status of [0, 401, 403, 404, 408, 425, 429, 500, 502, 503, 504]) {
    assert.equal(sendOutcome({ ok: false, status }), SendOutcome.RETRY, String(status));
  }
  /* Server vaatas sisu ja keeldus: kordamine sama sisuga ei aita. 404 siia ei
     kuulu: see tähendab „sulle seda praegu ei ole" (ka hetkeks suletud
     koduteenus) ja kogu järjekorda ei tohi selle pärast tagasi lükatuks märkida. */
  for (const status of [400, 409, 413, 422]) {
    assert.equal(sendOutcome({ ok: false, status }), SendOutcome.ATTENTION, String(status));
  }
  assert.equal(sendOutcome({ ok: true, status: 201 }), SendOutcome.SENT);
  assert.equal(sendOutcome({ ok: true, status: 200 }), SendOutcome.SENT);
  assert.equal(sendOutcome(), SendOutcome.RETRY);
  /* Wifi sisselogimisleht vastab 200 ja HTML-iga: see ei ole serveri otsus,
     kirjet ei tohi tagasi lükatuks märkida. */
  assert.equal(sendOutcome({ ok: false, status: 200 }), SendOutcome.RETRY);
  assert.equal(sendOutcome({ ok: false, status: 302 }), SendOutcome.RETRY);

  /* Vormilt läheb kirje järjekorda ainult siis, kui serverini ei jõutud. */
  assert.deepEqual([0, 200, 302, 502, 503, 504].map(isUnreachable), [true, true, true, true, true, true]);
  assert.deepEqual([400, 401, 403, 404, 409, 500].map(isUnreachable), [false, false, false, false, false, false]);

  const body = { kind: 'NOTE', text: 'Tõin toidu.', clientRequestId: 'key-12345678', deviceCreatedAt: '2026-10-09T08:00:00.000Z' };
  const item = newQueueItem({ organizationId: 'org1', clientId: 'c1', clientName: 'Linda Tamm', body, nowMs: 1_000_000 });
  assert.equal(item.clientRequestId, 'key-12345678');
  assert.equal(item.state, OutboxState.PENDING);
  assert.deepEqual(item.payload, { clientName: 'Linda Tamm', body });
  /* Ilma võtmeta kirjet järjekorda ei panda: kordussaatmine tekitaks teise kirje. */
  assert.equal(newQueueItem({ organizationId: 'org1', clientId: 'c1', clientName: 'x', body: { text: 'x' }, nowMs: 1 }), null);
  assert.equal(newQueueItem({ organizationId: '', clientId: 'c1', clientName: 'x', body, nowMs: 1 }), null);

  /* Saadetav keha: vormi keha muutmata ja ooteaeg. Tagasi keeratud kell ei anna negatiivset aega. */
  assert.deepEqual(bodyForSend(item, 1_000_000 + 90_000), { ...body, waitedMs: 90_000 });
  assert.equal(bodyForSend(item, 500_000).waitedMs, 0);
  assert.equal(Object.hasOwn(body, 'waitedMs'), false, 'järjekorras olevat keha ei muudeta');

  /* Pärast katset: ajutine viga jätab ootele, keeldumine viib tähelepanu alla. */
  const retried = afterAttempt(item, { outcome: SendOutcome.RETRY, status: 403, messageKey: 'home_care.errors.access_reason_required', nowMs: 2_000_000 });
  assert.deepEqual(
    [retried.state, retried.attempts, retried.lastStatus, retried.lastMessageKey, retried.lastTriedAtMs],
    [OutboxState.PENDING, 1, 403, 'home_care.errors.access_reason_required', 2_000_000]
  );
  const refused = afterAttempt(retried, { outcome: SendOutcome.ATTENTION, status: 400, messageKey: '', nowMs: 3_000_000 });
  assert.deepEqual([refused.state, refused.attempts, refused.lastStatus, refused.lastMessageKey], [OutboxState.ATTENTION, 2, 400, null]);
  assert.deepEqual(refused.payload, item.payload, 'sisu jääb alles');

  /* Ülempiir blokeerib uue kirje, sama võtme uuendamine on lubatud. */
  const full = Array.from({ length: OUTBOX_LIMIT }, (_, index) => ({ clientRequestId: `k${index}`, state: OutboxState.PENDING }));
  assert.equal(canEnqueue(full, 'new'), false);
  assert.equal(canEnqueue(full, 'k3'), true);
  assert.equal(canEnqueue(full.slice(1), 'new'), true);
  assert.equal(canEnqueue(null, 'new'), true);

  /* Ligipääsuta kirje (403) jääb ootele ja seda proovitakse edasi, aga inimene
     peab seda nägema: täistekst ja kustutamise võimalus. */
  assert.equal(needsPerson(item), false);
  assert.equal(needsPerson(retried), true);
  assert.equal(needsPerson(refused), true);
  assert.equal(needsPerson({ unreadable: true, state: OutboxState.PENDING }), true);
  assert.equal(needsPerson({ state: OutboxState.PENDING, lastStatus: 503 }), false);
  assert.equal(needsPerson({ state: OutboxState.PENDING, lastStatus: 404 }), true);
  assert.deepEqual([retried, refused, item, { state: OutboxState.PENDING, lastStatus: 404 }].map(isBlocked), [true, false, false, true]);
  assert.deepEqual(outboxSummary([item, retried, refused, { clientRequestId: 'u', unreadable: true, state: OutboxState.PENDING }]), {
    total: 4,
    attention: 3,
    pending: 2
  });
  /* Vanemad ees: kirjed jõuavad serverisse kirjutamise järjekorras. */
  assert.deepEqual(
    sortQueue([{ clientRequestId: 'b', queuedAtMs: 5 }, { clientRequestId: 'a', queuedAtMs: 5 }, { clientRequestId: 'c', queuedAtMs: 1 }]).map((row) => row.clientRequestId),
    ['c', 'a', 'b']
  );

  assert.equal(previewText('  Tõin   toidu\nja jõin teed. '), 'Tõin toidu ja jõin teed.');
  assert.equal(previewText('a'.repeat(200)).length, 90);
  assert.ok(previewText('a'.repeat(200)).endsWith('…'));

  /* Mustand: tühja vormi ei hoita, vana mustand aegub. */
  assert.equal(isDraftWorthKeeping({ text: '  ', assessment: '' }), false);
  assert.equal(isDraftWorthKeeping({ text: 'pooleli' }), true);
  assert.equal(isDraftWorthKeeping({ text: '', assessment: 'hinnang' }), true);
  assert.equal(isDraftWorthKeeping(null), false);
  assert.equal(isDraftExpired({ savedAtMs: 1000 }, 1000 + DRAFT_MAX_AGE_MS), false);
  assert.equal(isDraftExpired({ savedAtMs: 1000 }, 1001 + DRAFT_MAX_AGE_MS), true);
  assert.equal(isDraftExpired({}, 5), true);
});

test('dikteerimine: tekst lisatakse välja lõppu, piiri ületav lõpp ei kao vaikselt', () => {
  /* Tühjale väljale: tekst nagu on, tühikud korrastatud. */
  assert.deepEqual(appendDictatedText('', '  Tõin   toidu\nja ravimid. ', 4000), { text: 'Tõin toidu ja ravimid.', cut: false });
  /* Kirjutatud tekstile järele, ühe tühikuga; olemasolevat teksti ei muudeta. */
  assert.deepEqual(appendDictatedText('Käik kell 9.', 'Linda oli rõõmus.', 4000), { text: 'Käik kell 9. Linda oli rõõmus.', cut: false });
  /* Kui väli lõpeb juba tühiku või reavahetusega, lisatühikut ei tule. */
  assert.equal(appendDictatedText('Esimene rida.\n', 'Teine rida.', 4000).text, 'Esimene rida.\nTeine rida.');
  assert.equal(appendDictatedText('Lause ', 'jätkub.', 4000).text, 'Lause jätkub.');
  /* Tühi tuvastus ei muuda midagi. */
  assert.deepEqual(appendDictatedText('Olemas', '   ', 4000), { text: 'Olemas', cut: false });
  assert.deepEqual(appendDictatedText('Olemas', null, 4000), { text: 'Olemas', cut: false });
  assert.deepEqual(appendDictatedText(undefined, 'Tere', 4000), { text: 'Tere', cut: false });
  /* Piir: lõpp lõigatakse ja kutsuja saab sellest teada. */
  assert.deepEqual(appendDictatedText('abc', 'defgh', 6), { text: 'abc de', cut: true });
  assert.deepEqual(appendDictatedText('abc', 'de', 6), { text: 'abc de', cut: false });
  assert.equal(appendDictatedText('x'.repeat(10), 'y', 10).cut, true);
  assert.equal(appendDictatedText('x'.repeat(10), 'y', 10).text, 'x'.repeat(10));
});

test('klientide tabel: eraldaja, jutumärgid, päised kolmes keeles', () => {
  /* Arvutustabelist kopeeritud tekst on tabulaatoritega; CSV koma või semikooloniga. */
  assert.equal(detectDelimiter('Nimi\tTunnus\tAadress'), '\t');
  assert.equal(detectDelimiter('Nimi;Tunnus;Aadress'), ';');
  assert.equal(detectDelimiter('Nimi,Tunnus,Aadress'), ',');
  /* Eraldaja jutumärkide sees ei loe. */
  assert.equal(detectDelimiter('"Nimi, perekonnanimi";Tunnus'), ';');

  /* Jutumärkides lahter võib sisaldada eraldajat, reavahetust ja jutumärki. */
  const parsed = parseDelimited('Nimi;Märkus\r\n"Tamm, Linda";"Tütar ""Mari""\nhelistab õhtul"\nKask Jaan;\n', ';');
  assert.deepEqual(parsed.map((row) => row.cells), [
    ['Nimi', 'Märkus'],
    ['Tamm, Linda', 'Tütar "Mari"\nhelistab õhtul'],
    ['Kask Jaan', '']
  ]);
  /* Reanumber on tabeli rida, kust kirje algab (mitmerealise lahtri järel nihkub). */
  assert.deepEqual(parsed.map((row) => row.line), [1, 2, 4]);

  /* Päised tuntakse ära nime järgi, järjekord ei loe; tundmatu veerg jäetakse kõrvale ja öeldakse. */
  const table = readClientTable('Telefon\tSünniaeg\tNIMI\tKood\n5551234\t1940\tLinda Tamm\tLT-1\n\n\t\t\t\nJaan Kask\n');
  assert.equal(table.ok, true);
  assert.deepEqual(table.columns, { contactPhone: 0, displayName: 2, internalCode: 3 });
  assert.deepEqual(table.ignoredHeaders, ['Sünniaeg']);
  /* Tühjad read jäetakse vahele. */
  assert.equal(table.rows.length, 2);
  assert.deepEqual(readClientTable('Name,Address\nA,B').columns, { displayName: 0, address: 1 });
  assert.deepEqual(readClientTable('Имя;Телефон\nА;1').columns, { displayName: 0, contactPhone: 1 });
  /* Faili alguse BOM ei riku esimest päist. */
  assert.deepEqual(readClientTable('\uFEFFNimi;Tunnus\nA;1').columns, { displayName: 0, internalCode: 1 });

  /* Mis ei ole tabel, saab selge vea, mitte erindi. */
  assert.equal(readClientTable('').errorKey, 'home_care.errors.import_empty');
  assert.equal(readClientTable('   \n  ').errorKey, 'home_care.errors.import_empty');
  assert.equal(readClientTable(null).errorKey, 'home_care.errors.import_empty');
  assert.equal(readClientTable('Aadress;Telefon\nKase 3;555').errorKey, 'home_care.errors.import_name_column_missing');
  assert.equal(readClientTable('Nimi;Tunnus').errorKey, 'home_care.errors.import_no_rows');
  const many = ['Nimi', ...Array.from({ length: CLIENT_IMPORT_MAX_ROWS + 1 }, (_, index) => `Klient ${index}`)].join('\n');
  assert.equal(readClientTable(many).errorKey, 'home_care.errors.import_too_many_rows');
  assert.equal(readClientTable(`Nimi\n${'x'.repeat(400_001)}`).errorKey, 'home_care.errors.import_too_large');
});

test('klientide tabel: kava ütleb iga rea kohta, mis sellest saab', () => {
  const table = readClientTable(
    [
      'Nimi;Tunnus;Aadress',
      'Linda Tamm;LT-1;Kase 3',
      'Jaan Kask;JK-2;',
      'Mari  Mets;;Tamme 5',
      ';X-9;',
      'Uus Inimene;LT-1;',
      'Teine Jaan;JK-2;',
      'mari mets;;',
      'Olemas Olev;;',
      `${'n'.repeat(250)};;`
    ].join('\n')
  );
  const plan = planClientImport(table, { existingCodes: new Set(['JK-2']), existingNames: new Set(['Olemas  OLEV']) });
  assert.deepEqual(
    plan.rows.map((row) => [row.line, row.status]),
    [
      [2, ClientImportStatus.NEW],
      /* Sama tunnus on asutuses olemas: ei tooda teist korda. */
      [3, ClientImportStatus.EXISTS],
      [4, ClientImportStatus.NEW],
      /* Nimi puudub. */
      [5, ClientImportStatus.ERROR],
      /* Sama tunnus selles tabelis varem. */
      [6, ClientImportStatus.REPEATED],
      [7, ClientImportStatus.EXISTS],
      /* Tunnust ei ole ja sama nimi oli tabelis juba (tähesuurus ja tühikud ei loe). */
      [8, ClientImportStatus.SAME_NAME],
      /* Tunnust ei ole ja sama nimega klient on juba olemas. */
      [9, ClientImportStatus.SAME_NAME],
      /* Liiga pikk nimi on viga (sama piir mis vormis), mitte vaikne lõikamine. */
      [10, ClientImportStatus.ERROR]
    ]
  );
  assert.equal(plan.rows[3].errorKey, 'home_care.errors.name_required');
  assert.equal(plan.rows[8].errorKey, 'home_care.errors.text_too_long');
  assert.equal(plan.rows[8].displayName.length, HOME_CARE_LIMITS.DISPLAY_NAME_MAX);
  assert.deepEqual(plan.rows[0].data, { displayName: 'Linda Tamm', internalCode: 'LT-1', address: 'Kase 3', contactPhone: null, contactNote: null });
  assert.equal(plan.rows[2].data.displayName, 'Mari Mets');
  assert.deepEqual(plan.summary, { total: 9, new: 2, exists: 2, repeated: 1, sameName: 2, errors: 2 });

  /* Kliendiks saavad uued read ja need samanimelised, mille hooldusjuht kinnitas. */
  assert.deepEqual(rowsToCreate(plan).map((row) => row.line), [2, 4]);
  assert.deepEqual(rowsToCreate(plan, [9, 3, 5, 'x']).map((row) => row.line), [2, 4, 9]);
});

test('imporditud ajalugu: tekst jagatakse lõikudeks, midagi ei kao ega muutu', () => {
  const squash = (value) => value.replace(/\s+/g, '');

  /* Lühike tekst on üks lõige; tühi tekst ei anna midagi. */
  assert.deepEqual(splitHistoryText('  Esimene rida.\r\nTeine rida.  '), ['Esimene rida.\nTeine rida.']);
  assert.deepEqual(splitHistoryText(''), []);
  assert.deepEqual(splitHistoryText('   \n\n  '), []);
  assert.deepEqual(splitHistoryText(null), []);
  /* Reavahetused ühtseks, realõpu tühikud ära, NUL välja. */
  assert.equal(normalizeHistoryText(`a  \r\nb\rc${String.fromCharCode(0)}d`), 'a\nb\ncd');

  /* Lühikesed lõigud pannakse kokku kuni sihtpikkuseni, järjekord säilib. */
  const paragraphs = Array.from({ length: 12 }, (_, index) => `Kuupäev ${index + 1}. ${'Käik tehtud, kõik korras. '.repeat(12).trim()}`);
  const text = paragraphs.join('\n\n');
  const blocks = splitHistoryText(text);
  assert.ok(blocks.length > 1 && blocks.length < paragraphs.length);
  assert.ok(blocks.every((block) => block.length <= HISTORY_BLOCK_TARGET));
  assert.equal(blocks.join('\n\n'), text);
  assert.ok(blocks[0].startsWith('Kuupäev 1.'));
  assert.ok(blocks[blocks.length - 1].includes('Kuupäev 12.'));

  /* Dokument ilma tühjade ridadeta: lõigatakse lause lõpu kohalt, ükski lõige ei ületa piiri. */
  const wall = 'Linda oli täna rõõmus ja sõi hästi. '.repeat(400).trim();
  const cut = splitHistoryText(wall);
  assert.ok(cut.length > 1);
  assert.ok(cut.every((block) => block.length <= HISTORY_BLOCK_MAX));
  assert.ok(cut.slice(0, -1).every((block) => block.endsWith('.')));
  assert.equal(squash(cut.join(' ')), squash(wall));

  /* Üks hiigelsõna (tühikuteta): lõigatakse piiri kohalt, märke ei kao. */
  const blob = 'x'.repeat(HISTORY_BLOCK_MAX * 2 + 17);
  const pieces = splitHistoryText(blob);
  assert.equal(pieces.join(''), blob);
  assert.ok(pieces.every((block) => block.length <= HISTORY_BLOCK_MAX));

  /* Sama tekst annab sama räsi, ka teiste reavahetustega; teine tekst teise. */
  assert.equal(historyContentHash(splitHistoryText('a\r\n\r\nb')), historyContentHash(splitHistoryText('a\n\nb  ')));
  assert.notEqual(historyContentHash(splitHistoryText('a\n\nb')), historyContentHash(splitHistoryText('a\n\nc')));
  assert.match(historyContentHash(['a']), /^[a-f0-9]{64}$/);
});

test('QR-kood: ehitus vastab standardile ja väljund on sama, mille sõltumatu lugeja lahti luges', () => {
  const rowsOf = (qr) => qr.modules.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''));
  const hashOf = (text) => createHash('sha256').update(rowsOf(encodeQr(text)).join('\n')).digest('hex');

  /* Versiooni mahutavus baitides (tase M) ja väikseima sobiva versiooni valik. */
  assert.deepEqual(Array.from({ length: 10 }, (_, index) => qrCapacityBytes(index + 1)), [14, 26, 42, 62, 84, 106, 122, 152, 180, 213]);
  assert.deepEqual(['x'.repeat(14), 'x'.repeat(15), 'x'.repeat(62), 'x'.repeat(63), 'x'.repeat(213)].map((text) => encodeQr(text).version), [1, 2, 4, 5, 10]);
  assert.throws(() => encodeQr('x'.repeat(214)), RangeError);
  /* Täpitähed loetakse baitidena (UTF-8), mitte märkidena. */
  assert.equal(encodeQr('õ'.repeat(7)).version, 1);
  assert.equal(encodeQr('õ'.repeat(8)).version, 2);

  const qr = encodeQr('Tere');
  const rows = rowsOf(qr);
  assert.equal(qr.size, 21);
  assert.equal(rows.length, 21);
  assert.ok(rows.every((row) => row.length === 21));
  /* Kolm otsimismustrit nurkades: 7×7 raam, sees 3×3. */
  const finder = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
  finder.forEach((line, y) => {
    assert.equal(rows[y].slice(0, 7), line, `ülal vasakul, rida ${y}`);
    assert.equal(rows[y].slice(14), line, `ülal paremal, rida ${y}`);
    assert.equal(rows[14 + y].slice(0, 7), line, `all vasakul, rida ${y}`);
  });
  /* Eraldaja, ajastusjoon ja alati tume moodul. */
  assert.equal(rows[7].slice(0, 8), '00000000');
  assert.equal(rows[6].slice(8, 13), '10101');
  assert.equal(rows[13][8], '1');

  /* REGRESSIOON. Need räsid on arvutatud koodidest, mille sõltumatu lugeja
     (OpenCV QRCodeDetector) luges tagasi täpselt samaks tekstiks: 17 proovi
     versioonidest 1 kuni 10, sealhulgas iga versiooni täpne mahupiir, täpitähed
     ja uksesildi aadress. Kui kodeerija muutub ja räsi enam ei klapi, tuleb uus
     väljund enne räsi uuendamist uuesti lugejaga kontrollida. */
  assert.equal(hashOf('A'), 'bc9009ae87ca68f1d256b69eb26362086d73d9f0b95f1e9f3dccae752626c3b6');
  assert.equal(hashOf('https://sotsiaal.pro/org/koduteenus/uks/Zk3vQ9xP1sLmN7aB2cD4eF'), '7be49240b5bd6844a578a246e2115c19354529a61e87974a62c7fdedf011657a');
  assert.equal(hashOf('Õun, Ülle & Äär: täpitähed šž 100%'), '11bf9789c82af183e48c637945940ff41ffe04e867940ef3ba433b516aa5f7c8');
  assert.equal(hashOf('t'.repeat(122)), 'd6e757be86a0a0f6b515930fdbcd5502bc21db50594a95c6ba2069278c39806f');
  assert.equal(hashOf('q'.repeat(181)), 'f651b1eae9c3e5113645bdc372a7795b4ade105e207ebf569f40b39578dfda84');

  /* Joonistus: iga tume moodul on ühikruut, vaikne äär neli moodulit. */
  const path = qrSvgPath(qr.modules);
  assert.equal(path.side, 29);
  assert.equal((path.d.match(/M/g) || []).length, rows.join('').split('1').length - 1);
  assert.ok(path.d.startsWith('M4,4h1v1h-1z'));
  assert.match(path.d, /^[Mhvz0-9,-]+$/);
});

test('uksesilt: tunnus on juhuslik ja aadressist ei loe välja asutust, klienti ega nime; dokument on paotatud', () => {
  const tokens = Array.from({ length: 200 }, () => newDoorTagToken());
  assert.equal(new Set(tokens).size, 200);
  assert.ok(tokens.every(isDoorTagToken));
  assert.ok(tokens.every((token) => token.length === 22));
  for (const bad of ['', 'abc', 'a'.repeat(21), 'a'.repeat(23), `${'a'.repeat(21)}/`, `${'a'.repeat(21)}.`, null, 42, ' '.repeat(22)]) {
    assert.equal(isDoorTagToken(bad), false, String(bad));
  }
  assert.equal(doorTagPath('Zk3vQ9xP1sLmN7aB2cD4eF'), '/org/koduteenus/uks/Zk3vQ9xP1sLmN7aB2cD4eF');
  assert.equal(doorTagUrl('Zk3vQ9xP1sLmN7aB2cD4eF', { siteUrl: 'https://sotsiaal.pro/' }), 'https://sotsiaal.pro/org/koduteenus/uks/Zk3vQ9xP1sLmN7aB2cD4eF');
  /* Aadress mahub väikesesse koodi (versioon 4 või 5), mida telefon loeb ka halvas valguses. */
  assert.ok(encodeQr(doorTagUrl(tokens[0], { siteUrl: 'https://sotsiaal.pro' })).version <= 5);

  const qr = qrSvgPath(encodeQr('https://sotsiaal.pro/org/koduteenus/uks/Zk3vQ9xP1sLmN7aB2cD4eF').modules);
  const html = renderDoorTagHtml({
    tag: { qr: { ...qr, d: `${qr.d}"><script>alert(document.cookie)</script>` } },
    clientName: 'Linda <b>Tamm</b>',
    organization: { displayName: 'Hoolekanne <A> & Co', defaultLocale: 'et' }
  });
  /* Kasutaja tekst on paotatud ja teekonda ei saa midagi süstida. */
  for (const raw of ['<script', '<b>', '<A>', 'alert', 'cookie']) assert.equal(html.includes(raw), false, raw);
  assert.ok(html.includes('Linda &lt;b&gt;Tamm&lt;/b&gt;'));
  assert.ok(html.includes('Hoolekanne &lt;A&gt; &amp; Co'));
  assert.ok(html.includes(`<path d="${qr.d}" fill="#000"/>`));
  assert.ok(html.includes(`viewBox="0 0 ${qr.side} ${qr.side}"`));
  /* Pealkirjas ei ole nime; nimi on ainult lõikejoonest väljaspool oleval real, mitte sildil. */
  assert.match(html, /<title>Uksesilt<\/title>/);
  const tagSection = html.slice(html.indexOf('<section class="tag">'), html.indexOf('</section>'));
  assert.equal(tagSection.includes('Linda'), false);
  assert.ok(html.indexOf('Linda') < html.indexOf('<section class="tag">'));
  assert.ok(html.includes('http-equiv="Content-Security-Policy"'));
  assert.ok(html.indexOf('http-equiv="Content-Security-Policy"') < html.indexOf('<style>'));
});

/* Kirje „Tõin toidu." kordussaatmise räsi koodiga, mis oli harul enne kõnemärke
   välju (arvutatud `origin/main` failist `lib/homeCare/validation.js`). */
const LEGACY_PLAIN_HASH = 'c78183943a0239ea45db2478aece5ff4c841844f27423da5839f7a3a381e480a';

test('kõnemärge: väljad ainult telefonikontaktil, vana räsi jääb samaks, kuu on asutuse kalendrikuu', () => {
  /* Kõnemärge: mõlemad väljad koos. */
  const callNote = normalizeEntryInput({ text: 'Tütar küsis seisu.', contactMode: 'PHONE', callTopic: 'status', callCaller: 'RELATIVE' }, { now: NOW });
  assert.deepEqual([callNote.contactMode, callNote.callTopic, callNote.callCaller], ['PHONE', 'STATUS', 'RELATIVE']);
  /* Tavaline telefonikirje ilma kõnemärketa. */
  const phone = normalizeEntryInput({ text: 'Helistasin apteeki.', contactMode: 'PHONE' }, { now: NOW });
  assert.deepEqual([phone.callTopic, phone.callCaller], [null, null]);
  /* Käigul kõnemärget ei ole, ka siis, kui väljad saadeti. */
  const visit = normalizeEntryInput({ text: 'Käik.', contactMode: 'VISIT', callTopic: 'STATUS', callCaller: 'CLIENT' }, { now: NOW });
  assert.deepEqual([visit.callTopic, visit.callCaller], [null, null]);
  /* Üks väli ilma teiseta ja tundmatu väärtus on viga. */
  for (const bad of [
    { callTopic: 'STATUS' },
    { callCaller: 'CLIENT' },
    { callTopic: 'GOSSIP', callCaller: 'CLIENT' },
    { callTopic: 'STATUS', callCaller: 'NEIGHBOUR' }
  ]) {
    assert.throws(
      () => normalizeEntryInput({ text: 'x', contactMode: 'PHONE', ...bad }, { now: NOW }),
      (error) => error.status === 400 && error.messageKey === 'home_care.errors.invalid_call',
      JSON.stringify(bad)
    );
  }

  /* PARANDUS: saatmata väljad jäävad; kontakti viisi muutmine käiguks võtab kõnemärke ära. */
  const base = { kind: 'NOTE', contactMode: 'PHONE', callTopic: 'CHANGE', callCaller: 'CLIENT', occurredAt: new Date('2026-10-08T10:00:00Z'), companionMembershipId: null };
  const kept = normalizeEntryInput({ text: 'Täpsustus' }, { now: NOW, base });
  assert.deepEqual([kept.callTopic, kept.callCaller], ['CHANGE', 'CLIENT']);
  const toVisit = normalizeEntryInput({ text: 'Tegelikult käik', contactMode: 'VISIT' }, { now: NOW, base });
  assert.deepEqual([toVisit.callTopic, toVisit.callCaller], [null, null]);

  /* RÄSI: ilma kõnemärketa kirje räsi ei tohi muutuda (seadmes ootav vanem kirje
     peab pärast uuendust olema endiselt kordus). Väärtus on arvutatud enne
     kõnemärke väljade lisamist. */
  const plain = normalizeEntryInput({ text: 'Tõin toidu.' }, { now: NOW });
  assert.equal(entryRequestHash('c1', plain), LEGACY_PLAIN_HASH);
  assert.notEqual(entryRequestHash('c1', callNote), entryRequestHash('c1', { ...callNote, callTopic: 'CONCERN' }));
  assert.notEqual(entryRequestHash('c1', callNote), entryRequestHash('c1', { ...callNote, callTopic: null, callCaller: null }));

  /* Loenduri kuu: tühi tähendab käesolevat kuud ASUTUSE ajavööndis. */
  assert.deepEqual(resolveCallMonth('2026-09', NOW, 'Europe/Tallinn'), { year: 2026, month: 9 });
  assert.deepEqual(resolveCallMonth(undefined, NOW, 'Europe/Tallinn'), { year: 2026, month: 10 });
  /* 31.10 kell 22:30 UTC on Tallinnas juba 1. november. */
  assert.deepEqual(resolveCallMonth('', new Date('2026-10-31T22:30:00Z'), 'Europe/Tallinn'), { year: 2026, month: 11 });
  for (const bad of ['2026-13', '2026-0', '26-10', '2026/10', 'oktoober', '0000-01', '1999-12', '3000-01']) {
    assert.throws(() => resolveCallMonth(bad, NOW, 'Europe/Tallinn'), (error) => error.status === 400 && error.messageKey === 'home_care.errors.invalid_month', bad);
  }
});

test('täieliku väljavõtte kontroll: kuju, koguarvud, kordumatud ID-d ja viited', () => {
  const make = () => {
    const doc = {
      format: HOME_CARE_EXPORT_FORMAT,
      version: HOME_CARE_EXPORT_VERSION,
      exportId: 'e1',
      generatedAt: '2026-10-09T12:00:00.000Z',
      organization: { id: 'o1' },
      manifest: { includes: [...HOME_CARE_EXPORT_KEYS], excludes: [] },
      units: [{ id: 'u1' }],
      people: [{ id: 'm1', name: 'Anu Hooldaja' }],
      clients: [
        { id: 'c1', unitId: 'u1', createdByMembershipId: 'm1' },
        { id: 'c2', unitId: null, createdByMembershipId: null }
      ],
      teamMembers: [{ id: 't1', clientId: 'c1', membershipId: 'm1' }],
      cardLines: [{ id: 'l1', clientId: 'c1' }],
      entries: [{ id: 'n1', clientId: 'c1', authorMembershipId: 'm1' }],
      entryRevisions: [{ id: 'r1', entryId: 'n1', clientId: 'c1', actorMembershipId: 'm1' }],
      entryReads: [{ id: 'd1', entryId: 'n1', membershipId: 'm1' }],
      incidentUpdates: [{ id: 'i1', entryId: 'n1', clientId: 'c1', actorMembershipId: 'm1' }],
      accessLog: [{ id: 'a1', clientId: 'c1', membershipId: 'm1' }],
      chronologyReleases: [{ id: 'k1', clientId: 'c1', entryCount: 1, createdByMembershipId: 'm1' }],
      chronologyReleaseItems: [{ id: 'ki1', releaseId: 'k1' }],
      importedHistories: [{ id: 'h1', clientId: 'c1', blockCount: 2, importedByMembershipId: 'm1' }],
      importedHistoryBlocks: [
        { id: 'b1', historyId: 'h1', clientId: 'c1' },
        { id: 'b2', historyId: 'h1', clientId: 'c1' }
      ],
      doorTags: [{ id: 'g1', clientId: 'c1', createdByMembershipId: 'm1' }],
      clientStatusChanges: [{ id: 's1', clientId: 'c1', actorMembershipId: 'm1' }],
      activities: [{ id: 'act1', createdByMembershipId: 'm1' }],
      carePlans: [{ id: 'p1', clientId: 'c1', createdByMembershipId: 'm1', activatedByMembershipId: 'm1' }],
      carePlanLines: [
        { id: 'pl1', planId: 'p1', clientId: 'c1', activityId: 'act1' },
        { id: 'pl2', planId: 'p1', clientId: 'c1', activityId: null }
      ],
      decisions: [{ id: 'd1', clientId: 'c1', createdByMembershipId: 'm1', retractedByMembershipId: null }],
      entryActivities: [
        { id: 'ea1', entryId: 'n1', clientId: 'c1', planLineId: 'pl1', activityId: 'act1' },
        { id: 'ea2', entryId: 'n1', clientId: 'c1', planLineId: null, activityId: null }
      ],
      visitSlots: [
        { id: 'vs1', clientId: 'c1', workerMembershipId: 'm1', createdByMembershipId: 'm1' },
        { id: 'vs2', clientId: 'c1', workerMembershipId: null, createdByMembershipId: 'm1' }
      ],
      auditEvents: [{ id: 'x1', actorMembershipId: 'm1' }]
    };
    doc.totals = Object.fromEntries(HOME_CARE_EXPORT_KEYS.map((key) => [key, doc[key].length]));
    return doc;
  };
  const problems = (change) => {
    const doc = make();
    change(doc);
    return checkHomeCareExport(doc).problems;
  };

  /* Korras fail: vigu ega tähelepanekuid ei ole; tühi üksuse viide on lubatud. */
  const good = checkHomeCareExport(make());
  assert.deepEqual([good.ok, good.problems, good.notes], [true, [], []]);
  assert.equal(good.totals.clients, 2);

  /* Kogude järjekord on leping: vanem kogu on failis enne seda, kes talle viitab. */
  assert.deepEqual(HOME_CARE_EXPORT_KEYS, [
    'units',
    'clients',
    'teamMembers',
    'cardLines',
    'entries',
    'entryRevisions',
    'entryReads',
    'incidentUpdates',
    'accessLog',
    'chronologyReleases',
    'chronologyReleaseItems',
    'importedHistories',
    'importedHistoryBlocks',
    'doorTags',
    'clientStatusChanges',
    'activities',
    'carePlans',
    'carePlanLines',
    'decisions',
    'entryActivities',
    'visitSlots',
    'auditEvents',
    'people'
  ]);
  for (const collection of HOME_CARE_EXPORT_COLLECTIONS) {
    for (const parent of collection.parents) {
      assert.ok(HOME_CARE_EXPORT_KEYS.indexOf(parent.collection) < HOME_CARE_EXPORT_KEYS.indexOf(collection.key), `${collection.key} → ${parent.collection}`);
    }
  }

  /* Vale kuju. */
  assert.equal(checkHomeCareExport(null).ok, false);
  assert.equal(checkHomeCareExport([]).ok, false);
  assert.match(problems((doc) => { doc.format = 'muu'; })[0], /vorming/);
  assert.match(problems((doc) => { doc.version = 99; })[0], /versioon/);
  /* Varasema versiooni fail (enne seisu ajaloo kogu) jääb kontrollitavaks; uue versiooni
     failis on sama kogu puudumine viga. */
  const older = make();
  older.version = 1;
  for (const key of ['clientStatusChanges', 'activities', 'carePlans', 'carePlanLines', 'decisions', 'entryActivities', 'visitSlots']) {
    delete older[key];
    delete older.totals[key];
  }
  assert.deepEqual([checkHomeCareExport(older).ok, checkHomeCareExport(older).problems], [true, []]);
  /* Versioon 2 tunneb seisu ajalugu, aga mitte veel toimingute kataloogi. */
  const second = make();
  second.version = 2;
  for (const key of ['activities', 'carePlans', 'carePlanLines', 'decisions', 'entryActivities', 'visitSlots']) {
    delete second[key];
    delete second.totals[key];
  }
  assert.deepEqual([checkHomeCareExport(second).ok, checkHomeCareExport(second).problems], [true, []]);
  /* Versioon 3 tunneb kataloogi, aga mitte veel hoolduskavasid. */
  const third = make();
  third.version = 3;
  for (const key of ['carePlans', 'carePlanLines', 'decisions', 'entryActivities', 'visitSlots']) {
    delete third[key];
    delete third.totals[key];
  }
  assert.deepEqual([checkHomeCareExport(third).ok, checkHomeCareExport(third).problems], [true, []]);
  /* Versioon 4 tunneb hoolduskavasid, aga mitte veel otsuseid. */
  const fourth = make();
  fourth.version = 4;
  for (const key of ['decisions', 'entryActivities', 'visitSlots']) {
    delete fourth[key];
    delete fourth.totals[key];
  }
  assert.deepEqual([checkHomeCareExport(fourth).ok, checkHomeCareExport(fourth).problems], [true, []]);
  /* Versioon 5 tunneb otsuseid, aga mitte veel käigul tehtud toiminguid. */
  const fifth = make();
  fifth.version = 5;
  for (const key of ['entryActivities', 'visitSlots']) {
    delete fifth[key];
    delete fifth.totals[key];
  }
  assert.deepEqual([checkHomeCareExport(fifth).ok, checkHomeCareExport(fifth).problems], [true, []]);
  /* Versioon 6 tunneb tehtud toiminguid, aga mitte veel käigumustrit. */
  const sixth = make();
  sixth.version = 6;
  delete sixth.visitSlots;
  delete sixth.totals.visitSlots;
  assert.deepEqual([checkHomeCareExport(sixth).ok, checkHomeCareExport(sixth).problems], [true, []]);
  /* Käigumustri rida, mis viitab olematule kliendile, on viga; uue versiooni failis on kogu puudumine viga. */
  assert.match(problems((doc) => { doc.visitSlots[0].clientId = 'olematu'; }).join(' '), /visitSlots/);
  assert.match(problems((doc) => { delete doc.visitSlots; }).join(' '), /visitSlots/);
  /* Tehtud toiming, mis viitab olematule kirjele, on viga; tühi kava- ja toiminguviide ei ole. */
  assert.match(problems((doc) => { doc.entryActivities[0].entryId = 'olematu'; }).join(' '), /entryActivities/);
  assert.match(problems((doc) => { delete doc.entryActivities; }).join(' '), /entryActivities/);
  /* Otsus, mis viitab olematule kliendile, on viga; uue versiooni failis on kogu puudumine viga. */
  assert.match(problems((doc) => { doc.decisions[0].clientId = 'olematu'; }).join(' '), /decisions/);
  assert.match(problems((doc) => { delete doc.decisions; }).join(' '), /decisions/);
  /* Kava rida, mis viitab olematule kavale, on viga; tühi toiminguviide (toiming kustutatud) ei ole. */
  assert.match(problems((doc) => { doc.carePlanLines[0].planId = 'olematu'; }).join(' '), /carePlanLines/);
  assert.match(problems((doc) => { delete doc.clientStatusChanges; }).join(' '), /clientStatusChanges/);
  assert.match(problems((doc) => { delete doc.activities; }).join(' '), /activities/);
  assert.match(problems((doc) => { delete doc.exportId; })[0], /exportId/);
  /* Poolik fail: lõpus olevad koguarvud puuduvad. */
  assert.ok(problems((doc) => { delete doc.totals; }).some((line) => /poolik/.test(line)));
  assert.ok(problems((doc) => { delete doc.accessLog; }).some((line) => /accessLog/.test(line)));

  /* Arvud ja ID-d. */
  assert.match(problems((doc) => { doc.entries.push({ id: 'n2', clientId: 'c1' }); })[0], /entries.*2 rida.*koguarv ütleb 1/);
  assert.ok(problems((doc) => { doc.clients[1].id = 'c1'; }).some((line) => /clients.*kordub 1/.test(line)));
  assert.ok(problems((doc) => { delete doc.cardLines[0].id; }).some((line) => /cardLines.*ilma ID-ta/.test(line)));

  /* Viited: kirje ilma kliendita, parandus ilma kirjeta, lõik ilma ajaloota, tundmatu üksus. */
  assert.deepEqual(problems((doc) => { doc.entries[0].clientId = 'c9'; }), ['Kogus „entries" ei leia 1 rea väli „clientId" oma rida kogust „clients".']);
  assert.ok(problems((doc) => { doc.entryRevisions[0].entryId = 'n9'; }).some((line) => /entryRevisions.*entryId.*entries/.test(line)));
  assert.ok(problems((doc) => { doc.importedHistoryBlocks[1].historyId = 'h9'; }).some((line) => /importedHistoryBlocks.*historyId/.test(line)));
  assert.ok(problems((doc) => { doc.clients[0].unitId = 'u9'; }).some((line) => /clients.*unitId.*units/.test(line)));
  /* Kohustuslik viide ei tohi olla tühi. */
  assert.ok(problems((doc) => { doc.teamMembers[0].clientId = null; }).some((line) => /teamMembers.*clientId/.test(line)));

  /* Rea enda väide: lõikude ja väljastuse ridade arv. */
  assert.ok(problems((doc) => { doc.importedHistories[0].blockCount = 3; }).some((line) => /lõikude arv/.test(line)));
  assert.ok(problems((doc) => { doc.chronologyReleases[0].entryCount = 2; }).some((line) => /ridade arv/.test(line)));

  /* Tundmatu töötaja on tähelepanek, mitte viga: need viited on andmebaasis võõrvõtmeta jäljed. */
  const loose = make();
  loose.entries[0].authorMembershipId = 'm9';
  const looseCheck = checkHomeCareExport(loose);
  assert.equal(looseCheck.ok, true);
  assert.deepEqual(looseCheck.notes, ['Kogus „entries" on 1 viidet töötajale, keda loendis „people" ei ole.']);

  /* Iga väljajätt ja iga põhjus on lehel sõnadega kirjas kõigis kolmes keeles. */
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).home_care.export;
    assert.deepEqual(Object.keys(messages.excluded).sort(), HOME_CARE_EXPORT_EXCLUSIONS.map((item) => item.key).sort(), locale);
    assert.deepEqual(Object.keys(messages.reasons).sort(), [...CARE_EXPORT_REASONS].sort(), locale);
  }
  assert.ok(HOME_CARE_EXPORT_EXCLUSIONS.every((item) => item.why.length > 20));
});
