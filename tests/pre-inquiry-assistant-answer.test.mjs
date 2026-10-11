// Pöörduja eelpöördumise leht: abilise vastus sammus „Täpsusta abilisega".
//
// Vastus oli üks tekst vestlusmullis inimese kirjelduse all: lühikese kirjeldusega oli vaade
// 806 px (paneelis mahub 445) ja töölaua paneelis hakkas pärast vastust kerima iga samm.
// Vastus on nüüd osadena (components/workspace/preInquiry/assistantAnswer.js); siin on osadeks
// jagamise käitumine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ASSISTANT_MESSAGE_LIMIT, assistantAnswer, assistantHasNotes, assistantMessagePlace } from '../components/workspace/preInquiry/assistantAnswer.js';

const LANGS = ['et', 'en', 'ru'];
const catalog = (lang) => JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')).workspace_feature_pages.pre_inquiries;
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);

/* Serveri vastuse kuju (lib/preInquiries.js, `assistPreInquiry`). */
const reply = {
  message: 'Kaardistasin kirjelduse eelpöördumise jaoks ja pakkusin sobivat adressaati: teenuseosutajat. Kontrolli adressaati ja mustandit enne salvestamist või jagamist.',
  reasoning: 'Võimalik suund on KOV.',
  lifeDomains: ['füüsiline tervis', 'igapäevaelu toimingud'],
  targetGroups: ['eakas inimene', 'füüsiline tervis'],
  questions: ['Kas inimene liigub kodus iseseisvalt?', 'Kes teda praegu aitab?'],
  warnings: [
    'Eelpöördumine ei asenda ametlikku abivajaduse väljaselgitamist ega otsustamist.',
    'Kui olukord on vahetult ohtlik või vajab kiiret abi, helista 112 või pöördu kriisiabi poole.'
  ]
};

test('abilise vastus jaguneb osadeks: sõnum, üks küsimus, kiire abi, märksõnad, märkused', () => {
  const answer = assistantAnswer(reply);
  assert.equal(answer.answered, true);
  assert.equal(answer.message, reply.message);
  /* Korraga on ees üks küsimus: see, millele inimene järgmisena vastab. */
  assert.equal(answer.question, 'Kas inimene liigub kodus iseseisvalt?');
  /* Kiire abi hoiatus on eraldi ja jääb vaates alati ette. */
  assert.deepEqual(answer.urgent, [reply.warnings[1]]);
  assert.deepEqual(answer.notes, [reply.warnings[0]]);
  /* Märksõnad ilma kordusteta, valdkonnad enne sihtrühmi. */
  assert.deepEqual(answer.tags, ['füüsiline tervis', 'igapäevaelu toimingud', 'eakas inimene']);
  assert.equal(assistantHasNotes(answer), true);
});

test('kiire abi hoiatuse tunnused', () => {
  const urgent = (warning) => assistantAnswer({ warnings: [warning] }).urgent.length === 1;
  /* Hoiatused, mida server annab (lib/preInquiriesAssessment.js). */
  for (const warning of [
    'Lapse või alaealise ohutuse korral suuna inimene Lasteabi 116 111, vahetu ohu korral 112 või KOV lastekaitse poole. AI ei tee lõplikku riskihinnangut.',
    'Vägivalla või kuriteo korral saab nõu ohvriabi kriisitelefonilt 116 006.',
    'Kui olukord on vahetult ohtlik või vajab kiiret abi, helista 112 või pöördu kriisiabi poole.'
  ]) {
    assert.equal(urgent(warning), true, warning);
  }
  assert.equal(urgent('Eelpöördumine ei asenda ametlikku abivajaduse väljaselgitamist ega otsustamist.'), false);
  /* Sama hoiatus kaks korda on üks rida. */
  assert.equal(assistantAnswer({ warnings: ['Helista 112.', ' Helista  112. '] }).urgent.length, 1);
});

test('vastamata abiline ja poolik vastus', () => {
  const empty = assistantAnswer();
  assert.deepEqual(empty, { answered: false, message: '', question: '', urgent: [], tags: [], notes: [] });
  assert.equal(assistantHasNotes(empty), false);
  assert.equal(assistantAnswer({ message: '  ', questions: ['', null], warnings: null, lifeDomains: 'x' }).answered, false);
  /* Sõnumita vastuses on ees põhjendus. */
  assert.equal(assistantAnswer({ reasoning: ' Võimalik  suund on KOV. ' }).message, 'Võimalik suund on KOV.');
  /* Ainult küsimus või ainult hoiatus on samuti vastus. */
  assert.equal(assistantAnswer({ questions: ['Kes aitab?'] }).answered, true);
  assert.equal(assistantAnswer({ warnings: ['Helista 112.'] }).answered, true);
});

test('avatav plokk on ainult siis, kui seal on midagi', () => {
  const short = assistantAnswer({ message: 'Lühike vastus.', questions: ['Kes aitab?'] });
  assert.equal(assistantHasNotes(short), false);
  assert.equal(assistantHasNotes(assistantAnswer({ message: 'Lühike vastus.', lifeDomains: ['tervis'] })), true);
  assert.equal(assistantHasNotes(assistantAnswer({ message: 'Lühike vastus.', warnings: ['Märkus.'] })), true);
  /* Pikk sõnum: vaates on algus, terve tekst plokis. */
  assert.equal(assistantHasNotes(assistantAnswer({ message: 'a'.repeat(ASSISTANT_MESSAGE_LIMIT + 1) })), true);
  assert.equal(assistantHasNotes(assistantAnswer({ message: 'a'.repeat(ASSISTANT_MESSAGE_LIMIT) })), false);
  /* Ainult kiire abi hoiatus plokki ei vaja (see on ees); koos sõnumiga on sõnum plokis. */
  assert.equal(assistantHasNotes(assistantAnswer({ warnings: ['Helista 112.'] })), false);
  assert.equal(assistantHasNotes(assistantAnswer({ message: 'Lühike.', warnings: ['Helista 112.'] })), true);
  assert.ok(ASSISTANT_MESSAGE_LIMIT >= 120 && ASSISTANT_MESSAGE_LIMIT <= 220, 'sõnumi algus on mõõdetud nii, et vaade mahub paneeli');
});

test('kui palju sõnumist on ees: terve, algus või mitte midagi', () => {
  const place = (input) => assistantMessagePlace(assistantAnswer(input));
  assert.deepEqual(place({ message: 'Lühike vastus.' }), { inline: 'full', folded: false });
  assert.deepEqual(place({ message: 'a'.repeat(ASSISTANT_MESSAGE_LIMIT + 1) }), { inline: 'start', folded: true });
  /* Kiire abi hoiatuse korral on ees hoiatus ja küsimus; üldine sõnum on avatavas plokis. */
  assert.deepEqual(place({ message: 'Lühike vastus.', warnings: ['Kui olukord on vahetult ohtlik, helista 112.'] }), { inline: 'none', folded: true });
  /* Muu märkus sõnumit eest ära ei võta. */
  assert.deepEqual(place({ message: 'Lühike vastus.', warnings: ['Eelpöördumine ei asenda ametlikku hindamist.'] }), { inline: 'full', folded: false });
  assert.deepEqual(place({}), { inline: 'none', folded: false });
  assert.deepEqual(assistantMessagePlace(null), { inline: 'none', folded: false });
});

test('abilise vaate tekstid on kataloogis kolmes keeles', () => {
  const keys = ['views.assistant.title', 'views.assistant.lead', 'views.assistant.notes', 'views.assistant.tags', 'actions.assisting'];
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string' || !at(messages, key).trim()), [], lang);
  }
});
