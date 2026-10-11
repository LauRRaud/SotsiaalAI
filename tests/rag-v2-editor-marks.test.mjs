import test from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_VERSION, validateAnswer, withoutEditorMarks } from '../lib/rag-v2/pilot/contracts.js';
import { SOURCE_CLAIMS_ANSWER_VERSION, renderAnswer } from '../lib/rag-v2/pilot/presentation.js';
import { completedView } from '../lib/rag-v2/pilot/service.js';
import { municipalPacket } from './fixtures/rag-v2-municipal-packet.mjs';

// ADR-118 (09.10.2026): two stored answers carried an editor's note of the answering model in the text the reader
// saw: "[citations omitted]" five times in one, "[Remove?]" in another. Nothing checked for them. Such a note is taken
// out of the answer; the answer itself is kept, and no other bracket is touched.

test('an editor\'s note is taken out with the space before it; a line that held only the note goes', () => {
  for (const [text, cleaned] of [
    ['Toetus on 320 eurot [citations omitted].', 'Toetus on 320 eurot.'],
    ['Toetus [citations omitted] on 320 eurot.', 'Toetus on 320 eurot.'],
    ['[Remove?] Taotlus tuleb esitada vallale.', 'Taotlus tuleb esitada vallale.'],
    ['  [Remove?]   Taotlus tuleb esitada vallale.', 'Taotlus tuleb esitada vallale.'],
    ['Esimene lõik.\n[citations omitted]\nTeine lõik.', 'Esimene lõik.\nTeine lõik.'],
    ['Esimene lõik.\r\n[citations omitted]\r\nTeine lõik.', 'Esimene lõik.\r\nTeine lõik.'],
    ['Väide. [Citations Omitted] [ references removed ] [footnote omitted]', 'Väide.'],
    ['Väide [internal citations omitted].', 'Väide.'],
    ['Üks [delete?] kaks [keep ?] kolm [Omit?] neli [cut?] viis [drop?]', 'Üks kaks kolm neli viis'],
    ['[citations omitted]', ''],
  ]) assert.equal(withoutEditorMarks(text), cleaned, text);
  // Cleaning a cleaned text changes nothing: a stored answer reads the same every time.
  assert.equal(withoutEditorMarks(withoutEditorMarks('Toetus [citations omitted] on 320 eurot.')), 'Toetus on 320 eurot.');
});

test('no other bracket and no other wording is touched', () => {
  for (const text of [
    'Seadus [RT I, 28.06.2024, 5 - jõust. 01.01.2025] ütleb nii.',
    'Kirjuta [nimi] ja [kuupäev] taotlusele.', 'Vaata joonealust märkust [1] ja [2].', 'Tekst [...] jätkub.', 'Nii on kirjas [sic].',
    'Aadress on allikas kirjas kui [e-post eemaldatud].', 'Vaata [lisa 2] ja [tabel 3].',
    'Citations omitted from the original.', 'Viited on välja jäetud (citations omitted).', '[citations omitted in the original text]', '[please remove this]', '[Remove]', '[remove this?]',
    '[viited välja jäetud]', 'Kas eemaldada? [Eemaldada?]', 'Ilma nurksulgudeta lause.', '',
  ]) assert.equal(withoutEditorMarks(text), text, text);
  // Not a string: as it came (the answer check names such a value itself).
  for (const value of [null, undefined, 7]) assert.equal(withoutEditorMarks(value), value);
});

const block = (text, refs = ['S1']) => ({ text, factual: true, refs });
const answer = more => ({ kind: 'grounded', blocks: [block('Toetus on 320 eurot.')], limitations: [], clarification: null, ...more });

test('an answer of the current version is published without the notes: blocks, limitations and the clarifying question', () => {
  const draft = answer({ kind: 'partial', blocks: [block('Toetus on 320 eurot [citations omitted].'), block('[Remove?] Taotlus esitatakse vallale. [citations omitted] S2', ['S2'])],
    limitations: ['Tulevast määra ma öelda ei saa [citations omitted].'], clarification: 'Kas elad Tallinnas? [Remove?]' });
  const before = JSON.stringify(draft), valid = validateAnswer(draft, ['S1', 'S2']);
  assert.deepEqual(valid.blocks.map(one => one.text), ['Toetus on 320 eurot.', 'Taotlus esitatakse vallale.']);
  assert.deepEqual([valid.limitations, valid.clarification], [['Tulevast määra ma öelda ei saa.'], 'Kas elad Tallinnas?']);
  // The draft the model returned is not changed: the turn keeps it as it came.
  assert.equal(JSON.stringify(draft), before);
  // A published answer read again gives itself: the stored answer and its replay agree.
  assert.deepEqual(validateAnswer(valid, ['S1', 'S2']), valid);
  assert.equal(renderAnswer(valid, ANSWER_VERSION).includes('omitted'), false);
  // An answer without a note is the same object content as before the rule.
  const plain = answer({ limitations: ['Piirang.'], clarification: 'Küsimus?' });
  assert.deepEqual(validateAnswer(plain, ['S1']), plain);
});

test('a text that is nothing but a note is no text: the answer is refused, and an older version\'s answer reads as it was published', () => {
  const refused = value => assert.throws(() => validateAnswer(value, ['S1']), error => error.code === 'invalid_answer' && error.status === 422);
  refused(answer({ blocks: [block('[citations omitted]')] }));
  refused(answer({ kind: 'partial', limitations: [' [Remove?] '] }));
  refused(answer({ kind: 'clarification', blocks: [], clarification: '[citations omitted]' }));
  // The earlier answer version: nothing is taken out of an answer published under it.
  const old = answer({ blocks: [block('Toetus on 320 eurot [citations omitted].')], limitations: ['Piirang [Remove?].'] });
  assert.deepEqual(validateAnswer(old, ['S1'], SOURCE_CLAIMS_ANSWER_VERSION), old);
});

test('an answer stored with a note before the rule is shown without it', () => {
  const packet = municipalPacket({ records: 2, passages: 2 });
  const stored = { kind: 'grounded', blocks: [block('Rulaatorit saab laenutada [citations omitted].'), block('Teine väide.', ['S2'])], limitations: [], clarification: null };
  const row = { id: 'turn-1', state: 'completed', configHash: 'plan', createdAt: new Date('2026-10-07T10:00:00Z'), expiresAt: null,
    payload: { question: 'Kust saab rulaatorit laenutada?', contextMode: 'new', query: { language: 'et', tokens: 6 }, events: [], answer: stored, answerVersion: ANSWER_VERSION, messageId: 'message-1', packet,
      context: { version: 'd', scopeId: 'scope-1', personId: 'person-1', scopeTurnId: 'turn-1', revision: 1, correctionRevision: 0, mode: 'new' }, contextAudit: { userTurns: [{ text: 'Kust saab rulaatorit laenutada?' }] } } };
  const view = completedView(row, 'real');
  assert.deepEqual(view.answer.blocks.map(one => one.text), ['Rulaatorit saab laenutada.', 'Teine väide.']);
  assert.equal(view.sources.find(source => source.ref === 'S1').used, true);
});
