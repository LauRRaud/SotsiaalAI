// Mentorluse avalehed (avaleht, minu mentoriprofiil, mentori profiil): read, otsused ja tekstid.
//
// Kolm lehte olid pikad veerud tumeda kaardi sees; nüüd on need vaadetena sammulaval
// (components/mentoring/entry). Test hoiab seda, mida silm kergesti ei märka: puuduv
// tõlkevõti, nimeta vaade, toores serveri kood ekraanil, ühe vajutusega lõplik tegevus
// ja nupp, mida server selles seisus ei luba.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CATALOG_CAP,
  EDITABLE_PROFILE_STATUSES,
  ESTA_MENTORS_URL,
  HOME_VIEW_KEYS,
  PROFILE_ACTIONS,
  PROFILE_LIMITS,
  PROFILE_VIEW_KEYS,
  PUBLIC_VIEW_KEYS,
  RETIRABLE_PROFILE_STATUSES,
  REVIEW_REASON_KEYS,
  STATUS_WORDS,
  catalogFacets,
  filterQuery,
  homeParts,
  incomingRows,
  isDirty,
  mentorRows,
  missingForReview,
  overLimit,
  pickGroup,
  profilePayload,
  profileStateModel,
  profileSteps,
  publicParts,
  publicProfileModel,
  relationRows,
  safeExternalUrl,
  sentRows,
  splitList,
  statusWord,
  mergeAfterConflict,
  toForm
} from '../components/mentoring/entry/entryRows.js';
import {
  MENTOR_PROFILE_STATUS,
  MENTORING_LIMITS,
  MENTORING_RELATION_STATUS,
  MENTORING_REQUEST_STATUS
} from '../lib/mentoring/constants.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const PAGES = [
  '../components/mentoring/MentoringHomePage.jsx',
  '../components/mentoring/MyMentorProfilePage.jsx',
  '../components/mentoring/MentorProfilePublicPage.jsx'
];
const VIEWS = [
  '../components/mentoring/entry/HomeViews.jsx',
  '../components/mentoring/entry/MyProfileViews.jsx',
  '../components/mentoring/entry/PublicProfileViews.jsx',
  '../components/mentoring/entry/EntryParts.jsx'
];
const SOURCES = [...PAGES, ...VIEWS, '../components/mentoring/entry/entryRows.js'];

/* Tõlkija, mis näitab, mis võtmega ja mis muutujatega teksti küsiti. */
const t = (key, vars) => (vars ? `[${key} ${Object.entries(vars).map(([name, value]) => `${name}=${value}`).join(' ')}]` : `[${key}]`);
const formatDate = (value) => (value ? `kp:${String(value).slice(0, 10)}` : '');
const context = { t, formatDate };

function literalKeys() {
  const keys = new Set();
  for (const source of SOURCES) {
    /* Ainult täielikud võtmed: mallisõnega kokku pandud võtmed kontrollib järgmine test. */
    for (const match of read(source).matchAll(/\bt\(\s*"(mentoring\.[a-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  return keys;
}

test('vaadete tekstivõtmed on kataloogis kolmes keeles ja kannavad samu kohatäitjaid', () => {
  const keys = literalKeys();
  assert.ok(keys.size > 110, `võtmeid leiti ${keys.size}`);
  const marks = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');
  const source = catalog('et');
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
    assert.deepEqual([...keys].filter((key) => marks(at(messages, key)) !== marks(at(source, key))), [], `${lang}: kohatäitjad`);
  }
});

test('eestikeelsetes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const messages = catalog('et');
  const bad = [...literalKeys()].filter((key) => /[—–"]/.test(at(messages, key)));
  assert.deepEqual(bad, []);
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks', () => {
  const groups = [
    ['home', HOME_VIEW_KEYS],
    ['my_profile', PROFILE_VIEW_KEYS],
    ['profile_public', PUBLIC_VIEW_KEYS]
  ];
  for (const lang of LANGS) {
    const mentoring = catalog(lang).mentoring;
    for (const [group, keys] of groups) {
      for (const key of keys) {
        const view = mentoring[group].views[key];
        assert.ok(view?.title && view?.short, `${lang}: ${group}.${key}`);
        assert.ok(view.short.length <= 18, `${lang}: ${group}.${key} lühinimi mahub kiirmenüüsse`);
      }
    }
    /* Laia vaate nimi seisab samuti kiirmenüüs. */
    for (const all of [mentoring.home.all_parts, mentoring.profile_public.all_parts]) {
      assert.ok(all && all.length <= 18, `${lang}: laia vaate nimi`);
    }
  }
});

test('teade, mis saadab teise sammu juurde, nimetab sammu nii, nagu kiirmenüü seda näitab', () => {
  /* Kiirmenüü näitab täisnime, kui see mahub (kuni 18 tähte), muidu lühinime (StepRail `nameOf`). */
  const shown = (view) => (view.title.length <= 18 ? view.title : view.short);
  for (const lang of LANGS) {
    const profile = catalog(lang).mentoring.my_profile;
    assert.ok(profile.saved_draft.includes(shown(profile.views.state)), `${lang}: saved_draft`);
    assert.ok(profile.name_required.includes(shown(profile.views.who)), `${lang}: name_required`);
  }
});

test('igal seisul, tagasilükkamise alusel ja profiili tegevusel, mille võtme leht kokku paneb, on sõna', () => {
  /* Loend katab kõik koodid, mida server võib saata. */
  assert.deepEqual(Object.keys(STATUS_WORDS.profile_status).sort(), Object.values(MENTOR_PROFILE_STATUS).sort());
  assert.deepEqual(Object.keys(STATUS_WORDS.request_status).sort(), Object.values(MENTORING_REQUEST_STATUS).sort());
  assert.deepEqual(Object.keys(STATUS_WORDS.relation_status).sort(), Object.values(MENTORING_RELATION_STATUS).sort());
  for (const lang of LANGS) {
    const mentoring = catalog(lang).mentoring;
    for (const [kind, codes] of Object.entries(STATUS_WORDS)) {
      for (const entry of Object.values(codes)) assert.equal(typeof mentoring[kind][entry.key], 'string', `${lang}: ${kind}.${entry.key}`);
    }
    for (const reason of REVIEW_REASON_KEYS) assert.equal(typeof mentoring.review_reason[reason], 'string', `${lang}: ${reason}`);
    for (const action of PROFILE_ACTIONS) assert.equal(typeof mentoring.my_profile.action_done[action], 'string', `${lang}: ${action}`);
  }
});

test('tundmatu seisukood ei jõua ekraanile ei sõna ega toore koodina', () => {
  assert.deepEqual(statusWord('profile_status', 'ACTIVE', t), { text: '[mentoring.profile_status.active]', tone: 'ok' });
  assert.deepEqual(statusWord('profile_status', 'active', t).text, '[mentoring.profile_status.active]');
  assert.deepEqual(statusWord('relation_status', 'SOMETHING_NEW', t), { text: '', tone: 'quiet' });
  assert.deepEqual(statusWord('request_status', undefined, t), { text: '', tone: 'quiet' });
  const rows = relationRows([{ id: 'r1', position: 'mentor', status: 'SOMETHING_NEW', mentee: { name: 'A' } }], context);
  assert.equal(rows[0].chip, '');
  assert.ok(!JSON.stringify(rows).includes('SOMETHING_NEW'));
});

test('suhete read: kes on teine pool, kuhu rida viib ja mis on lõppenud', () => {
  const rows = relationRows(
    [
      { id: 'r 1', position: 'mentee', status: 'ACTIVE', mentor: { name: 'Mari' }, mentee: { name: 'Mina' }, lastActivityAt: '2026-10-01T10:00:00Z' },
      { id: 'r2', position: 'mentor', status: 'DRAFT', mentor: { name: 'Mina' }, mentee: { name: null } },
      { id: 'r3', position: 'mentor', status: 'CLOSED', mentee: { name: 'Jaan' }, lastActivityAt: '2026-01-01T10:00:00Z' }
    ],
    context
  );
  assert.equal(rows[0].title, '[mentoring.home.relation_as_mentee name=Mari]');
  assert.equal(rows[0].href, '/mentorlus/suhe/r%201');
  assert.equal(rows[0].meta, '[mentoring.home.last_activity date=kp:2026-10-01]');
  assert.equal(rows[0].openText, '[mentoring.home.open_relation]');
  /* Nimeta teine pool saab sõna, kuupäevata suhe ei trüki tühja „Viimane tegevus:”. */
  assert.equal(rows[1].title, '[mentoring.home.relation_as_mentor name=[mentoring.labels.deleted_user]]');
  assert.equal(rows[1].meta, '');
  assert.equal(rows[1].tone, 'wait');
  assert.deepEqual([rows[2].closed, rows[2].meta, rows[2].openText], [true, '', '[mentoring.home.open_archive]']);
  assert.deepEqual(relationRows(null, context), []);
});

test('taotluste read: saabunud ootab otsust, saadetud näitab seisu ja tühistada saab ainult ootel taotlust', () => {
  const incoming = incomingRows([{ id: 'q1', menteeName: 'Liis', message: 'Tere', expiresAt: '2026-11-01T00:00:00Z', canRespond: true }, { id: 'q2' }], context);
  assert.deepEqual(incoming[0], { id: 'q1', name: 'Liis', message: 'Tere', meta: '[mentoring.home.request_expires date=kp:2026-11-01]', canRespond: true });
  assert.deepEqual([incoming[1].name, incoming[1].message, incoming[1].meta], ['[mentoring.labels.deleted_user]', '', '']);
  const sent = sentRows(
    [
      { id: 's1', mentorDisplayName: 'Mari', status: 'PENDING', expiresAt: '2026-11-01T00:00:00Z', canCancel: true },
      { id: 's2', mentorDisplayName: null, status: 'DECLINED', expiresAt: '2026-09-01T00:00:00Z', canCancel: false }
    ],
    context
  );
  assert.deepEqual([sent[0].chip, sent[0].tone, sent[0].pending, sent[0].canCancel], ['[mentoring.request_status.pending]', 'wait', true, true]);
  assert.equal(sent[0].meta, '[mentoring.home.request_expires date=kp:2026-11-01]');
  /* Mentor, kelle profiil ei ole enam kataloogis, ei ole „kustutatud kasutaja”. */
  assert.equal(sent[1].name, '[mentoring.home.mentor_not_listed]');
  assert.deepEqual([sent[1].meta, sent[1].canCancel], ['', false]);
});

test('kataloogi read: platvormi mentor avab profiili, ESTA kirje viib välja ega luba taotlust', () => {
  const rows = mentorRows(
    [
      { id: 'm 1', displayName: 'Mari', title: 'Spetsialist', organization: 'Tartu LV', fields: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], bioShort: 'Lühike', capacity: 'OPEN' },
      { id: 'm2', displayName: 'Peeter', capacity: 'FULL' },
      { id: 'm3', displayName: 'Väline', external: true, externalProfileUrl: 'https://eswa.ee/x', checkedAt: '2026-05-01T00:00:00Z', capacity: 'OPEN' },
      { id: 'm4', displayName: 'Halb link', external: true, externalProfileUrl: 'javascript:alert(1)' }
    ],
    context
  );
  assert.deepEqual([rows[0].href, rows[0].sub, rows[0].fields, rows[0].excerpt], ['/mentorlus/mentor/m%201', 'Spetsialist · Tartu LV', 'a, b, c, d, e +2', 'Lühike']);
  assert.deepEqual([rows[0].chip, rows[0].tone], ['[mentoring.home.capacity_open]', 'ok']);
  assert.deepEqual([rows[1].chip, rows[1].tone, rows[1].sub, rows[1].fields], ['[mentoring.home.capacity_full]', 'quiet', '', '']);
  assert.deepEqual([rows[2].external, rows[2].href, rows[2].chip], [true, 'https://eswa.ee/x', '[mentoring.home.external_chip]']);
  assert.equal(rows[2].meta, '[mentoring.home.external_checked date=kp:2026-05-01]');
  /* Aadress, mis ei ole veebiaadress, lingiks ei lähe. */
  assert.equal(rows[3].href, ESTA_MENTORS_URL);
  assert.equal(safeExternalUrl(' http://example.org/a '), 'http://example.org/a');
  assert.equal(safeExternalUrl('data:text/html,x'), ESTA_MENTORS_URL);
});

test('filtrite valikud tulevad kataloogist ja päring kannab ainult valitud filtreid', () => {
  const facets = catalogFacets([
    { fields: ['Lastekaitse', ' Eakad '], topics: ['Tööpiirid'], languages: ['vene', 'eesti'] },
    { fields: ['Lastekaitse', ''], topics: null, languages: ['eesti'] }
  ]);
  assert.deepEqual(facets, { field: ['Eakad', 'Lastekaitse'], topic: ['Tööpiirid'], language: ['eesti', 'vene'] });
  assert.deepEqual(catalogFacets(null), { field: [], topic: [], language: [] });
  assert.equal(filterQuery({ field: '', topic: '', language: '' }), '');
  assert.equal(filterQuery({ field: 'Eakate hoolekanne', topic: '', language: 'vene' }), 'field=Eakate+hoolekanne&language=vene');
});

test('rühma valik: tühja rühma asemel näidatakse seda, kus midagi on', () => {
  assert.equal(pickGroup('incoming', ['incoming', 'sent'], { incoming: 2, sent: 1 }), 'incoming');
  assert.equal(pickGroup('sent', ['incoming', 'sent'], { incoming: 2, sent: 1 }), 'sent');
  assert.equal(pickGroup('incoming', ['incoming', 'sent'], { incoming: 0, sent: 3 }), 'sent');
  assert.equal(pickGroup('closed', ['open', 'closed'], { open: 0, closed: 0 }), 'open');
});

test('avalehe osad on alati samad neli ja plaadil on esimene rida, mitte ridade arv', () => {
  const relations = relationRows(
    [
      { id: 'r1', position: 'mentee', status: 'ACTIVE', mentor: { name: 'Mari' } },
      { id: 'r2', position: 'mentor', status: 'ACTIVE', mentee: { name: 'Jaan' } }
    ],
    context
  );
  const full = homeParts({
    t,
    mentors: mentorRows([{ id: 'm1', displayName: 'Mari' }], context),
    catalogFailed: false,
    openRelations: relations,
    closedRelations: [],
    incoming: incomingRows([{ id: 'q1', menteeName: 'Liis' }], context),
    sent: sentRows([{ id: 's1', mentorDisplayName: 'Mari', status: 'PENDING' }], context),
    profile: { status: 'PAUSED', displayName: 'Mina' }
  });
  assert.deepEqual(full.map((part) => part.key), [...HOME_VIEW_KEYS]);
  assert.deepEqual(full.map((part) => part.state), ['partial', 'done', 'done', 'partial']);
  assert.equal(full[1].summary, '[mentoring.home.relation_as_mentee name=Mari] [mentoring.home.views.more]');
  assert.ok(!/\d/.test(full[1].summary.replace(/\[[^\]]*\]/g, '')), 'suhete plaadil ei ole loendurit');
  assert.equal(full[2].summary, '[mentoring.home.views.requests.summary_incoming name=Liis]');
  assert.equal(full[3].summary, '[mentoring.profile_status.paused]');
  for (const part of full) assert.ok(part.label && part.short, part.key);

  const empty = homeParts({ t, mentors: [], catalogFailed: false, openRelations: [], closedRelations: [], incoming: [], sent: [], profile: null });
  assert.deepEqual(empty.map((part) => part.key), [...HOME_VIEW_KEYS]);
  assert.deepEqual(empty.map((part) => part.state), ['empty', 'empty', 'empty', 'empty']);
  assert.deepEqual(empty.map((part) => part.summary), [
    '[mentoring.home.views.find.summary_empty]',
    '[mentoring.home.empty_title]',
    '[mentoring.home.views.requests.empty]',
    '[mentoring.home.no_profile]'
  ]);

  const failed = homeParts({ t, mentors: [], catalogFailed: true, openRelations: [], closedRelations: [], incoming: [], sent: sentRows([{ id: 's1', mentorDisplayName: 'Mari', status: 'PENDING' }], context), profile: null });
  assert.equal(failed[0].summary, '[mentoring.home.catalog_failed]');
  assert.equal(failed[2].summary, '[mentoring.home.views.requests.summary_sent name=Mari]');
  /* Täis kataloogileht ütleb „200+”, mitte ei väida, et mentoreid ongi täpselt nii palju. */
  const capped = homeParts({ t, mentors: Array.from({ length: CATALOG_CAP }, (_, index) => ({ id: String(index) })), catalogFailed: false, openRelations: [], closedRelations: [], incoming: [], sent: [], profile: null });
  assert.equal(capped[0].summary, `[mentoring.home.views.find.summary count=${CATALOG_CAP}+]`);
});

test('profiilivorm: loend on üks kirje real, koma töötab ka ja salvestatav kuju on sama mis enne', () => {
  assert.deepEqual(splitList('Lastekaitse, Eakad\n  Tööheaolu \n\nEakad'), ['Lastekaitse', 'Eakad', 'Tööheaolu']);
  assert.deepEqual(splitList(null), []);
  const profile = { displayName: 'Liis', title: null, organization: 'LV', fields: ['Lastekaitse', 'Eakad'], topics: [], languages: ['eesti'], formats: null, bioShort: 'Lühike', bioFull: null, experienceSummary: null, version: 4 };
  const form = toForm(profile);
  assert.deepEqual(form, { displayName: 'Liis', title: '', organization: 'LV', bioShort: 'Lühike', bioFull: '', experienceSummary: '', fields: 'Lastekaitse\nEakad', topics: '', languages: 'eesti', formats: '' });
  assert.deepEqual(profilePayload(form, profile.version), {
    displayName: 'Liis',
    title: '',
    organization: 'LV',
    fields: ['Lastekaitse', 'Eakad'],
    topics: [],
    languages: ['eesti'],
    formats: [],
    bioShort: 'Lühike',
    bioFull: '',
    experienceSummary: '',
    expectedVersion: 4
  });
  assert.equal(Object.values(toForm(null)).join(''), '');
});

test('profiilivorm: muudatuse märkab, tühikuid ja loendi kuju muudatuseks ei pea', () => {
  const profile = { displayName: 'Liis', fields: ['Lastekaitse', 'Eakad'], bioShort: 'Lühike' };
  const form = toForm(profile);
  assert.equal(isDirty(form, profile), false);
  assert.equal(isDirty({ ...form, displayName: ' Liis ' }, profile), false);
  assert.equal(isDirty({ ...form, fields: 'Lastekaitse, Eakad' }, profile), false);
  assert.equal(isDirty({ ...form, fields: 'Eakad\nLastekaitse' }, profile), true);
  assert.equal(isDirty({ ...form, bioShort: 'Teine' }, profile), true);
  assert.equal(isDirty(toForm(null), null), false);
  assert.equal(isDirty({ ...toForm(null), title: 'Amet' }, null), true);
});

test('profiilivorm: leht teab enne serverit, mis on esitamiseks puudu ja mis loend on üle piiri', () => {
  assert.deepEqual(missingForReview(toForm(null)), ['display_name', 'bio_short', 'fields']);
  assert.deepEqual(missingForReview({ displayName: 'Liis', bioShort: '  ', fields: 'Lastekaitse' }), ['bio_short']);
  assert.deepEqual(missingForReview({ displayName: 'Liis', bioShort: 'Lühike', fields: 'Lastekaitse' }), []);
  const many = (count) => Array.from({ length: count }, (_, index) => `kirje ${index}`).join('\n');
  assert.deepEqual(overLimit({ fields: many(12), topics: many(13), languages: many(6), formats: many(7) }), { fields: false, topics: true, languages: false, formats: true });
  for (const lang of LANGS) {
    const missing = catalog(lang).mentoring.my_profile.missing;
    for (const key of missingForReview(toForm(null))) assert.equal(typeof missing[key], 'string', `${lang}: ${key}`);
  }
});

test('profiili seis: nupp ilmub ainult seisus, kus server tegevust lubab', () => {
  const model = (status, extra = {}) => profileStateModel(status ? { status, ...extra } : null);
  assert.deepEqual(model(null), { status: '', helpKey: 'none', editable: true, canSubmit: false, canSetCapacity: false, canPause: false, canResume: false, canRetire: false, reasonKey: '' });
  assert.deepEqual([model('DRAFT').canSubmit, model('REJECTED').canSubmit, model('PENDING_REVIEW').canSubmit, model('ACTIVE').canSubmit], [true, true, false, false]);
  assert.deepEqual([model('ACTIVE').canPause, model('ACTIVE').canSetCapacity, model('ACTIVE').canResume], [true, true, false]);
  assert.deepEqual([model('PAUSED').canPause, model('PAUSED').canSetCapacity, model('PAUSED').canResume], [false, false, true]);
  /* Lõpetatud ja suletud profiil on lukus: muuta, esitada ega lõpetada ei saa. */
  for (const status of ['RETIRED', 'REVOKED']) {
    const closed = model(status);
    assert.deepEqual([closed.editable, closed.canSubmit, closed.canRetire, closed.canPause, closed.canResume], [false, false, false, false, false], status);
  }
  assert.equal(model('REJECTED', { reviewReasonKey: 'incomplete' }).reasonKey, 'incomplete');
  assert.equal(model('REJECTED', { reviewReasonKey: 'made_up' }).reasonKey, '');
  assert.equal(model('ACTIVE', { reviewReasonKey: 'incomplete' }).reasonKey, '');
  assert.equal(model('NEW_STATUS').helpKey, '');
  for (const lang of LANGS) {
    const help = catalog(lang).mentoring.my_profile.state_help;
    for (const status of [null, ...Object.values(MENTOR_PROFILE_STATUS).filter((value) => value !== 'EXTERNAL_REFERENCE')]) {
      assert.equal(typeof help[model(status).helpKey], 'string', `${lang}: ${status}`);
    }
  }
});

test('lehe piirid ja lubatud seisud on samad mis serveris', () => {
  const service = read('../lib/mentoring/profileService.js');
  const listAfter = (marker) => {
    const from = service.indexOf(marker);
    assert.ok(from >= 0, marker);
    const block = service.slice(from, service.indexOf(']', from));
    return [...block.matchAll(/MENTOR_PROFILE_STATUS\.([A-Z_]+)/g)].map((match) => match[1]);
  };
  assert.deepEqual(listAfter('const EDITABLE_STATUSES').sort(), [...EDITABLE_PROFILE_STATUSES].sort());
  const retire = service.slice(service.indexOf('export async function retireOwnMentorProfile'));
  assert.deepEqual([...retire.slice(0, retire.indexOf(']')).matchAll(/MENTOR_PROFILE_STATUS\.([A-Z_]+)/g)].map((match) => match[1]).sort(), [...RETIRABLE_PROFILE_STATUSES].sort());
  /* Keelte ja vormide piir on serveris arvuna koodi sees. */
  assert.match(service, /languages: normalizeTags\(payload\.languages, \{ max: 6 \}\)/);
  assert.match(service, /formats: normalizeTags\(payload\.formats, \{ max: 6 \}\)/);
  assert.deepEqual([PROFILE_LIMITS.languages, PROFILE_LIMITS.formats], [6, 6]);
  assert.deepEqual([PROFILE_LIMITS.fields, PROFILE_LIMITS.line, PROFILE_LIMITS.text], [MENTORING_LIMITS.MAX_TAGS, MENTORING_LIMITS.MAX_SHORT_TEXT, MENTORING_LIMITS.MAX_TEXT]);
  /* Esitamise eeltingimus: nimi, lühitutvustus ja vähemalt üks valdkond. */
  assert.match(service, /!existing\.displayName \|\| !\(existing\.bioShort \|\| ""\)\.trim\(\) \|\| !existing\.fields\?\.length/);
  assert.match(read('../lib/mentoring/catalogService.js'), new RegExp(`\\.slice\\(0, ${CATALOG_CAP}\\)`));
  const admin = read('../lib/mentoring/adminService.js');
  const reasons = admin.slice(admin.indexOf('const REVIEW_REASONS'), admin.indexOf(']);', admin.indexOf('const REVIEW_REASONS')));
  assert.deepEqual([...reasons.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]), [...REVIEW_REASON_KEYS]);
});

test('profiilivormi sammud: seis ja kokkuvõte tulevad vormist', () => {
  const blank = profileSteps({ t, form: toForm(null), profile: null });
  assert.deepEqual(blank.map((step) => step.key), [...PROFILE_VIEW_KEYS]);
  assert.deepEqual(blank.map((step) => step.state), ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty']);
  assert.equal(blank.at(-1).summary, '[mentoring.my_profile.views.state.summary_none]');
  const profile = { status: 'ACTIVE', displayName: 'Liis', title: 'Sotsiaaltöötaja', fields: ['Lastekaitse'], topics: ['A'], languages: ['eesti'], formats: [], bioShort: 'x'.repeat(200), bioFull: '', experienceSummary: 'Kogemus' };
  const steps = profileSteps({ t, form: toForm(profile), profile });
  assert.deepEqual(steps.map((step) => step.state), ['done', 'done', 'partial', 'done', 'empty', 'done', 'done']);
  assert.equal(steps[0].summary, 'Liis · Sotsiaaltöötaja');
  assert.equal(steps[3].summary.length, 90);
  assert.equal(steps.at(-1).summary, '[mentoring.profile_status.active]');
  assert.equal(profileSteps({ t, form: { ...toForm(null), title: 'Amet', topics: 'A' }, profile: null }).slice(0, 2).map((step) => step.state).join(','), 'partial,partial');
});

test('mentori profiil: osad tulevad sisust ja välisel kirjel taotluse osa ei ole', () => {
  const full = publicProfileModel({ displayName: 'Mari', title: 'Spetsialist', organization: 'LV', fields: ['Lastekaitse'], topics: [], languages: ['eesti'], formats: [], bioShort: 'Lühike', bioFull: 'Pikk', experienceSummary: 'Kogemus', capacity: 'OPEN', canRequest: true });
  assert.deepEqual(full.viewKeys, [...PUBLIC_VIEW_KEYS]);
  assert.deepEqual([full.heading, full.sub, full.bio, full.experience, full.canRequest], ['Mari', 'Spetsialist · LV', 'Pikk', 'Kogemus', true]);
  assert.deepEqual(full.groups.map((group) => group.key), ['fields', 'languages']);
  /* Pikema tutvustuse puudumisel näidatakse lühikest (sama reegel mis enne). */
  assert.equal(publicProfileModel({ bioShort: 'Lühike' }).bio, 'Lühike');
  const bare = publicProfileModel({ displayName: 'Tiina', capacity: 'FULL', canRequest: false });
  assert.deepEqual([bare.viewKeys, bare.canRequest], [['about', 'request'], false]);
  const external = publicProfileModel({ displayName: 'Väline', external: true, canRequest: true, externalProfileUrl: 'javascript:x', bioShort: 'Tutvustus' });
  assert.deepEqual([external.viewKeys, external.canRequest, external.externalUrl], [['about', 'story'], false, ESTA_MENTORS_URL]);

  const parts = publicParts({ t, model: full, sent: false });
  assert.deepEqual(parts.map((part) => [part.key, part.state]), [['about', 'partial'], ['story', 'partial'], ['request', 'partial']]);
  assert.equal(parts[2].summary, '[mentoring.home.capacity_open]');
  assert.equal(publicParts({ t, model: full, sent: true })[2].state, 'done');
  assert.equal(publicParts({ t, model: bare, sent: false })[1].summary, '[mentoring.profile_public.capacity_full_note]');
  for (const part of parts) assert.ok(part.label && part.short, part.key);
});

test('lõplik tegevus küsib teist vajutust: keeldumine, taotluse tühistamine ja mentorluse lõpetamine', () => {
  const home = read('../components/mentoring/MentoringHomePage.jsx');
  assert.ok(home.includes('armConfirm(`decline:${row.id}`)'), 'taotlusest keeldumine kahe vajutusega');
  assert.ok(home.includes('armConfirm(`cancel:${row.id}`)'), 'taotluse tühistamine kahe vajutusega');
  /* Otse nupu külge seotud keeldumist ega tühistamist ei ole. */
  assert.ok(!/onDecline: \(\) => respond\(/.test(home) && !/onCancel: \(\) => cancelRequest\(/.test(home));
  const profile = read('../components/mentoring/MyMentorProfilePage.jsx');
  assert.ok(profile.includes('armConfirm("retire")'), 'mentorluse lõpetamine kahe vajutusega');
  assert.equal(profile.match(/runAction\("retire"\)/g).length, 1, 'lõpetamine käivitub ainult kinnitatud vajutusest');
});

test('lehed on sammulaval, ilma teise kaardi, lehe pealkirja ja status-rollita', () => {
  for (const source of [...PAGES, ...VIEWS]) {
    const code = read(source);
    assert.ok(!code.includes('role="status"'), `${source}: teated ei kasuta status-rolli (ühine kiht joonistab selle omal moel)`);
    assert.ok(!code.includes('MentoringPage.module.css'), `${source}: vana tume kaart on läinud`);
    assert.ok(!code.includes('SubpageHeader'), `${source}: paneelis ei ole lehe pealkirja`);
    assert.ok(!code.includes('as="a"'), `${source}: lingid on next/link, mitte terve lehe uuesti laadiv ankur`);
    /* Seisu sõna ei panda kokku serveri koodist: see käib läbi `statusWord`-i. */
    assert.ok(!/toLowerCase\(\)\}`\)/.test(code), `${source}: võtit ei ehitata toorest koodist`);
  }
  for (const page of PAGES) assert.ok(read(page).includes('<StepFlight'), `${page} on sammulaval`);
  for (const view of VIEWS.slice(0, 3)) {
    const code = read(view);
    assert.ok(code.includes('<StepPanel'), `${view} joonistab vaated StepPanel-iga`);
    assert.ok(!code.includes('fetch('), `${view}: vaade ainult joonistab, päringud on lehel`);
  }
  const lines = (page) => read(page).split(/\r?\n/).map((line) => line.trim());
  /* Avaleht ja mentori profiil ei ole sammud, vaid osad; avaleht avaneb kõigi osade ülevaates. */
  assert.ok(lines(PAGES[0]).includes('startWide') && lines(PAGES[0]).includes('parts'));
  assert.ok(lines(PAGES[2]).includes('parts') && !lines(PAGES[2]).includes('startWide'));
  assert.ok(!lines(PAGES[1]).includes('parts'), 'profiilivorm on sammud');
});

test('versioonikonflikti järel jäävad vormi ainult inimese muudatused', () => {
  const before = { displayName: 'Mari', bioShort: 'vana tutvustus', fields: ['lastekaitse'], topics: [] };
  const fresh = { displayName: 'Mari M.', bioShort: 'admin parandas', fields: ['lastekaitse', 'võlanõustamine'], topics: ['läbipõlemine'] };
  const form = { ...toForm(before), bioShort: 'minu uus tutvustus' };
  const merged = mergeAfterConflict(form, before, fresh);
  /* Minu muudetud väli jääb; puutumata väljad saavad serveri värske väärtuse. */
  assert.equal(merged.bioShort, 'minu uus tutvustus');
  assert.equal(merged.displayName, 'Mari M.');
  assert.equal(merged.fields, toForm(fresh).fields);
  assert.equal(merged.topics, toForm(fresh).topics);
  /* Kui midagi ei muudetud, on tulemus serveri vorm; kui kõik muudeti, jääb minu vorm. */
  assert.deepEqual(mergeAfterConflict(toForm(before), before, fresh), toForm(fresh));
  const mine = Object.fromEntries(Object.keys(toForm(before)).map((key) => [key, 'x']));
  assert.deepEqual(mergeAfterConflict(mine, before, fresh), mine);
});

test('ülevaatuse parandused: silt ei korda vaate nime, väli ei lukustu salvestamise ajaks', () => {
  const views = read('../components/mentoring/entry/MyProfileViews.jsx');
  assert.match(views, /export function TextView[\s\S]*?labelHidden/);
  const page = read('../components/mentoring/MyMentorProfilePage.jsx');
  assert.ok(page.includes('const formProps = { disabled: locked, note, actions: saveButton };'));
  assert.ok(page.includes('if (busy) return false;'), 'topeltsaatmist hoiab ära kontroll, mitte välja lukustamine');
  assert.ok(page.includes('mergeAfterConflict(current, before, fresh)'));
});

test('lehe kujundus on oma moodulis ja klassinimedega, ilma paljaste siltide valijateta', () => {
  const css = read('../components/mentoring/entry/entry.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/(^|[{}])\s*([^{}@]+)\{/g)].flatMap((match) => match[2].split(',')).map((selector) => selector.trim()).filter(Boolean);
  assert.ok(selectors.length > 40, `valijaid leiti ${selectors.length}`);
  const bare = selectors.filter((selector) => !/^(\.|:global\()/.test(selector) || /[\s>+~](?![.:])[a-z]/.test(selector.replace(/:global\([^)]*\)\s*/, '')));
  assert.deepEqual(bare, []);
  /* Tee edasi teistele mentorluse lehtedele jääb alles. */
  const rows = read('../components/mentoring/entry/entryRows.js');
  assert.ok(rows.includes('/mentorlus/suhe/') && rows.includes('/mentorlus/mentor/'));
  assert.ok(read('../components/mentoring/MentoringHomePage.jsx').includes('"/mentorlus/profiil"'));
});
