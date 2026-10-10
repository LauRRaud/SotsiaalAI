// Avatud abikuulutus: väikesed vaated loendi asemel (lugemine, ühendamine, muutmine, kustutamine).
//
// Avatud kuulutus oli üks pikk leht vanal ühisel kihil: oma päis, kast kasti
// sees, rippvalikud, eestikeelsed valikute nimed koodis ja kustutamise kinnitus
// eraldi aknas. Nüüd on see vaadetena components/stage klotsidel. Test hoiab
// seda, mida silm kergesti ei märka: puuduv tõlkevõti, väärtusest kokku pandud
// võti ilma sõnata, toores seis ekraanil, ühe liigutusega kustutamine, muutunud
// päring ja omadus, mille leht jättis vaatele andmata.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONFIRM_MS,
  EDIT_LIMITS,
  EDIT_PART_KEYS,
  HELP_CATEGORY_CODES,
  HELP_TYPE_CODES,
  LISTING_VIEW_KEYS,
  MIN_GAP_MS,
  TARGET_GROUP_CODES,
  TIME_TYPE_CODES,
  categoryOptions,
  categoryWord,
  cleanDescription,
  connectChoice,
  counterText,
  editPartOptions,
  editProblem,
  editSnapshot,
  editValues,
  helpTypeOptions,
  listingChips,
  listingFacts,
  listingKindWord,
  listingNotice,
  listingSheet,
  listingText,
  listingViewKey,
  pressTooSoon,
  saveEditPayload,
  targetGroupOptions,
  timeTypeOptions,
  toggleTargetGroup
} from '../components/chat/selectedListingSheet.js';
import { getHelpUiText } from '../components/chat/helpUiText.js';
import { HELP_LISTING_TEXT_LIMITS } from '../lib/help/listingLimits.js';

/* Tööpuus on reavahetus CRLF, kontrollis LF: võrdlused käivad LF kujul. */
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const LANGS = ['et', 'en', 'ru'];
const catalogs = Object.fromEntries(LANGS.map((lang) => [lang, JSON.parse(read(`../messages/${lang}.json`))]));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const missingIn = (key) => LANGS.filter((lang) => typeof at(catalogs[lang], key) !== 'string' || !at(catalogs[lang], key));
/* Tõlkija nagu lehel: võti ilma sõnata tuleb tagasi võtmena, muutujad pannakse sisse. */
const tOf = (lang) => (key, vars) => {
  const text = at(catalogs[lang], key);
  if (typeof text !== 'string') return key;
  return vars && typeof vars === 'object' ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
};
const t = tOf('et');
const ui = getHelpUiText(t);

const CONTEXT = '../components/chat/SelectedListingContext.jsx';
const VIEWS = '../components/chat/SelectedListingViews.jsx';
const SHEET = '../components/chat/selectedListingSheet.js';
const STYLE = '../components/chat/selectedListing.module.css';
const PANEL = '../components/chat/HelpListingsPanel.jsx';
const CHAT = '../components/alalehed/ChatBody.jsx';
const SOURCES = [CONTEXT, VIEWS, SHEET, '../components/chat/helpUiText.js'];

/* Kuulutus nii, nagu server selle omanikule annab (lib/help/listingViews.js, `toHelpListingDetailView`). */
const OWN = Object.freeze({
  id: 'r1',
  kind: 'request',
  title: 'Vajan abi poes käimisel',
  summary: 'Tartu linn | Igapäevaabi | Eakas | Vabatahtlik abi | Ühekordne',
  description: 'Vajan kord nädalas abi poes käimisel. Põhikategooria: Igapäevaabi Omavalitsus: Tartu linn Sihtrühm: Eakas',
  editableTitle: 'Vajan abi poes käimisel',
  editableDescription: 'Vajan kord nädalas abi poes käimisel. Põhikategooria: Igapäevaabi Omavalitsus: Tartu linn Sihtrühm: Eakas',
  categoryLabel: 'Igapäevaabi',
  primaryCategoryCode: 'DAILY_TASKS',
  municipalityLabel: 'Tartu linn',
  rawPlace: 'Annelinn',
  editableRawPlace: 'Annelinn',
  helpType: 'VOLUNTARY',
  helpTypeLabel: 'Vabatahtlik abi',
  timeType: 'ONE_TIME',
  timeTypeLabel: 'Ühekordne',
  status: 'OPEN',
  statusLabel: 'Aktiivne',
  targetGroupLabels: ['Eakas'],
  targetGroupCodes: ['ELDER', 'DISABILITY'],
  availabilityOrStart: 'Neljapäeviti',
  compensationDetails: '',
  conditions: 'Kott ei tohi olla raske'
});
/* Võõras kuulutus: avalik projektsioon (`toPublicHelpListingProjection`), vabateksti ei ole. */
const OTHER = Object.freeze({
  id: 'o7',
  kind: 'offer',
  title: 'Abipakkumine: Transport - Tallinn',
  summary: 'Tallinn | Transport | Paindlik',
  description: 'Tallinn | Transport | Paindlik',
  categoryLabel: 'Transport',
  primaryCategoryCode: 'TRANSPORT',
  municipalityLabel: 'Tallinn',
  helpType: '',
  helpTypeLabel: '',
  timeType: 'FLEXIBLE',
  timeTypeLabel: 'Paindlik',
  status: 'OPEN',
  statusLabel: 'Aktiivne',
  targetGroupLabels: [],
  availabilityOrStart: '',
  compensationDetails: '',
  conditions: ''
});

/* --- Kataloog --------------------------------------------------------------- */

test('iga tekstivõti, mille avatud kuulutus välja kirjutab, on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    const text = read(source);
    for (const match of text.matchAll(/\bt\(\s*"([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)"/g)) keys.add(match[1]);
    /* Võtmed, mis seisavad tingimuses või tagastatakse sõnena (neid i18n:check ei näe). */
    for (const match of text.matchAll(/"(chat\.help\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 70, `võtmeid leiti ${keys.size}`);
  assert.deepEqual([...keys].filter((key) => missingIn(key).length), []);
});

test('igal vaatel on nimi ja lühinimi, mis mahub kiirmenüüsse', () => {
  assert.deepEqual([...LISTING_VIEW_KEYS], ['read', 'connect', 'edit']);
  for (const lang of LANGS) {
    for (const key of LISTING_VIEW_KEYS) {
      const view = at(catalogs[lang], `chat.help.opened.views.${key}`);
      assert.ok(view?.title && view?.short, `${lang}: chat.help.opened.views.${key}`);
      assert.ok(view.short.length <= 18, `${lang}: chat.help.opened.views.${key}.short`);
    }
  }
  /* Vaate nimi on ekraanilugeja pealkiri (`StepPanel title`), nähtavat pealkirja paneelil ei ole. */
  const views = read(VIEWS);
  for (const key of LISTING_VIEW_KEYS) assert.ok(views.includes(`title={t("chat.help.opened.views.${key}.title")}`), key);
  assert.ok(!views.includes('SubpageHeader') && !read(CONTEXT).includes('SubpageHeader'), 'oma päist ja tagasinoolt enam ei ole');
});

test('võtmed, mis pannakse kokku väärtusest, on iga võimaliku väärtuse jaoks olemas', () => {
  const missing = [];
  const need = (key) => {
    if (missingIn(key).length) missing.push(key);
  };
  for (const code of HELP_CATEGORY_CODES) need(`chat.help.categories.${code}`);
  for (const code of TARGET_GROUP_CODES) need(`chat.help.targetGroupOptions.${code}`);
  for (const part of EDIT_PART_KEYS) need(`chat.help.opened.editParts.${part}`);
  assert.deepEqual(missing, []);
  /* Tõlkija annab puuduva sõna asemel võtme enda: ükski valik ei tohi olla võti. */
  for (const lang of LANGS) {
    const tr = tOf(lang);
    const words = [...categoryOptions(tr), ...targetGroupOptions(tr), ...editPartOptions(tr), ...helpTypeOptions(getHelpUiText(tr), tr), ...timeTypeOptions(getHelpUiText(tr), tr)];
    for (const option of words) assert.ok(option.label && !option.label.includes('chat.help'), `${lang}: ${option.value}`);
  }
  assert.ok(catalogs.et.chat.help.opened.charsUsed.includes('{count}') && catalogs.ru.chat.help.opened.charsUsed.includes('{max}'));
});

test('kategooriad ja sihtrühmad on samad mis serveri algandmetes, sõnad kaasa arvatud', () => {
  const categories = JSON.parse(read('../src/server/data/help-categories.json'))
    .filter((item) => item.isActive !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  assert.deepEqual([...HELP_CATEGORY_CODES], categories.map((item) => item.code), 'sama loend ja järjekord');
  for (const item of categories) {
    assert.deepEqual(
      LANGS.map((lang) => at(catalogs[lang], `chat.help.categories.${item.code}`)),
      [item.labelEt, item.labelEn, item.labelRu],
      item.code
    );
  }
  const groups = JSON.parse(read('../src/server/data/target-groups.json'));
  for (const code of TARGET_GROUP_CODES) {
    const item = groups.find((group) => group.code === code);
    assert.ok(item, `sihtrühm ${code} on serveri loendis`);
    assert.deepEqual(LANGS.map((lang) => at(catalogs[lang], `chat.help.targetGroupOptions.${code}`)), [item.labelEt, item.labelEn, item.labelRu], code);
  }
  /* Abi liik ja ajalisus: samad koodid, mille server vastu võtab (lib/help/requests.js). */
  const server = read('../lib/help/requests.js');
  assert.ok(server.includes(`[${HELP_TYPE_CODES.map((code) => `"${code}"`).join(', ')}].includes(normalized)`));
  assert.ok(server.includes(`[${TIME_TYPE_CODES.map((code) => `"${code}"`).join(', ')}].includes(normalized)`));
  /* Vanas komponendis olid need nimed eestikeelsete sõnedena koodis. */
  const all = SOURCES.map(read).join('\n');
  for (const word of ['"Igapäevaabi"', '"Koduabi"', '"Täiskasvanu"', '"Eakas"', '"Transport"']) assert.ok(!all.includes(word), word);
});

test('lisatud eestikeelsetes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const walk = (node, path, out) => {
    for (const [key, value] of Object.entries(node || {})) {
      if (value && typeof value === 'object') walk(value, `${path}.${key}`, out);
      else out.push([`${path}.${key}`, String(value)]);
    }
    return out;
  };
  const help = catalogs.et.chat.help;
  const texts = [
    ...walk(help.opened, 'chat.help.opened', []),
    ...walk(help.categories, 'chat.help.categories', []),
    ...walk(help.targetGroupOptions, 'chat.help.targetGroupOptions', []),
    ['chat.help.connectNotCompatible', help.connectNotCompatible]
  ];
  assert.ok(texts.length > 45);
  for (const [key, text] of texts) assert.ok(!/[—–"']/.test(text), `${key}: ${text}`);
  /* Vene ja inglise tekst on tõlge, mitte eestikeelse koopia. */
  for (const [key] of walk(help.opened, 'chat.help.opened', [])) {
    const [et, en, ru] = LANGS.map((lang) => at(catalogs[lang], key));
    assert.ok(/[а-яё]/i.test(ru), `${key}: vene tekst on kirillitsas`);
    if (!key.endsWith('charsUsed')) assert.notEqual(et, en, key);
  }
});

/* --- Vaate valik ja lugemise vaade ------------------------------------------- */

test('milline vaade on ees', () => {
  assert.equal(listingViewKey(), '', 'kuulutust ei ole avatud');
  assert.equal(listingViewKey({ loading: true }), 'loading');
  assert.equal(listingViewKey({ loading: true, listing: OWN, editState: {} }), 'loading', 'laadimine on enne kõike muud');
  assert.equal(listingViewKey({ error: 'x' }), 'missing');
  assert.equal(listingViewKey({ listing: OWN, isOwn: true }), 'read');
  assert.equal(listingViewKey({ listing: OWN, isOwn: true, error: 'x' }), 'read', 'tegevuse tõrge ei võta kuulutust eest');
  assert.equal(listingViewKey({ listing: OWN, isOwn: true, editState: { title: '' } }), 'edit');
  assert.equal(listingViewKey({ listing: OTHER, connectOpen: true }), 'connect');
  assert.equal(listingViewKey({ listing: OWN, isOwn: true, connectOpen: true }), 'read', 'oma kuulutusega ei ühendata');
  assert.equal(listingViewKey({ listing: OTHER, connectOpen: true, editState: { title: '' } }), 'edit', 'muutmine on ees, kui leht selle avas');
});

test('kirjelduse lõpust lõigatakse serveri lisatud struktuuriread, tekst ise jääb', () => {
  assert.equal(cleanDescription(OWN), 'Vajan kord nädalas abi poes käimisel.');
  assert.equal(cleanDescription({ description: 'Pakun sõitu arsti juurde. Tasu info: kütuse eest Saadavus / algus: tööpäeviti' }), 'Pakun sõitu arsti juurde.');
  assert.equal(cleanDescription({ description: 'Lihtsalt tekst ilma lisaridadeta.' }), 'Lihtsalt tekst ilma lisaridadeta.');
  assert.equal(cleanDescription({ description: 'Tingimused: ainult tööpäeviti' }), 'Tingimused: ainult tööpäeviti', 'kui tekst algab sellise reaga, ei jää tühjus');
  assert.equal(cleanDescription({}), '');
  /* Võõra kuulutuse kirjeldus on serveris sama märksõnade rida mis kokkuvõte: seda ei korrata. */
  assert.equal(listingText(OTHER), '');
  assert.equal(listingText({ title: 'Sama lause', description: 'Sama lause' }), '');
  assert.equal(listingText(OWN), 'Vajan kord nädalas abi poes käimisel.');
});

test('märgid: liik ja minu kuulutus sõnana, seis ainult siis, kui see ei ole avatud', () => {
  assert.deepEqual(listingChips(OWN, { t, ui, isOwn: true }), [
    { key: 'kind', text: 'Abisoov', tone: 'quiet' },
    { key: 'own', text: 'Minu kuulutus', tone: 'own' }
  ]);
  /* Võõra kuulutuse pealkirja paneb server kokku liigist („Abipakkumine: Transport - Tallinn"):
     liigimärk kordaks seda. Avatud kuulutusel ei ole ka seisumärki. */
  assert.ok(OTHER.title.startsWith('Abipakkumine'));
  assert.deepEqual(listingChips(OTHER, { t, ui }), []);
  /* Seisu sõna annab server; toorest koodi ekraanile ei kirjutata. */
  assert.deepEqual(listingChips({ ...OWN, status: 'CLOSED', statusLabel: 'Suletud' }, { t, ui, isOwn: true }).map((chip) => chip.text), ['Abisoov', 'Minu kuulutus', 'Suletud']);
  assert.deepEqual(listingChips({ ...OTHER, status: 'CLOSED', statusLabel: 'Suletud' }, { t, ui }).map((chip) => chip.text), ['Suletud']);
  assert.deepEqual(listingChips({ ...OWN, status: 'MATCHED', statusLabel: '' }, { t, ui, isOwn: true }).map((chip) => chip.key), ['kind', 'own'], 'sõnata seis jääb märgita');
  for (const chip of listingChips({ ...OWN, status: 'CLOSED', statusLabel: 'Suletud' }, { t, ui, isOwn: true })) {
    assert.ok(!/^[A-Z_]{3,}$/.test(chip.text) && !chip.text.includes('|'), chip.text);
  }
  /* Liigi sõna: serveri silt, kui kuulutus seda kannab, muidu kataloogist kolmes keeles. */
  assert.equal(listingKindWord({ kind: 'offer', kindLabel: 'Help offer' }, t), 'Help offer');
  assert.deepEqual(LANGS.map((lang) => listingKindWord({ kind: 'request' }, tOf(lang))), ['Abisoov', 'Help request', 'Запрос помощи']);
});

test('faktid on nimetuse ja väärtuse paarid serveri siltidega; tühja väärtusega fakti ei ole', () => {
  assert.deepEqual(
    listingFacts(OWN, ui).map((fact) => [fact.key, fact.label, fact.value, Boolean(fact.wide)]),
    [
      ['category', 'Põhikategooria', 'Igapäevaabi', false],
      ['municipality', 'Omavalitsus', 'Tartu linn', false],
      ['location', 'Asukoht', 'Annelinn', false],
      ['targetGroups', 'Sihtrühm', 'Eakas', false],
      ['helpType', 'Abi liik', 'Vabatahtlik abi', false],
      ['timeType', 'Ajalisus', 'Ühekordne', false],
      ['availabilityOrStart', 'Saadavus / algus', 'Neljapäeviti', true],
      ['conditions', 'Tingimused', 'Kott ei tohi olla raske', true]
    ]
  );
  assert.deepEqual(listingFacts(OTHER, ui).map((fact) => fact.key), ['category', 'municipality', 'timeType']);
  /* Täpsem asukoht, mida omavalitsuse nimi juba ütleb, jääb välja. */
  assert.ok(!listingFacts({ ...OWN, rawPlace: 'Tartu' }, ui).some((fact) => fact.key === 'location'));
  assert.deepEqual(listingFacts({}, ui), []);
  /* Koode faktides ei ole. */
  for (const fact of listingFacts(OWN, ui)) assert.ok(!['DAILY_TASKS', 'VOLUNTARY', 'ONE_TIME', 'ELDER', 'OPEN'].includes(fact.value), fact.key);
  /* Kui server sõna ei leidnud ja annab sildi kohal koodi, tuleb kategooria sõna
     kataloogist ja muu kood jääb välja. */
  const raw = { categoryLabel: 'DAILY_TASKS', primaryCategoryCode: 'DAILY_TASKS', helpTypeLabel: 'VOLUNTARY', timeTypeLabel: 'ONE_TIME', targetGroupLabels: ['ELDER', 'Eakas'] };
  assert.deepEqual(listingFacts(raw, ui, t).map((fact) => [fact.key, fact.value]), [['category', 'Igapäevaabi'], ['targetGroups', 'Eakas']]);
  assert.equal(categoryWord({ categoryLabel: '', primaryCategoryCode: 'transport' }, tOf('ru')), 'Транспорт');
  assert.equal(categoryWord({ categoryLabel: 'Koduabi', primaryCategoryCode: 'HOME_HELP' }, t), 'Koduabi', 'serveri silt on esimene valik');
  assert.equal(categoryWord({ categoryLabel: 'LEGACY_X', primaryCategoryCode: 'LEGACY_X' }, t), '', 'tundmatut koodi ei kirjutata');
  assert.deepEqual(listingChips({ kind: 'offer', status: 'ON_HOLD', statusLabel: 'ON_HOLD' }, { t, ui, isOwn: true }).map((chip) => chip.key), ['kind', 'own']);
});

test('lugemise vaate leht: pealkiri, tekst, tegevuse nimi', () => {
  const own = listingSheet(OWN, { t, ui, isOwn: true });
  assert.equal(own.title, 'Vajan abi poes käimisel');
  assert.equal(own.text, 'Vajan kord nädalas abi poes käimisel.');
  assert.equal(own.closed, false);
  assert.equal(own.connectLabel, 'Paku abi', 'abisoovile pakutakse abi');
  const other = listingSheet(OTHER, { t, ui });
  assert.equal(other.connectLabel, 'Võta ühendust', 'abipakkumise tegijaga võetakse ühendust');
  assert.equal(other.text, '');
  assert.equal(listingSheet({ kind: 'offer' }, { t, ui }).title, 'Abipakkumine', 'pealkirjata kuulutuse esimene rida on liik');
  assert.equal(listingSheet({ ...OTHER, status: 'CLOSED' }, { t, ui }).closed, true);
});

test('teade: nõusolekupäringu saatmine ei ole tõrge', () => {
  assert.deepEqual(listingNotice('', ui), { text: '', tone: '', sent: false });
  assert.deepEqual(listingNotice(ui.connectPending, ui), { text: ui.connectPending, tone: 'info', sent: true });
  assert.deepEqual(listingNotice(ui.connectFailed, ui), { text: ui.connectFailed, tone: 'risk', sent: false });
  assert.equal(listingNotice(ui.connectNotCompatible, ui).tone, 'risk');
});

/* --- Ühendamine --------------------------------------------------------------- */

test('ühendamise valik: minu avatud vastaskuulutused; kui neid ei ole, ütleb lause, mida on vaja', () => {
  const mine = [{ id: 'a1', title: 'Pakun sõiduabi' }, { id: ' a2 ', title: '' }, { id: '', title: 'ilma id-ta' }];
  const choice = connectChoice({ listing: OWN, options: mine, selectedId: 'a1', t });
  assert.equal(choice.question, 'Millise oma abipakkumisega soovid abi pakkuda?');
  assert.deepEqual(choice.options, [{ value: 'a1', label: 'Pakun sõiduabi' }, { value: 'a2', label: 'Abipakkumine' }], 'pealkirjata kuulutus saab liigi sõna, id-ta rida jääb välja');
  assert.equal(choice.value, 'a1');
  assert.equal(choice.none, '');
  assert.equal(choice.columns, 2);
  assert.equal(connectChoice({ listing: OWN, options: mine, selectedId: 'kadunud', t }).value, '', 'valik, mida loendis ei ole, ei ole valitud');
  const toOffer = connectChoice({ listing: OTHER, options: [], selectedId: '', t });
  assert.equal(toOffer.question, 'Millise oma abisooviga soovid ühendust võtta?');
  assert.deepEqual(toOffer.options, []);
  assert.ok(toOffer.none.includes('abisoovi') && toOffer.none.includes('vestluses'));
  assert.ok(connectChoice({ listing: OWN, options: null, t }).none.includes('abipakkumist'));
  assert.equal(connectChoice({ listing: OWN, options: [{ id: 'x', title: 'Üks' }], selectedId: 'x', t }).columns, 1);
  /* Kui minu kuulutuste loend jäi laadimata, ei väideta, et neid ei ole. */
  const failed = connectChoice({ listing: OWN, options: [], failed: true, t });
  assert.ok(failed.none.includes('ei saanud laadida') && !failed.none.includes('on vaja'));
  assert.equal(connectChoice({ listing: OWN, options: [{ id: 'x', title: 'Üks' }], failed: true, t }).none, '', 'laaditud valikud on valikud');
  const chat = read(CHAT);
  assert.match(chat, /if \(optionsResponse\.ok && optionsPayload\?\.ok !== false\) \{\s+connectOptions = Array\.isArray\(optionsPayload\?\.items\) \? optionsPayload\.items : \[\];\s+\} else \{\s+connectOptionsFailed = true;\s+\}/);
  assert.ok(read(CONTEXT).includes('failed: connectOptionsFailed, t })'));
});

/* --- Muutmine ------------------------------------------------------------------ */

test('vormi väärtused: muudetud väärtus, selle puudumisel kuulutuse oma (vana komponendi järjekord)', () => {
  const started = { title: OWN.editableTitle, description: OWN.editableDescription, primaryCategoryCode: 'DAILY_TASKS', roleLabel: '', rawPlace: 'Annelinn', helpType: 'VOLUNTARY', timeType: 'ONE_TIME', availabilityOrStart: 'Neljapäeviti', compensationDetails: '', conditions: 'Kott ei tohi olla raske', targetGroupCodes: ['ELDER', 'DISABILITY'], targetGroups: 'Eakas' };
  const values = editValues(OWN, started);
  assert.equal(values.title, 'Vajan abi poes käimisel');
  assert.equal(values.description, OWN.editableDescription, 'vormis on kirjeldus nii, nagu see on salvestatud');
  assert.deepEqual(values.targetGroupCodes, ['ELDER'], 'alles jäävad sihtrühmad, mida vorm pakub');
  assert.equal(values.helpType, 'VOLUNTARY');
  /* Tühjaks kustutatud väli jääb tühjaks: kuulutuse vana väärtus tagasi ei tule. */
  assert.equal(editValues(OWN, { ...started, rawPlace: '', conditions: '' }).rawPlace, '');
  assert.equal(editValues(OWN, { ...started, conditions: '' }).conditions, '');
  /* Väli, mida muutmise olekus ei ole, loetakse kuulutuselt. */
  const sparse = editValues(OWN, { title: 'Uus' });
  assert.deepEqual([sparse.description, sparse.primaryCategoryCode, sparse.rawPlace, sparse.timeType], [OWN.editableDescription, 'DAILY_TASKS', 'Annelinn', 'ONE_TIME']);
  assert.deepEqual(sparse.targetGroupCodes, ['ELDER']);
  assert.deepEqual(editValues(null, null).targetGroupCodes, []);

  /* Salvestamisel antakse kasutajale sama kuju mis enne: muutmise olek ja puhastatud sihtrühmad. */
  assert.deepEqual(saveEditPayload(started, values), { ...started, targetGroupCodes: ['ELDER'] });
  assert.ok(read(CONTEXT).includes('onSaveEdit?.(saveEditPayload(editState, values));'));

  assert.deepEqual(toggleTargetGroup(['ELDER'], 'CHILD'), ['ELDER', 'CHILD']);
  assert.deepEqual(toggleTargetGroup(['ELDER', 'CHILD'], 'ELDER'), ['CHILD']);
  assert.deepEqual(toggleTargetGroup(null, 'ADULT'), ['ADULT']);
});

test('muudetud vorm on teada: võrdlus algseisuga, sihtrühmade järjekord ei loe', () => {
  const base = editValues(OWN, { title: 'A', description: 'B', targetGroupCodes: ['ELDER', 'CHILD'] });
  assert.equal(editSnapshot(base), editSnapshot({ ...base, targetGroupCodes: ['CHILD', 'ELDER'] }));
  for (const field of ['title', 'description', 'primaryCategoryCode', 'helpType', 'timeType', 'rawPlace', 'availabilityOrStart', 'compensationDetails', 'conditions']) {
    assert.notEqual(editSnapshot(base), editSnapshot({ ...base, [field]: `${base[field]}x` }), field);
  }
  assert.notEqual(editSnapshot(base), editSnapshot({ ...base, targetGroupCodes: ['ELDER'] }));
});

test('tühja kirjeldusega kuulutust ei saadeta; loendur ilmub, kui väli hakkab täis saama', () => {
  assert.equal(editProblem({ description: '  ' }), 'chat.help.opened.descriptionRequired');
  assert.equal(editProblem({ description: 'Tekst' }), '');
  assert.deepEqual(missingIn(editProblem({})), []);
  /* Sama nõue on serveris. */
  assert.ok(read('../lib/help/requests.js').includes('HELP_REQUEST_DESCRIPTION_REQUIRED') && read('../lib/help/offers.js').includes('HELP_OFFER_DESCRIPTION_REQUIRED'));

  assert.equal(EDIT_LIMITS, HELP_LISTING_TEXT_LIMITS, 'väljade piirid on serveri omad');
  assert.equal(counterText('lühike', 160, t), '');
  assert.equal(counterText('x'.repeat(128), 160, t), '128 / 160 tähemärki');
  assert.equal(counterText('x'.repeat(160), 160, tOf('en')), '160 / 160 characters');
  assert.equal(counterText('x', 0, t), '');
  const views = read(VIEWS);
  for (const field of ['title', 'description', 'rawPlace', 'availabilityOrStart', 'compensationDetails', 'conditions']) {
    assert.ok(views.includes(`EDIT_LIMITS.${field}`), `väljal ${field} on serveri piir`);
  }
});

test('valikud on lahtrid, mitte rippvalikud: abi liigi ja ajalisuse saab jätta määramata', () => {
  assert.deepEqual(helpTypeOptions(ui, t).map((option) => option.value), ['', ...HELP_TYPE_CODES]);
  assert.deepEqual(timeTypeOptions(ui, t).map((option) => option.value), ['', ...TIME_TYPE_CODES]);
  assert.equal(helpTypeOptions(ui, t)[0].label, 'Määramata', 'tühi valik on sõna, mitte kriips');
  assert.deepEqual(editPartOptions(t).map((option) => option.value), [...EDIT_PART_KEYS]);
  assert.equal(categoryOptions(t).length, 10);
  assert.deepEqual(targetGroupOptions(t).map((option) => option.label), ['Laps', 'Noor', 'Täiskasvanu', 'Eakas']);
  const views = read(VIEWS);
  assert.ok(!views.includes('DocumentsDropdown') && !views.includes('<select') && !read(CONTEXT).includes('DocumentsDropdown'));
  assert.ok(views.includes('options={categoryOptions(t)}') && views.includes('options={helpTypeOptions(ui, t)}') && views.includes('options={timeTypeOptions(ui, t)}') && views.includes('options={targetGroupOptions(t)}'));
  /* Vormi iga osa on vaates olemas ja osad on sakkidena kohe näha. */
  for (const part of EDIT_PART_KEYS) assert.ok(views.includes(`form.part === "${part}"`), part);
  assert.ok(views.includes('options={editPartOptions(t)} value={form.part} onChange={form.onPart}'));
  /* Ühe valikureaga osa ei korda oma nime: silt jääb ekraanilugejale. */
  assert.match(views, /label=\{ui\.category\}\s+labelHidden/);
  /* Üks salvestamine katab kõik osad ja vaade ütleb seda. */
  assert.ok(views.includes('t("chat.help.opened.saveAllNote")') && views.split('type="submit"').length - 1 === 1);
});

/* --- Vajutuste reeglid ---------------------------------------------------------- */

test('teise vajutuse piirid: topeltklõps ei ole kaks vajutust', () => {
  assert.equal(MIN_GAP_MS, 400);
  assert.equal(CONFIRM_MS, 8000);
  assert.equal(pressTooSoon(1000, 1399), true);
  assert.equal(pressTooSoon(1000, 1400), false);
  assert.equal(pressTooSoon(0, 5000), false, 'kui algust ei ole märgitud, vajutust kinni ei peeta');
});

test('kustutamine on kaks vajutust samal nupul ja tagajärg seisab nupu kõrval', () => {
  const context = read(CONTEXT);
  const views = read(VIEWS);
  const press = context.slice(context.indexOf('const pressDelete = () => {'), context.indexOf('const submitConnect'));
  /* Esimene vajutus ainult küsib; teine kustutab; topeltklõps ja käimasolev päring ei kustuta. */
  assert.match(press, /if \(busyAction\) return;\s+if \(!deleteArmed\) \{\s+deleteAskedAt\.current = Date\.now\(\);\s+onDeleteListing\?\.\(\);\s+return;\s+\}/);
  assert.match(press, /if \(pressTooSoon\(deleteAskedAt\.current\)\) return;\s+onConfirmDelete\?\.\(\);/);
  assert.equal(context.split('onConfirmDelete?.()').length - 1, 1, 'kustutab ainult teine vajutus');
  /* Küsimus aegub ja kaob, kui lugemise vaade ei ole ees. */
  assert.ok(context.includes('window.setTimeout(() => onCancelDelete?.(), CONFIRM_MS)') && context.includes('if (view !== "read") {\n      onCancelDelete?.();'));
  /* Sama nupp: sõnad vahetuvad, klahvikordus ei vajuta, tagajärg on nupu kirjeldus. */
  assert.ok(views.includes('{remove.armed ? t("chat.help.opened.deleteArmed") : ui.delete}'));
  assert.ok(views.includes('onKeyDown={ignoreKeyRepeat}\n                onClick={remove.onPress}') && views.includes('aria-describedby={noteId}'));
  assert.ok(views.includes('id={noteId}>\n              {t("chat.help.opened.deleteNote")}'));
  assert.ok(views.includes('event.repeat && (event.key === "Enter" || event.key === " ")'));
  /* Kustutada saab oma kuulutust; administraator ka võõrast. */
  assert.ok(context.includes('isOwn || canDelete\n              ? { armed: deleteArmed, busy: busyAction === "delete", onPress: pressDelete, onCancel: () => onCancelDelete?.() }'));
  /* Eraldi kinnitusakent ei ole kummaski failis ega lehel. */
  for (const source of [CONTEXT, VIEWS, CHAT]) assert.ok(!read(source).includes('ModalConfirm'), source);
});

test('leht annab kustutamise astme ja mõlemad tegevused vaatele ning hoiab oma olekut nagu enne', () => {
  const chat = read(CHAT);
  assert.ok(chat.includes('deleteArmed: selectedListingState.deleteConfirmOpen,'));
  assert.ok(chat.includes('onDeleteListing: requestDeleteOwnedListing,') && chat.includes('onConfirmDelete: deleteOwnedListing,') && chat.includes('onCancelDelete: cancelDeleteOwnedListing,'));
  /* Küsimine, tagasivõtmine ja kustutamise algus: samad olekumuutused mis kinnitusakna ajal. */
  assert.match(chat, /const requestDeleteOwnedListing = useCallback\(\(\) => \{\s+setSelectedListingState\(\(prev\) => prev\.listing \? \{\s+\.\.\.prev,\s+deleteConfirmOpen: true,\s+error: ""\s+\} : prev\);/);
  assert.match(chat, /const cancelDeleteOwnedListing = useCallback\(\(\) => \{\s+setSelectedListingState\(\(prev\) => \(\{\s+\.\.\.prev,\s+deleteConfirmOpen: false\s+\}\)\);/);
  assert.match(chat, /const deleteOwnedListing = useCallback\(async \(\) => \{\s+const listing = selectedListingState\.listing;\s+if \(!listing\) return;\s+setSelectedListingState\(\(prev\) => \(\{\s+\.\.\.prev,\s+deleteConfirmOpen: false,\s+busyAction: "delete",\s+error: ""\s+\}\)\);/);
  assert.ok(chat.includes('patchListingCollections(listing.kind, listing, "delete");'));
  /* Kõik vana komponendi omadused on alles (ja kolm uut kustutamise jaoks). */
  const context = read(CONTEXT);
  for (const prop of ['locale: _locale = "et"', 'inline = false', 'loading = false', 'error = ""', 'listing = null', 'isOwn = false', 'canDelete = false', 'editState = null', 'connectOptions = []', 'connectOptionsFailed = false', 'selectedConnectListingId = ""', 'busyAction = ""', 'deleteArmed = false', 'onSelectConnectListing', 'onConnect', 'onStartEdit', 'onChangeEditField', 'onCancelEdit', 'onSaveEdit', 'onDeleteListing', 'onConfirmDelete', 'onCancelDelete', 'onDismiss']) {
    assert.ok(context.includes(`  ${prop}`), `omadus on alles: ${prop}`);
  }
  for (const prop of ['loading', 'error', 'listing', 'isOwn', 'canDelete', 'connectOptions', 'connectOptionsFailed', 'selectedConnectListingId', 'busyAction']) {
    assert.ok(chat.includes(`    ${prop}: selectedListingState.${prop},`), `leht annab: ${prop}`);
  }
  assert.ok(chat.includes('editState: selectedListingState.edit,') && chat.includes('onDismiss: dismissSelectedListing,') && chat.includes('onConnect: connectSelectedListing'));
  /* Mõlemad kasutused: loendi sees ja modaalina väljaspool loendit. */
  assert.match(chat, /<SelectedListingContext\s+\{\.\.\.selectedListingContextProps\}\s+inline\s+\/>/);
  assert.match(chat, /!activeListingsPanel && selectedListingContextProps \? \(\s+<SelectedListingContext\s+\{\.\.\.selectedListingContextProps\}\s+\/>/);
});

test('saatmine ei tule topeltklõpsust ega käimasoleva päringu ajal; välju ei lukustata', () => {
  const context = read(CONTEXT);
  const views = read(VIEWS);
  /* Lugemise vaate nupp ja järgmise vaate saatmisnupp seisavad samas kohas. */
  assert.match(context, /const submitConnect = \(\) => \{[\s\S]*?if \(busyAction \|\| pressTooSoon\(shownAt\.current\)\) return;\s+onConnect\?\.\(\);/);
  assert.match(context, /const submitEdit = \(event\) => \{\s+event\?\.preventDefault\?\.\(\);\s+if \(busyAction \|\| pressTooSoon\(shownAt\.current\)\) return;/);
  assert.ok(context.includes('shownAt.current = Date.now();'), 'vaate ilmumise aeg märgitakse');
  /* Tühja kirjeldusega päringut ei tehta. */
  assert.match(context, /const problem = editProblem\(values\);\s+setProblemKey\(problem\);\s+if \(problem\) \{[\s\S]*?setEditPart\("text"\);\s+return;\s+\}\s+setDiscardArmed\(false\);\s+onSaveEdit\?\.\(/);
  /* Päringu ajal on sisu tuhmim; väljad ja nupud jäävad kasutatavaks (fookus ei kao). */
  assert.ok(!/disabled=\{[^}]*busy/.test(views) && !views.includes('disabled={form.'), 'päringu ajaks ei lukustata midagi');
  assert.equal(views.split('disabled=').length - 1, 1, 'keelatud on ainult saatmine ilma valikuta');
  assert.ok(views.includes('disabled={!choice.value}'));
  /* All hoitud Enter väljal vormi ei saada. */
  assert.ok(views.includes('onSubmit={form.onSubmit} onKeyDown={blockRepeatEnter}'));
});

test('salvestamata muudatused: loobumine ja lahkumine küsivad teist vajutust', () => {
  const context = read(CONTEXT);
  /* Kiirmenüü tagasinool, Esc ja akna sulgemine käivad ühise värava kaudu. */
  assert.ok(context.includes('const release = setPanelLeaveGuard(leave);') && context.includes('twoPressLeaveGuard({'));
  assert.ok(context.includes('if (!dirty) return undefined;') && context.includes('window.addEventListener("beforeunload", warn);'));
  assert.ok(context.includes('t("chat.help.opened.leaveAsked")'), 'põhjus seisab vaate kohal');
  assert.ok(context.indexOf('{leaveAsked ? (') < context.indexOf('{body}'), 'teade on vaadete kohal, mitte ühe vaate sees');
  /* Vormi enda „Loobu": muudetud vormil teine vajutus, muutmata vormil kohe. */
  assert.match(context, /const cancelEdit = \(\) => \{\s+if \(dirty && !discardArmed\) \{\s+discardAskedAt\.current = Date\.now\(\);\s+setDiscardArmed\(true\);\s+return;\s+\}\s+if \(dirty && pressTooSoon\(discardAskedAt\.current\)\) return;\s+setDiscardArmed\(false\);\s+onCancelEdit\?\.\(\);/);
  assert.ok(read(VIEWS).includes('{form.discardArmed ? t("chat.help.opened.discardArmed") : ui.cancel}'));
  /* Töölaua tagasinool ja loendi modaali sulgemine küsivad sama väravat. */
  const chat = read(CHAT);
  assert.match(chat, /const backToWorkspaceFromListingsPanel = useCallback\(\(\) => \{[\s\S]*?if \(!panelLeaveAllowed\("back"\)\) return;\s+closeListingsPanel\(\{/);
  assert.ok(read(PANEL).includes('if (!panelLeaveAllowed("close")) return;'));
  /* Ühendus pärast õnnestunud päringut sulgeb paneeli ilma väravata (see ei ole lahkumine). */
  assert.ok(chat.includes('closeListingsPanel({\n            skipAnimation: true,'));
});

test('vaate vahetusel läheb fookus pealkirjale, mitte nupule; teade kuulub oma vaate juurde', () => {
  const context = read(CONTEXT);
  assert.ok(context.includes('node.querySelector("[data-step-heading]")?.focus({ preventScroll: true });'));
  assert.ok(!/querySelector\([^)]*button/.test(context), 'nupule fookust ei viida');
  /* Kui avatud kuulutus sulgub (ka pärast kustutamist), läheb fookus loendi pealkirjale. */
  const panel = read(PANEL);
  assert.match(panel, /if \(hadDetail\.current === hasDetail\) return;\s+hadDetail\.current = hasDetail;\s+if \(hasDetail\) return;\s+bodyRef\.current\?\.querySelector\("\[data-step-heading\]"\)\?\.focus\(\{ preventScroll: true \}\);/);
  assert.ok(panel.includes('<div className={styles.page} ref={bodyRef}>') && panel.includes('const body = hasDetail ? detailNode : list;'));
  /* Kustutamise tõrge ei käi kaasa muutmise vormi. */
  assert.ok(context.includes('listingNotice(errorView === view || error === ui.connectPending ? error : "", ui)'));
});

/* --- Leht: päringud, tõrked ja hilinenud vastused -------------------------------- */

test('kuulutuse päringud on samad mis enne', () => {
  const chat = read(CHAT);
  /* Avamine ja minu vastaskuulutused. */
  assert.ok(chat.includes('const response = await fetch(`/api/help/listings/${encodeURIComponent(kind)}/${encodeURIComponent(id)}?locale=${encodeURIComponent(locale)}`, {\n        cache: "no-store"\n      });'));
  assert.ok(chat.includes('const oppositeKind = kind === "request" ? "offer" : "request";\n        const optionsResponse = await fetch(`/api/help/listings?kind=${encodeURIComponent(oppositeKind)}&scope=mine&status=OPEN&locale=${encodeURIComponent(locale)}&limit=20`, {\n          cache: "no-store"\n        });'));
  /* Salvestamine: sama aadress, meetod ja keha väljad samas järjekorras. */
  const save = chat.slice(chat.indexOf('const saveListingEdit = useCallback'), chat.indexOf('const requestDeleteOwnedListing'));
  assert.ok(save.includes('fetch(`/api/help/listings/${encodeURIComponent(listing.kind)}/${encodeURIComponent(listing.id)}?locale=${encodeURIComponent(locale)}`, {\n        method: "PATCH",\n        headers: {\n          "Content-Type": "application/json"\n        },\n        body: JSON.stringify({'));
  assert.deepEqual(
    [...save.matchAll(/^\s{10}(\w+): /gm)].map((match) => match[1]),
    ['title', 'description', 'primaryCategoryCode', 'roleLabel', 'rawPlace', 'helpType', 'timeType', 'availabilityOrStart', 'compensationDetails', 'conditions', 'targetGroupCodes', 'targetGroups']
  );
  assert.ok(save.includes('targetGroupCodes: Array.isArray(editPayload?.targetGroupCodes) ? editPayload.targetGroupCodes : undefined,\n          targetGroups: Array.isArray(editPayload?.targetGroups) ? editPayload.targetGroups : []'));
  /* Kustutamine ja ühendamine. */
  assert.ok(chat.includes('const response = await fetch(`/api/help/listings/${encodeURIComponent(listing.kind)}/${encodeURIComponent(listing.id)}`, {\n        method: "DELETE"\n      });'));
  assert.ok(chat.includes('const payload = listing.kind === "request"\n        ? { requestId: listing.id, offerId: selectedConnectListingId }\n        : { requestId: selectedConnectListingId, offerId: listing.id };\n      const response = await fetch("/api/help/matches", {\n        method: "POST",\n        headers: {\n          "Content-Type": "application/json"\n        },\n        body: JSON.stringify(payload)\n      });'));
});

test('inimesele näidatav tõrge on kataloogi lause, mitte brauseri vea tekst', () => {
  const chat = read(CHAT);
  const handlers = chat.slice(chat.indexOf('const openSelectedListing = useCallback'), chat.indexOf('const openGlobalRequestsPanel'));
  assert.ok(handlers.length > 3000);
  assert.ok(!handlers.includes('error?.message') && !handlers.includes('error.message') && !handlers.includes('catch (error)'));
  for (const sentence of ['error: helpUi.detailLoadFailed', 'error: helpUi.updateFailed', 'error: helpUi.deleteFailed', 'error: failureText', 'helpUi.connectPending']) {
    assert.ok(handlers.includes(sentence), sentence);
  }
  /* Server ütleb eraldi, kui kaks kuulutust kokku ei sobi: selle kohta on oma lause. */
  assert.ok(handlers.includes('if (body?.message === "HELP_MATCH_NOT_COMPATIBLE") failureText = helpUi.connectNotCompatible;'));
  assert.ok(read('../app/api/help/matches/route.js').includes('error?.code === "HELP_MATCH_NOT_COMPATIBLE" ? 409'));
  assert.deepEqual(missingIn('chat.help.connectNotCompatible'), []);
  /* Vaated ei kirjuta ekraanile ühtegi vea objekti. */
  for (const source of [CONTEXT, VIEWS]) assert.ok(!read(source).includes('.message'), source);
});

test('hilinenud vastus ei rakendu valele kuulutusele', () => {
  const chat = read(CHAT);
  /* Avamine: vastus kehtib ainult siis, kui sama avamine on veel pooleli. */
  assert.ok(chat.includes('const openingKey = `${kind}:${id}`;') && chat.includes('openingKey: ""'));
  assert.equal(chat.split('prev.openingKey !== openingKey ? prev : {').length - 1, 2, 'nii õnnestumine kui ka tõrge');
  /* Salvestamine, kustutamine ja ühendamine: tulemus kehtib selle kuulutuse kohta, mille jaoks päring tehti. */
  assert.equal(chat.split('isSelectedListing(prev, listing) ? {').length - 1, 5);
  assert.ok(chat.includes('return Boolean(state?.listing && listing && state.listing.id === listing.id && state.listing.kind === listing.kind);'));
});

/* --- Kuju ------------------------------------------------------------------------ */

test('avatud kuulutus ei kasuta vana ühist kihti ega status-rolli', () => {
  const context = read(CONTEXT);
  const views = read(VIEWS);
  for (const source of [context, views]) {
    assert.ok(!source.includes('role="status"'), 'status-rolli ühine kiht joonistab kastina');
    assert.ok(!source.includes('selected-listing') && !source.includes('documents-workspace') && !source.includes('feature-page'));
    assert.ok(!source.includes('ui/Panel"') && !source.includes('<textarea') && !source.includes('<fieldset'));
    assert.ok(!/className="[a-z]/.test(source), 'üldklasse ei ole: kujundus tuleb moodulist');
  }
  /* Vaate kuju tuleb klotsidest. */
  for (const block of ['stage/StepPanel', 'stage/ChoiceRow', 'stage/ChoiceChips', 'stage/TextAreaField']) assert.ok(views.includes(`@/components/${block}`), block);
  /* Paljast „|" seisu ja minu kuulutuse märgi vahel enam ei ole. */
  assert.ok(!views.includes('>|<') && !context.includes('>|<'));
  /* Modaalina: oma kiht ja kaart moodulist, kiirmenüü märk teistele lehtedele. */
  assert.ok(context.includes('className={styles.overlay}') && context.includes('contentClassName={styles.card}') && context.includes('document.body.classList.add("modal-open");'));
  /* Vana päise ankur ja üldfailide reeglid on kadunud. */
  assert.ok(!read('../components/ui/SubpageHeader.jsx').includes('selected-listing'));
  for (const file of ['feature-pages.css', 'workspace.css', 'chat.css', 'panel.css']) assert.ok(!read(`../app/styles/${file}`).includes('selected-listing'), file);
});

test('kujundus on mooduli klassidega: paljaste siltide reegleid, !important-it ega kindlaid värve ei ole', () => {
  const css = read(STYLE).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!css.includes('!important'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/\brgba?\(/.test(css), 'värvid tulevad platvormi muutujatest (hele ja tume teema)');
  for (const match of css.matchAll(/(^|\})\s*([^{}@]+)\{/g)) {
    for (const selector of match[2].split(',')) {
      assert.ok(!/(^|[\s>+~])(p|h[1-6]|ul|li|dl|dt|dd|section|div|span|label|input|button|form|a)(?![\w-])/.test(selector.trim()), `paljas silt valijas: ${selector.trim()}`);
    }
  }
  /* Ühte omadust ei kirjutata kaks korda (ehitus jätab alles ainult viimase). */
  for (const block of css.matchAll(/\{([^{}]*)\}/g)) {
    const names = block[1].split(';').map((line) => line.split(':')[0].trim()).filter(Boolean);
    assert.equal(new Set(names).size, names.length, `korduv omadus plokis ${block[1].trim().slice(0, 60)}`);
  }
  /* Ühised osad võetakse olemasolevatest moodulitest, mitte ei kirjutata uuesti. */
  assert.ok(css.includes('composes: fault from "../stage/rows.module.css";'));
  const views = read(VIEWS);
  for (const name of ['list.stack', 'list.chip', 'list.quiet', 'list.notice']) assert.ok(views.includes(name) || read(CONTEXT).includes(name), name);
  const listCss = read('../components/chat/helpListings.module.css');
  for (const name of ['.stack', '.chip', '.quiet', '.notice']) assert.ok(listCss.includes(`${name} {`) || listCss.includes(`${name},`), name);
  /* Iga klass, mida vaated moodulist küsivad, on moodulis olemas. */
  const used = new Set([...`${views}\n${read(CONTEXT)}`.matchAll(/\bstyles\.([A-Za-z]+)/g)].map((match) => match[1]));
  assert.ok(used.size >= 15);
  for (const name of used) assert.ok(new RegExp(`\\.${name}\\b`).test(css), `klass ${name} on moodulis`);
});
