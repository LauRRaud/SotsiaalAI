// Pöörduja eelpöördumise leht: adressaadi samm ja saatmise tee.
//
// Kolm kontaktikaarti olid 948 px (paneelis 522) ja leht luges adressaadi kanalit väljadelt,
// mida teenusekaardi vastus ei kanna: iga kaart ütles „Sotsiaal.pro sisene" ja teenuseosutajale
// ei pakkunud saatmise samm ei platvormi ega e-kirja. Otsused on failis
// components/workspace/preInquiry/senderModel.js; siin on nende käitumine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  RECIPIENT_PAGE,
  RECIPIENT_SERVICE_PAGE,
  RECIPIENT_SUGGESTED,
  findRecipientEntry,
  recipientChannelKey,
  recipientChannels,
  recipientChoice,
  recipientFilterChange,
  recipientListView,
  recipientServiceActions,
  recipientStepView,
  recipientTypeOf,
  sendTellsOrganizationReaders,
  suggestedRecipients,
  withChosenService
} from '../components/workspace/preInquiry/senderModel.js';

const LANGS = ['et', 'en', 'ru'];
const catalog = (lang) => JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')).workspace_feature_pages.pre_inquiries;
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);

/* Kirjed sellisel kujul, nagu leht need saab: teenusekaardi KOV kontakt (kanalit ei kanna),
   asutuse vastuvõtulaud (server märgib platvormisiseseks) ja teenuseosutaja osutamiskoha kaupa
   koos teenuste reeglitega. */
const kov = { id: 'kov-1', type: 'KOV_SOCIAL_CONTACT', title: 'Sotsiaalosakond', email: 'sots@vald.example' };
const kovNoMail = { id: 'kov-2', type: 'KOV_GENERAL_CONTACT', title: 'Üldkontakt', email: '' };
const desk = { id: 'organization-inbox:org-1', type: 'ORGANIZATION_INBOX', title: 'Vallavalitsus', deliveryChannel: 'INTERNAL', recipientOrganizationId: 'org-1' };
const action = (id, over = {}) => ({ providerServiceId: id, providerLocationId: 'loc-1', name: id, platformAllowed: false, emailAllowed: false, email: null, ...over });
const provider = (actions, over = {}) => ({
  id: 'entry-1::loc-1',
  parentEntryId: 'entry-1',
  providerLocationId: 'loc-1',
  type: 'SERVICE_PROVIDER',
  title: 'Hooldusabi MTÜ',
  email: null,
  serviceActions: actions,
  providerProfile: { serviceItems: actions.map((item) => ({ id: item.providerServiceId, name: item.name })) },
  ...over
});
const both = action('home', { platformAllowed: true, emailAllowed: true, email: 'kodu@hooldus.example' });
const platformOnly = action('assistant', { platformAllowed: true });
const mailOnly = action('support', { emailAllowed: true, email: 'tugi@hooldus.example' });
const closed = action('closed');
const mailWithoutAddress = action('noaddress', { emailAllowed: true, email: null });

test('saatmise tee: KOV kontakt läheb e-kirjaga, vastuvõtulaud platvormis', () => {
  /* Teenusekaardi kirje ei kanna kanalit: leht ei tohi seda platvormisiseseks pidada. */
  assert.deepEqual(recipientChannels(kov), { platform: false, email: true, address: 'sots@vald.example' });
  assert.equal(recipientChannelKey(recipientChannels(kov)), 'email');
  assert.deepEqual(recipientChannels(kovNoMail), { platform: false, email: false, address: '' });
  assert.equal(recipientChannelKey(recipientChannels(kovNoMail)), 'manual');
  assert.deepEqual(recipientChannels(desk), { platform: true, email: false, address: '' });
  assert.equal(recipientChannelKey(recipientChannels(desk)), 'platform');
  /* Kirje, mille server on märkinud platvormisiseseks (abilise soovitus), pakub mõlemat teed. */
  assert.equal(recipientChannelKey(recipientChannels({ ...kov, deliveryChannel: 'INTERNAL' })), 'both');
  assert.deepEqual(recipientChannels(null), { platform: false, email: false, address: '' });
});

test('saatmise samm ütleb ainult asutuse vastuvõtulaua kohta, kes pöördumist ja vestlust loeb', () => {
  /* Asutuse laual ei loe vestlust kogu asutus, vaid töö vastutaja ja üleandmise järel järgmine:
     inimene peab seda teadma enne saatmist. Nimelise kontakti ja teenuseosutaja juures lauset
     ei ole, ka siis, kui pöördumine läheb neile platvormis. */
  assert.equal(sendTellsOrganizationReaders(desk), true);
  assert.equal(sendTellsOrganizationReaders({ ...desk, deliveryChannel: '' }), false);
  for (const entry of [null, kov, kovNoMail, { ...kov, deliveryChannel: 'INTERNAL' }, provider([both]), provider([platformOnly])]) {
    assert.equal(sendTellsOrganizationReaders(entry), false, entry?.id || 'valimata');
  }
  /* Leht küsib reeglit valitud adressaadi kohta ja paneb lause saatmise sammu teadete algusesse. */
  const page = fs.readFileSync(new URL('../components/workspace/WorkspaceFeaturePage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(page, /const sendNotices = \[\n\s+\/\*[^\n]+\*\/\n\s+sendTellsOrganizationReaders\(selectedRecipient\)\n\s+\? tr\(\n\s+"views\.send\.organization_readers",/);
  for (const lang of LANGS) {
    const text = at(catalog(lang), 'views.send.organization_readers');
    assert.ok(typeof text === 'string' && text.length > 60, lang);
    assert.equal(/[—–{}]/.test(text), false, lang);
  }
  /* Eesti lause nimetab mõlemat: kes loeb pöördumist ja kes vestlust pärast üleandmist. */
  const et = at(catalog('et'), 'views.send.organization_readers');
  assert.ok(et.includes('vastuvõtutiim') && et.includes('antakse üle') && et.includes('järgmine töötaja'));
});

test('saatmise tee: teenuseosutajal otsustab valitud teenus', () => {
  const entry = provider([both, platformOnly, mailOnly, closed, mailWithoutAddress]);
  /* Valitav on teenus, mille kohta saab platvormis saata või millel on e-kirja aadress. */
  assert.deepEqual(recipientServiceActions(entry).map((item) => item.providerServiceId), ['home', 'assistant', 'support']);
  assert.deepEqual(recipientServiceActions(kov), []);
  assert.deepEqual(recipientServiceActions({ ...entry, serviceActions: null }), []);

  assert.deepEqual(recipientChannels(entry, { serviceId: 'home', locationId: 'loc-1' }), { platform: true, email: true, address: 'kodu@hooldus.example' });
  assert.deepEqual(recipientChannels(entry, { serviceId: 'assistant' }), { platform: true, email: false, address: '' });
  assert.deepEqual(recipientChannels(entry, { serviceId: 'support' }), { platform: false, email: true, address: 'tugi@hooldus.example' });
  /* Teenus, mida ei saa valida, teise koha teenus või tundmatu teenus: saata ei saa kuidagi. */
  for (const pick of [{ serviceId: 'closed' }, { serviceId: 'home', locationId: 'loc-2' }, { serviceId: 'x' }]) {
    assert.equal(recipientChannelKey(recipientChannels(entry, pick)), 'manual', JSON.stringify(pick));
  }
  /* Enne teenuse valimist: mida vähemalt üks teenus lubab; aadressi veel ei ole. */
  assert.deepEqual(recipientChannels(entry), { platform: true, email: true, address: '' });
  assert.deepEqual(recipientChannels(provider([mailOnly])), { platform: false, email: true, address: '' });
  assert.equal(recipientChannelKey(recipientChannels(provider([closed]))), 'manual');
  /* Kirje enda e-posti väli teenuseosutaja kanalit ei määra (see on teenuse küljes). */
  assert.equal(recipientChannels(provider([closed], { email: 'info@hooldus.example' })).email, false);
});

test('kontakti vaate põhinupp: otse valik, üks teenus, teenuse valik või mitte midagi', () => {
  assert.deepEqual(recipientChoice(kov), { kind: 'direct' });
  assert.deepEqual(recipientChoice(desk), { kind: 'direct' });
  assert.deepEqual(recipientChoice(provider([both, closed])), { kind: 'service', action: both });
  assert.deepEqual(recipientChoice(provider([both, mailOnly])), { kind: 'services', count: 2 });
  assert.deepEqual(recipientChoice(provider([closed, mailWithoutAddress])), { kind: 'none' });
  assert.deepEqual(recipientChoice(provider([])), { kind: 'none' });
});

test('valitud adressaat leitakse ka kaardikirje tunnuse järgi', () => {
  const second = provider([both], { id: 'entry-1::loc-2', providerLocationId: 'loc-2' });
  const entries = [kov, desk, provider([both]), second];
  assert.equal(findRecipientEntry(entries, 'kov-1'), kov);
  assert.equal(findRecipientEntry(entries, 'entry-1::loc-2'), second);
  /* Salvestatud pöördumine kannab kaardikirje tunnust ja osutamiskohta. */
  assert.equal(findRecipientEntry(entries, 'entry-1', 'loc-2'), second);
  assert.equal(findRecipientEntry(entries, 'entry-1').id, 'entry-1::loc-1');
  /* Koht, mida enam ei ole: adressaati ei arvata ära. */
  assert.equal(findRecipientEntry(entries, 'entry-1', 'loc-9'), null);
  assert.equal(findRecipientEntry(entries, ''), null);
  assert.equal(findRecipientEntry(null, 'kov-1'), null);
});

test('saatmise sammu teated käivad valitud teenuse kohta', () => {
  const entry = provider([both, mailOnly]);
  assert.deepEqual(withChosenService(entry, 'support').providerProfile.serviceItems.map((item) => item.id), ['support']);
  assert.equal(withChosenService(entry, ''), entry);
  assert.equal(withChosenService(kov, 'support'), kov);
  assert.equal(withChosenService(null, 'support'), null);
  /* Algne kirje ei muutu. */
  assert.equal(entry.providerProfile.serviceItems.length, 2);
});

test('adressaadi liik salvestamiseks tuleb valitud adressaadist', () => {
  assert.equal(recipientTypeOf(kov), 'KOV_CONTACT');
  assert.equal(recipientTypeOf(kovNoMail), 'KOV_CONTACT');
  assert.equal(recipientTypeOf(desk), 'ORGANIZATION_INBOX');
  assert.equal(recipientTypeOf(provider([both])), 'SERVICE_PROVIDER');
  assert.equal(recipientTypeOf(null), '');
});

test('abilise soovitus viiakse laaditud kirjele, et teenuseosutajat saaks valida', () => {
  const loaded = provider([both, mailOnly]);
  const other = provider([both], { id: 'entry-1::loc-2', providerLocationId: 'loc-2' });
  const suggestions = [
    { id: 'entry-1', type: 'SERVICE_PROVIDER', title: 'Hooldusabi MTÜ', routingReason: 'Piirkond ja vajadus sobivad.' },
    { id: 'kov-1', type: 'KOV_SOCIAL_CONTACT', title: 'Sotsiaalosakond', deliveryChannel: 'INTERNAL', routingReason: 'Piirkonna kontakt.' },
    { id: 'gone', type: 'KOV_SOCIAL_CONTACT', title: 'Laadimata kontakt' },
    { id: 'kov-1', type: 'KOV_SOCIAL_CONTACT', title: 'Kordus' },
    { title: 'tunnuseta' }
  ];
  const rows = suggestedRecipients(suggestions, [kov, loaded, other]);
  /* Teenuseosutaja soovitus annab iga osutamiskoha rea koos valitavate teenustega. */
  assert.deepEqual(rows.map((row) => row.id), ['entry-1::loc-1', 'entry-1::loc-2', 'kov-1', 'gone']);
  assert.equal(recipientChoice(rows[0]).kind, 'services');
  assert.equal(rows[0].routingReason, 'Piirkond ja vajadus sobivad.');
  /* KOV kontakti rida on laaditud kirje: saatmise tee on sama, mida saatmise samm pakub. */
  assert.equal(recipientChannelKey(recipientChannels(rows[2])), 'email');
  assert.equal(rows[2].routingReason, 'Piirkonna kontakt.');
  /* Soovitus, mida laaditud loendis ei ole, jääb alles sellisena, nagu abiline ta andis. */
  assert.equal(rows[3].title, 'Laadimata kontakt');
  assert.deepEqual(suggestedRecipients(null, [kov]), []);
  assert.deepEqual(suggestedRecipients(suggestions, null).map((row) => row.id), ['entry-1', 'kov-1', 'gone']);
});

test('adressaadi loend: soovitused või otsing, lehekülgede kaupa', () => {
  const entries = Array.from({ length: 8 }, (_, index) => ({ id: `e${index + 1}` }));
  const suggestions = [{ id: 's1' }, { id: 's2' }];
  /* Soovitused on ees, kuni inimene läheb ise otsima. */
  const suggested = recipientListView({ suggestions, entries });
  assert.deepEqual([suggested.source, suggested.hasSuggestions, suggested.suggestedCount], ['suggested', true, 2]);
  assert.deepEqual(suggested.items.map((item) => item.id), ['s1', 's2']);
  /* Otsing näitab kõiki sobivaid kontakte: soovitused ei varja neid enam. */
  const search = recipientListView({ suggestions, entries, source: 'search' });
  assert.deepEqual([search.source, search.total, search.pages], ['search', 8, Math.ceil(8 / RECIPIENT_PAGE)]);
  assert.deepEqual(search.items.map((item) => item.id), entries.slice(0, RECIPIENT_PAGE).map((item) => item.id));
  const second = recipientListView({ entries, page: 1 });
  assert.deepEqual([second.source, second.hasSuggestions, second.from, second.to], ['search', false, RECIPIENT_PAGE + 1, Math.min(8, RECIPIENT_PAGE * 2)]);
  /* Soovitusteta ei saa soovituste loendit olla, ka siis, kui seda küsitakse. */
  assert.equal(recipientListView({ entries, source: 'suggested' }).source, 'search');
  /* Korduv ja tunnuseta kirje jääb välja. */
  assert.equal(recipientListView({ entries: [{ id: 'a' }, { id: 'a' }, {}, null] }).total, 1);
  assert.deepEqual([recipientListView().total, recipientListView({ entries: null, suggestions: null }).source], [0, 'search']);
  assert.ok(RECIPIENT_PAGE >= 2 && RECIPIENT_PAGE <= 3, 'lehekülg on mõõdetud nii, et loend mahub paneeli');
  assert.ok(RECIPIENT_SERVICE_PAGE >= 2 && RECIPIENT_SERVICE_PAGE <= 4);
});

test('filtririda: soovitused ja liigid ühes reas, valitud adressaati see ei puutu', () => {
  const change = (state, value) => recipientFilterChange(state, value);
  /* Liigi vajutus näitab seda liiki kontakte; teine vajutus võtab liigi maha. */
  assert.deepEqual(change({ source: 'search', type: '' }, 'KOV_CONTACT'), { source: 'search', type: 'KOV_CONTACT' });
  assert.deepEqual(change({ source: 'search', type: 'KOV_CONTACT' }, 'KOV_CONTACT'), { source: 'search', type: '' });
  assert.deepEqual(change({ source: 'search', type: 'KOV_CONTACT' }, 'SERVICE_PROVIDER'), { source: 'search', type: 'SERVICE_PROVIDER' });
  /* Soovituste juurest liigile minnes jääb liik valituks ka siis, kui see oli juba meeles. */
  assert.deepEqual(change({ source: 'suggested', type: 'KOV_CONTACT' }, 'KOV_CONTACT'), { source: 'search', type: 'KOV_CONTACT' });
  /* Soovituste lahter: sisse ja teise vajutusega tagasi otsingusse; liik jääb meelde. */
  assert.deepEqual(change({ source: 'search', type: 'SERVICE_PROVIDER' }, RECIPIENT_SUGGESTED), { source: 'suggested', type: 'SERVICE_PROVIDER' });
  assert.deepEqual(change({ source: 'suggested', type: 'SERVICE_PROVIDER' }, RECIPIENT_SUGGESTED), { source: 'search', type: 'SERVICE_PROVIDER' });
  /* Vastus ei kanna midagi peale allika ja liigi: valiku tühjendamist siin ei ole. */
  assert.deepEqual(Object.keys(change({}, 'KOV_CONTACT')).sort(), ['source', 'type']);
});

test('adressaadi sammus on ees loend, üks kontakt või teenuse valik', () => {
  assert.deepEqual(recipientStepView(), { mode: 'list', id: '' });
  /* Valitud adressaat on tagasi tulles ees; loendisse minnes mitte. */
  assert.deepEqual(recipientStepView({ selectedId: 'a' }), { mode: 'contact', id: 'a' });
  assert.deepEqual(recipientStepView({ selectedId: 'a', browsing: true }), { mode: 'list', id: '' });
  /* Loendist avatud kontakt on ees ka siis, kui valitud on teine. */
  assert.deepEqual(recipientStepView({ selectedId: 'a', browsing: true, peekId: 'b' }), { mode: 'contact', id: 'b' });
  assert.deepEqual(recipientStepView({ peekId: 'b', services: true }), { mode: 'services', id: 'b' });
  /* Teenuse valik ilma kontaktita ei ole vaade. */
  assert.deepEqual(recipientStepView({ services: true, browsing: true, selectedId: 'a' }), { mode: 'list', id: '' });
});

test('adressaadi sammu ja saatmise tee tekstid on kataloogis kolmes keeles', () => {
  const keys = [
    'views.recipient.title', 'views.recipient.back', 'views.recipient.back_contact', 'views.recipient.filters', 'views.recipient.source_suggested',
    'views.recipient.source_note', 'views.recipient.chosen', 'views.recipient.services', 'views.recipient.no_services',
    'views.recipient.choose_service', 'views.recipient.change_service',
    'views.recipient.facts.place', 'views.recipient.facts.area', 'views.recipient.facts.email', 'views.recipient.facts.service', 'views.recipient.facts.channel',
    'actions.choose_contact', 'actions.open', 'actions.save', 'actions.copy', 'actions.download', 'recipient.selected',
    'views.send.save_hint', 'views.send.copy_hint', 'views.send.download_hint'
  ];
  const channelKeys = [kov, kovNoMail, desk, { ...kov, deliveryChannel: 'INTERNAL' }].map((entry) => recipientChannelKey(recipientChannels(entry)));
  assert.deepEqual([...new Set(channelKeys)].sort(), ['both', 'email', 'manual', 'platform']);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string' || !at(messages, key).trim()), [], lang);
    for (const key of channelKeys) assert.equal(typeof at(messages, `views.recipient.channel.${key}`), 'string', `${lang}: ${key}`);
    assert.ok(messages.views.recipient.source_suggested.includes('{count}'), lang);
    /* Vana kaardi ja vaate tekstid ei jää kataloogi rippuma. */
    for (const gone of ['views.recipient.lead', 'actions.show_more_contacts', 'actions.show_less_contacts', 'delivery.internal', 'delivery.external_email', 'preview.no_auto_send']) {
      assert.equal(at(messages, gone), undefined, `${lang}: ${gone}`);
    }
  }
});
