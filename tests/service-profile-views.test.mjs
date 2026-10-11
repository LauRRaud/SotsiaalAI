// Teenuseprofiil: vaadete tekstid on kataloogis, mudel teeb seda, mida leht lubab.
//
// Leht oli üks pikk vorm failis components/workspace/WorkspaceFeaturePage.jsx; nüüd on
// see vaadetena sammulaval (components/workspace/serviceProfile). Test hoiab seda, mida
// silm kergesti ei märka: puuduv tõlkevõti, nimeta vaade, ühe vajutusega eemaldamine,
// salvestatava keha kuju ja see, et avaldamise kontrolli rida viib päris vaatesse.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AVAILABILITY_NOTE_LIMIT,
  LIST_VIEW_OF,
  LOCATION_VIEW_KEYS,
  PROFILE_VIEW_KEYS,
  SERVICE_PROFILE_KEY,
  SERVICE_PROFILE_OPTIONS,
  SERVICE_VIEW_KEYS,
  areaViewIsTall,
  availabilityChoices,
  countyChoice,
  createServiceProfileForm,
  emailLooksValid,
  firstEmailProblem,
  indexAfterSave,
  joinList,
  keepsLocation,
  keepsService,
  locationRows,
  locationViewStates,
  municipalityChoice,
  optionsWithSelected,
  profileViewStates,
  profileViewSummaries,
  realServiceLocations,
  serviceAreaChoices,
  serviceProfileDirty,
  serviceProfileMapStatus,
  serviceProfileOptionSets,
  serviceProfilePublishChecks,
  serviceProfilePublishState,
  serviceProfileSavePayload,
  serviceProfileSteps,
  serviceRows,
  serviceViewStates,
  serviceViewSummaries,
  splitList,
  toggleListValue,
  unreadableServiceAreas
} from '../components/workspace/serviceProfile/profileModel.js';
import { assistantDirectoryCounts } from '../lib/serviceProviderAssistantGate.js';
import { SERVICE_PROFILE_LIMITS } from '../lib/serviceProviderProfileLimits.js';
import { ServiceAreaKind, municipalityRegister, readServiceArea } from '../lib/serviceProviderServiceArea.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`)).workspace_feature_pages.service_profile;
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const VIEW_SOURCES = [
  '../components/workspace/serviceProfile/ProfileFields.jsx',
  '../components/workspace/serviceProfile/ProfileViews.jsx',
  '../components/workspace/serviceProfile/ServiceViews.jsx',
  '../components/workspace/serviceProfile/LocationViews.jsx'
];
const page = read('../components/workspace/WorkspaceFeaturePage.jsx');
/* Lehe failis on ka eelpöördumised ja teenusekaart: siin loeb ainult teenuseprofiili osa. */
const surface = page.slice(page.indexOf('function useServiceProfileAddressSearch'), page.indexOf('export default function WorkspaceFeaturePage'));
const model = read('../components/workspace/serviceProfile/profileModel.js');
const tp = (key, fallback, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : `[${key}]`);

const sampleProfile = () => ({
  updatedAt: '2026-10-09T08:00:00.000Z',
  organizationName: 'Hoolekanne MTÜ',
  organizationType: 'MTÜ',
  email: 'info@hoolekanne.example',
  status: 'PUBLISHED',
  mapVisible: true,
  acceptsPlatformPreInquiries: false,
  serviceMapEntry: { geocodingStatus: 'MATCHED', normalizedAddress: 'Lossi 1, Põltsamaa' },
  serviceLocations: [
    { id: 'loc-a', label: 'Keskus', address: 'Lossi 1', normalizedAddress: 'Lossi 1, Põltsamaa', latitude: 58.65, longitude: 25.97, mapVisible: true, status: 'PUBLISHED' }
  ],
  serviceItems: [
    {
      id: 'svc-a',
      name: 'Koduteenus',
      status: 'PUBLISHED',
      categories: ['Kodune abi ja hooldus', 'Koduabi'],
      targetGroups: ['Puudega inimene'],
      locationIds: ['loc-a'],
      availabilityStatus: 'accepting',
      availability: { status: 'accepting', freshness: 'fresh' },
      acceptsPlatformPreInquiries: false
    }
  ]
});

test('vaadete tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of [...VIEW_SOURCES.map(read), surface, model]) {
    for (const match of source.matchAll(/\btp\(\s*"([a-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  /* Avaldamise kontrolli ja aadressi seisu laused annab mudel võtmena. */
  for (const match of model.matchAll(/\["((?:publish_checks|map_status)\.[a-z_]+)"/g)) keys.add(match[1]);
  for (const match of model.matchAll(/key: "(map_status\.[a-z_]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size > 120, `võtmeid leiti ${keys.size}`);
  assert.ok(keys.has('publish_checks.contact_ready') && keys.has('map_status.pending'));
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
  /* Teenuseprofiili osa ei loe tekste eelpöördumiste nimeruumi abilisega. */
  assert.ok(!/\btr\(/.test(surface), 'pind kasutab `tp`, mitte eelpöördumiste `tr`');
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks ning vaatefail joonistab selle', () => {
  const files = [
    [PROFILE_VIEW_KEYS, read(VIEW_SOURCES[1])],
    [SERVICE_VIEW_KEYS, read(VIEW_SOURCES[2])],
    [LOCATION_VIEW_KEYS, read(VIEW_SOURCES[3])]
  ];
  const all = files.flatMap(([keys]) => keys);
  assert.equal(new Set(all).size, all.length, 'vaadete võtmed ei kordu tasemete vahel');
  for (const [keys, source] of files) {
    /* Esimene vaade on lüliti vaikeharu, ülejäänutel on oma haru. */
    for (const key of keys.slice(1)) assert.ok(source.includes(`case "${key}":`), `vaatefailis on haru ${key}`);
    assert.ok(source.includes(`views.${keys[0]}.title`), `vaatefail joonistab vaate ${keys[0]}`);
  }
  for (const lang of LANGS) {
    const views = catalog(lang).views;
    for (const key of all) {
      assert.ok(views[key]?.title && views[key]?.short, `${lang}: ${key}`);
      assert.ok(views[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
    for (const mark of ['{count}', '{max}']) assert.ok(views.services.count.includes(mark) && views.locations.count.includes(mark), `${lang}: ${mark}`);
    assert.ok(views.services.summary.includes('{published}') && views.check.summary_open.includes('{count}'), lang);
    assert.ok(views.back_to_list.includes('{list}') && views.go_to.includes('{view}'), lang);
  }
  assert.deepEqual(LIST_VIEW_OF, { service: 'services', location: 'locations' });
});

test('valikute sildid on kataloogis ja väärtused ei kordu', () => {
  for (const [group, options] of Object.entries(SERVICE_PROFILE_OPTIONS)) {
    const values = options.map(([value]) => value);
    assert.equal(new Set(values).size, values.length, `${group}: väärtused ei kordu`);
    for (const lang of LANGS) {
      const messages = catalog(lang);
      for (const [, key] of options) assert.equal(typeof at(messages, key), 'string', `${lang}: ${key}`);
    }
  }
  const sets = serviceProfileOptionSets(tp);
  assert.deepEqual(sets.status.map((option) => option.value), ['DRAFT', 'REVIEW', 'PUBLISHED', 'HIDDEN']);
  assert.equal(sets.category.length, 11);
  assert.equal(sets.targetGroup.length, 16);
  /* Vene keeles oli „Ei" tõlkimata. */
  assert.equal(catalog('ru').requirement_options.no, 'Нет');
});

test('loendiväljad: tekst vormis, massiiv serveris', () => {
  assert.equal(joinList(['a', 'b']), 'a, b');
  assert.equal(joinList(null), '');
  assert.deepEqual(splitList('a, b;c\n d ,,'), ['a', 'b', 'c', 'd']);
  assert.equal(toggleListValue('a, b', 'b'), 'a');
  assert.equal(toggleListValue('a', 'b'), 'a, b');
  assert.equal(toggleListValue('', 'b'), 'b');
});

test('varasem valik, mida loendis enam ei ole, jääb lahtrina näha', () => {
  const options = serviceProfileOptionSets(tp).category;
  assert.equal(optionsWithSelected(options, 'Muu teenus'), options);
  const extended = optionsWithSelected(options, 'Muu teenus, Koduabi, Koduabi');
  assert.equal(extended.length, options.length + 1);
  assert.deepEqual(extended.at(-1), { value: 'Koduabi', label: 'Koduabi' });

  const availability = serviceProfileOptionSets(tp).availability;
  assert.equal(availabilityChoices(availability, 'waitlist', 'Varasem'), availability);
  assert.equal(availabilityChoices(availability, '', 'Varasem'), availability);
  assert.deepEqual(availabilityChoices(availability, 'saadaval', 'Varasem').at(-1), { value: 'saadaval', label: 'Varasem: saadaval' });
  assert.equal(AVAILABILITY_NOTE_LIMIT, 500);
});

test('vorm sünnib profiilist ja „salvestamata" tähendab erinevust sellest', () => {
  const profile = sampleProfile();
  const form = createServiceProfileForm(profile);
  assert.equal(form.organizationName, 'Hoolekanne MTÜ');
  assert.equal(form.serviceItems[0].categories, 'Kodune abi ja hooldus, Koduabi');
  assert.equal(form.serviceItems[0].contactStrategy, 'ORGANIZATION');
  assert.equal(form.serviceLocations[0].clientId, 'loc-a');
  assert.equal(serviceProfileDirty(form, profile), false);
  assert.equal(serviceProfileDirty({ ...form, phone: '5551234' }, profile), true);
  assert.equal(serviceProfileDirty(createServiceProfileForm(), null), false);
  /* Tühi profiil annab tühja vormi vaikimisi lubadega. */
  const empty = createServiceProfileForm(null);
  assert.equal(empty.status, 'DRAFT');
  assert.equal(empty.acceptsPlatformPreInquiries, true);
  assert.deepEqual(empty.serviceItems, []);
});

test('salvestatav keha: loendid massiivina, nimeta teenus ja tühi koht jäävad välja', () => {
  const profile = sampleProfile();
  const form = createServiceProfileForm(profile);
  form.serviceAreaMunicipalityIds = 'Põltsamaa vald, Jõgeva vald';
  form.serviceItems.push({ ...form.serviceItems[0], id: '', name: '   ' });
  form.serviceItems.push({ ...form.serviceItems[0], id: '', name: 'Tugiisik', contactStrategy: 'CUSTOM', contactName: 'Mari', email: 'mari@hoolekanne.example' });
  form.serviceItems[0] = { ...form.serviceItems[0], contactName: 'Jäänuk', phone: '555' };
  form.serviceLocations.push({ ...form.serviceLocations[0], clientId: 'location-2', label: '', address: '', normalizedAddress: '' });

  const payload = serviceProfileSavePayload(form, profile.updatedAt);
  assert.equal(payload.expectedUpdatedAt, profile.updatedAt);
  assert.equal(serviceProfileSavePayload(form, undefined).expectedUpdatedAt, null);
  assert.deepEqual([payload.services, payload.serviceCategories, payload.targetGroups, payload.languages], [[], [], [], []]);
  assert.deepEqual(payload.serviceAreaMunicipalityIds, ['Põltsamaa vald', 'Jõgeva vald']);
  /* Kaardi aadress tuleb esimesest kaardil nähtavast aadressiga kohast. */
  assert.equal(payload.normalizedAddress, 'Lossi 1, Põltsamaa');
  assert.equal(payload.latitude, 58.65);
  assert.equal(payload.serviceLocations.length, 1);
  assert.deepEqual(payload.serviceItems.map((item) => item.name), ['Koduteenus', 'Tugiisik']);
  assert.deepEqual(payload.serviceItems.map((item) => item.sortOrder), [0, 2]);
  const [first, second] = payload.serviceItems;
  assert.deepEqual(first.categories, ['Kodune abi ja hooldus', 'Koduabi']);
  assert.equal(first.category, 'Kodune abi ja hooldus');
  assert.deepEqual(first.targetGroups, ['Puudega inimene']);
  assert.deepEqual(first.locationIds, ['loc-a']);
  /* Organisatsiooni kontakti kasutav teenus ei saada oma kontakti kaasa. */
  assert.deepEqual([first.contactName, first.phone, first.email, first.website], ['', '', '', '']);
  assert.deepEqual([second.contactName, second.email], ['Mari', 'mari@hoolekanne.example']);

  assert.equal(keepsService({ name: ' ' }), false);
  assert.equal(keepsLocation({ label: 'Keskus' }), true);
  assert.equal(keepsLocation({ label: '', address: ' ' }), false);
  /* Avatud kirje järjekorranumber pärast salvestamist. */
  assert.equal(indexAfterSave(form.serviceItems, 2, keepsService), 1);
  assert.equal(indexAfterSave(form.serviceItems, 1, keepsService), -1);
  assert.equal(indexAfterSave(form.serviceItems, 0, keepsService), 0);
  assert.equal(indexAfterSave(null, 0, keepsService), -1);
});

test('e-posti kuju kontroll katab terve vormi ja ütleb vaate, kus viga on', () => {
  for (const value of ['', '  ', 'a@b.ee', ' mari.maasikas@asutus.example ']) assert.equal(emailLooksValid(value), true, value);
  for (const value of ['mari', 'mari@', '@b.ee', 'a b@c.ee', 'a@b..ee']) assert.equal(emailLooksValid(value), false, value);

  const form = createServiceProfileForm(sampleProfile());
  assert.equal(firstEmailProblem(form), null);
  assert.deepEqual(firstEmailProblem({ ...form, email: 'vale' }), { level: 'profile', index: -1, view: 'contact' });
  const custom = { ...form, serviceItems: [{ ...form.serviceItems[0], contactStrategy: 'CUSTOM', email: 'vale' }] };
  assert.deepEqual(firstEmailProblem(custom), { level: 'service', index: 0, view: 'service_contact' });
  /* Organisatsiooni kontakti kasutava teenuse e-posti ei saadeta, seega seda ei kontrollita. */
  assert.equal(firstEmailProblem({ ...form, serviceItems: [{ ...form.serviceItems[0], contactStrategy: 'ORGANIZATION', email: 'vale' }] }), null);
  const place = { ...form, serviceLocations: [{ ...form.serviceLocations[0], email: 'vale@' }] };
  assert.deepEqual(firstEmailProblem(place), { level: 'location', index: 0, view: 'place_contact' });
  for (const problem of [firstEmailProblem(custom), firstEmailProblem(place)]) {
    assert.ok([...SERVICE_VIEW_KEYS, ...LOCATION_VIEW_KEYS].includes(problem.view));
  }
});

test('avaldamise reeglid: puuduv teenus või kontakt lukustab ainult avaldatud profiili', () => {
  const form = createServiceProfileForm(sampleProfile());
  const ready = serviceProfilePublishState(form);
  assert.deepEqual(ready, { published: true, hasPublishableService: true, hasMappableLocation: true, hasContact: true, blocking: [] });

  const bare = { ...form, email: '', phone: '', website: '', serviceItems: [], serviceLocations: [] };
  assert.deepEqual(serviceProfilePublishState(bare).blocking, ['service', 'contact']);
  assert.deepEqual(serviceProfilePublishState({ ...bare, status: 'DRAFT' }).blocking, []);
  /* Platvormisisene eelpöördumine loeb kontaktiks; mustand või kaardilt peidetud teenus ei loe avaldatavaks. */
  assert.equal(serviceProfilePublishState({ ...bare, acceptsPlatformPreInquiries: true }).hasContact, true);
  assert.equal(serviceProfilePublishState({ ...form, serviceItems: [{ ...form.serviceItems[0], status: 'DRAFT' }] }).hasPublishableService, false);
  assert.equal(serviceProfilePublishState({ ...form, serviceItems: [{ ...form.serviceItems[0], mapVisible: false }] }).hasPublishableService, false);
  assert.equal(serviceProfilePublishState({ ...form, serviceLocations: [{ ...form.serviceLocations[0], mapVisible: false }] }).hasMappableLocation, false);
});

test('avaldamise kontrolli iga rida viib profiili vaatesse, kus seda saab parandada', () => {
  const profile = sampleProfile();
  const form = createServiceProfileForm(profile);
  const rows = serviceProfilePublishChecks(form, profile.serviceMapEntry);
  assert.deepEqual(rows.map((row) => row.key), ['status', 'map', 'service', 'location', 'contact', 'assistant', 'address']);
  for (const row of rows) {
    assert.ok(PROFILE_VIEW_KEYS.includes(row.view), `${row.key} → ${row.view}`);
    assert.ok(row.textKey && row.fallback, row.key);
  }
  assert.deepEqual(rows.filter((row) => !row.ok).map((row) => row.key), ['assistant']);
  assert.equal(rows.at(-1).detail, 'Lossi 1, Põltsamaa');

  const bare = { ...form, email: '', serviceItems: [], serviceLocations: [] };
  const open = serviceProfilePublishChecks(bare, null);
  assert.deepEqual(open.filter((row) => row.blocking).map((row) => [row.key, row.view]), [['service', 'services'], ['contact', 'contact']]);
  assert.equal(open.find((row) => row.key === 'contact').textKey, 'publish_checks.contact_missing');
  assert.equal(open.at(-1).textKey, 'map_status.empty');
  /* Aadressita profiil: kaardikirje olek FAILED ei tee reast „vastet ei leitud". */
  assert.equal(serviceProfilePublishChecks(bare, { geocodingStatus: 'FAILED' }).at(-1).textKey, 'map_status.empty');
  assert.equal(serviceProfilePublishChecks(bare, { geocodingStatus: 'FAILED', address: 'Lossi 1' }).at(-1).textKey, 'map_status.failed');
  const withPlace = { ...bare, serviceLocations: [{ address: 'Lossi 1', mapVisible: true }] };
  assert.equal(serviceProfilePublishChecks(withPlace, { geocodingStatus: 'FAILED' }).at(-1).textKey, 'map_status.failed');

  assert.equal(serviceProfileMapStatus({ geocodingStatus: 'manually_confirmed' }).matched, true);
  assert.equal(serviceProfileMapStatus({ geocodingStatus: 'AMBIGUOUS' }).key, 'map_status.ambiguous');
  assert.equal(serviceProfileMapStatus({ geocodingStatus: 'FAILED' }).key, 'map_status.failed');
  assert.equal(serviceProfileMapStatus({}).key, 'map_status.pending');
});

test('vaadete seis ja kokkuvõte tulevad vormist', () => {
  const profile = sampleProfile();
  const form = createServiceProfileForm(profile);
  const states = profileViewStates(form, profile.serviceMapEntry);
  assert.deepEqual(Object.keys(states), [...PROFILE_VIEW_KEYS]);
  assert.equal(states.who, 'done');
  assert.equal(states.about, 'empty');
  assert.equal(states.services, 'done');
  assert.equal(states.locations, 'done');
  assert.equal(states.visibility, 'done');
  /* Näidisprofiilil on puudu ainult assistendi luba. See on teenuseosutaja valik, mitte nõue:
     kontrolli samm on valmis ja „üle vaadata" hulka see ei loe. */
  assert.equal(states.check, 'done');
  const assistantRow = serviceProfilePublishChecks(form, profile.serviceMapEntry).find((row) => row.key === 'assistant');
  assert.equal(assistantRow.optional, true);
  /* Leht annab märke vaatele edasi: muidu kannab valik silti „Vaata üle". */
  assert.ok(read('../components/workspace/WorkspaceFeaturePage.jsx').includes('optional: Boolean(row.optional),'));
  assert.equal(profileViewStates({ ...form, mapVisible: false }, profile.serviceMapEntry).check, 'partial', 'päris puudus jätab sammu pooleli');
  assert.equal(profileViewStates(createServiceProfileForm(), null).who, 'empty');
  assert.equal(profileViewStates({ ...form, organizationName: '', registryCode: '123' }, null).who, 'partial');

  const options = serviceProfileOptionSets((key, fallback) => fallback);
  const summaries = profileViewSummaries(form, profile.serviceMapEntry, { tp, options });
  assert.equal(summaries.who, 'Hoolekanne MTÜ');
  assert.equal(summaries.visibility, 'Avaldatud');
  assert.equal(summaries.services, 'views.services.summary:{"count":1,"published":1}');
  /* Ainus lahtine rida on assistendi luba, mis on valik: kokkuvõte ütleb „korras". */
  assert.equal(summaries.check, '[views.check.summary_ok]');
  assert.equal(profileViewSummaries({ ...form, mapVisible: false }, profile.serviceMapEntry, { tp, options }).check, 'views.check.summary_open:{"count":1}');

  const service = form.serviceItems[0];
  const serviceStates = serviceViewStates(service, { savedAvailability: service.availability, licenceRow: { badge: { tone: 'POSITIVE' } } });
  assert.deepEqual(Object.keys(serviceStates), [...SERVICE_VIEW_KEYS]);
  assert.deepEqual([serviceStates.service, serviceStates.category, serviceStates.places, serviceStates.confirm, serviceStates.licence], ['done', 'done', 'done', 'done', 'done']);
  assert.equal(serviceViewStates(service, { savedAvailability: { freshness: 'stale' } }).confirm, 'partial');
  assert.equal(serviceViewStates(service).licence, 'empty');
  assert.equal(serviceViewStates({ ...service, contactStrategy: 'CUSTOM' }).service_contact, 'partial');
  /* Kokkuvõttes on sildid, mitte koodid; tundmatu varasem valik jääb oma sõnaga. */
  const serviceSummaries = serviceViewSummaries({ ...service, feeType: 'FREE' }, { options });
  assert.equal(serviceSummaries.category, 'Kodune abi ja hooldus, Koduabi');
  assert.equal(serviceSummaries.price, 'Tasuta');
  assert.equal(serviceSummaries.availability, 'Võtab uusi pöördumisi vastu');

  const locationStates = locationViewStates(form.serviceLocations[0]);
  assert.deepEqual(Object.keys(locationStates), [...LOCATION_VIEW_KEYS]);
  assert.deepEqual(locationStates, { place: 'done', address: 'done', place_contact: 'empty' });
  assert.equal(locationViewStates({ ...form.serviceLocations[0], normalizedAddress: '' }).address, 'partial');
});

test('lava sammud: nimed kataloogist, loendid on vabad vaated', () => {
  const steps = serviceProfileSteps(PROFILE_VIEW_KEYS, { tp, states: { who: 'done' }, summaries: { who: 'Hoolekanne MTÜ' } });
  assert.deepEqual(steps[0], { key: 'who', label: '[views.who.title]', short: '[views.who.short]', state: 'done', summary: 'Hoolekanne MTÜ', free: false });
  assert.deepEqual(steps.filter((step) => step.free).map((step) => step.key), ['locations', 'services']);
  assert.equal(steps.at(-1).state, 'empty');
  /* Teenuse kohtade vaade on vaba alles siis, kui kohti on rohkem, kui paneeli mahub. */
  const few = serviceProfileSteps(SERVICE_VIEW_KEYS, { tp, placeCount: 3 });
  const many = serviceProfileSteps(SERVICE_VIEW_KEYS, { tp, placeCount: 12 });
  assert.equal(few.find((step) => step.key === 'places').free, false);
  assert.equal(many.find((step) => step.key === 'places').free, true);
});

test('loendiread ütlevad, mis ei salvestu, ja seis on kood, mille sõna annab vaade', () => {
  const form = createServiceProfileForm(sampleProfile());
  form.serviceItems.push({ ...form.serviceItems[0], name: '', status: 'DRAFT' });
  form.serviceLocations.push({ ...form.serviceLocations[0], label: '', address: '', normalizedAddress: '' });
  assert.deepEqual(serviceRows(form), [
    { index: 0, name: 'Koduteenus', saves: true, status: 'PUBLISHED', published: true },
    { index: 1, name: '', saves: false, status: 'DRAFT', published: false }
  ]);
  const places = locationRows(form);
  assert.deepEqual(places[0], { index: 0, title: 'Keskus', address: 'Lossi 1, Põltsamaa', saves: true, status: 'PUBLISHED', onMap: true });
  assert.deepEqual([places[1].title, places[1].saves], ['', false]);
  assert.equal(realServiceLocations(form).length, 1);
  /* Vaade ei trüki seisu koodi: sõna tuleb valikute siltidest. */
  const lists = read(VIEW_SOURCES[1]);
  assert.ok(lists.includes('statusText(row.status)') && !lists.includes('{row.status}'), 'loend näitab seisu sõnaga');
  for (const source of VIEW_SOURCES.map(read)) {
    /* Seis võib olla valiku väärtus (`value={service.status}`), aga mitte tekst märgendi sees. */
    assert.ok(!/>\s*\{[a-zA-Z.]*status\}/i.test(source), 'seisu koodi ei trükita');
  }
});

test('lehe lubadused: kaks vajutust eemaldamiseks, loendur välja all, valikud lahtritena', () => {
  /* Eemaldamine: esimene vajutus küsib kinnitust, vaade ise ei eemalda midagi. */
  assert.ok(surface.includes('armConfirm(opened.kind)'), 'eemaldamine küsib teist vajutust');
  assert.ok(surface.includes('if (confirming !== opened.kind) {'), 'teine vajutus alles eemaldab');
  for (const source of [read(VIEW_SOURCES[2]), read(VIEW_SOURCES[3])]) {
    assert.ok(source.includes('onClick={remove.onClick}') && !source.includes('removeService'), 'vaade kutsub lehe eemaldamist');
  }
  for (const source of [...VIEW_SOURCES.map(read), surface]) {
    assert.ok(!source.includes('role="status"'), 'teated ei kasuta status-rolli (ühine kiht joonistab selle kastina)');
    assert.ok(!source.includes('feature-section'), 'vaated ei ole vanal ühisel kihil');
  }
  /* Valikud on kohe näha lahtrid. Rippvalik on ainult registrist valimiseks (15 maakonda,
     78 omavalitsust) ja elab ühes kohas, ühises väljafailis: vaated ise seda ei joonista. */
  for (const source of [...VIEW_SOURCES.slice(1).map(read), surface]) {
    assert.ok(!source.includes('Dropdown'), 'vaates rippvalikuid ei ole: variandid on kohe näha');
  }
  assert.equal(read(VIEW_SOURCES[0]).split('<Dropdown').length - 1, 1, 'rippvalik on ainult registri valiku väljal');
  /* Märkide loendur on välja enda all (K08) ja piirid tulevad ühest kohast. */
  const fields = read(VIEW_SOURCES[0]);
  assert.ok(fields.includes('className={styles.counter}'), 'loenduril on oma klass');
  assert.ok(fields.includes('maxLength = SERVICE_PROFILE_LIMITS.shortText') && fields.includes('maxLength = SERVICE_PROFILE_LIMITS.text'));
  assert.ok(read(VIEW_SOURCES[3]).includes('maxLength={SERVICE_PROFILE_LIMITS.addressQuery}'));
  assert.deepEqual([SERVICE_PROFILE_LIMITS.services, SERVICE_PROFILE_LIMITS.locations], [40, 30]);
  assert.ok(surface.includes('SERVICE_PROFILE_LIMITS.services') && surface.includes('SERVICE_PROFILE_LIMITS.locations'));
  const css = read('../components/workspace/serviceProfile/profile.module.css');
  for (const name of ['counter', 'field', 'row', 'check', 'textButton']) assert.ok(css.includes(`.${name} {`), `kujundusfailis on .${name}`);
});

test('leht teeb samad päringud ja admini töövaate valik ei hõlju sisu kohal', () => {
  for (const call of [
    'fetch("/api/service-provider/profile", { cache: "no-store" })',
    'method: "PUT"',
    '"Idempotency-Key"',
    'JSON.stringify(serviceProfileSavePayload(form, profile?.updatedAt))',
    '/availability-confirmation`',
    'JSON.stringify({ fingerprint: service.availabilityFingerprint })',
    '/api/service-map/address-suggestions?'
  ]) {
    assert.ok(surface.includes(call), `päring on alles: ${call}`);
  }
  assert.ok(surface.includes('serviceProfileSaveNotice(t, savedProfile)'), 'salvestamise teade tuleb samast otsustajast');
  assert.ok(surface.includes('<StepFlight') && surface.includes('validate={false}'), 'pind on sammulaval');
  assert.equal(SERVICE_PROFILE_KEY, 'workspace_feature_pages.service_profile');
  /* K08 ja omanik 10.10: valik ei hõlju paneeli nurgas sisu kohal, vaid
     seisab ekraani alumises paremas nurgas, väljaspool paneeli. */
  const roleSwitch = read('../components/workspace/AdminRoleViewCycleButton.jsx');
  assert.ok(roleSwitch.includes('placement === "corner" ? document.body : null'), 'lüliti portaalitakse paneelist välja');
  assert.ok(!roleSwitch.includes('document.querySelector(".panel")'), 'lüliti ei lähe enam paneeli sisse');
  assert.ok(!page.includes('profileStyles.roleSlot'), 'teenuseprofiilil ei ole valikul oma rida');
  assert.ok(page.includes('featureKey === "pre_inquiries" || featureKey === "service_profile" ? "sr-only"'), 'lehe pealkiri on ainult ekraanilugejale');
  /* Vana vormi ühised reeglid on kustutatud, sest keegi neid enam ei kasuta. */
  for (const file of ['../app/styles/feature-pages.css', '../app/styles/workspace.css']) {
    const styles = read(file);
    for (const name of ['service-profile-availability', 'service-profile-licence-actions', 'feature-section--profile']) {
      assert.ok(!styles.includes(name), `${file}: ${name}`);
    }
  }
});

// Kolme kategooria nimes on koma. Loend on vormis komadega tekst: lihtne tükeldamine
// tegi ühest kategooriast kaks olematut ja lahter ei jäänud valituks (viga oli juba vanal lehel).
test('komaga valikuväärtus jääb loendis üheks tervikuks', () => {
  const withComma = SERVICE_PROFILE_OPTIONS.category.map((option) => option[0]).filter((value) => value.includes(','));
  assert.equal(withComma.length, 3, 'kolm kategooriat sisaldavad koma');
  for (const value of withComma) {
    const picked = toggleListValue('', value);
    assert.deepEqual(splitList(picked), [value], value);
    /* Teine valik kõrvale ja esimene uuesti maha: kumbki ei lagune. */
    const both = toggleListValue(picked, 'Muu teenus');
    assert.deepEqual(splitList(both), [value, 'Muu teenus']);
    assert.deepEqual(splitList(toggleListValue(both, value)), ['Muu teenus']);
  }
  /* Kõik kolm korraga, nagu server need massiivina tagasi annab. */
  assert.deepEqual(splitList(joinList(withComma)), withComma);
  /* Inimese kirjutatud loend töötab edasi: koma, semikoolon ja reavahetus eraldavad. */
  assert.deepEqual(splitList('eesti, vene; inglise\nsoome'), ['eesti', 'vene', 'inglise', 'soome']);
  assert.deepEqual(splitList(''), []);
  /* Salvestamise sisu kannab kategooria tervikuna. */
  const form = createServiceProfileForm(null);
  const item = { ...(form.serviceItems[0] || {}), name: 'Proov', categories: toggleListValue('', withComma[0]) };
  const payload = serviceProfileSavePayload({ ...form, serviceItems: [item] });
  const saved = (payload.serviceItems || [])[0];
  if (saved) {
    assert.deepEqual(saved.categories, [withComma[0]]);
    assert.equal(saved.category, withComma[0]);
  }
});

// Piirkond registrist (ADR-144). Vestluse assistent saab osutajat nimetada ainult koha kohta, mille
// kohta küsitakse, seega peab märgitud piirkond olema loetav. Vorm küsis maakonda ja omavalitsusi
// vabatekstina: „Tartu" (nii linn kui vald) või „Lõuna-Eesti" ei katnud ühtki kohta.
const registerRows = JSON.parse(read('../src/server/data/municipalities.rich.json'));
const UNREAD_NONE = { municipalities: 0, counties: 0, ambiguous: 0 };

test('piirkonna valikud tulevad registrist ja valitud väärtusi loeb piirkonna lugeja', () => {
  const choices = serviceAreaChoices(registerRows);
  assert.equal(choices.municipalities.length, 78);
  assert.equal(choices.counties.length, 15);
  assert.deepEqual(choices.counties.slice(0, 3).map((option) => option.value), ['Harjumaa', 'Hiiumaa', 'Ida-Virumaa']);
  /* Loend on eesti tähestiku järgi: õ, ä, ö, ü on lõpus, mitte o ja a kõrval. */
  const names = choices.municipalities.map((option) => option.label);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'et')));

  /* Lugeja ehitab registri ise (nagu vestluse poolel): iga valik, mida vorm pakub, on loetav. */
  const register = municipalityRegister(registerRows);
  for (const option of choices.municipalities) {
    const area = readServiceArea({ serviceAreaType: 'KOV põhine', municipalityIds: [option.value] }, {}, register);
    assert.deepEqual([area.kind, area.municipalities, area.unread], [ServiceAreaKind.MUNICIPALITY, [option.slug], UNREAD_NONE], option.value);
  }
  for (const option of choices.counties) {
    const area = readServiceArea({ serviceAreaType: 'Maakondlik', county: option.value }, {}, register);
    assert.deepEqual([area.kind, area.counties.length, area.unread], [ServiceAreaKind.COUNTY, 1, UNREAD_NONE], option.value);
  }

  /* Terve tee: valik vormis → salvestatav keha → lugeja. */
  const form = createServiceProfileForm(sampleProfile());
  let picked = '';
  for (const name of ['Elva vald', 'Tartu linn']) {
    assert.ok(municipalityChoice(picked, choices).options.some((option) => option.value === name), `${name} on pakkumises`);
    picked = toggleListValue(picked, name);
  }
  const after = municipalityChoice(picked, choices);
  assert.deepEqual([after.selected, after.unread, after.options.length, after.full], [['Elva vald', 'Tartu linn'], [], 76, false]);
  const county = countyChoice('', choices, 'Täpsustamata');
  assert.deepEqual([county.value, county.unread, county.options.length, county.options[0]], ['', false, 16, { value: '', label: 'Täpsustamata' }]);
  form.serviceItems[0] = { ...form.serviceItems[0], serviceAreaType: 'KOV põhine', municipalityIds: picked };
  form.serviceItems.push({ ...form.serviceItems[0], id: '', name: 'Tugiisik', serviceAreaType: 'Maakondlik', municipalityIds: '', county: 'Raplamaa' });
  form.serviceAreaMunicipalityIds = toggleListValue('', 'Tallinn');
  form.county = 'Harjumaa';
  const payload = serviceProfileSavePayload(form, null);
  assert.deepEqual(payload.serviceItems[0].municipalityIds, ['Elva vald', 'Tartu linn']);
  assert.deepEqual(payload.serviceAreaMunicipalityIds, ['Tallinn']);
  const [byMunicipality, byCounty] = payload.serviceItems.map((service) => readServiceArea(service, payload, register));
  assert.deepEqual([byMunicipality.kind, byMunicipality.municipalities, byMunicipality.unread], [ServiceAreaKind.MUNICIPALITY, ['elva-vald', 'tartu-linn'], UNREAD_NONE]);
  assert.deepEqual([byCounty.kind, byCounty.counties, byCounty.unread], [ServiceAreaKind.COUNTY, ['rapla'], UNREAD_NONE]);
  /* Profiili enda valik: tüübita teenus pärib selle ja lugeja loeb. */
  const inherited = readServiceArea({ serviceAreaType: '' }, payload, register);
  assert.deepEqual([inherited.kind, inherited.municipalities, inherited.unread], [ServiceAreaKind.MUNICIPALITY, ['tallinn'], UNREAD_NONE]);

  /* Loendus (scripts/service-profile-assistant-count.mjs): kui see profiil on avaldatud ja loaga,
     ei jää tema vormist valitud piirkonnas ühtki sõna lugemata. */
  const published = {
    id: 'p1',
    status: 'PUBLISHED',
    assistantRecommendationAllowed: true,
    registryCode: null,
    county: payload.county,
    serviceAreaMunicipalityIds: payload.serviceAreaMunicipalityIds,
    serviceMapEntry: { id: 'e1', status: 'PUBLISHED' },
    serviceLocations: [],
    serviceItems: payload.serviceItems.map((service, index) => ({ ...service, id: `s${index}`, status: 'PUBLISHED', mapVisible: true, locationLinks: [] }))
  };
  const counts = assistantDirectoryCounts([published], registerRows);
  assert.deepEqual([counts.profiles.allowed, counts.services.public], [1, 2]);
  assert.deepEqual(counts.services.unreadAreaWords, UNREAD_NONE);
  assert.deepEqual(counts.services.area, { national: 0, county: 1, municipality: 1, unknown: 0 });
  /* Vastupidi: käsitsi kirjutatud sõnad loeb sama loendus lugemata sõnadeks. */
  const handWritten = { ...published, serviceItems: [{ ...published.serviceItems[0], municipalityIds: ['Tartu', 'Lõuna-Eesti'] }] };
  assert.deepEqual(assistantDirectoryCounts([handWritten], registerRows).services.unreadAreaWords, { municipalities: 1, counties: 0, ambiguous: 1 });

  /* Piirkonna vaates valitud maakond salvestub: teeninduskoha vana maakond ei kirjuta seda üle
     (koht pärib maakonna loomisel profiililt ja tal endal seda välja ei ole). */
  const moved = createServiceProfileForm({ ...sampleProfile(), county: 'Raplamaa', serviceLocations: [{ ...sampleProfile().serviceLocations[0], county: 'Raplamaa' }] });
  assert.equal(serviceProfileSavePayload(moved, null).county, 'Raplamaa');
  assert.equal(serviceProfileSavePayload({ ...moved, county: 'Harjumaa' }, null).county, 'Harjumaa');
  assert.equal(serviceProfileSavePayload({ ...moved, county: '' }, null).county, '');

  /* Server lubab loendis kuni 50 kirjet: täis loend ei paku rohkem lisada. */
  const fifty = choices.municipalities.slice(0, SERVICE_PROFILE_LIMITS.listItems).map((option) => option.value).join(', ');
  assert.equal(municipalityChoice(fifty, choices).full, true);
  /* Väljafail joonistab valikud registrist ja keelab lisamise, kui loend on täis. */
  const fields = read(VIEW_SOURCES[0]);
  assert.ok(fields.includes('options={pick.options}') && fields.includes('disabled={pick.full}') && fields.includes('options={countyPick.options}'));
  for (const view of [read(VIEW_SOURCES[1]), read(VIEW_SOURCES[2])]) assert.ok(view.includes('<AreaFields'), 'vaade kasutab registri valikut');
  for (const view of VIEW_SOURCES.map(read)) {
    assert.ok(!view.includes('fields.municipalities') && !view.includes('service_items.municipality_ids'), 'vabateksti välja „KOV-id või piirkonnad" enam ei ole');
  }
  /* Leht saab registri profiiliga koos ja annab selle mõlemale piirkonna vaatele. */
  assert.ok(surface.includes('setAreaRegister(Array.isArray(payload?.areaRegister) ? payload.areaRegister : [])'));
  assert.equal(surface.split('area={areaChoices}').length - 1, 2);
  const route = read('../app/api/service-provider/profile/route.js');
  assert.ok(route.includes('areaRegister: municipalities.map(({ slug, displayName, baseName, county }) => ({ slug, displayName, baseName, county }))'));
});

test('varem käsitsi kirjutatud piirkond jääb näha ja maha võetavaks', () => {
  const choices = serviceAreaChoices(registerRows);
  const legacy = 'Elva, Tartu, Lõuna-Eesti, Põltsamaa vald';
  const pick = municipalityChoice(legacy, choices);
  assert.deepEqual(pick.selected, ['Elva', 'Tartu', 'Lõuna-Eesti', 'Põltsamaa vald']);
  /* „Tartu" sobib linnale ja vallale, „Lõuna-Eesti" ei ole omavalitsus: kumbki ei kata ühtki kohta. */
  assert.deepEqual(pick.unread, ['Tartu', 'Lõuna-Eesti']);
  /* Loetav vana kuju („Elva") katab oma omavalitsuse: seda ei pakuta teist korda. */
  const offered = pick.options.map((option) => option.value);
  assert.ok(!offered.includes('Elva vald') && !offered.includes('Põltsamaa vald'));
  assert.ok(offered.includes('Tartu linn') && offered.includes('Tartu vald'));
  assert.equal(offered.length, 76);
  /* Näha: väli joonistab valitud sõnad lahtritena (valikuloend on tühi, lahtrid tulevad väärtusest). */
  assert.deepEqual(optionsWithSelected([], legacy).map((option) => option.value), pick.selected);
  assert.ok(read(VIEW_SOURCES[0]).includes('value={municipalities} options={[]} onChange={onMunicipalities}'));
  /* Maha võetav: vajutus lahtrile eemaldab selle sõna, teised jäävad. */
  const cleaned = toggleListValue(legacy, 'Lõuna-Eesti');
  assert.deepEqual(splitList(cleaned), ['Elva', 'Tartu', 'Põltsamaa vald']);
  assert.deepEqual(municipalityChoice(cleaned, choices).unread, ['Tartu']);
  /* Ei kao vaikselt: salvestamine saadab kõik sõnad, mida osutaja maha ei võtnud. */
  const form = { ...createServiceProfileForm(sampleProfile()), serviceAreaMunicipalityIds: legacy };
  form.serviceItems = [{ ...form.serviceItems[0], municipalityIds: legacy }];
  const payload = serviceProfileSavePayload(form, null);
  assert.deepEqual(payload.serviceAreaMunicipalityIds, pick.selected);
  assert.deepEqual(payload.serviceItems[0].municipalityIds, pick.selected);

  /* Maakond: loetav vana kuju näitab registri nime valituna, tundmatu jääb omaette valikuna alles. */
  const old = countyChoice('Harju maakond', choices, 'Täpsustamata');
  assert.deepEqual([old.value, old.unread, old.options.length], ['Harjumaa', false, 16]);
  const unknown = countyChoice(' Lõuna-Eesti ', choices, 'Täpsustamata');
  assert.deepEqual([unknown.value, unknown.unread, unknown.options.length], ['Lõuna-Eesti', true, 17]);
  assert.deepEqual(unknown.options.at(-1), { value: 'Lõuna-Eesti', label: 'Lõuna-Eesti' });
  assert.equal(serviceProfileSavePayload({ ...form, county: 'Lõuna-Eesti' }, null).county, 'Lõuna-Eesti');

  /* Kui register ei laadinud, ei hinda vorm ühtki sõna loetamatuks ja sõnad jäävad alles. */
  const none = serviceAreaChoices([]);
  const blind = municipalityChoice(legacy, none);
  assert.deepEqual([blind.selected, blind.options, blind.unread], [pick.selected, [], []]);
  const blindCounty = countyChoice('Lõuna-Eesti', none, 'Täpsustamata');
  assert.deepEqual([blindCounty.value, blindCounty.unread, blindCounty.options.length], ['Lõuna-Eesti', false, 2]);
  assert.deepEqual(unreadableServiceAreas({ ...form, serviceItems: [{ ...form.serviceItems[0], serviceAreaType: 'KOV põhine' }] }, none), { municipality: [], county: [] });

  /* Vaade, mis on teate või paljude valitud omavalitsuste tõttu teistest pikem, on laval „vaba":
     teised vaated ei võta selle kõrgust (mõõdetud 1536 × 640 aknas: profiili vaatesse mahub üks
     rida lahtreid, teenuse vaatesse kaks). */
  const many = choices.municipalities.slice(0, 7).map((option) => option.value);
  assert.equal(areaViewIsTall('area', many.slice(0, 3).join(', '), 'Tartumaa', choices), false);
  assert.equal(areaViewIsTall('area', many.slice(0, 4).join(', '), 'Tartumaa', choices), true);
  assert.equal(areaViewIsTall('reach', many.slice(0, 6).join(', '), '', choices), false);
  assert.equal(areaViewIsTall('reach', many.join(', '), '', choices), true);
  assert.equal(areaViewIsTall('reach', 'Tartu', '', choices), true, 'teade lugemata sõna kohta');
  assert.equal(areaViewIsTall('area', '', 'Lõuna-Eesti', choices), true, 'teade maakonna kohta');
  assert.equal(areaViewIsTall('area', 'Tartu, Lõuna-Eesti', 'Lõuna-Eesti', none), false, 'ilma registrita teadet ei ole');
  assert.deepEqual(serviceProfileSteps(PROFILE_VIEW_KEYS, { tp, tallArea: true }).filter((step) => step.free).map((step) => step.key), ['area', 'locations', 'services']);
  assert.equal(serviceProfileSteps(SERVICE_VIEW_KEYS, { tp, tallArea: true }).find((step) => step.key === 'reach').free, true);
  assert.equal(serviceProfileSteps(SERVICE_VIEW_KEYS, { tp }).find((step) => step.key === 'reach').free, false);
  assert.ok(surface.includes('areaViewIsTall("reach", openedService.municipalityIds, openedService.county, areaChoices)'));
  assert.ok(surface.includes('areaViewIsTall("area", form.serviceAreaMunicipalityIds, form.county, areaChoices)'));
});

test('kontroll ütleb, kui teenuse piirkonda ei saa lugeda, ja rida kaob, kui piirkond on valitud', () => {
  const profile = sampleProfile();
  const choices = serviceAreaChoices(registerRows);
  const form = createServiceProfileForm(profile);
  const withArea = (patch) => ({ ...form, serviceItems: [{ ...form.serviceItems[0], municipalityIds: '', county: '', ...patch }] });
  const checks = (value) => serviceProfilePublishChecks(value, profile.serviceMapEntry, choices);
  const keys = (value) => checks(value).map((row) => row.key);
  const BASE = ['status', 'map', 'service', 'location', 'contact', 'assistant', 'address'];
  assert.deepEqual(keys(form), BASE, 'täpsustamata tüübiga teenus ei too rida');

  /* KOV põhine teenus ilma omavalitsuseta: rida ilmub, ei takista salvestamist ja viib teenuse piirkonna vaatesse. */
  const kov = withArea({ serviceAreaType: 'KOV põhine' });
  assert.deepEqual(keys(kov), ['status', 'map', 'service', 'location', 'contact', 'area_municipality', 'assistant', 'address']);
  const row = checks(kov).find((item) => item.key === 'area_municipality');
  assert.deepEqual(row, {
    key: 'area_municipality',
    ok: false,
    view: 'services',
    item: { kind: 'service', index: 0, view: 'reach' },
    blocking: false,
    textKey: 'publish_checks.area_municipality_missing',
    fallback: 'KOV põhisel teenusel ei ole ühtki registrist valitud omavalitsust.',
    detail: 'Koduteenus'
  });
  assert.ok(PROFILE_VIEW_KEYS.includes(row.view) && SERVICE_VIEW_KEYS.includes(row.item.view));
  assert.deepEqual(serviceProfilePublishState(kov).blocking, []);
  /* Sõnad, mida register ei loe, ei ole valik. */
  assert.ok(keys(withArea({ serviceAreaType: 'KOV põhine', municipalityIds: 'Tartu, Lõuna-Eesti' })).includes('area_municipality'));
  /* Registrist valitud omavalitsus: rida kaob. Sama, kui omavalitsus on valitud profiili piirkonnas (lugeja varu). */
  assert.deepEqual(keys(withArea({ serviceAreaType: 'KOV põhine', municipalityIds: 'Elva vald' })), BASE);
  assert.deepEqual(keys({ ...kov, serviceAreaMunicipalityIds: 'Elva vald' }), BASE);

  /* Maakondlik teenus ilma maakonnata. */
  const county = withArea({ serviceAreaType: 'Maakondlik' });
  assert.deepEqual(keys(county), ['status', 'map', 'service', 'location', 'contact', 'area_county', 'assistant', 'address']);
  assert.equal(checks(county).find((item) => item.key === 'area_county').textKey, 'publish_checks.area_county_missing');
  assert.ok(keys(withArea({ serviceAreaType: 'Maakondlik', county: 'Lõuna-Eesti' })).includes('area_county'));
  assert.deepEqual(keys(withArea({ serviceAreaType: 'Maakondlik', county: 'Raplamaa' })), BASE);
  assert.deepEqual(keys({ ...county, county: 'Raplamaa' }), BASE, 'profiili maakond on varu');

  /* Teised tüübid ei küsi midagi; nimeta teenus ei salvestu ja seda ei hinnata. */
  for (const type of ['', 'Üleriigiline', 'Veebiteenus', 'Teeninduskoha põhine']) assert.deepEqual(keys(withArea({ serviceAreaType: type })), BASE, type);
  const twoServices = { ...form, serviceItems: [kov.serviceItems[0], { ...kov.serviceItems[0], name: 'Tugiisik' }, { ...kov.serviceItems[0], name: ' ' }] };
  assert.equal(checks(twoServices).find((item) => item.key === 'area_municipality').detail, 'Koduteenus, Tugiisik');
  assert.deepEqual(unreadableServiceAreas(twoServices, choices).municipality.map((item) => item.index), [0, 1]);
  /* Tüübid, mida mudel jälgib, on päris valikuväärtused. */
  const areaTypes = SERVICE_PROFILE_OPTIONS.areaType.map(([value]) => value);
  assert.ok(areaTypes.includes('KOV põhine') && areaTypes.includes('Maakondlik'));

  /* Sammu seis ja kokkuvõte: lahtine rida jätab kontrolli pooleli; ilma registrita ei hinnata midagi. */
  const options = serviceProfileOptionSets((key, fallback) => fallback);
  assert.equal(profileViewStates(kov, profile.serviceMapEntry, choices).check, 'partial');
  assert.equal(profileViewStates(kov, profile.serviceMapEntry).check, 'done');
  assert.equal(profileViewSummaries(kov, profile.serviceMapEntry, { tp, options, areaChoices: choices }).check, 'views.check.summary_open:{"count":1}');
  assert.equal(serviceViewStates(kov.serviceItems[0], { areaUnread: true }).reach, 'partial');
  assert.equal(serviceViewStates(kov.serviceItems[0]).reach, 'done');
  /* Leht viib rea teenuse vaatesse ja annab registri kontrollile kaasa. */
  assert.ok(surface.includes('openItem(row.item.kind, row.item.index, row.item.view)'));
  assert.ok(surface.includes('serviceProfilePublishChecks(form, mapEntry, areaChoices, representation)'));
});

test('assistendi koopia hoiatus jääb pärast salvestamist lava kohale', () => {
  const page = read('../components/workspace/WorkspaceFeaturePage.jsx');
  assert.ok(page.includes('if (SAVE_WARNING_KEYS.has(serviceProfileSaveNoticeKey(savedProfile).key)) setSaveWarning(savedText);'));
  assert.ok(page.includes('"workspace_feature_pages.service_profile.save_success_removal_pending"'));
  assert.ok(page.includes('"workspace_feature_pages.service_profile.save_success_assistant_sync_failed"'));
  /* Hoiatus kustub alles järgmise salvestamise alguses, mitte esimese muudatusega. */
  assert.equal(page.split('setSaveWarning("")').length - 1, 1);
});

test('töölaua sees avatud teenuseprofiilil ei korrata paneelil lehe pealkirja', () => {
  const panel = read('../components/chat/WorkspacePanel.jsx');
  assert.match(panel, /const EMBEDDED_TITLE_IN_DOCK = new Set\(\[[^\]]*"service_profile"[^\]]*\]\);/);
});

test('põhinupu läige on ainult ees oleval vaatel', () => {
  const page = read('../components/workspace/WorkspaceFeaturePage.jsx');
  assert.ok(page.includes('const save = saveButton(flight?.isActive !== false);'));
  assert.ok(!page.includes('save={saveButton}'), 'ükski vaade ei saa nuppu, mille läige on alati sees');
});
