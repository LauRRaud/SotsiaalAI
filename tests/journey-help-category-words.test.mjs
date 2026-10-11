// TEEKOND — abi liigi tuletamine kirjeldusest: sõnapiir tunneb täpitähti.
//
// `\b` ja `\w` loevad JavaScriptis sõna osaks ainult ladina põhitähti. Märksõnad „õppimine",
// „õpe" ja „üksildus" ei alanud seetõttu kunagi sõnapiirilt ja neid liike ei tuletatud; „töövorm"
// seevastu luges sõna „vorm" omaette sõnaks. Leitud Teekonna lehtede ümberehitusel 10.10.2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hasAssistiveDeviceSignal } from '../lib/journey/assistiveDevices.js';
import { buildHelpMediationHandoff, inferHelpCategoryCode } from '../lib/journey/helpMediationHandoff.js';

const code = (summary, domains = []) => inferHelpCategoryCode({ summary, domains });

test('õ- ja ü-tähega algav märksõna tuntakse ära, ka suurtähtedega ja keset lauset', () => {
  for (const text of ['õppimine', 'Õppimine', 'ÕPPIMINE', 'õpe', 'Õpe', 'Vajan abi: õppimine on raske.', 'kool (õpe) ja kodu', 'Esimene rida\nõpe on pooleli']) {
    assert.equal(code(text), 'LEARNING_GUIDANCE', text);
  }
  for (const text of ['üksildus', 'Üksildus', 'ÜKSILDUS', 'Ema mure on üksildus.', 'mure: üksildus, väsimus']) {
    assert.equal(code(text), 'SOCIAL_SUPPORT', text);
  }
  /* Märksõna võib tulla ka valdkonna sildilt, mitte ainult kirjeldusest. */
  assert.equal(code('', ['õpe']), 'LEARNING_GUIDANCE');
  assert.equal(code('Midagi muud', ['üksildus']), 'SOCIAL_SUPPORT');
});

test('täpitähed sõna sees: ä, ö, õ ja ü sobivad endiselt, suur- ja väiketähega', () => {
  const cases = [
    ['poes käimine', 'DAILY_TASKS'],
    ['Poes Käimine', 'DAILY_TASKS'],
    ['IGAPÄEVASED TOIMINGUD', 'DAILY_TASKS'],
    ['kõrvalabi', 'CARE_SUPPORT'],
    ['KÕRVALABI', 'CARE_SUPPORT'],
    ['teenusele jõudmine', 'TRANSPORT'],
    ['Sõit arsti juurde', 'TRANSPORT'],
    ['taotluse täitmine', 'ADMIN_FORM_HELP'],
    ['Taotluse Täitmine', 'ADMIN_FORM_HELP']
  ];
  for (const [text, expected] of cases) assert.equal(code(text), expected, text);
  /* Ilma täppideta kirjutatud kuju jääb samuti alles. */
  for (const [text, expected] of [['oppimine', 'LEARNING_GUIDANCE'], ['uksildus', 'SOCIAL_SUPPORT'], ['korvalabi', 'CARE_SUPPORT'], ['poes kaimine', 'DAILY_TASKS']]) {
    assert.equal(code(text), expected, text);
  }
});

test('märksõna teise sõna sees ei loe, ka siis, kui naabriks on täpitäht', () => {
  /* „töövorm": enne luges `\b` tähe „ö" sõnapiiriks ja sõna „vorm" sobis. */
  for (const text of ['töövorm', 'Töövorm', 'platvorm', 'öölaps', 'üliõpe', 'õppevormid', 'sõitma', 'eelõpe']) {
    assert.equal(code(text), '', text);
  }
  /* Sidekriips, koma, sulg ja reavahetus on sõnapiirid; number ja alakriips ei ole. */
  assert.equal(code('töö-vorm'), 'ADMIN_FORM_HELP');
  assert.equal(code('vorm,avaldus'), 'ADMIN_FORM_HELP');
  assert.equal(code('vorm2'), '');
  assert.equal(code('õpe_1'), '');
});

test('varasemad tulemused ja reeglite järjekord on samad', () => {
  const cases = [
    ['transport arsti juurde', 'TRANSPORT'],
    ['transportimine', 'TRANSPORT'],
    ['poes käimine', 'DAILY_TASKS'],
    ['koduabi', 'HOME_HELP'],
    ['digiabi', 'DIGITAL_HELP'],
    ['e-teenus', 'DIGITAL_HELP'],
    ['hooldus', 'CARE_SUPPORT'],
    ['laps', 'CHILD_YOUTH_SUPPORT'],
    /* „juhendamine" on kahes reeglis; esimene sobiv reegel võidab nagu enne. */
    ['juhendamine', 'CHILD_YOUTH_SUPPORT'],
    ['suhtlemine', 'SOCIAL_SUPPORT'],
    ['avaldus', 'ADMIN_FORM_HELP'],
    ['transport ja laps', 'TRANSPORT'],
    ['midagi muud', ''],
    ['', '']
  ];
  for (const [text, expected] of cases) assert.equal(code(text), expected, text);
  assert.equal(inferHelpCategoryCode(), '');
  assert.equal(inferHelpCategoryCode({ summary: null, domains: null }), '');
});

test('üleandmine: ü- ja õ-sõnaga kirjeldus annab praktilise vajaduse ja otsingusõna', () => {
  const social = buildHelpMediationHandoff({ id: 'j-1', summary: 'Üksildus pärast kolimist' });
  assert.equal(social.hasPracticalNeed, true);
  assert.equal(social.categoryCode, 'SOCIAL_SUPPORT');
  assert.match(social.viewOffersHref, /[?&]q=[^&]+/);
  const learning = buildHelpMediationHandoff({ id: 'j-2', summary: 'Õppimine on raske' });
  assert.deepEqual([learning.hasPracticalNeed, learning.categoryCode], [true, 'LEARNING_GUIDANCE']);
  assert.equal(buildHelpMediationHandoff({ id: 'j-3', summary: 'Töövorm on muutunud' }).hasPracticalNeed, false);
});

test('platvormi enda soovitus „Vaata Abivahenduse võimalusi" ei ole abivahendi vajadus', () => {
  /* Leitud 11.10.2026 ülevaatusel: iga Teekond, millel oli praktilise abi soovitus, sai abi otsimise
     osas ka valiku „Abivahendid" ja eelpöördumisse rea „abivahendid ja kohandused". */
  const learning = {
    summary: 'Poja õppimine on raske ja ta jääb koolis maha. Tahan teada, kust saada abi.',
    domains: ['lapse heaolu'],
    suggestedActions: [{ title: 'Täpsusta ja kinnita teekonna kokkuvõte' }, { title: 'Vaata sobivaid kontakte teenusekaardilt' }, { title: 'Vaata Abivahenduse võimalusi' }]
  };
  assert.equal(hasAssistiveDeviceSignal(learning), false);
  for (const text of ['Abivahendus', 'abivahenduse võimalused', 'Leidsin abi Abivahendusest.', 'ABIVAHENDUST ei ole vaja', 'vaatan abivahendusse']) {
    assert.equal(hasAssistiveDeviceSignal({ summary: text }), false, text);
  }
  /* Päris abivahendi sõnavormid loevad endiselt. */
  for (const text of ['abivahend', 'Ema vajab abivahendit.', 'abivahendi taotlus', 'Abivahendid on katki', 'küsin abivahendeid', 'abivahendiga saab hakkama', 'ABIVAHEND']) {
    assert.equal(hasAssistiveDeviceSignal({ summary: text }), true, text);
  }
  /* „duss" (dušš ilma täppideta) sobis iga sõnaga, mis lõpeb „-dusse". */
  for (const text of ['Ema läks hooldusse.', 'Võtsin vallaga ühendusse', 'Poeg läks haridusse tööle', 'kogudusse']) {
    assert.equal(hasAssistiveDeviceSignal({ summary: text }), false, text);
  }
  for (const text of ['dušš on kõrge äärega', 'Duss on katki', 'ei saa dussi alla', 'vajab dušitooli', '(dušš)']) {
    assert.equal(hasAssistiveDeviceSignal({ summary: text }), true, text);
  }
  /* Kui Teekonnas on mõlemad, loeb abivahend. */
  assert.equal(hasAssistiveDeviceSignal({ summary: 'Vaatasin Abivahendust, aga vajan hoopis abivahendit.' }), true);
  /* Soovituste loend, mille mustand ise koostab, ei tekita abivahendi märki üheski harus peale abivahendi oma. */
  const draft = readFileSync(new URL('../lib/journey/draft.js', import.meta.url), 'utf8');
  const titles = [...draft.matchAll(/type: "([A-Z_]+)",\s*title: "([^"]+)"/g)].map((match) => ({ type: match[1], title: match[2] }));
  assert.ok(titles.length >= 7, 'soovituste pealkirjad leiti');
  for (const { type, title } of titles) {
    assert.equal(hasAssistiveDeviceSignal({ suggestedActions: [{ title }] }), type === 'ASSISTIVE_DEVICES', `${type}: ${title}`);
  }
});
