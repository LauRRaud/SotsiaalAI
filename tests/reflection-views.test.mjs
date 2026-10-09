// Meetodipeegel: vaadete tekstid on kataloogis, vormi kuju ja arvutused peavad
// ning leht hoiab oma lubadusi.
//
// Leht oli klaaspaneeli sees veel üks tume kaart ja vorm üks pikk veerg; nüüd on
// see vaadetena sammulaval (components/reflection/ReflectionViews.jsx). Test
// hoiab seda, mida silm kergesti ei märka: puuduv tõlkevõti, nimeta vaade, väli,
// mis jäi vaadetest välja, ühe vajutusega kustutamine, ekraanile trükitud kood.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CHOICE_FIELDS,
  FORM_VIEWS,
  TEXT_FIELDS,
  choiceLabel,
  clip,
  conflictRows,
  emptyForm,
  formFromReflection,
  isChoiceField,
  reflectionBody,
  reflectionErrorText,
  reflectionRows,
  reflectionViewKeys,
  sameForm,
  textRows,
  viewFields,
  viewState,
  viewSummary
} from '../components/reflection/reflectionForm.js';
import {
  INTERIM_OUTCOMES,
  REFLECTION_FIELD_PROVENANCE,
  REFLECTION_SOURCE_KINDS,
  REFLECTION_TEXT_FIELDS,
  SUPPORT_NEEDS
} from '../lib/reflection/constants.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const PAGE = '../components/reflection/ReflectionPage.jsx';
const VIEWS = '../components/reflection/ReflectionViews.jsx';
const FORM = '../components/reflection/reflectionForm.js';
const ALL_VIEW_KEYS = reflectionViewKeys({ open: true, conflict: true });
/* Tõlkija nagu lehel: olemasolev võti annab teksti, puuduv võti tuleb tagasi võtmena. */
const t = (key) => `[${key}]`;
const real = (lang) => {
  const messages = catalog(lang);
  return (key, vars) => {
    const text = at(messages, key);
    if (typeof text !== 'string') return key;
    return vars ? text.replace(/\{(\w+)\}/g, (mark, name) => (name in vars ? String(vars[name]) : mark)) : text;
  };
};

test('tekstivõtmed, mida leht ja vaated sõnasõnalt loevad, on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of [PAGE, VIEWS, FORM]) {
    /* Ainult täielikud võtmed: mallisõnega kokku pandud võtmed kontrollib järgmine test. */
    for (const match of read(source).matchAll(/\bt\(\s*"(reflection\.[A-Za-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size >= 30, `võtmeid leiti ${keys.size}`);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
  }
});

test('igal vaatel on nimi ja lühinimi kiirmenüü jaoks; vormi vaatel ka juhis', () => {
  assert.deepEqual(ALL_VIEW_KEYS, ['list', 'method', 'action', 'reason', 'observation', 'interpretation', 'conclusion', 'outcome', 'conflict', 'entry']);
  for (const lang of LANGS) {
    const views = catalog(lang).reflection.views;
    for (const key of ALL_VIEW_KEYS) {
      assert.ok(views[key]?.title && views[key]?.short, `${lang}: ${key}`);
      assert.ok(views[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    }
    for (const key of ['list', 'conflict', ...FORM_VIEWS.map((view) => view.key)]) {
      assert.equal(typeof views[key].lead, 'string', `${lang}: ${key} juhis`);
    }
    assert.ok(views.source_chip.includes('{kind}'), `${lang}: seotud tegevuse märgis kannab kohatäitjat`);
  }
});

test('võtmed, mida leht kokku paneb (väljad, valikud, päritolu, allika liik), on olemas', () => {
  for (const lang of LANGS) {
    const messages = catalog(lang);
    for (const field of FORM_VIEWS.flatMap(viewFields)) assert.equal(typeof at(messages, `reflection.field.${field}`), 'string', `${lang}: ${field}`);
    for (const value of SUPPORT_NEEDS) assert.equal(typeof at(messages, `reflection.support_need.${value}`), 'string', `${lang}: ${value}`);
    for (const value of INTERIM_OUTCOMES) assert.equal(typeof at(messages, `reflection.interim_outcome.${value}`), 'string', `${lang}: ${value}`);
    for (const value of REFLECTION_SOURCE_KINDS) assert.equal(typeof at(messages, `reflection.source_kind.${value}`), 'string', `${lang}: ${value}`);
    for (const value of new Set(Object.values(REFLECTION_FIELD_PROVENANCE))) {
      assert.equal(typeof at(messages, `casework.provenance.${value}`), 'string', `${lang}: ${value}`);
    }
  }
});

test('eestikeelsetes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const walk = (node, out = []) => {
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') walk(value, out);
      else out.push(String(value));
    }
    return out;
  };
  for (const text of walk(catalog('et').reflection)) {
    assert.ok(!/[—–"]/.test(text), text);
  }
});

test('vorm: iga väli on täpselt ühes vaates ja vaade on väike', () => {
  const fields = FORM_VIEWS.flatMap(viewFields);
  assert.equal(new Set(fields).size, fields.length, 'ükski väli ei kordu');
  /* Samad kaksteist tekstivälja ja kaks valikut, mis olid vanal pikal vormil. */
  assert.deepEqual([...TEXT_FIELDS].sort(), [
    'action', 'approach', 'choiceReason', 'clientGoal', 'clientReaction', 'interpretation',
    'method', 'nextStep', 'supportTechnique', 'whatDidNot', 'whatWorked', 'workerObservation'
  ]);
  assert.deepEqual(Object.keys(CHOICE_FIELDS).sort(), ['interimOutcome', 'supportNeed']);
  /* Server võtab vastu ainult oma loendis olevaid tekstivälju. */
  for (const field of TEXT_FIELDS) assert.ok(REFLECTION_TEXT_FIELDS.includes(field), field);
  /* Päritolumärgisega väljad on kõik vormil alles. */
  for (const field of Object.keys(REFLECTION_FIELD_PROVENANCE)) assert.ok(TEXT_FIELDS.includes(field), field);
  for (const view of FORM_VIEWS) {
    assert.ok(viewFields(view).length >= 1 && viewFields(view).length <= 3, `${view.key}: kuni kolm välja`);
    assert.ok(view.layout.length <= 2, `${view.key}: kuni kaks rida, et vaade mahuks paneeli`);
    for (const row of view.layout) {
      assert.ok(row.length <= 2, `${view.key}: kõrvuti kuni kaks välja`);
      if (row.length === 2) assert.ok(row.every((field) => !isChoiceField(field)), `${view.key}: kõrvuti on ainult tekstiväljad`);
    }
    /* Tekstikastide ridu kokku nii palju, et vaade ei kasva paneelist välja. */
    const lines = view.layout.reduce((sum, row) => sum + Math.max(...row.map((field) => (isChoiceField(field) ? 0 : textRows(field)))), 0);
    assert.ok(lines <= 6, `${view.key}: ${lines} tekstirida`);
  }
});

test('lava vaated: loend on alati esimene, võrdlus ainult erinevuse korral', () => {
  assert.deepEqual(reflectionViewKeys(), ['list']);
  assert.deepEqual(reflectionViewKeys({ open: false, conflict: true }), ['list']);
  const open = reflectionViewKeys({ open: true });
  assert.equal(open[0], 'list');
  assert.equal(open.at(-1), 'entry');
  assert.ok(!open.includes('conflict'));
  assert.deepEqual(reflectionViewKeys({ open: true, conflict: true }).slice(-2), ['conflict', 'entry']);
});

test('vormi sisu: tühi vorm, kirjest laadimine ja serverile saadetav keha', () => {
  const empty = emptyForm();
  assert.equal(Object.keys(empty).length, 14);
  assert.ok(Object.values(empty).every((value) => value === ''));
  const form = formFromReflection({ method: 'Motiveeriv intervjueerimine', supportNeed: 'COVISION', interimOutcome: null, id: 'r1', updatedAt: 'x' });
  assert.equal(form.method, 'Motiveeriv intervjueerimine');
  assert.equal(form.supportNeed, 'COVISION');
  assert.equal(form.interimOutcome, '');
  assert.ok(!('id' in form) && !('updatedAt' in form), 'vormi ei tule välju, mida vorm ei muuda');
  const body = reflectionBody(form);
  assert.equal(body.method, 'Motiveeriv intervjueerimine');
  assert.equal(body.approach, null, 'tühi väli läheb serverile null-ina');
  assert.equal(body.interimOutcome, null);
  assert.equal(Object.keys(body).length, 14);
  assert.ok(!('sourceKind' in body) && !('expectedUpdatedAt' in body), 'allika ja versiooni lisab leht ise');
});

test('salvestamata muudatused: tühikud välja servas ei loe, sisu loeb', () => {
  const base = formFromReflection({ method: 'A', nextStep: 'B' });
  assert.ok(sameForm(base, { ...base, method: ' A  ' }));
  assert.ok(sameForm(emptyForm(), {}));
  assert.ok(!sameForm(base, { ...base, method: 'A!' }));
  assert.ok(!sameForm(base, { ...base, supportNeed: 'ETHICS' }));
});

test('vaate täituvus ja kokkuvõte', () => {
  const [method, , , , , conclusion, outcome] = FORM_VIEWS;
  assert.equal(viewState(method, emptyForm()), 'empty');
  assert.equal(viewState(method, { ...emptyForm(), approach: '   ' }), 'empty');
  assert.equal(viewState(method, { ...emptyForm(), approach: 'x' }), 'partial');
  assert.equal(viewState(method, { ...emptyForm(), approach: 'x', method: 'y' }), 'done');
  assert.equal(viewSummary(method, emptyForm(), t), '');
  assert.equal(viewSummary(method, { ...emptyForm(), method: 'Lahenduskeskne' }, t), 'Lahenduskeskne');
  /* Valiku kokkuvõte on kataloogi nimi, mitte sisemine kood. */
  assert.equal(viewSummary(conclusion, { ...emptyForm(), supportNeed: 'ETHICS' }, t), '[reflection.support_need.ETHICS]');
  assert.equal(viewSummary(outcome, { ...emptyForm(), interimOutcome: 'NEEDS_TIME' }, t), '[reflection.interim_outcome.NEEDS_TIME]');
  assert.equal(viewSummary(outcome, { ...emptyForm(), interimOutcome: 'SOMETHING_NEW' }, t), '', 'tundmatut koodi ei trükita');
});

test('pika teksti lõikamine: sõna piirilt, reavahetused üheks reaks', () => {
  assert.equal(clip('  lühike\ntekst  '), 'lühike tekst');
  assert.equal(clip(null), '');
  const long = clip('sõna '.repeat(40), 30);
  assert.ok(long.length <= 31 && long.endsWith('…'), long);
  assert.ok(!long.includes('  '));
  assert.equal(clip('x'.repeat(50), 10), `${'x'.repeat(10)}…`);
});

test('valiku nimi tuleb kataloogist; tundmatu väärtus jääb sildita', () => {
  assert.equal(choiceLabel('supportNeed', 'NONE', t), '[reflection.support_need.NONE]');
  assert.equal(choiceLabel('interimOutcome', 'CONTINUE', t), '[reflection.interim_outcome.CONTINUE]');
  assert.equal(choiceLabel('interimOutcome', 'COVISION', t), '', 'teise välja väärtus ei saa siin silti');
  assert.equal(choiceLabel('supportNeed', '', t), '');
  assert.equal(choiceLabel('method', 'CONTINUE', t), '');
  /* Päris kataloogis ei ole ükski nimi sama mis kood. */
  for (const lang of LANGS) {
    for (const value of INTERIM_OUTCOMES) assert.notEqual(choiceLabel('interimOutcome', value, real(lang)), value, `${lang}: ${value}`);
    for (const value of SUPPORT_NEEDS) assert.notEqual(choiceLabel('supportNeed', value, real(lang)), value, `${lang}: ${value}`);
  }
});

test('kahe versiooni võrdlus näitab ainult erinevaid välju', () => {
  const mine = { ...emptyForm(), method: 'Minu meetod', nextStep: 'Helistan ', supportNeed: 'COVISION' };
  const server = { id: 'r1', updatedAt: '2026-10-09T10:00:00Z', method: 'Serveri meetod', nextStep: 'Helistan', supportNeed: null, whatWorked: 'Rahulik algus' };
  const rows = conflictRows(mine, server);
  assert.deepEqual(rows.map((row) => row.field), ['method', 'whatWorked', 'supportNeed']);
  assert.deepEqual(rows[0], { field: 'method', choice: false, mine: 'Minu meetod', theirs: 'Serveri meetod' });
  assert.deepEqual(rows[1], { field: 'whatWorked', choice: false, mine: '', theirs: 'Rahulik algus' });
  assert.deepEqual(rows[2], { field: 'supportNeed', choice: true, mine: 'COVISION', theirs: '' });
  assert.deepEqual(conflictRows(mine, { ...mine }), []);
  assert.deepEqual(conflictRows(emptyForm(), null), []);
});

test('loendi read: pealkiri, aeg ja tulem märgina; koodi ega kirje sisu ei trükita', () => {
  const formatDate = (value) => `@${value}`;
  const items = [
    { id: 'a', method: 'Motiveeriv intervjueerimine', approach: 'Lahenduskeskne', interimOutcome: 'CONTINUE', createdAt: '2026-10-09T09:00:00Z' },
    { id: 'b', method: null, approach: 'Lahenduskeskne', interimOutcome: null, createdAt: '2026-10-08T09:00:00Z' },
    { id: 'c', method: null, approach: null, interimOutcome: 'OLD_VALUE', createdAt: null },
    { id: 'd', method: 'm'.repeat(300), approach: null, interimOutcome: null, createdAt: null }
  ];
  const rows = reflectionRows(items, { t, formatDate, openId: 'b', busyId: 'c' });
  assert.deepEqual(rows[0], { id: 'a', title: 'Motiveeriv intervjueerimine', date: '@2026-10-09T09:00:00Z', outcome: '[reflection.interim_outcome.CONTINUE]', selected: false, busy: false });
  assert.equal(rows[1].title, 'Lahenduskeskne');
  assert.equal(rows[1].outcome, '');
  assert.equal(rows[1].selected, true);
  assert.equal(rows[2].title, '[reflection.list.untitled]');
  assert.equal(rows[2].outcome, '', 'tundmatu tulem jääb märgita');
  assert.equal(rows[2].date, '');
  assert.equal(rows[2].busy, true);
  assert.ok(rows[3].title.length <= 81, 'pikk pealkiri lõigatakse, rida jääb madal');
  assert.deepEqual(reflectionRows(null, { t, formatDate }), []);
  assert.ok(reflectionRows(items, { t, formatDate }).every((row) => !row.selected && !row.busy));
});

test('veateade: serveri võti enne üldist „kirjet ei leitud”', () => {
  const et = real('et');
  assert.equal(reflectionErrorText({ status: 401, payload: { message: 'api.common.unauthorized' } }, et), 'Palun logi sisse.');
  assert.equal(reflectionErrorText({ status: 404, payload: { message: 'reflection.errors.record_missing' } }, et), 'Kirjet ei leitud.');
  /* Loomisel tähendab 404 ka seda, et seotud tegevust ei leitud. */
  assert.equal(reflectionErrorText({ status: 404, payload: { message: 'reflection.errors.source_missing' } }, et), 'Seotud tegevust ei leitud.');
  assert.equal(reflectionErrorText({ status: 404, payload: {} }, et), 'Kirjet ei leitud.');
  assert.equal(reflectionErrorText({ status: 409, payload: { message: 'reflection.errors.stale_update' } }, et), 'Kirjet muudeti samal ajal. Võrdle mõlemat versiooni.');
  assert.equal(reflectionErrorText({ status: 402, payload: { message: 'api.common.subscription_required' } }, et), 'Vajalik on aktiivne tellimus.');
  /* Tundmatu võti ei jõua ekraanile: asemel on üldine laadimise viga. */
  assert.equal(reflectionErrorText({ status: 500, payload: { message: 'reflection.errors.brand_new' } }, et), 'Laadimine ebaõnnestus.');
  assert.equal(reflectionErrorText({ status: 500, payload: {} }, et), 'Laadimine ebaõnnestus.');
});

test('leht hoiab lubadusi: kahe vajutusega kustutamine, sisenemine tegevuse juurest, ei pesastatud kaarti', () => {
  const page = read(PAGE);
  const views = read(VIEWS);
  /* Kustutamine ja salvestamata tekstist loobumine küsivad teist vajutust. */
  assert.ok(page.includes('armConfirm("delete")') && page.includes('confirming === "delete"'), 'kustutamine kahe vajutusega');
  assert.ok(page.includes('armConfirm("use-server")'), 'serveri versiooni võtmine kahe vajutusega');
  for (const key of ['guardDiscard("close", closeForm)', 'guardDiscard("new", openNew)', 'guardDiscard(`open:${row.id}`']) {
    assert.ok(page.includes(key), `salvestamata tekst ei kao ühe vajutusega: ${key}`);
  }
  assert.ok(!page.includes('ModalConfirm') && !views.includes('ModalConfirm'), 'kinnitusaken on asendatud teise vajutusega');
  /* Kustutamine on avatud kirje juures; loendi real on üks tegevus (avamine). */
  assert.equal([...views.matchAll(/className=\{styles\.row\}/g)].length, 1);
  assert.ok(!views.includes('onDelete'), 'loendi real ei ole kustutamist');
  /* Kõik päringud on alles ja ainult lehel; vaated ei päri midagi. */
  for (const call of ['`/api/reflections${query}`', '`/api/reflections/${id}`', '"/api/reflections"', '`/api/reflections/${editingId}`', '`/api/reflections/${undoDeletion.id}/undo`']) {
    assert.ok(page.includes(call), call);
  }
  for (const method of ['"PATCH"', '"POST"', '"DELETE"']) assert.ok(page.includes(`method: ${method}`), method);
  assert.ok(page.includes('"Idempotency-Key"') && page.includes('expectedUpdatedAt'), 'loomise kordumatu võti ja muutmise versioon käivad kaasa');
  assert.ok(!/\bfetch\(/.test(views), 'vaated ei tee päringuid');
  /* Sisenemine tegevuse juurest: päringust loetud allikas läheb loomisel kaasa. */
  assert.ok(page.includes('searchParams?.get("sourceKind")') && page.includes('searchParams?.get("sourceId")'));
  assert.ok(page.includes('isReflectionSourceKind(kind) && id'));
  assert.ok(page.includes('sourceRef ? { ...body, ...sourceRef } : body'));
  const link = read('../components/workspace/WorkspaceFeaturePage.jsx');
  assert.ok(link.includes('/refleksioon?sourceKind=PRE_INQUIRY&sourceId='), 'ettevalmistuse paneel viib endiselt siia');
  /* Teated ei kasuta status-rolli (ühine kiht joonistab selle omal moel) ja
     leht ei mähi end enam oma kaarti ega korda pealkirja. */
  for (const source of [page, views]) {
    assert.ok(!source.includes('role="status"'));
    assert.ok(!source.includes('SubpageHeader') && !source.includes('Dropdown') && !source.includes('<textarea'));
  }
  assert.ok(page.includes('<h1 className="sr-only">'), 'lehe pealkiri jääb ekraanilugejale');
  assert.ok(!fs.existsSync(new URL('../components/reflection/ReflectionPage.module.css', import.meta.url)), 'vana kaardi kujundusfail on eemaldatud');
  const css = read('../components/reflection/reflection.module.css');
  assert.ok(!/backdrop-filter|--glass-bg-strong|--panel-radius/.test(css), 'lehel ei ole oma klaaskaarti paneeli sees');
  assert.ok(!/(^|[\s,>+~])(section|div|label|textarea|p|ul|li|h[1-6])\s*[{,]/m.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'kujundus käib klassinimede, mitte paljaste siltide järgi');
  /* Iga klass, mida leht ja vaated kasutavad, on kujundusfailis olemas, ja vastupidi. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"/g, '');
  const defined = new Set([...rules.matchAll(/\.([A-Za-z][A-Za-z0-9]*)(?=[\s{:,.[])/g)].map((match) => match[1]));
  /* `html.theme-light` on platvormi teemaklass, mitte selle faili oma. */
  defined.delete('theme');
  const used = new Set([...`${page}\n${views}`.matchAll(/styles\.([A-Za-z][A-Za-z0-9]*)/g)].map((match) => match[1]));
  assert.deepEqual([...used].filter((name) => !defined.has(name)), [], 'kasutatud klass puudub kujundusfailist');
  assert.deepEqual([...defined].filter((name) => !used.has(name)), [], 'kujundusfailis on kasutamata klass');
  /* Privaatsusmärgis on igas vaates: loendis üleval, avatud kirje vaadetes all. */
  assert.ok(views.includes('data-privacy="private"'));
  for (const name of ['FormView', 'ConflictView', 'EntryView']) {
    assert.ok(new RegExp(`<${name}\\b[\\s\\S]*?note=\\{(foot|conflictFoot)\\}`).test(page), `${name} kannab märki paneeli alaservas`);
  }
  assert.ok(/const foot = <FootNote privacy=/.test(page) && /const conflictFoot = <FootNote privacy=/.test(page));
  assert.ok(/export function FootNote[\s\S]*?<PrivacyChip/.test(views));
  assert.ok(/export function ListView[\s\S]*?<PrivacyChip/.test(views));
  /* Ühe vaatega lehel (ainult loend) lava ei ole: kiirmenüüs ei seisa „1/1” ega avane ühe plaadiga ülevaade. */
  assert.ok(page.includes('viewKeys.length > 1 ? ('), 'lava on ainult avatud kirje juures');
  /* Lava uuesti ehitamisel kaob nupp, millel fookus oli: fookus läheb ette tulnud vaate pealkirjale. */
  assert.ok(page.includes('[data-step-heading]') && page.includes('focusInside.current'), 'fookus ei kao lava vahetumisel');
});
