import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';
import { rememberPilotIntent, forgetPilotIntent, readPilotIntentContext } from '../lib/chat/m4PilotIntent.js';
test('normal chat adapter publishes only completed answers and binds every link to a turn', () => {
  assert.equal(pilotChatResult({ state: 'unknown' }, 'conv').ok, false);
  assert.equal(pilotChatResult({ state: 'needs_recovery' }, 'conv').answer, undefined);
  const turn = { id: 'turn-123', state: 'completed', mode: 'test', answer: { kind: 'partial', blocks: [{ text: 'Piiratud vastus', refs: ['S1'] }], limitations: ['Puuduv tingimus'], clarification: null },
    sources: [{ ref: 'S1', title: '<script>not HTML</script>', pages: [3], used: true }] };
  const first = pilotChatResult(turn, 'conv-123');
  const second = pilotChatResult({ ...turn, id: 'turn-456' }, 'conv-123');
  assert.match(first.answer, /Piiratud vastus \[S1\]/);
  assert.match(first.answer, /Puuduv tingimus/);
  assert.match(first.sources[0].url, /^\/chat-source\?convId=conv-123&turnId=turn-123&ref=S1$/);
  assert.notEqual(first.sources[0].key, second.sources[0].key);
  assert.equal(first.pilotKind, 'partial');
});
test('pilot intent survives refresh without storing question text and clears only its own completed key', async () => {
  const map = new Map(); const storage = { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
  const input = { convId: 'conversation', text: 'private question', language: 'et', key: 'first-key' };
  assert.equal(await rememberPilotIntent(storage, input), 'first-key');
  assert.equal(await rememberPilotIntent(storage, { ...input, key: 'second-key' }), 'first-key');
  assert.ok(![...map.values()][0].includes(input.text));
  forgetPilotIntent(storage, input.convId, 'other-key'); assert.equal(map.size, 1);
  forgetPilotIntent(storage, input.convId, 'first-key'); assert.equal(map.size, 0);
});

test('M4-C intent binds mode, scope and answer point; refresh restores only content-free selection', async () => {
  const map = new Map(), storage = { getItem: k => map.get(k) || null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  const input = { convId: 'conversation', text: 'PRIVATE CIRCUMSTANCE', language: 'et', key: 'key-a', contextMode: 'correction', contextTurnId: 'scope-a', replyToTurnId: 'turn-a', replyToBlock: 2 };
  assert.equal(await rememberPilotIntent(storage, input), 'key-a');
  assert.equal(await rememberPilotIntent(storage, { ...input, key: 'key-b' }), 'key-a');
  assert.deepEqual(readPilotIntentContext(storage, input.convId), { contextMode: 'correction', contextTurnId: 'scope-a', replyToTurnId: 'turn-a', replyToBlock: 2 });
  for (const change of [{ contextMode: 'same' }, { contextTurnId: 'scope-b' }, { replyToTurnId: 'turn-b' }, { replyToBlock: 1 }]) {
    await rememberPilotIntent(storage, input);
    assert.equal(await rememberPilotIntent(storage, { ...input, ...change, key: 'changed-key' }), 'changed-key');
  }
  assert.ok(![...map.values()].some(value => value.includes(input.text)));
});


test('F11/F12: legacy suffix compatibility is narrow, versioned, and leaves original artifacts intact', async () => {
  const { renderAnswer, ANSWER_VERSION } = await import('../lib/rag-v2/pilot/presentation.js');
  const answer = text => ({ kind: 'grounded', blocks: [{ text, refs: ['S1', 'S3'] }], limitations: [], clarification: null });
  for (const text of ['Use cite as a word. [S1][S3]', 'Use cite as a word. citeS1S3']) {
    const raw = answer(text), before = JSON.stringify(raw);
    assert.equal(renderAnswer(raw), 'Use cite as a word. [S1, S3]');
    assert.equal(JSON.stringify(raw), before);
    assert.equal(renderAnswer(raw, ANSWER_VERSION), text + ' [S1, S3]');
  }
  for (const text of ['Unknown [S99]', 'Mixed [S99][S1]', 'Ambiguous citeS1UNKNOWN', 'The term [S1] occurs mid-sentence.', 'cite [ordinary] <script>alert(1)</script>']) {
    assert.equal(renderAnswer(answer(text)), text + ' [S1, S3]');
  }
  assert.throws(() => renderAnswer(answer('Text'), 'unrecognized-version'), { code: 'unsupported_answer_version' });
});

test('F05: mixed historical/completed/failed/unknown turns retain chronological questions and safe status keys', async () => {
  const { pilotChatMessages } = await import('../lib/chat/m4PilotClientContract.js');
  const complete = { id: 'a', state: 'completed', question: 'First', answer: { kind: 'grounded', blocks: [{ text: 'Supported [S1]', refs: ['S1'] }], limitations: [], clarification: null }, sources: [] };
  const turns = [complete, { id: 'b', state: 'answer_rejected', question: 'Second', failureKind: 'references', responseAudit: { draft: 'SECRET INVALID' } },
    { ...complete, id: 'c', question: 'Third' }, { id: 'd', state: 'unknown', question: 'Fourth' }];
  const messages = pilotChatMessages(turns, 'conversation');
  assert.deepEqual(messages.filter(m => m.role === 'user').map(m => m.text), ['First', 'Second', 'Third', 'Fourth']);
  assert.equal(messages[3].messageKey, 'm4Pilot.referenceFailed'); assert.equal(messages[3].completionStatus, 'FAILED');
  assert.equal(messages[7].messageKey, 'm4Pilot.unknown');
  assert.ok(!JSON.stringify(messages).includes('SECRET INVALID'));
});

test('crisis sentences reach the crisis notice on the pilot chat path, including failed turns and history', async () => {
  const { detectCrisis } = await import('../lib/chat/safety.js');
  const { pilotChatMessages } = await import('../lib/chat/m4PilotClientContract.js');
  for (const text of ['Mul on enesetapumõtted', 'Tahan end tappa', 'mõtlen enesetapule', 'tahan oma elu lõpetada', 'Olen üksi kodus, ei jaksa enam elada, tööd ei ole', 'lõikun ennast', 'suitsiidimõtted', 'tahan lõpetada oma elu.', 'lõikasin end eile'])
    assert.equal(detectCrisis(text), true, text);
  for (const text of ['Olen üksi kodus, raske on toimetulek, tööd ei ole', 'Kuidas taotleda toimetulekutoetust Tapa vallas?', 'Mu vend tahab aega tappa', 'Pean töölepingu lõpetama', 'Tahan lõpetada õpingud',
    // R4: a compound word is not a crisis (the urgent-help form would otherwise jump to the emergency screen).
    'Soovin lõpetada oma elukindlustuse', 'Soovin lõpetada oma eluasemelaenu lepingu', 'Tahan tööelu lõpetada', 'lõikasin endale leiba'])
    assert.equal(detectCrisis(text), false, text);
  const answer = { kind: 'grounded', blocks: [{ text: 'Vastus [S1]', refs: ['S1'] }], limitations: [], clarification: null };
  assert.equal(pilotChatResult({ id: 't1', state: 'completed', question: 'Tahan end tappa', answer, sources: [] }, 'conv').isCrisis, true);
  assert.equal(pilotChatResult({ id: 't2', state: 'completed', question: 'Kus on sotsiaaltöötaja?', answer, sources: [] }, 'conv').isCrisis, false);
  assert.equal(pilotChatResult({ state: 'answer_rejected', question: 'ei jaksa enam elada' }, 'conv').isCrisis, true);
  const messages = pilotChatMessages([{ id: 't3', state: 'stopped', question: 'Mul on enesetapumõtted' }], 'conv');
  assert.equal(messages.at(-1).isCrisis, true);
});

test('source panel label carries the checkable origin: authors, journal, issue, year and printed pages', async () => {
  const { citationLine } = await import('../lib/chat/m4PilotClientContract.js');
  assert.equal(citationLine({ authors: ['Laur Raudsoo'], journal: 'Sotsiaaltöö', issue: '2/2025', year: '2025', pageRange: '3–6' }), 'Laur Raudsoo · Sotsiaaltöö 2/2025, lk 3–6');
  assert.equal(citationLine({ journal: 'Sotsiaaltöö', issue: '1', year: '2016' }), 'Sotsiaaltöö 1 2016');
  assert.equal(citationLine({ authors: ['A', 'B', 'C', 'D'] }), 'A; B; C jt');
  assert.equal(citationLine({}), '');
  const answer = { kind: 'grounded', blocks: [{ text: 'Vastus [S1]', refs: ['S1'] }], limitations: [], clarification: null };
  const result = pilotChatResult({ id: 't', state: 'completed', question: 'Q', answer, sources: [
    { ref: 'S1', title: 'Tehisintellekt sotsiaaltöös', authors: ['Laur Raudsoo'], journal: 'Sotsiaaltöö', issue: '2/2025', pageRange: '3–6', pages: [9], used: true },
    { ref: 'S2', title: 'Koduteenus', pages: [], used: false }] }, 'conv');
  assert.equal(result.sources[0].label, 'S1 · Tehisintellekt sotsiaaltöös · Laur Raudsoo · Sotsiaaltöö 2/2025, lk 3–6 · Vastuses kasutatud');
  assert.equal(result.sources[0].journalTitle, 'Sotsiaaltöö');
  // Only cited sources reach the reader's list; an uncited catalogue record stays in the audit.
  assert.deepEqual(result.sources.map(source => source.label.split(' · ')[0]), ['S1']);
  assert.deepEqual(result.displayed_sources, result.sources);
  // A municipality's record shows when it was collected or checked, so the answer need not repeat it.
  const record = pilotChatResult({ id: 't', state: 'completed', question: 'Q', answer, sources: [
    { ref: 'S1', title: 'Sotsiaaltransporditeenus', checked: '2026-04-30', pages: [], used: true }] }, 'conv');
  assert.equal(record.sources[0].label, 'S1 · Sotsiaaltransporditeenus · kontrollitud 30.04.2026 · Vastuses kasutatud');
  const unknown = pilotChatResult({ id: 't', state: 'completed', question: 'Q', answer, sources: [
    { ref: 'S1', title: 'Koduteenus', checked: 'eile', pages: [], used: true }] }, 'conv');
  assert.equal(unknown.sources[0].label, 'S1 · Koduteenus · Vastuses kasutatud');
});

test('an answer gives the links of the forms it relies on, read from the turn record context, never from the model text', async () => {
  const { answerForms, ANSWER_FORMS_LIMIT } = await import('../lib/rag-v2/pilot/presentation.js');
  const { pilotChatMessages } = await import('../lib/chat/m4PilotClientContract.js');
  const field = (value, ref) => ({ value, refs: [ref] });
  const form = (key, ref, title, url, format) => ({ key, record_id: `kose_vald_form_${key}`, kind: 'form', region: 'kose_vald', detail: 'catalogue',
    fields: { title: field(title, ref), official_url: field(url, ref), ...(format ? { format: field(format, ref) } : {}) } });
  const packet = { record_context: { entries: [
    { key: 'R1', record_id: 'kose_vald_benefit_matusetoetus', kind: 'benefit', region: 'kose_vald', detail: 'relevant_detail', fields: { title: field('Matusetoetus', 'S1') } },
    form('R2', 'S2', 'Matusetoetuse avalduse vorm2026', 'https://www.kosevald.ee/sites/default/files/Matusetoetuse%20avalduse%20vorm2026.docx', 'docx'),
    form('R3', 'S3', 'Kose valla SPOKU e-taotluste keskkond', 'https://kose.spoku.ee/', 'web_form'),
    { key: 'R4', record_id: 'kose_vald_service_koduteenus', kind: 'service', region: 'kose_vald', detail: 'catalogue', fields: { title: field('Koduteenus', 'S4') } },
    form('R5', 'S5', 'Koduteenuse taotlus', 'https://www.kosevald.ee/koduteenus.pdf', 'PDF'),
    form('R6', 'S6', 'Vana vorm', 'http://www.kosevald.ee/vana.doc', 'doc'),
  ], relations: [
    { from: 'R1', relation: 'form', to: 'R3', state: 'source_declared', refs: ['S1'] },
    { from: 'R1', relation: 'form', to: 'R2', state: 'source_declared', refs: ['S1'] },
    { from: 'R1', relation: 'form', to: null, state: 'unavailable', refs: [] },
    { from: 'R4', relation: 'form', to: 'R5', state: 'source_declared', refs: ['S4'] },
  ] } };
  const answer = { blocks: [{ text: 'Esita avaldus: https://example.org/vorm [S1, S2]', refs: ['S1', 'S2'] }, { text: 'Koduteenus [S4, S6]', refs: ['S4', 'S6'] }] };
  // The cited form first, then the form the cited benefit (shown in full) declares; each address once. A catalogue
  // record's form, a plain http address and the address in the answer text give no link.
  assert.deepEqual(answerForms(packet, answer), [
    { title: 'Matusetoetuse avalduse vorm2026', url: 'https://www.kosevald.ee/sites/default/files/Matusetoetuse%20avalduse%20vorm2026.docx', format: 'docx' },
    { title: 'Kose valla SPOKU e-taotluste keskkond', url: 'https://kose.spoku.ee/' }]);
  // The same service shown in full declares its form; its "PDF" is a file format.
  packet.record_context.entries[3].detail = 'selected_detail';
  assert.deepEqual(answerForms(packet, answer).map(item => [item.title, item.format]),
    [['Matusetoetuse avalduse vorm2026', 'docx'], ['Kose valla SPOKU e-taotluste keskkond', undefined], ['Koduteenuse taotlus', 'pdf']]);
  // An answer citing no record, or a turn without a record context, gives none.
  assert.deepEqual(answerForms(packet, { blocks: [{ text: 'Vastus', refs: ['S9'] }] }), []);
  assert.deepEqual(answerForms({ evidence: [] }, answer), []);
  const many = { record_context: { entries: Array.from({ length: 8 }, (_, i) => form(`R${i + 1}`, `S${i + 1}`, `Vorm ${i + 1}`, `https://vald.ee/${i + 1}.pdf`, 'pdf')), relations: [] } };
  assert.equal(answerForms(many, { blocks: [{ text: 'Vormid', refs: many.record_context.entries.map((_, i) => `S${i + 1}`) }] }).length, ANSWER_FORMS_LIMIT);
  // The chat shows them as links under the answer, after a reload too.
  const turn = { id: 't', state: 'completed', question: 'Mis dokumente on vaja?', answer: { kind: 'grounded', blocks: [{ text: 'Vastus', refs: ['S1'] }], limitations: [], clarification: null },
    sources: [{ ref: 'S1', title: 'Matusetoetus', pages: [], used: true }], forms: answerForms(packet, answer) };
  assert.deepEqual(pilotChatResult(turn, 'conv').attachments.slice(0, 2), [
    { label: 'Matusetoetuse avalduse vorm2026 (docx)', url: 'https://www.kosevald.ee/sites/default/files/Matusetoetuse%20avalduse%20vorm2026.docx' },
    { label: 'Kose valla SPOKU e-taotluste keskkond', url: 'https://kose.spoku.ee/' }]);
  assert.deepEqual(pilotChatMessages([turn], 'conv').at(-1).attachments, pilotChatResult(turn, 'conv').attachments);
  assert.deepEqual(pilotChatResult({ ...turn, forms: undefined }, 'conv').attachments, []);
});
