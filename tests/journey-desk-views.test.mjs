// Avatud Teekonna laud: osade reeglid ja vaadete tekstid.
//
// Avatud Teekond oli üks pikk veerg; nüüd on see laud, kus iga osa on üks asi
// (components/journey/detail). Laua otsused on puhaste funktsioonidena failis
// journeyDesk.js ja neid kontrollitakse siin käitumise järgi: mis seisu plaat
// näitab, mida saab jagamisse kaasa võtta, millal vorm on muudetud ja mis sõna
// kannab iga seis, mis võib ekraanile jõuda.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DESK_PARTS,
  DEVICE_STATUSES,
  HELP_REQUEST_DEFAULT_SHARE,
  PRE_INQUIRY_DEFAULT_SHARE,
  RELATED_GROUPS,
  ROAD_STATE_KEYS,
  continuityForm,
  continuityOf,
  counterNear,
  dayOf,
  deskTiles,
  deviceStatusKey,
  firstLine,
  formDirty,
  hasContinuity,
  helpCategoryKey,
  helpKinds,
  helpOfferMatchHref,
  helpRequestShareOptions,
  isArchived,
  journeyLifeDomains,
  journeyStateKey,
  journeyWish,
  linesToText,
  linkedState,
  plainDayLabel,
  preInquiryShareOptions,
  pressTooSoon,
  relatedCounts,
  reviewedShareHref,
  roadFocus,
  sentSummaryKey,
  shareBlockKey,
  situationForm,
  situationProblemKey,
  startTarget,
  stepGroups,
  stepMeta,
  stepSuggestions,
  textToLines,
  toggleKey
} from '../components/journey/detail/journeyDesk.js';
import { HELP_CATEGORY_CODES } from '../components/chat/selectedListingSheet.js';
import { AssessmentChange, JOURNEY_ASSESSMENT_LEVELS } from '../lib/journey/assessmentRules.js';
import { JOURNEY_CLOSURE_KINDS, JOURNEY_CLOSURE_OUTCOMES } from '../lib/journey/closureRules.js';
import { JOURNEY_PRIMARY_PATHS, JOURNEY_STATUSES } from '../lib/journey/constants.js';
import { inferHelpCategoryCode } from '../lib/journey/helpMediationHandoff.js';
import { LINKED_PRE_INQUIRY_STATES } from '../lib/journey/linkedPreInquiryState.js';
import { PAPER_SHEET_PARTS } from '../lib/journey/paperSheet.js';
import { RoadmapState, journeyRoadmap } from '../lib/journey/roadmap.js';
import { JOURNEY_STEP_STATES } from '../lib/journey/stepRules.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
/* Tõlkija nagu lehel: puuduva võtme korral tagastab võtme enda. */
const translator = (lang) => {
  const messages = catalog(lang);
  return (key, vars) => {
    const value = at(messages, key);
    if (typeof value !== 'string') return key;
    return vars ? value.replace(/\{(\w+)\}/g, (_match, name) => String(vars[name] ?? '')) : value;
  };
};
const t = translator('et');
const word = (lang, key) => typeof at(catalog(lang), key) === 'string';

const journey = (over = {}) => ({
  id: 'jrn_1',
  status: 'ACTIVE',
  title: 'Ema vajab kodus abi',
  summary: 'Ema kukkus ja ei saa üksi poes käia.\n\nTahan teada, kuhu pöörduda.',
  primaryPath: 'PRE_INQUIRY',
  domains: ['eakate hooldus'],
  missingInfo: ['Millises omavalitsuses abi vajatakse?'],
  riskSignals: [],
  suggestedActions: [{ type: 'CREATE_PRE_INQUIRY', title: 'Koosta eelpöördumine' }, 'Räägi emaga'],
  context: {},
  updatedAt: '2026-10-10T09:30:00.000Z',
  steps: [],
  assessments: { baseline: null, latest: null, change: null, items: [] },
  preInquiryFacts: { total: 0, sent: 0, opened: 0, answered: 0 },
  closure: { current: null, history: [] },
  linkedPreInquiries: [],
  ...over
});
const step = (over = {}) => ({ id: 's1', title: 'Helista valda', state: 'TODO', doer: null, dueOn: null, note: null, ...over });
const tileOf = (tiles, key) => tiles.find((tile) => tile.key === key);

test('laua osad on kindlas järjekorras ja aadressi märge avab õige osa', () => {
  assert.deepEqual(DESK_PARTS, ['situation', 'wish', 'steps', 'feeling', 'sent', 'share', 'help', 'continuity', 'road', 'closure', 'data']);
  assert.deepEqual(startTarget('PRE_INQUIRY'), { part: 'share', view: 'choose' });
  assert.deepEqual(startTarget('SERVICE_MAP'), { part: 'help', view: 'map' });
  for (const value of ['', 'MIDAGI', 'toString', 'constructor', undefined, null]) assert.equal(startTarget(value), null, String(value));
  for (const target of [startTarget('PRE_INQUIRY'), startTarget('SERVICE_MAP')]) assert.ok(DESK_PARTS.includes(target.part));
});

test('igal osal on nimi ja lühinimi kiirmenüü jaoks kolmes keeles', () => {
  for (const lang of LANGS) {
    const messages = catalog(lang);
    for (const part of DESK_PARTS) {
      const names = at(messages, `journey.desk.parts.${part}`);
      assert.ok(names?.title && names?.short, `${lang}: ${part}`);
      assert.ok(names.short.length <= 18, `${lang}: ${part} lühinimi mahub kiirmenüüsse (${names.short.length})`);
    }
  }
});

test('Teekonna seis: paus ja lõpetamine oma sõnaga, tundmatu liik jääb arhiveerituks', () => {
  assert.equal(journeyStateKey(journey()), 'journey.status.ACTIVE');
  assert.equal(journeyStateKey(journey({ status: 'DRAFT' })), 'journey.status.DRAFT');
  assert.equal(journeyStateKey(journey({ status: 'ARCHIVED' })), 'journey.status.ARCHIVED');
  assert.equal(journeyStateKey(journey({ status: 'ARCHIVED', closure: { current: { kind: 'PAUSED' } } })), 'journey.closure.status.PAUSED');
  assert.equal(journeyStateKey(journey({ status: 'ARCHIVED', closure: { current: { kind: 'MUU' } } })), 'journey.status.ARCHIVED');
  assert.equal(isArchived(journey({ status: 'ARCHIVED' })), true);
  assert.equal(isArchived(journey()), false);
  for (const lang of LANGS) {
    for (const status of JOURNEY_STATUSES) {
      for (const kind of [null, ...JOURNEY_CLOSURE_KINDS]) {
        const key = journeyStateKey({ status, closure: { current: kind ? { kind } : null } });
        assert.ok(word(lang, key), `${lang}: ${key}`);
      }
    }
  }
});

test('sammud: tegemata ja lõpetatud eraldi; pakutud read ilma juba võetute ja liiga pikkadeta', () => {
  const j = journey({
    steps: [step({ id: 'a' }), step({ id: 'b', state: 'DONE', title: 'Räägi emaga' }), step({ id: 'c', state: 'DROPPED' })],
    suggestedActions: [{ title: 'Koosta eelpöördumine' }, 'räägi EMAGA', 'Koosta eelpöördumine', { title: 'x'.repeat(201) }, { type: 'TÜHI' }]
  });
  assert.deepEqual(stepGroups(j).open.map((item) => item.id), ['a']);
  assert.deepEqual(stepGroups(j).closed.map((item) => item.id), ['b', 'c']);
  /* Sama pealkirjaga samm on juba olemas (suurtähti ei loeta), kordus ja liiga pikk rida jäävad välja. */
  assert.deepEqual(stepSuggestions(j), ['Koosta eelpöördumine']);
  assert.deepEqual(stepSuggestions(journey({ suggestedActions: null })), []);
});

test('sammu rida: kes teeb, mis ajaks ja kas tähtaeg on möödas', () => {
  const today = '2026-10-10';
  assert.equal(stepMeta(step(), { t, today }), '');
  assert.equal(stepMeta(step({ doer: 'mina', dueOn: '2026-10-13' }), { t, today }), 'Teeb: mina · Tähtaeg: 13.10.2026');
  assert.equal(stepMeta(step({ dueOn: '2026-10-09' }), { t, today }), 'Tähtaeg: 09.10.2026 · tähtaeg on möödas');
  /* Tänane tähtaeg ei ole möödas; lõpetatud samm ei ole kunagi hilinenud. */
  assert.equal(stepMeta(step({ dueOn: '2026-10-10' }), { t, today }), 'Tähtaeg: 10.10.2026');
  assert.equal(stepMeta(step({ dueOn: '2026-10-01', state: 'DONE' }), { t, today }), 'Tähtaeg: 01.10.2026');
});

test('saadetud pöördumiste lause tuleb faktidest: vastus on tugevaim', () => {
  const key = (facts) => sentSummaryKey(journey({ preInquiryFacts: facts }));
  assert.equal(key({ total: 0, sent: 0, opened: 0, answered: 0 }), 'journey.desk.sent.none');
  assert.equal(key({ total: 1, sent: 0, opened: 0, answered: 0 }), 'journey.desk.sent.draft');
  assert.equal(key({ total: 2, sent: 1, opened: 0, answered: 0 }), 'journey.desk.sent.sent');
  assert.equal(key({ total: 2, sent: 1, opened: 1, answered: 0 }), 'journey.desk.sent.opened');
  assert.equal(key({ total: 2, sent: 1, opened: 0, answered: 1 }), 'journey.desk.sent.answered');
  assert.equal(sentSummaryKey({}), 'journey.desk.sent.none');
  /* Rea seis tuleb serverilt; kui seda ei ole, tuletatakse see samadest faktidest. */
  assert.equal(linkedState({ state: 'ANSWERED' }), 'ANSWERED');
  assert.equal(linkedState({ status: 'READY', sentAt: '2026-10-01T00:00:00Z', openedAt: '2026-10-02T00:00:00Z' }), 'OPENED');
});

test('eelpöördumisse saab kaasa võtta ainult seda, mis Teekonnas olemas on', () => {
  const plain = preInquiryShareOptions(journey()).map((option) => option.value);
  assert.deepEqual(plain, ['summary', 'domains', 'missingInfo', 'title']);
  const full = preInquiryShareOptions(
    journey({ context: { personWish: 'Soov', personContext: 'Isa on 82', serviceContinuity: { serviceName: 'Koduteenus' }, municipalityName: 'Tartu', contextNote: 'Otsus' } }),
    { hasAssistiveDeviceNeed: true }
  ).map((option) => option.value);
  assert.deepEqual(full, ['summary', 'domains', 'missingInfo', 'assistiveDevices', 'wish', 'personContext', 'serviceContinuity', 'municipality', 'document', 'title']);
  assert.deepEqual([...PRE_INQUIRY_DEFAULT_SHARE], ['summary', 'domains', 'missingInfo']);
  for (const lang of LANGS) for (const option of preInquiryShareOptions(journey({ context: { personWish: 'x', personContext: 'y', serviceContinuity: {}, municipality: 'z', contextNote: 'n' } }), { hasAssistiveDeviceNeed: true })) assert.ok(word(lang, option.labelKey), `${lang}: ${option.labelKey}`);
});

test('abisoovi kaasa võetav sõltub sellest, mida platvorm Teekonnast leidis', () => {
  const none = helpRequestShareOptions(journey(), { categoryCode: '', municipalityName: '' }).map((option) => option.value);
  assert.deepEqual(none, ['summary']);
  const full = helpRequestShareOptions(
    journey({ context: { personWish: 'Soov', helpMediation: { timing: 'hommikuti', conditions: 'tasuta' } } }),
    { categoryCode: 'TRANSPORT', municipalityName: 'Tartu linn' }
  ).map((option) => option.value);
  assert.deepEqual(full, ['summary', 'category', 'region', 'timing', 'conditions', 'ownWords']);
  assert.deepEqual([...HELP_REQUEST_DEFAULT_SHARE], ['summary', 'category', 'region', 'ownWords']);
});

test('edasi viiv aadress kannab valitud osi ja jätab olemasoleva päringu alles', () => {
  assert.equal(reviewedShareHref('/eelpoordumised?fromJourney=j1&workspaceRole=CLIENT', ['summary', 'wish']), '/eelpoordumised?fromJourney=j1&workspaceRole=CLIENT&shareReview=1&share=summary%2Cwish');
  assert.equal(reviewedShareHref('/vestlus?workflow=help_request&share=vana', []), '/vestlus?workflow=help_request&shareReview=1');
  assert.equal(reviewedShareHref('/eelpoordumised', ['summary', '', null]), '/eelpoordumised?shareReview=1&share=summary');
});

test('valiku lüliti ja põhjus, miks jagamisega edasi minna ei saa', () => {
  assert.deepEqual(toggleKey(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(toggleKey(['a'], 'b'), ['a', 'b']);
  assert.deepEqual(toggleKey(null, 'a'), ['a']);
  assert.equal(shareBlockKey([], false), 'journey.desk.share.need_choice');
  assert.equal(shareBlockKey(['summary'], false), '');
  /* Teise inimese teave: enne kinnitust edasi ei saa. */
  assert.equal(shareBlockKey(['summary', 'personContext'], false), 'journey.desk.share.need_ack');
  assert.equal(shareBlockKey(['summary', 'personContext'], true), '');
});

test('olukorra vorm: read on tekstina, muudetud vorm on teada ja tühi pealkiri või kirjeldus ei salvestu', () => {
  const j = journey();
  const form = situationForm(j);
  assert.equal(form.domains, 'eakate hooldus');
  assert.equal(form.suggestedActions, 'Koosta eelpöördumine\nRäägi emaga');
  assert.equal(formDirty(form, situationForm(j)), false);
  assert.equal(formDirty({ ...form, title: 'Uus pealkiri' }, situationForm(j)), true);
  assert.equal(formDirty({ ...form, missingInfo: `${form.missingInfo}\nUus rida` }, situationForm(j)), true);
  assert.equal(formDirty(null, form), false);
  assert.deepEqual(textToLines(' esimene \n\n teine\r\nkolmas '), ['esimene', 'teine', 'kolmas']);
  assert.equal(linesToText([{ title: 'a' }, ' b ', { nimi: 'x' }, '']), 'a\nb');
  assert.equal(situationProblemKey({ title: ' ', summary: 'x' }), 'journey.desk.situation.need_title');
  assert.equal(situationProblemKey({ title: 'x', summary: '' }), 'journey.desk.situation.need_summary');
  assert.equal(situationProblemKey({ title: 'x', summary: 'y' }), '');
  /* Puuduva Teekonna vorm on tühi, mitte katki. */
  assert.equal(situationForm(null).primaryPath, 'UNKNOWN');
});

test('teenuse jätkumine: salvestatud vastused tulevad vormi tagasi samade valikutena', () => {
  assert.equal(hasContinuity(journey()), false);
  const saved = journey({ context: { serviceContinuity: { serviceName: 'Koduteenus', hasExistingService: true, knownEndDate: false, kovAlreadyInvolved: null, endDate: '', userGoal: 'Jätkuks' } } });
  assert.equal(hasContinuity(saved), true);
  const form = continuityForm(saved);
  assert.deepEqual([form.serviceName, form.hasExistingService, form.knownEndDate, form.kovAlreadyInvolved, form.userGoal], ['Koduteenus', 'YES', 'NO', '', 'Jätkuks']);
  assert.equal(formDirty(form, continuityForm(saved)), false);
  assert.equal(formDirty({ ...form, knownEndDate: 'YES' }, continuityForm(saved)), true);
  /* Tühjade väärtustega kirje ei ole täidetud kontroll. */
  assert.equal(hasContinuity(journey({ context: { serviceContinuity: { serviceName: '', hasExistingService: null } } })), false);
  assert.deepEqual(continuityOf(journey({ context: { serviceContinuity: 'tekst' } })), {});
});

test('teekonnarada: ees on pooleli või soovitatud rida, muidu viimane tehtud', () => {
  assert.equal(roadFocus(journey()).key, 'pre_inquiry');
  assert.equal(roadFocus(journey({ steps: [step()], primaryPath: 'UNKNOWN' })).key, 'steps');
  const done = roadFocus(journey({ primaryPath: 'UNKNOWN', steps: [step({ state: 'DONE' })], preInquiryFacts: { total: 1, sent: 1, opened: 1, answered: 1 } }));
  assert.deepEqual([done.key, done.state], ['steps', 'done']);
  for (const lang of LANGS) {
    for (const row of journeyRoadmap(journey())) assert.ok(word(lang, `journey.roadmap.${row.key}`), `${lang}: ${row.key}`);
    for (const state of Object.values(RoadmapState)) assert.ok(word(lang, ROAD_STATE_KEYS[state]), `${lang}: ${state}`);
  }
});

test('plaadid: tühi Teekond ütleb igas osas, mis seal on, ilma ühegi toore võtmeta', () => {
  for (const lang of LANGS) {
    const tr = translator(lang);
    const tiles = deskTiles(journey(), { t: tr, today: '2026-10-10', helpKinds: helpKinds(), levelWord: (level) => tr(`journey.assessment.levels.${level}`) });
    assert.deepEqual(tiles.map((tile) => tile.key), DESK_PARTS);
    for (const tile of tiles) {
      assert.ok(tile.label && tile.short && tile.summaryText, `${lang}: ${tile.key}`);
      for (const value of [tile.label, tile.short, tile.summaryText]) assert.ok(!/^(journey|chat)\.[a-z_.]+/i.test(value), `${lang}: ${tile.key} toores võti „${value}"`);
      assert.equal(tile.free, true);
    }
  }
  const tiles = deskTiles(journey(), { t, today: '2026-10-10', helpKinds: helpKinds() });
  assert.deepEqual(
    Object.fromEntries(tiles.map((tile) => [tile.key, tile.state])),
    { situation: 'done', wish: 'empty', steps: 'empty', feeling: 'empty', sent: 'empty', share: 'empty', help: 'empty', continuity: 'empty', road: 'done', closure: 'empty', data: 'empty' }
  );
  assert.equal(tiles.some((tile) => tile.attention), false);
  assert.equal(tileOf(tiles, 'situation').summaryText, 'Ema kukkus ja ei saa üksi poes käia.');
});

test('plaadid: täidetud Teekond näitab järgmist sammu, viimast märget ja saaja vastust', () => {
  const full = journey({
    context: { personWish: 'Tahan, et ema saaks kodus elada.\nJa et ma jaksaksin.', serviceContinuity: { serviceName: 'Koduteenus' } },
    steps: [step({ id: 'a', title: 'Helista valda', dueOn: '2026-10-13' }), step({ id: 'b', title: 'Vii avaldus', dueOn: '2026-10-01' }), step({ id: 'c', state: 'DONE' })],
    assessments: { baseline: { level: 2, createdAt: '2026-10-01T08:00:00Z' }, latest: { level: 3, createdAt: '2026-10-10T08:00:00Z' }, change: AssessmentChange.BETTER, items: [{}, {}] },
    preInquiryFacts: { total: 2, sent: 1, opened: 1, answered: 1 }
  });
  const tiles = deskTiles(full, { t, today: '2026-10-10', helpKinds: helpKinds({ hasPracticalNeed: true }), levelWord: (level) => t(`journey.assessment.levels.${level}`) });
  assert.equal(tileOf(tiles, 'wish').summaryText, 'Tahan, et ema saaks kodus elada.');
  /* Möödunud tähtajaga samm on ees ja plaat on märgitud. */
  assert.equal(tileOf(tiles, 'steps').summaryText, 'Vii avaldus · Tähtaeg: 01.10.2026 · tähtaeg on möödas');
  assert.equal(tileOf(tiles, 'steps').attention, true);
  assert.equal(tileOf(tiles, 'feeling').summaryText, 'nii ja naa, parem kui alguses');
  assert.equal(tileOf(tiles, 'sent').summaryText, 'Saaja on vastanud.');
  assert.equal(tileOf(tiles, 'sent').attention, true);
  assert.equal(tileOf(tiles, 'help').summaryText, 'Teenusekaart, Abivahendus');
  assert.equal(tileOf(tiles, 'continuity').summaryText, 'Koduteenus');
  assert.equal(tileOf(tiles, 'continuity').state, 'done');

  /* Ainult algseis: plaat ütleb algseisu, mitte tühja muutust. */
  const first = deskTiles(journey({ assessments: { baseline: { level: 2, createdAt: '2026-10-01T08:00:00Z' }, latest: null, change: null, items: [{}] } }), { t, levelWord: (level) => t(`journey.assessment.levels.${level}`) });
  assert.match(tileOf(first, 'feeling').summaryText, /^Algseis \d{2}\.10\.2026: raske\.$/);
  /* Kõik sammud lõpetatud. */
  assert.equal(tileOf(deskTiles(journey({ steps: [step({ state: 'DONE' })] }), { t }), 'steps').summaryText, 'Kõik sammud on lõpetatud.');
});

test('plaadid: kõrvale pandud Teekond ütleb, miks, ja käes olev jätkamise päev on märgitud', () => {
  const paused = journey({ status: 'ARCHIVED', closure: { current: { kind: 'PAUSED', closedAt: '2026-10-01T08:00:00Z', resumeOn: '2026-10-09', resumeDue: true }, history: [] } });
  const tiles = deskTiles(paused, { t, today: '2026-10-10' });
  assert.match(tileOf(tiles, 'closure').summaryText, /^Teekond on pausil alates \d{2}\.10\.2026\. Plaanisid jätkata 09\.10\.2026\.$/);
  assert.equal(tileOf(tiles, 'closure').attention, true);
  assert.equal(tileOf(tiles, 'closure').state, 'done');
  assert.equal(tileOf(tiles, 'share').summaryText, 'Kõrvale pandud Teekonnal muuta ei saa.');
  for (const outcome of JOURNEY_CLOSURE_OUTCOMES) {
    const finished = journey({ status: 'ARCHIVED', closure: { current: { kind: 'FINISHED', closedAt: '2026-10-05T08:00:00Z', outcome }, history: [] } });
    const text = tileOf(deskTiles(finished, { t }), 'closure').summaryText;
    assert.ok(text.startsWith('Teekond on lõpetatud') && !text.includes('journey.'), text);
  }
  assert.equal(tileOf(deskTiles(journey({ status: 'ARCHIVED' }), { t }), 'closure').summaryText, 'Teekond on arhiveeritud.');
});

test('abi otsimise vaated: teenusekaart alati, teised ainult märgi korral', () => {
  assert.deepEqual(helpKinds(), ['map']);
  assert.deepEqual(helpKinds({ hasPracticalNeed: true, hasAssistiveDeviceNeed: true, hasHealthSignal: true }), ['map', 'mediation', 'devices', 'health']);
  assert.deepEqual(helpKinds({ hasHealthSignal: true }), ['map', 'health']);
  for (const lang of LANGS) for (const kind of ['label', 'map', 'mediation', 'devices', 'health']) assert.ok(word(lang, `journey.desk.help.kinds.${kind}`), `${lang}: ${kind}`);
});

test('abivahendi seis ja abi liik on sõnad, tundmatu väärtus ei jõua ekraanile', () => {
  for (const lang of LANGS) {
    for (const status of DEVICE_STATUSES) assert.ok(word(lang, deviceStatusKey(status)), `${lang}: ${status}`);
    /* Abi liikide loend on sama, mida kasutavad abikuulutused. */
    for (const code of HELP_CATEGORY_CODES) assert.ok(word(lang, helpCategoryKey(code)), `${lang}: ${code}`);
  }
  /* Liik, mille platvorm kirjeldusest tuletab, on alati selles loendis. */
  for (const text of ['transport arsti juurde', 'poes käimine', 'koduabi', 'digiabi', 'hooldus', 'laps', 'juhendamine', 'suhtlemine', 'avaldus', 'midagi muud']) {
    const code = inferHelpCategoryCode({ summary: text });
    assert.ok(code === '' || HELP_CATEGORY_CODES.includes(code), `${text}: ${code}`);
  }
  assert.equal(deviceStatusKey('needed'), 'journey.desk.help.device_status.NEEDED');
  assert.equal(deviceStatusKey('MIDAGI MUUD'), '');
  assert.equal(deviceStatusKey(null), '');
  assert.equal(helpCategoryKey(''), 'chat.help.categories.OTHER');
});

test('abipakkumiste otsing: ainult praktilise vajaduse korral, märksõna ja piirkonnaga', () => {
  assert.equal(helpOfferMatchHref(null), '');
  assert.equal(helpOfferMatchHref({ hasPracticalNeed: false }), '');
  assert.equal(
    helpOfferMatchHref({ hasPracticalNeed: true, categoryCode: 'TRANSPORT', taxonomy: { needTags: ['transport'] }, municipalityName: 'Tartu linn' }),
    '/api/service-map/entries?type=HELP_OFFER&limit=1&q=transport&municipalityName=Tartu+linn'
  );
  assert.equal(helpOfferMatchHref({ hasPracticalNeed: true, categoryCode: 'HOME_HELP', taxonomy: {} }), '/api/service-map/entries?type=HELP_OFFER&limit=1&q=HOME_HELP');
});

test('seotud asjad: näidatakse, mitu neid on, mitte viiteid endid', () => {
  assert.deepEqual(relatedCounts(journey()), []);
  const counts = relatedCounts(journey({ context: { linkedDocumentIds: ['doc_1', 'doc_2', ''], linkedRoomIds: 'tekst', linkedHelpOfferIds: [] } }));
  assert.deepEqual(counts.map((group) => [group.key, group.count]), [['linkedDocumentIds', 2]]);
  for (const lang of LANGS) for (const [, labelKey] of RELATED_GROUPS) assert.ok(word(lang, labelKey), `${lang}: ${labelKey}`);
});

test('väikesed abilised: esimene rida, päevad, eluvaldkonnad, soov ja loendur', () => {
  assert.equal(firstLine('\n  Esimene rida.  \nTeine.'), 'Esimene rida.');
  assert.equal(firstLine('a'.repeat(200), 20).length, 20);
  assert.equal(firstLine(null), '');
  assert.equal(plainDayLabel('2026-10-15'), '15.10.2026');
  assert.equal(plainDayLabel('15.10.2026'), '');
  assert.equal(dayOf('pole kuupäev'), '');
  assert.match(dayOf('2026-10-10T09:30:00.000Z'), /^\d{2}\.10\.2026$/);
  assert.deepEqual(journeyLifeDomains(journey()), ['igapäevaelu toimingud', 'võrgustik ja kõrvalabi']);
  assert.deepEqual(journeyLifeDomains(journey({ context: { lifeDomains: ['hõivatus'] } })), ['hõivatus']);
  assert.equal(journeyWish(journey({ context: { personWish: 'Soov' } })), 'Soov');
  assert.equal(journeyWish(journey({ context: [] })), '');
  assert.equal(counterNear('a'.repeat(10), 1000), null);
  assert.deepEqual(counterNear('a'.repeat(900), 1000), { current: 900, limit: 1000 });
  assert.equal(pressTooSoon(1000, 1300), true);
  assert.equal(pressTooSoon(1000, 1500), false);
});

test('igal väärtusel, millest leht võtme kokku paneb, on sõna kolmes keeles', () => {
  for (const lang of LANGS) {
    const check = (prefix, values) => {
      for (const value of values) assert.ok(word(lang, `${prefix}.${value}`), `${lang}: ${prefix}.${value}`);
    };
    check('journey.own_steps.states', JOURNEY_STEP_STATES);
    check('journey.assessment.levels', JOURNEY_ASSESSMENT_LEVELS);
    check('journey.assessment.change', Object.values(AssessmentChange));
    check('journey.closure.outcomes', JOURNEY_CLOSURE_OUTCOMES);
    check('journey.related.pre_inquiry_state', LINKED_PRE_INQUIRY_STATES);
    check('journey.primary_paths', JOURNEY_PRIMARY_PATHS);
    check('journey.paper_ui.parts', PAPER_SHEET_PARTS);
    check('journey.desk.situation.tabs', ['label', 'text', 'direction', 'topics', 'notes']);
    check('journey.desk.situation.read_tabs', ['label', 'text', 'noticed']);
    check('journey.desk.continuity.tabs', ['label', 'service', 'time', 'state', 'goal']);
    check('journey.desk.data.tabs', ['paper', 'file', 'delete']);
    check('journey.serviceContinuity', ['hasExistingService', 'knownEndDate', 'hasDecisionOrPlan', 'documentAttached', 'kovAlreadyInvolved', 'providerAlreadyInvolved']);
    check('notifications.events', ['workspace_created', 'workspace_updated', 'workspace_activated', 'workspace_archived']);
  }
});

test('vaadete tekstivõtmed on kataloogis kolmes keeles', () => {
  const sources = ['JourneyDetail.jsx', 'JourneySteps.jsx', 'JourneyAssessment.jsx', 'JourneyClosure.jsx', 'JourneyPaperSheet.jsx', 'detail/DeskParts.jsx', 'detail/DeskBits.jsx', 'detail/journeyDesk.js'];
  const keys = new Set();
  for (const source of sources) {
    for (const match of read(`../components/journey/${source}`).matchAll(/["'`]((?:journey|chat)\.[A-Za-z_]+(?:\.[A-Za-z_0-9]+)+)["'`]/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 150, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('lehe lubadused: kustutamine küsib teist vajutust, teated ei kasuta status-rolli, brauseri dialoogi ei ole', () => {
  const files = ['JourneyDetail.jsx', 'JourneySteps.jsx', 'JourneyAssessment.jsx', 'JourneyClosure.jsx', 'JourneyPaperSheet.jsx', 'detail/DeskParts.jsx', 'detail/DeskBits.jsx'];
  for (const file of files) {
    const source = read(`../components/journey/${file}`);
    assert.ok(!source.includes('role="status"'), `${file}: status-roll`);
    assert.ok(!/window\.(confirm|alert|prompt)\(/.test(source), `${file}: brauseri dialoog`);
    assert.ok(!/<(textarea|select)\b/.test(source), `${file}: paljas väli vana kihi peal`);
  }
  /* Kolm kustutamist (samm, märge, Teekond) käivad kahe vajutusega nupu kaudu. */
  assert.ok(/<TwoPress[^>]*\n?[^>]*danger[\s\S]{0,400}journey\.own_steps\.delete/.test(read('../components/journey/JourneySteps.jsx')));
  assert.ok(/<TwoPress[\s\S]{0,200}journey\.assessment\.delete/.test(read('../components/journey/JourneyAssessment.jsx')));
  assert.ok(/<TwoPress[\s\S]{0,200}journey\.actions\.delete/.test(read('../components/journey/detail/DeskParts.jsx')));
  /* Vana üldkiht on läinud: Teekonna lehed ei kasuta enam üldisi journey-klasse. */
  assert.ok(!fs.existsSync(new URL('../app/styles/journey.css', import.meta.url)));
  assert.ok(!read('../app/styles/globals.css').includes('journey.css'));
  for (const file of [...files, 'JourneyDashboard.jsx', 'dashboard/DashboardViews.jsx']) assert.ok(!/className="journey-/.test(read(`../components/journey/${file}`)), file);
});

test('eestikeelsetes laua tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const walk = (node, path, out) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') out.push([`${path}.${key}`, value]);
      else if (value && typeof value === 'object') walk(value, `${path}.${key}`, out);
    }
    return out;
  };
  for (const [key, value] of walk(catalog('et').journey.desk, 'journey.desk', [])) assert.ok(!/[—–"]/.test(value), `${key}: ${value}`);
});
