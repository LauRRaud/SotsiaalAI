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
  availabilityChoices,
  createServiceProfileForm,
  emailLooksValid,
  firstEmailProblem,
  indexAfterSave,
  joinList,
  keepsLocation,
  keepsService,
  locationRows,
  locationViewStates,
  optionsWithSelected,
  profileViewStates,
  profileViewSummaries,
  realServiceLocations,
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
  toggleListValue
} from '../components/workspace/serviceProfile/profileModel.js';
import { SERVICE_PROFILE_LIMITS } from '../lib/serviceProviderProfileLimits.js';

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
  assert.equal(states.check, 'partial');
  assert.equal(profileViewStates(createServiceProfileForm(), null).who, 'empty');
  assert.equal(profileViewStates({ ...form, organizationName: '', registryCode: '123' }, null).who, 'partial');

  const options = serviceProfileOptionSets((key, fallback) => fallback);
  const summaries = profileViewSummaries(form, profile.serviceMapEntry, { tp, options });
  assert.equal(summaries.who, 'Hoolekanne MTÜ');
  assert.equal(summaries.visibility, 'Avaldatud');
  assert.equal(summaries.services, 'views.services.summary:{"count":1,"published":1}');
  assert.equal(summaries.check, 'views.check.summary_open:{"count":1}');

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
    assert.ok(!source.includes('DocumentsDropdown'), 'rippvalikuid ei ole: variandid on kohe näha');
    assert.ok(!source.includes('feature-section'), 'vaated ei ole vanal ühisel kihil');
  }
  /* Märkide loendur on välja enda all (K08) ja piirid tulevad ühest kohast. */
  const fields = read(VIEW_SOURCES[0]);
  assert.ok(fields.includes('className={styles.counter}'), 'loenduril on oma klass');
  assert.ok(fields.includes('maxLength = SERVICE_PROFILE_LIMITS.shortText') && fields.includes('maxLength = SERVICE_PROFILE_LIMITS.text'));
  assert.ok(read(VIEW_SOURCES[3]).includes('maxLength={SERVICE_PROFILE_LIMITS.addressQuery}'));
  assert.deepEqual([SERVICE_PROFILE_LIMITS.services, SERVICE_PROFILE_LIMITS.locations], [40, 30]);
  assert.ok(surface.includes('SERVICE_PROFILE_LIMITS.services') && surface.includes('SERVICE_PROFILE_LIMITS.locations'));
  const css = read('../components/workspace/serviceProfile/profile.module.css');
  for (const name of ['counter', 'field', 'row', 'check', 'textButton', 'roleSlot', 'roleInline']) assert.ok(css.includes(`.${name} {`), `kujundusfailis on .${name}`);
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
  /* K08: valik on voos oma real, mitte paneeli nurgas keriva sisu kohal. */
  assert.ok(page.includes('placement={featureKey === "service_profile" ? "inline" : "panel"}'));
  assert.ok(read('../components/workspace/AdminRoleViewCycleButton.jsx').includes('placement === "inline"'));
  assert.ok(page.includes('featureKey === "pre_inquiries" || featureKey === "service_profile" ? "sr-only"'), 'lehe pealkiri on ainult ekraanilugejale');
  /* Vana vormi ühised reeglid on kustutatud, sest keegi neid enam ei kasuta. */
  for (const file of ['../app/styles/feature-pages.css', '../app/styles/workspace.css']) {
    const styles = read(file);
    for (const name of ['service-profile-availability', 'service-profile-licence-actions', 'feature-section--profile']) {
      assert.ok(!styles.includes(name), `${file}: ${name}`);
    }
  }
});
