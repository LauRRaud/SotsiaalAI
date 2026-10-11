// Pöörduja eelpöördumise leht: mis vaade mis seisus pöördumisele avaneb ja mida saadetud
// pöördumise lugemisvaade näitab.
//
// Leht avas iga pöördumise muutmisvormina, ka saadetud ja vastu võetud oma, ja pakkus sellele
// uuesti „Saada platvormis". Otsus on nüüd failis
// components/workspace/preInquiry/senderModel.js; siin on selle käitumine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  LIST_FLOW_KEYS,
  SENT_FLOW_KEYS,
  SHARINGS_PATH,
  keepReplyFacts,
  replaceInquiryRow,
  senderCanEdit,
  senderFlowKeys,
  senderListCounts,
  senderOpenMode,
  sentInquiryView
} from '../components/workspace/preInquiry/senderModel.js';
import { PRE_INQUIRY_SENDER_STATE_KEYS } from '../lib/preInquirySenderState.js';

const NOW = new Date('2026-10-11T12:00:00.000Z');
const SENT_AT = '2026-10-09T09:00:00.000Z';
const OPENED_AT = '2026-10-10T08:00:00.000Z';
const LANGS = ['et', 'en', 'ru'];
const catalog = (lang) => JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')).workspace_feature_pages.pre_inquiries;
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);

/* Read nii, nagu server need pöördujale annab (`serializePreInquiry`). */
const base = { id: 'pi_1', authorId: 'u_author', topic: 'Koduteenus emale', situation: 'Ema vajab abi.', selectedRecipientName: 'Proovivalla sotsiaalosakond' };
const rows = {
  draft: { ...base, status: 'DRAFT' },
  ready: { ...base, status: 'READY' },
  downloaded: { ...base, status: 'DOWNLOADED' },
  archived: { ...base, status: 'ARCHIVED' },
  waiting: { ...base, status: 'SENT', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT_AT },
  accepted: { ...base, status: 'READY', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT_AT, openedAt: OPENED_AT },
  answered: { ...base, status: 'READY', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT_AT, openedAt: OPENED_AT, replyCount: 2, lastReplyAt: '2026-10-10T14:00:00.000Z' },
  receiverArchived: { ...base, status: 'ARCHIVED', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT_AT, openedAt: OPENED_AT },
  recalled: { ...base, status: 'SENT', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT_AT, recalledAt: '2026-10-09T10:00:00.000Z' },
  replaced: { ...base, status: 'READY', deliveryChannel: 'INTERNAL', recipientOwnerId: 'u_worker', sentAt: SENT_AT, openedAt: OPENED_AT, supersededById: 'pi_2' },
  external: { ...base, status: 'SENT', deliveryChannel: 'EXTERNAL_EMAIL', sentAt: SENT_AT, externalSendConfirmedAt: SENT_AT },
  organization: {
    ...base,
    status: 'SENT',
    deliveryChannel: 'INTERNAL',
    recipientOrganizationId: 'org_1',
    recipientOrganization: { id: 'org_1', displayName: 'Proovivalla vastuvõtulaud' },
    selectedRecipientName: 'Vana nimi',
    sentAt: SENT_AT
  }
};

test('muutmisvorm avaneb ainult saatmata pöördumisele', () => {
  /* Sama värav mis serveri `updatePreInquiry`: SENT, ARCHIVED, avatud ja asendatud annavad 409. */
  for (const key of ['draft', 'ready', 'downloaded']) {
    assert.equal(senderCanEdit(rows[key]), true, key);
    assert.equal(senderOpenMode(rows[key]), 'edit', key);
  }
  for (const key of ['archived', 'waiting', 'accepted', 'answered', 'receiverArchived', 'recalled', 'replaced', 'external', 'organization']) {
    assert.equal(senderCanEdit(rows[key]), false, key);
    assert.equal(senderOpenMode(rows[key]), 'read', key);
  }
  /* Uus, veel salvestamata pöördumine on muudetav. */
  assert.equal(senderOpenMode(null), 'edit');
  /* Vastu võetud pöördumise olek on andmebaasis READY (saaja töövoo seis): muuta seda ei saa. */
  assert.equal(senderCanEdit({ status: 'READY', openedAt: OPENED_AT }), false);
  assert.equal(senderCanEdit({ status: 'sent' }), false, 'olek loetakse suurtähtedeta ka');
});

test('lava sammud: lugemisvaates ei ole muutmist ega saatmist', () => {
  assert.deepEqual(senderFlowKeys('sent'), ['sent_state', 'sent_text', 'saved']);
  assert.deepEqual(senderFlowKeys('sent', { hasDomains: true }), [...SENT_FLOW_KEYS]);
  assert.deepEqual(senderFlowKeys('list'), [...LIST_FLOW_KEYS]);
  for (const key of ['text', 'send', 'recipient']) assert.ok(!senderFlowKeys('sent').includes(key), key);
  /* Koostamise töövoog on sama mis enne. */
  assert.deepEqual(senderFlowKeys('existing'), ['path', 'situation', 'who', 'urgency', 'context', 'assistant', 'review', 'recipient', 'text', 'send', 'saved']);
  assert.deepEqual(senderFlowKeys('find_recipient', { hasDomains: true }).slice(3, 6), ['urgency', 'domains', 'context']);
  assert.equal(senderFlowKeys('journey')[0], 'journey');
  assert.equal(senderFlowKeys('known_contact').at(-1), 'saved');
  /* Tagastatud loend on koopia: lehe muudatus ei riku konstanti. */
  senderFlowKeys('sent').push('x');
  assert.equal(SENT_FLOW_KEYS.length, 3);
});

test('lugemisvaade: seis, adressaat, viis ja aeg', () => {
  const waiting = sentInquiryView(rows.waiting, { now: NOW });
  assert.deepEqual([waiting.state.key, waiting.state.days, waiting.state.tone], ['sent_waiting', 2, 'wait']);
  assert.deepEqual([waiting.recipient, waiting.channel, waiting.sentAt, waiting.next], ['Proovivalla sotsiaalosakond', 'platform', SENT_AT, 'waiting']);

  const accepted = sentInquiryView(rows.accepted, { now: NOW });
  assert.deepEqual([accepted.state.key, accepted.state.at, accepted.state.tone, accepted.next], ['accepted', OPENED_AT, 'ok', 'accepted']);

  /* Vastus on tugevam kui vastuvõtmine: sama seis, mida näitab Teekond. */
  const answered = sentInquiryView(rows.answered, { now: NOW });
  assert.deepEqual([answered.state.key, answered.state.tone, answered.next], ['answered', 'ok', 'answered']);

  const external = sentInquiryView(rows.external, { now: NOW });
  assert.deepEqual([external.state.key, external.channel, external.next], ['sent_external', 'email', 'external']);

  assert.deepEqual([sentInquiryView(rows.recalled).state.key, sentInquiryView(rows.recalled).next], ['recalled', 'recalled']);
  assert.deepEqual([sentInquiryView(rows.replaced).state.key, sentInquiryView(rows.replaced).next], ['replaced', 'replaced']);

  const archived = sentInquiryView(rows.archived);
  assert.deepEqual([archived.state.key, archived.channel, archived.sentAt, archived.next], ['archived', 'none', null, 'archived']);

  /* Asutusele saadetud pöördumisel on adressaat asutuse nimi, mitte varem valitud kontakti oma. */
  assert.equal(sentInquiryView(rows.organization).recipient, 'Proovivalla vastuvõtulaud');
  assert.equal(sentInquiryView({ ...base, selectedRecipientName: '', recipientEntry: { title: 'Kaardi kontakt' }, status: 'SENT', sentAt: SENT_AT }).recipient, 'Kaardi kontakt');
  assert.equal(sentInquiryView({ status: 'ARCHIVED' }).recipient, '');
});

test('lugemisvaade: tekst nii, nagu saaja seda näeb', () => {
  /* Pöördumise tekst näidatakse eraldi ainult siis, kui see erineb kirjeldusest. */
  const same = sentInquiryView({ ...rows.waiting, userEditedDraft: ' Ema vajab abi. ' });
  assert.deepEqual([same.situation, same.text], ['Ema vajab abi.', '']);
  const both = sentInquiryView({ ...rows.waiting, userEditedDraft: 'Tere. Palun abi.', generatedDraft: 'Koostatud tekst' });
  assert.deepEqual([both.situation, both.text], ['Ema vajab abi.', 'Tere. Palun abi.']);
  assert.equal(sentInquiryView({ ...rows.waiting, generatedDraft: 'Koostatud tekst' }).text, 'Koostatud tekst');
});

test('lugemisvaate tegevused järgivad serveri reegleid', () => {
  const actions = (key) => sentInquiryView(rows[key], { now: NOW }).actions;
  /* Vastu võtmata: tagasi saab võtta, ruumi ja parandust veel ei ole. */
  assert.deepEqual(actions('waiting'), { room: false, recall: true, correct: false, reopen: false });
  assert.deepEqual(actions('organization'), { room: false, recall: true, correct: false, reopen: false });
  /* Vastu võetud: ruum ja parandus, tagasi võtta enam ei saa. */
  assert.deepEqual(actions('accepted'), { room: true, recall: false, correct: true, reopen: false });
  assert.deepEqual(actions('answered'), { room: true, recall: false, correct: true, reopen: false });
  /* Saaja arhiveeris: ruum jääb loetavaks, parandust saab saata. */
  assert.deepEqual(actions('receiverArchived'), { room: true, recall: false, correct: true, reopen: false });
  /* Parandusega asendatud: uut parandust sellele ei saadeta. */
  assert.deepEqual(actions('replaced'), { room: true, recall: false, correct: false, reopen: false });
  /* Tagasi võetud ja e-kirjaga saadetud: platvormis ei ole midagi teha. */
  assert.deepEqual(actions('recalled'), { room: false, recall: false, correct: false, reopen: false });
  assert.deepEqual(actions('external'), { room: false, recall: false, correct: false, reopen: false });
  /* Saatmata ja arhiveeritud: taasavamine. */
  assert.deepEqual(actions('archived'), { room: false, recall: false, correct: false, reopen: true });
  /* Üheski seisus ei ole muutmist ega uuesti saatmist. */
  for (const key of Object.keys(rows)) {
    assert.deepEqual(Object.keys(actions(key)).sort(), ['correct', 'recall', 'reopen', 'room'], key);
  }
});

test('vastuste arv jääb alles, kui serveri vastus seda ei kanna', () => {
  const listRow = rows.answered;
  /* Alla laadimise märge, taasavamine ja muutmine vastavad reaga, millel arvu ei ole. */
  const { replyCount: _count, lastReplyAt: _last, ...fromMutation } = { ...listRow, updatedAt: '2026-10-11T10:00:00.000Z' };
  const kept = keepReplyFacts(listRow, fromMutation);
  assert.deepEqual([kept.replyCount, kept.lastReplyAt, kept.updatedAt], [2, '2026-10-10T14:00:00.000Z', '2026-10-11T10:00:00.000Z']);
  assert.equal(sentInquiryView(kept).state.key, 'answered');
  /* Värske arv (ka null) võidab varasema; ilma varasemata jääb rida, nagu tuli. */
  assert.equal(keepReplyFacts(listRow, { ...fromMutation, replyCount: 0 }).replyCount, 0);
  assert.equal(keepReplyFacts(null, fromMutation), fromMutation);
  assert.equal(keepReplyFacts(rows.waiting, fromMutation), fromMutation);
  assert.equal(keepReplyFacts(listRow, null), null);

  const list = [rows.draft, listRow].map((row, index) => ({ ...row, id: `pi_${index}` }));
  const next = { ...fromMutation, id: 'pi_1' };
  const inPlace = replaceInquiryRow(list, next);
  assert.deepEqual(inPlace.map((row) => row.id), ['pi_0', 'pi_1']);
  assert.equal(inPlace[1].replyCount, 2);
  assert.equal(inPlace[0], list[0], 'teised read jäävad samaks objektiks');
  const front = replaceInquiryRow(list, next, { toFront: true });
  assert.deepEqual(front.map((row) => row.id), ['pi_1', 'pi_0']);
  assert.equal(front[0].replyCount, 2);
  /* Uus rida lisatakse ainult loendi algusesse; oma kohal asendamine tundmatut rida ei lisa. */
  assert.deepEqual(replaceInquiryRow(list, { id: 'pi_new' }, { toFront: true }).map((row) => row.id), ['pi_new', 'pi_0', 'pi_1']);
  assert.deepEqual(replaceInquiryRow(list, { id: 'pi_new' }).map((row) => row.id), ['pi_0', 'pi_1']);
  assert.deepEqual(replaceInquiryRow(null, { id: 'pi_new' }, { toFront: true }).map((row) => row.id), ['pi_new']);
  assert.equal(replaceInquiryRow(list, null), list);
});

test('avaekraani rida loeb pöörduja read kokku', () => {
  assert.deepEqual(senderListCounts(Object.values(rows)), { total: 12, sent: 8, unsent: 4 });
  assert.deepEqual(senderListCounts([]), { total: 0, sent: 0, unsent: 0 });
  assert.deepEqual(senderListCounts(null), { total: 0, sent: 0, unsent: 0 });
});

test('lugemisvaate tekstid on kataloogis kolmes keeles', () => {
  /* Iga seisu jaoks, mille lugemisvaade võib saada, on lause „mis edasi saab". Võti pannakse
     kokku töö ajal, seega kataloogi kontroll seda ise ei näe. */
  const nextKeys = new Set(Object.values(rows).map((row) => sentInquiryView(row, { now: NOW }).next).filter(Boolean));
  assert.deepEqual([...nextKeys].sort(), ['accepted', 'answered', 'archived', 'external', 'recalled', 'replaced', 'waiting']);
  const readStates = new Set(Object.values(rows).filter((row) => senderOpenMode(row) === 'read').map((row) => sentInquiryView(row, { now: NOW }).state.key));
  for (const key of readStates) assert.ok(PRE_INQUIRY_SENDER_STATE_KEYS.includes(key), key);
  const keys = [
    'steps.sent_state.title', 'steps.sent_state.short', 'steps.sent_text.title', 'steps.sent_text.short', 'start.mine',
    'views.sent.recipient', 'views.sent.no_recipient', 'views.sent.sent_at', 'views.sent.channel_platform', 'views.sent.channel_email',
    'views.sent.last_reply', 'views.sent.sharings_link', 'views.sent.recall_hint', 'views.sent.correct_hint',
    'views.sent.text_lead', 'views.sent.text_lead_unsent', 'views.sent.text_heading',
    ...[...nextKeys].map((key) => `views.sent.next.${key}`),
    ...[...readStates].map((key) => `sender_state.${key}`)
  ];
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string' || !at(messages, key).trim()), [], lang);
    assert.ok(messages.start.mine.includes('{count}'), `${lang}: arvu koht`);
    for (const key of ['sent_state', 'sent_text']) assert.ok(messages.steps[key].short.length <= 18, `${lang}: ${key} lühinimi mahub kiirmenüüsse`);
    /* Link viib lehele, mille nimi on sama mis sellel lehel endal. */
    const sharingsTitle = JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')).my_sharings.title;
    assert.equal(messages.views.sent.sharings_link, sharingsTitle, lang);
  }
  assert.equal(SHARINGS_PATH, '/minu-jagamised');
  assert.ok(fs.existsSync(new URL('../app/minu-jagamised/page.jsx', import.meta.url)), 'leht, kuhu link viib, on olemas');
});
