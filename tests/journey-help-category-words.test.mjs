// TEEKOND — abi liigi tuletamine kirjeldusest: sõnapiir tunneb täpitähti.
//
// `\b` ja `\w` loevad JavaScriptis sõna osaks ainult ladina põhitähti. Märksõnad „õppimine",
// „õpe" ja „üksildus" ei alanud seetõttu kunagi sõnapiirilt ja neid liike ei tuletatud; „töövorm"
// seevastu luges sõna „vorm" omaette sõnaks. Leitud Teekonna lehtede ümberehitusel 10.10.2026.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('fail jõuab brauserisse: avaldises ei ole tahavaadet ega ASCII sõnapiiri', () => {
  const source = readFileSync(new URL('../lib/journey/helpMediationHandoff.js', import.meta.url), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  /* Vanem Safari ei loe tahavaatega avaldist üldse: Teekonna leht jääks avanemata. */
  assert.doesNotMatch(code, /\(\?<[!=]/);
  assert.doesNotMatch(code, /\\\\?b\(/, '`\\b` ei tunne täpitähti');
  assert.doesNotMatch(code, /\\\\?w/, '`\\w` ei tunne täpitähti');
});
