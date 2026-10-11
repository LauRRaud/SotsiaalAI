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
  editDirty,
  editProblem,
  editSnapshot,
  editStartState,
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
import { toHelpListingDetailView, toPublicHelpListingDetailView } from '../lib/help/listingViews.js';

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
  /* Omaniku vaade annab teksti ridadena: välja jäävad ainult lisaread ise, rea kaupa. See, mis
     inimene vormis lisaridade järele kirjutas, jääb näha ja lõigud jäävad lõikudeks. */
  const lined = { description: 'ei loe', editableDescription: 'Esimene lõik.\n\nTeine lõik.\nPõhikategooria: Digiabi\nOmavalitsus: Tartu linn\nLisatud hiljem.' };
  assert.equal(cleanDescription(lined), 'Esimene lõik.\n\nTeine lõik.\nLisatud hiljem.');
  assert.equal(cleanDescription({ editableDescription: 'Tekst.\n\nPõhikategooria: Digiabi\n\nAjalisus: Ühekordne' }), 'Tekst.');
  assert.equal(cleanDescription({ editableDescription: 'Esimene rida.\nMeie tingimused: ainult tööpäeviti\nTingimused: kokkuleppel' }), 'Esimene rida.\nMeie tingimused: ainult tööpäeviti', 'rea sees olev sõna ei ole lisarida');
  assert.equal(cleanDescription({ editableDescription: 'Põhikategooria: Digiabi\nOmavalitsus: Tartu linn' }), 'Põhikategooria: Digiabi\nOmavalitsus: Tartu linn', 'ainult lisaridadest tekst ei jää tühjaks');
  /* Vana kirje, kus lisaread on tekstiga samal real: lõige nagu enne. */
  assert.equal(cleanDescription({ editableDescription: 'Pakun sõitu. Tasu info: kütuse eest' }), 'Pakun sõitu.');
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
});

test('valikud on lahtrid, mitte rippvalikud: abi liigi ja ajalisuse saab jätta määramata', () => {
  assert.deepEqual(helpTypeOptions(ui, t).map((option) => option.value), ['', ...HELP_TYPE_CODES]);
  assert.deepEqual(timeTypeOptions(ui, t).map((option) => option.value), ['', ...TIME_TYPE_CODES]);
  assert.equal(helpTypeOptions(ui, t)[0].label, 'Määramata', 'tühi valik on sõna, mitte kriips');
  assert.deepEqual(editPartOptions(t).map((option) => option.value), [...EDIT_PART_KEYS]);
  assert.equal(categoryOptions(t).length, 10);
  assert.deepEqual(targetGroupOptions(t).map((option) => option.label), ['Laps', 'Noor', 'Täiskasvanu', 'Eakas']);
});

/* --- Vajutuste reeglid ---------------------------------------------------------- */

test('teise vajutuse piirid: topeltklõps ei ole kaks vajutust', () => {
  assert.equal(MIN_GAP_MS, 400);
  assert.equal(CONFIRM_MS, 8000);
  assert.equal(pressTooSoon(1000, 1399), true);
  assert.equal(pressTooSoon(1000, 1400), false);
  assert.equal(pressTooSoon(0, 5000), false, 'kui algust ei ole märgitud, vajutust kinni ei peeta');
});

/* --- Leht: päringud, tõrked ja hilinenud vastused -------------------------------- */

test('kokkusobimatute kuulutuste kohta on serveril oma vastus ja kataloogis oma lause', () => {
  /* Server ütleb eraldi, kui kaks kuulutust kokku ei sobi: selle kohta on oma lause. */
  assert.ok(read('../app/api/help/matches/route.js').includes('error?.code === "HELP_MATCH_NOT_COMPATIBLE" ? 409'));
  assert.deepEqual(missingIn('chat.help.connectNotCompatible'), []);
});

/* --- Kuju ------------------------------------------------------------------------ */

/* --- Salvestamine päriselt: muutmisaeg, algseis ja vastuolu ----------------------- */

test('omaniku vaade kannab muutmisaega ja vormi kirjeldus hoiab reavahetused', () => {
  const record = {
    id: 'r1',
    title: 'Vajan abi',
    description: 'Esimene   lõik.\r\n\r\n\r\n\r\nTeine lõik,\n  kahel real. ',
    status: 'OPEN',
    updatedAt: new Date('2026-10-10T05:00:00.123Z')
  };
  const view = toHelpListingDetailView(record, { kind: 'request', locale: 'et' });
  assert.equal(view.updatedAt, '2026-10-10T05:00:00.123Z', 'täpselt see aeg, mida server muutmisel võrdleb');
  assert.equal(view.editableDescription, 'Esimene lõik.\n\nTeine lõik,\nkahel real.');
  assert.equal(view.description, 'Esimene lõik. Teine lõik, kahel real.', 'lugemise vaate tekst on nagu enne');
  assert.equal(toHelpListingDetailView({ id: 'r2' }, { kind: 'offer' }).updatedAt, null);
  assert.equal(toHelpListingDetailView({ id: 'r3', updatedAt: 'ei ole aeg' }, { kind: 'offer' }).updatedAt, null);
  /* Server keeldub ilma muutmisajata ja võrdleb seda salvestatuga: leping, mille järgi leht käib. */
  for (const file of ['../lib/help/requests.js', '../lib/help/offers.js']) {
    const source = read(file);
    assert.ok(/_EXPECTED_UPDATED_AT_REQUIRED/.test(source) && source.includes('where: { id, updatedAt: expectedUpdatedAt }'), file);
  }
  /* Võõrale antav vaade muutmisaega ei kanna. */
  const publicView = toPublicHelpListingDetailView({ ...record, status: 'OPEN' }, { kind: 'request', locale: 'et' });
  assert.equal(publicView.id, 'r1');
  assert.ok(!('updatedAt' in publicView) && !('editableDescription' in publicView));
});

test('vormi algseis tuleb kuulutusest ja „muudetud" otsustatakse selle järgi', () => {
  const listing = {
    id: 'r1',
    kind: 'request',
    title: 'Abisoov: Digiabi',
    editableTitle: 'Vajan abi telefoniga',
    description: 'Üks rida.',
    editableDescription: 'Üks\nrida.',
    primaryCategoryCode: 'DIGITAL_HELP',
    helpType: 'VOLUNTARY',
    timeType: 'ONE_TIME',
    rawPlace: 'Annelinn',
    availabilityOrStart: 'Õhtuti',
    conditions: '',
    targetGroupCodes: ['ELDER', 'DISABILITY'],
    targetGroupLabels: ['Eakad']
  };
  const start = editStartState(listing);
  assert.equal(start.title, 'Vajan abi telefoniga');
  assert.equal(start.description, 'Üks\nrida.', 'vorm saab reavahetustega teksti');
  assert.deepEqual(start.targetGroupCodes, ['ELDER', 'DISABILITY']);
  assert.equal(start.targetGroups, 'Eakad');
  /* Äsja avatud vorm ei ole muudetud; iga välja muutus on. */
  assert.equal(editDirty(listing, start), false);
  assert.equal(editDirty(listing, null), false, 'vormi ei ole');
  assert.equal(editDirty(null, start), false, 'kuulutust ei ole');
  for (const field of ['title', 'description', 'rawPlace', 'availabilityOrStart', 'compensationDetails', 'conditions']) {
    assert.equal(editDirty(listing, { ...start, [field]: `${start[field]}x` }), true, field);
  }
  assert.equal(editDirty(listing, { ...start, primaryCategoryCode: 'TRANSPORT' }), true);
  assert.equal(editDirty(listing, { ...start, helpType: '' }), true);
  assert.equal(editDirty(listing, { ...start, targetGroupCodes: ['ELDER', 'CHILD'] }), true);
  /* Muudetud ja tagasi muudetud vorm ei ole muudetud. */
  assert.equal(editDirty(listing, { ...start, title: 'Vajan abi telefoniga' }), false);
  /* Sama olek uuesti (töölaud suleti ja avati: komponent sündis uuesti) on ikka muudetud. */
  const edited = { ...start, description: 'Uus tekst' };
  assert.equal(editDirty(listing, edited), true);
  assert.equal(editDirty({ ...listing }, { ...edited }), true);
});

test('salvestamise vastus: vastuolu kohta on oma lause ja rida jääb minu kuulutuste alla', () => {
  assert.deepEqual(missingIn('chat.help.updateConflict'), []);
  assert.equal(ui.updateConflict, at(catalogs.et, 'chat.help.updateConflict'));
  /* Server vastab vastuolule koodiga 409. */
  assert.ok(read('../app/api/help/listings/[kind]/[id]/route.js').includes('if (code.endsWith("_CONFLICT")) {\n    return {\n      status: 409,'));
});

test('muutmise vormi sakkide nimed on lühikesed kõigis keeltes', () => {
  /* Sakkide nimed on lühikesed, et neli mahuks ühte ritta ka inglise ja vene keeles. */
  for (const lang of LANGS) {
    for (const key of EDIT_PART_KEYS) assert.ok(at(catalogs[lang], `chat.help.opened.editParts.${key}`).length <= 14, `${lang} ${key}`);
  }
});

test('abikuulutuse liigi sõna on platvormi oma ja vene keeles ei ole ladina tähtedes sõnu', () => {
  const views = read('../lib/help/listingViews.js');
  assert.ok(views.includes('et: "Abisoov",') && !views.includes('et: "Abipalve"'), 'abipalve on kiireloomuline abipalve, mitte abikuulutus');
  assert.ok(views.includes('return "Все возрастные группы";') && !views.includes('Vse vozrastnye'));
});
