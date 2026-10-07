import test from 'node:test';
import assert from 'node:assert/strict';
import { modelSourceMetadata, modelProjection, webAddress, WEB_SOURCE_TYPES } from '../lib/rag-v2/search/model-context.js';
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
