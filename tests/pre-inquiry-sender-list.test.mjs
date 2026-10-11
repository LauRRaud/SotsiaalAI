// Pöörduja eelpöördumise leht: adressaadi tühja loendi põhjus, loend rühmade ja lehekülgedena,
// pika teksti lõikamine kokkuvõttes.
//
// Leht näitas iga tühja adressaadiloendi juures sama vihjet ja mitu vaadet ei mahtunud paneeli
// (loend 1071 px, ülevaade 1461 px 522 vastu). Otsused on failis
// components/workspace/preInquiry/senderModel.js; siin on nende käitumine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SENDER_LIST_GROUPS,
  SENDER_LIST_PAGE,
  excerptOf,
  pageOf,
  recipientEmptyReason,
  senderCanEdit,
  senderListGroupOf,
  senderListView,
  senderRowCanArchive
} from '../components/workspace/preInquiry/senderModel.js';

const LANGS = ['et', 'en', 'ru'];
const catalog = (lang) => JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8')).workspace_feature_pages.pre_inquiries;
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const SENT_AT = '2026-10-09T09:00:00.000Z';

test('tühja adressaadiloendi tekst ütleb tegeliku põhjuse', () => {
  const reason = (input) => recipientEmptyReason({ entryCount: 40, typeCount: 12, ...input });
  /* Otsing tühi ja liik valimata: loendit ei ole veel küsitud. */
  assert.deepEqual(reason({}), { key: 'no_filter' });
  assert.deepEqual(reason({ query: '   ' }), { key: 'no_filter' });
  /* Otsingusõna (ka KOV-i tekstist ette täidetud) ei vasta ühelegi kontaktile: lause nimetab sõna. */
  assert.deepEqual(reason({ query: ' Tartu linn ' }), { key: 'no_match', query: 'Tartu linn' });
  assert.deepEqual(reason({ query: 'Tartu', type: 'SERVICE_PROVIDER' }), { key: 'no_match_type', query: 'Tartu' });
  /* Valitud liiki kontakte ei ole üldse: otsingusõna ei ole siis põhjus. */
  assert.deepEqual(reason({ type: 'SERVICE_PROVIDER', typeCount: 0 }), { key: 'none_of_type' });
  assert.deepEqual(reason({ type: 'SERVICE_PROVIDER', typeCount: 0, query: 'Tartu' }), { key: 'none_of_type' });
  /* Kontakte ei tulnud teenusekaardilt üldse. */
  assert.deepEqual(recipientEmptyReason({ query: 'Tartu', type: 'KOV_CONTACT', entryCount: 0 }), { key: 'no_contacts' });
  assert.deepEqual(recipientEmptyReason(), { key: 'no_contacts' });
  /* Laadimise ajal ei öelda, et midagi ei ole. */
  assert.deepEqual(recipientEmptyReason({ loading: true, entryCount: 0 }), { key: 'loading' });
  /* Vana vihje („lisa vähemalt piirkond või KOV…") ei ole ühegi põhjuse tekst. */
  const keys = new Set([reason({}), reason({ query: 'x' }), reason({ query: 'x', type: 't' }), reason({ type: 't', typeCount: 0 }), recipientEmptyReason(), recipientEmptyReason({ loading: true })].map((item) => item.key));
  assert.deepEqual([...keys].sort(), ['loading', 'no_contacts', 'no_filter', 'no_match', 'no_match_type', 'none_of_type']);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    for (const key of keys) assert.equal(typeof at(messages, `views.recipient.empty.${key}`), 'string', `${lang}: ${key}`);
    for (const key of ['no_match', 'no_match_type']) assert.ok(at(messages, `views.recipient.empty.${key}`).includes('{query}'), `${lang}: ${key} nimetab otsingusõna`);
    assert.equal(messages.recipients_hint, undefined, `${lang}: vana vihje on kataloogist eemaldatud`);
  }
});

test('lehekülg loendist', () => {
  const items = Array.from({ length: 9 }, (_, index) => index + 1);
  assert.deepEqual(pageOf(items, 0, 4), { items: [1, 2, 3, 4], page: 0, pages: 3, from: 1, to: 4, total: 9 });
  assert.deepEqual(pageOf(items, 2, 4), { items: [9], page: 2, pages: 3, from: 9, to: 9, total: 9 });
  /* Lehekülg, mida enam ei ole (rida arhiveeriti viimaselt lehelt), annab viimase olemasoleva. */
  assert.deepEqual(pageOf(items, 7, 4).page, 2);
  assert.deepEqual(pageOf(items, -3, 4).page, 0);
  assert.deepEqual(pageOf(items, 'x', 4).page, 0);
  assert.deepEqual(pageOf([], 0, 4), { items: [], page: 0, pages: 1, from: 0, to: 0, total: 0 });
  assert.deepEqual(pageOf(null, 0, 4).total, 0);
  assert.equal(pageOf(items, 0, 0).items.length, 1, 'lehekülje suurus on vähemalt üks');
});

test('minu eelpöördumised: rühmad, vaikimisi rühm ja leheküljed', () => {
  const row = (id, over = {}) => ({ id, status: 'DRAFT', ...over });
  const rows = [
    row('d1'), row('s1', { status: 'SENT', sentAt: SENT_AT }), row('d2', { status: 'READY' }), row('a1', { status: 'ARCHIVED' }),
    row('s2', { status: 'READY', sentAt: SENT_AT, openedAt: SENT_AT }), row('d3', { status: 'DOWNLOADED' }), row('d4'), row('d5'),
    /* Saaja arhiveeris ja pöörduja võttis tagasi: mõlemad on saadetud pöördumised. */
    row('s3', { status: 'ARCHIVED', sentAt: SENT_AT, openedAt: SENT_AT }), row('s4', { status: 'SENT', sentAt: SENT_AT, recalledAt: SENT_AT })
  ];
  assert.deepEqual(rows.map(senderListGroupOf), ['drafts', 'sent', 'drafts', 'archive', 'sent', 'drafts', 'drafts', 'drafts', 'sent', 'sent']);
  assert.deepEqual([...SENDER_LIST_GROUPS], ['sent', 'drafts', 'archive']);

  /* Rühm valimata: esimene, kus midagi on (saadetud ees, sest seda tullakse vaatama). */
  const first = senderListView(rows);
  assert.equal(first.group, 'sent');
  assert.deepEqual(first.counts, { sent: 4, drafts: 5, archive: 1 });
  assert.deepEqual(first.items.map((item) => item.id), ['s1', 's2', 's3'].slice(0, SENDER_LIST_PAGE));
  assert.equal(first.pages, Math.ceil(4 / SENDER_LIST_PAGE));

  const drafts = senderListView(rows, { group: 'drafts', page: 1 });
  assert.deepEqual([drafts.group, drafts.page, drafts.from, drafts.to, drafts.total], ['drafts', 1, SENDER_LIST_PAGE + 1, Math.min(5, SENDER_LIST_PAGE * 2), 5]);
  assert.deepEqual(senderListView(rows, { group: 'archive' }).items.map((item) => item.id), ['a1']);
  /* Tühi rühm jääb valituks (inimene valis selle ise); tundmatu rühm annab vaikimisi rühma. */
  assert.equal(senderListView([row('d1')], { group: 'sent' }).group, 'sent');
  assert.equal(senderListView([row('d1')], { group: 'sent' }).total, 0);
  assert.equal(senderListView([row('d1')], { group: 'x' }).group, 'drafts');
  assert.equal(senderListView([row('a1', { status: 'ARCHIVED' })]).group, 'archive');
  assert.deepEqual([senderListView([]).group, senderListView(null).total], ['drafts', 0]);
  /* Järjekord rühma sees on see, mille server andis (uuem ees). */
  assert.deepEqual(senderListView(rows, { group: 'drafts', pageSize: 10 }).items.map((item) => item.id), ['d1', 'd2', 'd3', 'd4', 'd5']);
  /* Lehekülje suurus on mõõdetud nii, et loend koos lehe teatega mahub paneeli. */
  assert.ok(SENDER_LIST_PAGE >= 2 && SENDER_LIST_PAGE <= 3);
});

test('loendireal saab arhiveerida ainult saatmata mustandit', () => {
  assert.equal(senderRowCanArchive({ status: 'DRAFT' }), true);
  assert.equal(senderRowCanArchive({ status: 'READY' }), true);
  assert.equal(senderRowCanArchive({ status: 'DOWNLOADED' }), true);
  assert.equal(senderRowCanArchive({ status: 'ARCHIVED' }), false);
  for (const sent of [{ status: 'SENT', sentAt: SENT_AT }, { status: 'READY', sentAt: SENT_AT, openedAt: SENT_AT }]) {
    assert.equal(senderRowCanArchive(sent), false);
    /* Saadetud rida avaneb lugemisvaates, kus on tema enda tegevused. */
    assert.equal(senderCanEdit(sent), false);
  }
});

test('pikk tekst kokkuvõttes: algus, sõna pealt lõigatud', () => {
  assert.equal(excerptOf('Lühike tekst.', 120), 'Lühike tekst.');
  assert.equal(excerptOf('  Mitu   tühikut\n\nja reavahetus  ', 120), 'Mitu tühikut ja reavahetus');
  const long = 'Ema kukkus kaks nädalat tagasi ja ei saa enam üksi poes käia ega end pesta. Elan teises linnas ja jõuan tema juurde ainult nädalavahetustel.';
  const cut = excerptOf(long, 60);
  assert.ok(cut.length <= 61 && cut.endsWith('…'), cut);
  assert.ok(long.startsWith(cut.slice(0, -1)), 'lõige on teksti algus');
  assert.ok(!/[\s,;:.]…$/.test(cut), 'enne kolme punkti ei jää tühikut ega kirjavahemärki');
  assert.equal(long[cut.length - 1], ' ', 'lõige on sõna piiril');
  /* Tühikuteta pikk sõna lõigatakse märgi pealt, mitte ei kao. */
  assert.equal(excerptOf('a'.repeat(50), 10), `${'a'.repeat(10)}…`);
  assert.equal(excerptOf(null), '');
  assert.equal(excerptOf(42), '42');
});

test('loendi, lehekülgede ja avatavate plokkide tekstid on kataloogis kolmes keeles', () => {
  const keys = [
    'views.saved.groups', 'views.saved.group_sent', 'views.saved.group_drafts', 'views.saved.group_archive',
    'views.saved.empty_sent', 'views.saved.empty_drafts', 'views.saved.empty_archive', 'views.saved.changed',
    'views.pager.range', 'views.pager.prev', 'views.pager.next',
    'views.review.missing_line', 'views.review.all_answers', 'views.text.journey_fold', 'views.journey.fold',
    'actions.archive', 'actions.open', 'empty_saved'
  ];
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual(keys.filter((key) => typeof at(messages, key) !== 'string' || !at(messages, key).trim()), [], lang);
    for (const group of SENDER_LIST_GROUPS) assert.ok(messages.views.saved[`group_${group}`].includes('{count}'), `${lang}: ${group}`);
    for (const mark of ['{from}', '{to}', '{total}']) assert.ok(messages.views.pager.range.includes(mark), `${lang}: ${mark}`);
    assert.ok(messages.views.review.missing_line.includes('{items}'), lang);
    /* Eemaldatud vaadete tekstid ei jää kataloogi rippuma. */
    for (const gone of ['views.saved.more', 'views.saved.less', 'views.review.missing', 'overview.lead', 'overview.missing_hint', 'actions.copy_short']) {
      assert.equal(at(messages, gone), undefined, `${lang}: ${gone}`);
    }
  }
});
