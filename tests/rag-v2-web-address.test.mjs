import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { modelSourceMetadata, modelProjection, webAddress, confirmedReading, WEB_SOURCE_TYPES } from '../lib/rag-v2/search/model-context.js';
import { completedView } from '../lib/rag-v2/pilot/service.js';
import { historyRecord, historyTurn, historyMessages } from '../lib/rag-v2/pilot/history.js';
import { dialogueRequest, WEB_ADDRESS_INSTRUCTIONS } from '../lib/rag-v2/pilot/dialogue.js';
import { pilotChatResult } from '../lib/chat/m4PilotClientContract.js';
import { messageLinks, splitByLinks } from '../lib/chat/messageLinks.js';
import { municipalPacket } from './fixtures/rag-v2-municipal-packet.mjs';
import { normalizeSources } from '../components/chat/utils/sources.js';
import { collectMessageSources } from '../components/chat/hooks/useConversationSources.js';

// ADR-097 (owner, 06.10.2026): "lingid peavad olema sõnumimullides ka" and "Luna võib ju kuidagi loomulikult märkida
// ära veebilehe aadressi". The answer names a web page's address in a sentence; the chat makes it a link.
const field = value => ({ value, provenance: [{ kind: 'metadata', path: '/url' }], review_state: 'imported_not_verified' });
const bundle = (type, urls) => ({ document: { fields: { source_type: field(type), authority: field('Näidispood'), language: field('et'), source_urls: field(urls) } } });

test('a web page\'s source card carries its address as a reader writes it; the declared address stays beside it for the chat', () => {
  assert.deepEqual(WEB_SOURCE_TYPES, ['web_page', 'vendor_page', 'organization_page']);
  for (const [url, address] of [['https://www.silmatervis.ee/abivahendid/', 'silmatervis.ee/abivahendid'], ['https://pood.example/', 'pood.example'], ['https://pood.example/a/b?x=1#y', 'pood.example/a/b'],
    ['https://pood.example/%C3%BC%C3%BCr', 'pood.example/üür'], ['http://pood.example/a', null], ['mis iganes', null]]) assert.equal(webAddress(url), address, url);
  const page = modelSourceMetadata(bundle('vendor_page', ['https://www.pood.example/laenutus/', 'https://pood.example/muu']));
  assert.deepEqual([page.web_address.value, page.web_address.url, page.source_type.value], ['pood.example/laenutus', 'https://www.pood.example/laenutus/', 'vendor_page']);
  assert.equal(modelSourceMetadata(bundle('web_page', ['https://amet.example/juhis'])).web_address.value, 'amet.example/juhis');
  // Not for other kinds of source, and never from an address that is not a declared https one.
  for (const other of [bundle('legal_act', ['https://www.riigiteataja.ee/akt/1']), bundle('research_report', ['https://amet.example/raport.pdf']), bundle('vendor_page', []),
    bundle('vendor_page', ['http://pood.example/a']), bundle('vendor_page', null)]) assert.equal('web_address' in modelSourceMetadata(other), false);
});

// A turn's row whose first source is a company's page and whose answer names its address.
function turnRow() {
  const packet = municipalPacket({ records: 2, passages: 2 }), first = packet.evidence.find(entry => entry.evidence_id === packet.reference_map.S1.evidence_id);
  first.source_metadata = { ...first.source_metadata, source_type: field('vendor_page'), web_address: { ...field('pood.example/laenutus'), url: 'https://www.pood.example/laenutus/' } };
  const answer = { kind: 'grounded', blocks: [{ text: 'Rulaatorit saab laenutada; vaata lähemalt: pood.example/laenutus.', factual: true, refs: ['S1'] }, { text: 'Teine väide.', factual: true, refs: ['S2'] }], limitations: [], clarification: null };
  return { id: 'turn-1', state: 'completed', configHash: 'plan', createdAt: new Date('2026-10-06T17:00:00Z'), expiresAt: null,
    payload: { question: 'Kust saab rulaatorit laenutada?', contextMode: 'new', query: { language: 'et', tokens: 6 }, events: [], answer, answerVersion: 'm4-text-refs-2', messageId: 'message-1', packet,
      context: { version: 'd', scopeId: 'scope-1', personId: 'person-1', scopeTurnId: 'turn-1', revision: 1, correctionRevision: 0, mode: 'new' }, contextAudit: { userTurns: [{ text: 'Kust saab rulaatorit laenutada?' }] } } };
}

test('the model is shown the address, not the declared target; the instructions say how it is named', () => {
  const row = turnRow(), projected = modelProjection(row.payload.packet.evidence, {}, { measure: 'none' });
  const cards = Object.values(projected.context.sources).filter(card => card.web_address);
  assert.deepEqual(cards.map(card => card.web_address), ['pood.example/laenutus']);
  assert.equal(JSON.stringify(projected.context).includes('https://www.pood.example'), false, 'the target is the chat\'s, not the model\'s');
  const body = dialogueRequest({ model: 'm', maxOutputTokens: 100, reasoning: 'low' }, 'Küsimus?', projected.context, 'et', { userTurns: [] });
  // Which prompt version this is belongs to the prompt's own test; later versions add after these instructions.
  assert(body.instructions.includes(WEB_ADDRESS_INSTRUCTIONS));
  assert.match(WEB_ADDRESS_INSTRUCTIONS, /exactly as web_address gives it/u);
  assert.match(WEB_ADDRESS_INSTRUCTIONS, /never write a web address that neither a web_address nor the evidence text gives/u);
});

test('the turn\'s view, its durable record and the chat\'s source list carry the address and its target', () => {
  const row = turnRow(), view = completedView(row, 'real');
  assert.deepEqual([view.sources[0].web, view.sources[0].webUrl, 'web' in view.sources[1]], ['pood.example/laenutus', 'https://www.pood.example/laenutus/', false]);
  // The record keeps it with the cited source, so a turn shown from its record (its audit row gone) still links.
  const record = historyRecord({ row, view, packet: row.payload.packet }), shown = historyTurn({ id: 'message-1', metadata: historyMessages(record, row.payload.question).assistant.metadata }, row.payload.question);
  assert.deepEqual([record.sources[0].web, shown.sources[0].webUrl], ['pood.example/laenutus', 'https://www.pood.example/laenutus/']);
  for (const turn of [view, shown]) {
    const result = pilotChatResult(turn, 'conv-1');
    assert.deepEqual(messageLinks(result.sources), [{ address: 'pood.example/laenutus', url: 'https://www.pood.example/laenutus/' }]);
  }
  // The chat page's own two layers between the reply and the bubble keep both (06.10.2026: the first release of this
  // lost them there, and the address in the answer stayed plain text).
  const reply = pilotChatResult(view, 'conv-1'), message = { role: 'ai', text: reply.answer, sources: normalizeSources(reply.sources) };
  assert.deepEqual([message.sources[0].web, message.sources[0].webUrl], ['pood.example/laenutus', 'https://www.pood.example/laenutus/']);
  assert.deepEqual(messageLinks(collectMessageSources(message, null)), [{ address: 'pood.example/laenutus', url: 'https://www.pood.example/laenutus/' }]);
  assert.deepEqual(splitByLinks(reply.answer, messageLinks(collectMessageSources(message, null))).filter(part => typeof part !== 'string'), [{ text: 'pood.example/laenutus', url: 'https://www.pood.example/laenutus/' }]);
  // A source whose target is not a declared https address gives no link.
  const odd = turnRow();
  odd.payload.packet.evidence.find(entry => entry.evidence_id === odd.payload.packet.reference_map.S1.evidence_id).source_metadata.web_address.url = 'javascript:alert(1)';
  assert.equal('web' in completedView(odd, 'real').sources[0], false);
  assert.deepEqual(messageLinks([{ web: 'pood.example', webUrl: 'http://pood.example' }, { web: '', webUrl: 'https://pood.example' }, null]), []);
});

test('in the bubble an address is a link only when it is a cited source\'s own, and it leads to the declared address', () => {
  const links = messageLinks([{ web: 'silmatervis.ee/abivahendid', webUrl: 'https://silmatervis.ee/abivahendid/' }, { web: 'silmatervis.ee/abivahendid', webUrl: 'https://silmatervis.ee/abivahendid/' },
    { web: 'itak.ee/invaabivahendite-laenutus', webUrl: 'https://www.itak.ee/invaabivahendite-laenutus' }]);
  assert.equal(links.length, 2);
  // As the card gives it, with a scheme or "www.", with a closing slash, in capitals; the sentence's full stop stays text.
  assert.deepEqual(splitByLinks('Vaata lähemalt: silmatervis.ee/abivahendid. Või WWW.ITAK.EE/invaabivahendite-laenutus/ ja https://silmatervis.ee/abivahendid', links),
    ['Vaata lähemalt: ', { text: 'silmatervis.ee/abivahendid', url: 'https://silmatervis.ee/abivahendid/' }, '. Või ', { text: 'WWW.ITAK.EE/invaabivahendite-laenutus/', url: 'https://www.itak.ee/invaabivahendite-laenutus' },
      ' ja ', { text: 'https://silmatervis.ee/abivahendid', url: 'https://silmatervis.ee/abivahendid/' }]);
  // The site named without its page leads to the one page of that site among the sources.
  assert.deepEqual(splitByLinks('Vaata silmatervis.ee.', links), ['Vaata ', { text: 'silmatervis.ee', url: 'https://silmatervis.ee/abivahendid/' }, '.']);
  // Not a link: an e-mail address, another page of the site, another site that ends the same, a site with two pages cited.
  for (const text of ['Kirjuta info@silmatervis.ee.', 'Vaata silmatervis.ee/abivahendid/muu.', 'Vaata minusilmatervis.ee.', 'Vaata silmatervis.ee.ru.', 'Aadressi ei ole.', ''])
    assert.deepEqual(splitByLinks(text, links), [text], text);
  const two = messageLinks([{ web: 'pood.example/a', webUrl: 'https://pood.example/a' }, { web: 'pood.example/b', webUrl: 'https://pood.example/b' }]);
  assert.deepEqual(splitByLinks('Vaata pood.example ja pood.example/b.', two), ['Vaata pood.example ja ', { text: 'pood.example/b', url: 'https://pood.example/b' }, '.']);
  assert.deepEqual(splitByLinks('Tekst silmatervis.ee/abivahendid', []), ['Tekst silmatervis.ee/abivahendid']);
});

test('an address miswritten by a letter is shown as its source gives it and leads there', () => {
  // The case of 06.10.2026: one letter dropped from the site's name, in two addresses of one answer.
  const links = messageLinks([{ web: 'viipekeeletolgid.example/teenused', webUrl: 'https://www.viipekeeletolgid.example/teenused' },
    { web: 'viipekeeletolgid.example/teenused/noustamine', webUrl: 'https://www.viipekeeletolgid.example/teenused/noustamine' }, { web: 'itak.ee/laenutus', webUrl: 'https://www.itak.ee/laenutus' },
    { web: 'silmatervis.ee/abivahendid', webUrl: 'https://silmatervis.ee/abivahendid/' }]);
  assert.deepEqual(splitByLinks('Telli: viipekeeltolgid.example/teenused. Nõu: https://www.viipekeeltolgid.example/teenused/noustamine.', links), ['Telli: ',
    { text: 'viipekeeletolgid.example/teenused', url: 'https://www.viipekeeletolgid.example/teenused' }, '. Nõu: ', { text: 'viipekeeletolgid.example/teenused/noustamine', url: 'https://www.viipekeeletolgid.example/teenused/noustamine' }, '.']);
  // The site named alone and miswritten leads to its one cited page.
  assert.deepEqual(splitByLinks('Vaata silmatevis.ee.', links), ['Vaata ', { text: 'silmatervis.ee', url: 'https://silmatervis.ee/abivahendid/' }, '.']);
  // Not a miswriting: a page that is not cited, a site with two cited pages named alone, another ending, a short name,
  // three letters off, an e-mail address, and a name near two cited sites.
  for (const text of ['Vaata silmatevis.ee/hinnad.', 'Vaata viipekeeltolgid.example.', 'Vaata silmatevis.eu.', 'Vaata ital.ee/laenutus.', 'Vaata silmtvis.ee.', 'Kirjuta info@silmatevis.ee.'])
    assert.deepEqual(splitByLinks(text, links), [text], text);
  const twins = messageLinks([{ web: 'kopsuliit-a.example', webUrl: 'https://kopsuliit-a.example' }, { web: 'kopsuliit-b.example', webUrl: 'https://kopsuliit-b.example' }]);
  assert.deepEqual(splitByLinks('Vaata kopsuliit-c.example.', twins), ['Vaata kopsuliit-c.example.']);
});

// ADR-114 (09.10.2026): a collected page declares no publication date, and an answer left a page's amounts out for
// want of a time to give with them. The card carries the day the page itself says it was last changed.
test('a web page\'s card carries the day the page says it was last changed; other sources and other values do not', () => {
  const page = (type, day) => ({ document: { fields: { source_type: field(type), authority: field('Amet'), language: field('et'), source_urls: field(['https://amet.example/maarad']) },
    legacy_metadata: day === undefined ? {} : { page_updated: day } } });
  const card = modelSourceMetadata(page('web_page', '2026-09-18'));
  assert.deepEqual([card.page_updated.value, card.page_updated.review_state, card.web_address.value], ['2026-09-18', 'imported_not_verified', 'amet.example/maarad']);
  for (const type of ['vendor_page', 'organization_page']) assert.equal(modelSourceMetadata(page(type, '2026-01-02')).page_updated.value, '2026-01-02');
  for (const other of [page('web_page'), page('web_page', '18.09.2026'), page('web_page', '2026-13-40'), page('web_page', 20260918), page('web_page', '2026-09-18T10:00:00Z'), page('research_report', '2026-09-18'),
    bundle('web_page', ['https://amet.example/juhis'])]) assert.equal('page_updated' in modelSourceMetadata(other), false);
  // The model sees the plain day on the page's source card.
  const packet = municipalPacket({ records: 1, passages: 1 }), first = packet.evidence.find(entry => entry.evidence_id === packet.reference_map.S1.evidence_id);
  first.source_metadata = { ...first.source_metadata, source_type: field('web_page'), page_updated: { ...field('2026-09-18') } };
  const cards = Object.values(modelProjection(packet.evidence, {}, { measure: 'none' }).context.sources).filter(one => one.page_updated);
  assert.deepEqual(cards.map(one => one.page_updated), ['2026-09-18']);
});

// ADR-117 (09.10.2026): a page that the monthly refresh reads again and finds the same was not stored or indexed again,
// so its card kept the day of the first reading and an answer said a figure of the page "as of" that old day. The
// refresh keeps a table of the stored bytes it has confirmed; the card takes the later day from it.
test('a card takes the day a later reading confirmed the very bytes of its document; nothing else moves the day', () => {
  const bytes = 'a'.repeat(64), other = 'b'.repeat(64);
  const doc = (type, checked, hash = bytes) => ({ document: { fields: { source_type: field(type), authority: field('Amet'), language: field('et'), source_urls: field(['https://amet.example/maarad']),
    source_checked_at: checked === undefined ? undefined : { value: checked, provenance: [{ kind: 'metadata', path: '/checked_at' }], review_state: 'imported_not_verified' } }, legacy_metadata: {} },
  version: { source_hash: hash } });
  const card = modelSourceMetadata(doc('web_page', '2026-10-08'), { [bytes]: '2026-11-03' });
  assert.deepEqual(card.source_checked_at, { value: '2026-11-03', provenance: [{ kind: 'refresh_reading', table: 'rag-v2/web-page-checks-1', source_hash: bytes }], review_state: 'imported_not_verified' });
  // The other fields of the card are as before.
  assert.deepEqual([card.web_address.value, card.source_type.value, card.authority.value], ['amet.example/maarad', 'web_page', 'Amet']);
  // Every collected page: the table names only bytes a reading confirmed, whatever the source's declared type.
  for (const type of ['vendor_page', 'organization_page', 'research_report']) assert.equal(modelSourceMetadata(doc(type, '2026-10-06'), { [bytes]: '2026-11-01' }).source_checked_at.value, '2026-11-01');
  // A document that has no day of its own takes the table's; a full time stamp is compared by its day.
  assert.equal(modelSourceMetadata(doc('web_page', undefined), { [bytes]: '2026-11-01' }).source_checked_at.value, '2026-11-01');
  assert.equal(modelSourceMetadata(doc('web_page', '2026-10-08T07:15:00.000Z'), { [bytes]: '2026-11-01' }).source_checked_at.value, '2026-11-01');
  // Not later than the document's own day, other bytes, a value that is not a day, no table: the card keeps its own.
  const own = modelSourceMetadata(doc('web_page', '2026-10-08'), {}).source_checked_at;
  assert.deepEqual(own, { value: '2026-10-08', provenance: [{ kind: 'metadata', path: '/checked_at' }], review_state: 'imported_not_verified' });
  for (const checks of [{ [bytes]: '2026-10-08' }, { [bytes]: '2026-10-01' }, { [other]: '2026-11-03' }, { [bytes]: '3.11.2026' }, { [bytes]: '2026-13-40' }, { [bytes]: 20261103 }, { [bytes]: '2026-11-03T09:00:00Z' }, null])
    assert.deepEqual(modelSourceMetadata(doc('web_page', '2026-10-08'), checks).source_checked_at, own, JSON.stringify(checks));
  assert.equal(modelSourceMetadata(doc('web_page', '2026-10-08T23:00:00Z'), { [bytes]: '2026-10-08' }).source_checked_at.value, '2026-10-08T23:00:00Z');
  // A name every object has is not an entry of the table, and a document without a version's bytes has no entry.
  assert.equal(confirmedReading(doc('web_page', '2026-10-08', 'constructor'), {}), null);
  assert.equal(confirmedReading({ document: { fields: { source_type: field('web_page') } } }, { [bytes]: '2026-11-03' }), null);
  // The sources panel shows the same day: it reads the card's value.
  const row = turnRow(), first = row.payload.packet.evidence.find(entry => entry.evidence_id === row.payload.packet.reference_map.S1.evidence_id);
  first.source_metadata = { ...first.source_metadata, source_checked_at: card.source_checked_at };
  assert.equal(completedView(row, 'real').sources.find(source => source.ref === 'S1').checked, '2026-11-03');
});

test('the table in the repository is what the reader expects: the version it names, hashes of bytes and plain days in order', () => {
  const table = JSON.parse(fs.readFileSync(new URL('../lib/rag-v2/search/web-page-checks.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(table), ['schema_version', 'checks']);
  assert.equal(table.schema_version, 'rag-v2/web-page-checks-1');
  const keys = Object.keys(table.checks);
  assert.deepEqual(keys, [...keys].sort((a, b) => a.localeCompare(b, 'en')));
  for (const [bytes, day] of Object.entries(table.checks)) { assert.match(bytes, /^[0-9a-f]{64}$/u); assert.match(day, /^\d{4}-\d{2}-\d{2}$/u); assert.equal(Number.isNaN(Date.parse(day)), false); }
});
