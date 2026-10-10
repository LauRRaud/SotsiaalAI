// „Minu otsing” (/otsi): reeglid, mida silm brauseris kergesti ei märka.
//
// Leht otsib inimese enda vestlusi (sõnumi teksti järgi), Teekondi ja dokumente
// (pealkirja järgi) ja näitab neid ühes kuupäevajärjekorras. Brauseris
// leitud vead olid kõik seda laadi, et tavalise otsinguga neid ei näe: „Näita rohkem”
// küsis välja teksti järgi, mitte loendi oma; ebaõnnestunud juurde laadimine viskas
// read minema; otsing näitas pealkirja järgi dokumenti, mida dokumentide leht peidab;
// märgid % ja _ vastasid kõigele; kursorisse sai kirjutada mida tahes. Siin on need
// reeglid kinni: andmebaasi päringu kuju (võltsitud prisma), marsruudi vastused,
// lehe otsingu käik (components/search/searchState.js, võltsitud päringuga) ja
// kataloogi sõnad.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  APP_GIVEN_CONVERSATION_TITLES,
  PERSONAL_SEARCH_LIMITS,
  escapeLikePattern,
  isPersonalSearchCursorValue,
  matchExcerpt,
  normalizePersonalSearchCursor,
  searchPersonalObjects
} from '../lib/search/personalSearch.js';
import { activeFieldAttachmentDocumentWhere, openableDocumentWhere, visibleRecordingDocumentWhere } from '../lib/documents/recordingVisibility.js';
import { IDLE_VIEW, createSearchSession, faultFromResponse, mergeResults, requestSearchPage, resultKey, viewAfterFirstPage } from '../components/search/searchState.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`));
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const LANGS = ['et', 'en', 'ru'];
const PAGE = '../components/search/PersonalSearchPage.jsx';

const CUID = 'cmg1a2b3c0000abcd1234efgh';
const UUID = '0b0f3c1e-7a51-4c1e-9d55-2f1f6f1a9c10';
const JOURNEY_ID = `jrn_${'0123456789abcdef'.repeat(2).slice(0, 28)}`;

/* Võltsitud prisma: jätab meelde, mida küsiti, ja vastab antud ridadega või veaga. */
function fakePrisma({ rows = {}, fail = {} } = {}) {
  const calls = { conversation: [], journey: [], document: [] };
  const source = (kind) => ({
    findMany: async (args) => {
      calls[kind].push(args);
      if (fail[kind]) throw fail[kind];
      return rows[kind] || [];
    }
  });
  return { calls, conversation: source('conversation'), journey: source('journey'), userDocument: source('document') };
}
/* Read on allika enda järjekorras (uuem enne); `day` on kuupäev jaanuaris 2026. */
const journeyRows = (count, firstDay = 28) => Array.from({ length: count }, (_, index) => ({
  id: `jrn_${String(index).padStart(28, '0')}`, title: `Teekond ${index}`, status: 'ACTIVE', updatedAt: new Date(Date.UTC(2026, 0, firstDay - index))
}));
const documentRow = (id, day) => ({ id, title: `Dokument ${id}`, originalName: null, kind: 'MATERIAL', updatedAt: new Date(Date.UTC(2026, 0, day)) });
const conversationRow = (id, day, extra = {}) => ({ id, title: null, summary: null, isPinned: false, lastActivityAt: new Date(Date.UTC(2026, 0, day)), messages: [], ...extra });
const days = (answer) => answer.results.map((row) => Number(row.updatedAt.slice(8, 10)));
function enumValues(name) {
  const body = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(read('../prisma/schema.prisma'))?.[1] || '';
  return body.split(/\r?\n/).map((line) => line.replace(/\/\/.*$/, '').trim()).filter(Boolean);
}

test('otsitakse täpselt seda teksti, mis kirjutati: LIKE-märgid % ja _ ei ole metamärgid', async () => {
  assert.equal(escapeLikePattern('50%'), '50\\%');
  assert.equal(escapeLikePattern('a_b'), 'a\\_b');
  assert.equal(escapeLikePattern('C:\\kaust'), 'C:\\\\kaust');
  assert.equal(escapeLikePattern('toimetulekutoetus'), 'toimetulekutoetus');

  const prisma = fakePrisma();
  await searchPersonalObjects({ prisma, userId: 'user-1', query: '50%_a' });
  const escaped = { contains: '50\\%\\_a', mode: 'insensitive' };
  const titleFilters = [
    prisma.calls.journey[0].where.AND[0].OR,
    prisma.calls.document[0].where.AND[0].OR
  ].flat();
  assert.equal(titleFilters.length, 3, 'Teekonna pealkiri, dokumendi pealkiri ja failinimi');
  for (const filter of titleFilters) {
    const [field] = Object.values(filter);
    assert.deepEqual(field, escaped);
  }
  /* Vestlus: pealkiri, kokkuvõte, sõnumi tekst ja rea lõigu jaoks loetav sõnum. */
  const [byTitle, bySummary, byMessage] = prisma.calls.conversation[0].where.AND[0].OR;
  assert.deepEqual(byTitle.AND[0], { title: escaped });
  assert.deepEqual(bySummary, { summary: escaped });
  assert.deepEqual(byMessage, { messages: { some: { content: escaped } } });
  assert.deepEqual(prisma.calls.conversation[0].select.messages.where, { content: escaped });
});

test('dokumenti otsitakse samade tingimustega, millega dokumendi leht selle avab', async () => {
  /* Ühine tingimus on kahe osa summa ja mõlemad osad on päriselt olemas. */
  assert.deepEqual(openableDocumentWhere(), { ...visibleRecordingDocumentWhere(), ...activeFieldAttachmentDocumentWhere() });
  assert.deepEqual(openableDocumentWhere().callRecordingFiles, { none: { status: { in: ['DELETE_PENDING', 'QUARANTINED'] } } });
  assert.deepEqual(openableDocumentWhere().fieldVisitAttachments, { none: { storageStatus: { not: 'ACTIVE' } } });

  const prisma = fakePrisma();
  await searchPersonalObjects({ prisma, userId: 'user-1', query: 'salvestis' });
  const where = prisma.calls.document[0].where;
  assert.equal(where.ownerId, 'user-1', 'omaniku piir jääb');
  for (const [key, value] of Object.entries(openableDocumentWhere())) assert.deepEqual(where[key], value, key);

  /* Mitte koopia: otsing ja dokumendi marsruudid võtavad tingimuse ühest kohast. */
  assert.ok(read('../lib/search/personalSearch.js').includes('...openableDocumentWhere()'));
  for (const route of ['route.js', 'download/route.js', 'audio-select/route.js', 'transcribe/route.js']) {
    const source = read(`../app/api/documents/[id]/${route}`);
    assert.ok(source.includes('...openableDocumentWhere()'), `${route} kasutab ühist tingimust`);
    assert.ok(!source.includes('fieldVisitAttachments: {'), `${route}: tingimuse koopiat ei ole`);
  }
});

test('rakenduse enda pandud pealkiri ei ole vestluse pealkiri', async () => {
  const prisma = fakePrisma();
  await searchPersonalObjects({ prisma, userId: 'user-1', query: 'sisepiloot' });
  const where = prisma.calls.conversation[0].where;
  assert.deepEqual(where.AND[0].OR[0].AND[1], { NOT: { title: { in: [...APP_GIVEN_CONVERSATION_TITLES] } } });
  assert.equal(where.userId, 'user-1');
  assert.equal(where.archivedAt, null);

  /* Iga pealkiri, mille piloodi rada vestlusele kirjutab, peab loendis olema: muidu
     loetleb otsing kõik vestlused selle sisemise nime all. */
  const written = [...read('../lib/chat/m4PilotServer.js').matchAll(/conversation\.create\(\{[^\n]*?\btitle: ['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.ok(written.length >= 1, `piloodi rada kirjutab pealkirja ${written.length} kohas`);
  assert.deepEqual(written.filter((title) => !APP_GIVEN_CONVERSATION_TITLES.includes(title)), []);

  /* Sõnumist leitud vestlus ei kanna rakenduse pandud pealkirja: rea nimi on lõik sõnumist. */
  const found = await searchPersonalObjects({
    prisma: fakePrisma({ rows: { conversation: [conversationRow(CUID, 9, { title: 'M4 sisepiloot', messages: [{ content: 'Kuidas taotleda toimetulekutoetust?' }] })] } }),
    userId: 'user-1', query: 'toimetulekutoetust'
  });
  assert.equal(found.results[0].title, null);
  assert.equal(found.results[0].excerpt, 'Kuidas taotleda toimetulekutoetust?');
});

test('vestlus leitakse sõnumi tekstist ja rida näitab lõiku otsisõna ümbert', async () => {
  const long = `${'Algus on pikk jutt, mis ei puutu asjasse. '.repeat(6)}Siis tuli jutuks **rabakivi** tänava maja ja selle küte. ${'Lõpp on samuti pikk ja asjasse ei puutu. '.repeat(6)}`;
  const excerpt = matchExcerpt(long, 'RABAKIVI');
  assert.ok(excerpt.includes('rabakivi tänava'), excerpt);
  assert.ok(!excerpt.includes('*'), 'vormindusmärke lõigus ei ole');
  assert.ok(excerpt.startsWith('…') && excerpt.endsWith('…'), 'lõigatud otsad on tähistatud');
  assert.ok(excerpt.length <= PERSONAL_SEARCH_LIMITS.excerptLength + 2, String(excerpt.length));
  assert.ok(!/^…\S*\s?$/.test(excerpt) && !/\s…$/.test(excerpt), excerpt);
  /* Lühike tekst jääb terveks; reavahetused ja pealkirjamärgid kaovad. */
  assert.equal(matchExcerpt('# Pealkiri\n\n> tsitaat `kood`\nrida', 'kood'), 'Pealkiri tsitaat kood rida');
  assert.equal(matchExcerpt('', 'abc'), '');
  assert.equal(matchExcerpt(null, 'abc'), '');
  /* Sõna, mida lõigust ei leia (andmebaas leidis teise tähekujuga): teksti algus. */
  assert.ok(matchExcerpt(long, 'zzz').startsWith('Algus on pikk jutt'));
  /* Väga pikk otsisõna ei vii lõiget tekstist välja. */
  assert.ok(matchExcerpt(long, 'x'.repeat(120)).length > 0);

  const rows = [
    conversationRow('conv-a', 9, { title: 'Minu pandud nimi', messages: [{ content: 'Räägime sellest, kuidas rabakivi maja kütta.' }] }),
    conversationRow('conv-b', 8, { title: 'Rabakivi maja', messages: [{ content: 'rabakivi' }] }),
    conversationRow('conv-c', 7, { summary: 'Kokkuvõte: rabakivi tänava pere.' }),
    conversationRow('conv-d', 6, { isPinned: true, messages: [{ content: 'rabakivi' }] })
  ];
  const answer = await searchPersonalObjects({ prisma: fakePrisma({ rows: { conversation: rows } }), userId: 'user-1', query: 'rabakivi' });
  assert.deepEqual(answer.results.map((row) => [row.title, row.excerpt, row.status]), [
    ['Minu pandud nimi', 'Räägime sellest, kuidas rabakivi maja kütta.', 'ACTIVE'],
    ['Rabakivi maja', null, 'ACTIVE'],
    [null, 'Kokkuvõte: rabakivi tänava pere.', 'ACTIVE'],
    [null, 'rabakivi', 'PINNED']
  ]);
  assert.deepEqual(Object.keys(answer.results[0]).sort(), ['excerpt', 'href', 'kind', 'status', 'title', 'updatedAt']);
  /* Sõnumi teksti rida ei kanna: ainult lõik. */
  assert.ok(!JSON.stringify(answer.results).includes('messages'));
});

test('kursor on rea id: muu kujuga väärtus ei jõua andmebaasi', async () => {
  for (const value of [CUID, UUID, JOURNEY_ID, '__done__', 'a1', 'a'.repeat(200)]) assert.equal(isPersonalSearchCursorValue(value), true, value);
  const bad = ['', '\u0000', `${CUID}\u0000`, 'a b c d e f', "x' OR 1=1 --", '%', '_%', 'täpitäht', `${CUID}\n`, 'a'.repeat(201), 12345678, { id: CUID }, [CUID], null, undefined];
  for (const value of bad) assert.equal(isPersonalSearchCursorValue(value), false, String(value));
  assert.deepEqual(normalizePersonalSearchCursor({ conversation: UUID, journey: '\u0000', document: '__done__', extra: CUID }), { conversation: UUID, journey: null, document: '__done__' });
  assert.deepEqual(normalizePersonalSearchCursor('tekst'), { conversation: null, journey: null, document: null });

  const prisma = fakePrisma();
  await searchPersonalObjects({ prisma, userId: 'user-1', query: 'abc', cursor: { conversation: UUID, journey: '\u0000', document: '__done__' } });
  assert.deepEqual(prisma.calls.conversation[0].cursor, { id: UUID });
  assert.equal(prisma.calls.conversation[0].skip, 1);
  assert.equal('cursor' in prisma.calls.journey[0], false, 'vigane kursor: Teekonnad algavad esimesest lehest');
  assert.equal(prisma.calls.document.length, 0, 'lõpuni loetud allikat uuesti ei küsita');
});

test('leht on 20 rida kokku ja järgmise lehe kursor on allika viimase näidatud rea id', async () => {
  const size = PERSONAL_SEARCH_LIMITS.pageSize;
  assert.equal(size, 20);
  const rows = journeyRows(size + 1);
  const prisma = fakePrisma({ rows: { journey: rows } });
  const answer = await searchPersonalObjects({ prisma, userId: 'user-1', query: 'teekond' });
  assert.equal(prisma.calls.journey[0].take, size + 1, 'küsitakse lehe jagu ja üks peale');
  assert.equal(answer.results.length, size);
  assert.equal(answer.partial, false);
  assert.deepEqual(answer.pagination, { hasMore: true, nextCursor: { conversation: '__done__', journey: rows[size - 1].id, document: '__done__' } });
  assert.deepEqual(Object.keys(answer.results[0]).sort(), ['href', 'kind', 'status', 'title', 'updatedAt']);
  /* Täpselt lehe jagu ridu: rohkem ei ole. */
  const exact = await searchPersonalObjects({ prisma: fakePrisma({ rows: { journey: journeyRows(size) } }), userId: 'user-1', query: 'teekond' });
  assert.equal(exact.results.length, size);
  assert.deepEqual(exact.pagination, { hasMore: false, nextCursor: { conversation: '__done__', journey: '__done__', document: '__done__' } });
});

test('read on ühes kuupäevajärjekorras üle allikate ja „Näita rohkem” jätkab sama järjekorda', async () => {
  /* Kolm allikat, igaühes rohkem kui lehe jagu ridu, kuupäevad põimuvad:
     vestlused 30, 27, 24 …; Teekonnad 29, 26, 23 …; dokumendid 28, 25, 22 … (jaanuar ei ulatu, aga
     kuupäev võib minna ka eelmisse kuusse: võrreldakse aega, mitte päeva numbrit). */
  const at = (first, index) => first - index * 3;
  const conversations = Array.from({ length: 21 }, (_, index) => conversationRow(`conv-${String(index).padStart(2, '0')}`, at(30, index), { messages: [{ content: 'abc' }] }));
  const journeys = Array.from({ length: 21 }, (_, index) => ({ id: `jrn_${String(index).padStart(28, '0')}`, title: `Teekond ${index}`, status: 'ACTIVE', updatedAt: new Date(Date.UTC(2026, 0, at(29, index))) }));
  const documents = Array.from({ length: 21 }, (_, index) => documentRow(`doc-${String(index).padStart(2, '0')}`, at(28, index)));
  const first = await searchPersonalObjects({ prisma: fakePrisma({ rows: { conversation: conversations, journey: journeys, document: documents } }), userId: 'user-1', query: 'abc' });
  const times = first.results.map((row) => Date.parse(row.updatedAt));
  assert.equal(first.results.length, 20);
  assert.deepEqual(times, [...times].sort((a, b) => b - a), 'esimene leht on ajas kahanev');
  assert.deepEqual(first.results.slice(0, 6).map((row) => row.kind), ['conversation', 'journey', 'document', 'conversation', 'journey', 'document']);
  /* 20 rida = 7 vestlust, 7 Teekonda, 6 dokumenti; iga allikas jätkab oma viimasest näidatud reast. */
  assert.deepEqual(first.pagination, { hasMore: true, nextCursor: { conversation: 'conv-06', journey: journeys[6].id, document: 'doc-05' } });

  /* Järgmine leht: andmebaas annab iga allika read kursorist edasi; ükski uus rida ei ole uuem kui esimese lehe viimane. */
  const second = await searchPersonalObjects({
    prisma: fakePrisma({ rows: { conversation: conversations.slice(7), journey: journeys.slice(7), document: documents.slice(6) } }),
    userId: 'user-1', query: 'abc', cursor: first.pagination.nextCursor
  });
  const later = second.results.map((row) => Date.parse(row.updatedAt));
  assert.ok(later[0] <= times.at(-1), 'teise lehe esimene rida ei ole uuem kui esimese lehe viimane');
  assert.deepEqual(later, [...later].sort((a, b) => b - a));
  const seen = new Set(first.results.map(resultKey));
  assert.deepEqual(second.results.filter((row) => seen.has(resultKey(row))), [], 'ükski rida ei kordu');
});

test('allikas, mille ridu lehele ei mahtunud, jääb oma kohale ja teda küsitakse uuesti', async () => {
  /* 21 uut Teekonda ja kaks vana dokumenti: esimene leht on ainult Teekonnad. */
  const journeys = journeyRows(21, 28);
  const documents = [documentRow('doc-old-1', 2), documentRow('doc-old-2', 1)];
  const first = await searchPersonalObjects({ prisma: fakePrisma({ rows: { journey: journeys, document: documents } }), userId: 'user-1', query: 'abc' });
  assert.deepEqual([...new Set(first.results.map((row) => row.kind))], ['journey']);
  /* Dokumentidest ei võetud midagi: kursor jääb algusesse (null), aga „veel on”. */
  assert.deepEqual(first.pagination, { hasMore: true, nextCursor: { conversation: '__done__', journey: journeys[19].id, document: null } });

  const prisma = fakePrisma({ rows: { journey: journeys.slice(20), document: documents } });
  const second = await searchPersonalObjects({ prisma, userId: 'user-1', query: 'abc', cursor: first.pagination.nextCursor });
  assert.equal(prisma.calls.conversation.length, 0, 'lõpuni loetud allikat ei küsita');
  assert.equal('cursor' in prisma.calls.document[0], false, 'dokumendid algavad oma esimesest reast');
  assert.deepEqual(second.results.map((row) => row.kind), ['journey', 'document', 'document']);
  assert.deepEqual(days(second), [8, 2, 1]);
  assert.deepEqual(second.pagination, { hasMore: false, nextCursor: { conversation: '__done__', journey: '__done__', document: '__done__' } });
});

test('lugemata jäänud allikas on nimetatud, jätkab samast kohast ja seda saab uuesti küsida', async () => {
  const quiet = new Error('connection reset');
  const first = await searchPersonalObjects({ prisma: fakePrisma({ rows: { conversation: [] }, fail: { journey: quiet } }), userId: 'user-1', query: 'tuhkpuu' });
  assert.deepEqual(first.results, []);
  assert.equal(first.partial, true);
  assert.deepEqual(first.unavailableKinds, ['journey']);
  /* Ridu ei ole, aga „veel on”: muidu saaks lugemata allikat küsida ainult uue otsinguga. */
  assert.deepEqual(first.pagination, { hasMore: true, nextCursor: { conversation: '__done__', journey: null, document: '__done__' } });

  const later = await searchPersonalObjects({
    prisma: fakePrisma({ fail: { journey: quiet } }), userId: 'user-1', query: 'tuhkpuu',
    cursor: { conversation: UUID, journey: JOURNEY_ID, document: '__done__' }
  });
  assert.equal(later.pagination.nextCursor.journey, JOURNEY_ID, 'ebaõnnestunud allika kursor jääb alles');
  assert.equal(later.pagination.hasMore, true);
});

test('kui ükski loetud allikas ei vastanud, on see viga, mitte tühi vastus', async () => {
  const down = new Error('database is down');
  const allDown = fakePrisma({ fail: { conversation: down, journey: down, document: down } });
  await assert.rejects(searchPersonalObjects({ prisma: allDown, userId: 'user-1', query: 'abc' }), /PERSONAL_SEARCH_ALL_SOURCES_UNAVAILABLE/);
  /* Juurde laadimisel loetakse ainult lõpetamata allikaid: kui need kõik kukuvad, on see samuti viga. */
  const onlyJourney = fakePrisma({ fail: { journey: down } });
  await assert.rejects(
    searchPersonalObjects({ prisma: onlyJourney, userId: 'user-1', query: 'abc', cursor: { conversation: '__done__', journey: JOURNEY_ID, document: '__done__' } }),
    /PERSONAL_SEARCH_ALL_SOURCES_UNAVAILABLE/
  );
  /* Ligipääsuviga ei ole „osaline vastus”: see lükkab kogu päringu tagasi. */
  const forbidden = Object.assign(new Error('FORBIDDEN'), { status: 403 });
  await assert.rejects(searchPersonalObjects({ prisma: fakePrisma({ fail: { journey: forbidden } }), userId: 'user-1', query: 'abc' }), (error) => error === forbidden);
});

test('marsruut: kadunud seanss, kiirusepiir ja tegemata otsing on eri vastused', async () => {
  const { POST } = await import('../app/api/otsi/route.js');
  const request = (body) => new Request('http://local/api/otsi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const signedIn = async () => ({ ok: true, userId: 'user-1' });
  const allowed = async () => ({ allowed: true });

  const lost = await POST(request({ query: 'abc' }), { requireUser: async () => ({ ok: false, status: 401, message: 'api.common.unauthorized' }) });
  assert.equal(lost.status, 401);
  assert.equal((await lost.json()).messageKey, 'api.common.unauthorized');

  const limited = await POST(request({ query: 'abc' }), { requireUser: signedIn, enforceRateLimit: async () => ({ allowed: false, retryAfterSeconds: 17 }), prisma: {} });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '17');

  const partial = await POST(request({ query: 'abc', cursor: { journey: '\u0000' } }), {
    requireUser: signedIn, enforceRateLimit: allowed, prisma: fakePrisma({ rows: { journey: journeyRows(2) }, fail: { document: new Error('x') } })
  });
  const partialBody = await partial.json();
  assert.equal(partial.status, 200);
  assert.equal(partialBody.partial, true);
  assert.deepEqual(partialBody.unavailableKinds, ['document']);
  assert.equal(partialBody.results.length, 2);

  const down = new Error('database is down');
  const logged = console.error;
  console.error = () => {};
  try {
    const failed = await POST(request({ query: 'abc' }), {
      requireUser: signedIn, enforceRateLimit: allowed, prisma: fakePrisma({ fail: { conversation: down, journey: down, document: down } })
    });
    assert.equal(failed.status, 500);
    assert.deepEqual(await failed.json(), { ok: false, messageKey: 'api.search.unavailable' });
  } finally {
    console.error = logged;
  }
});

test('juurde laetud read liituvad lõppu ja esimene uus rida on teada', () => {
  const row = (kind, id, title = id) => ({ kind, href: `/${kind}/${id}`, title });
  const shown = [row('journey', 'a'), row('document', 'b')];
  const merged = mergeResults(shown, [row('document', 'b', 'uuem'), row('journey', 'c'), row('journey', 'd')]);
  assert.deepEqual(merged.rows.map(resultKey), ['journey:/journey/a', 'document:/document/b', 'journey:/journey/c', 'journey:/journey/d']);
  assert.equal(merged.rows[1].title, 'uuem', 'juba nähtud siht jääb oma kohale');
  assert.equal(merged.added, 2);
  assert.equal(merged.firstNewIndex, 2, 'fookus läheb esimesele uuele reale');
  assert.deepEqual(shown.map((item) => item.title), ['a', 'b'], 'ekraanil olnud loendit ei muudeta kohapeal');

  const nothingNew = mergeResults(shown, [row('journey', 'a')]);
  assert.equal(nothingNew.added, 0);
  assert.equal(nothingNew.firstNewIndex, -1, 'uusi ridu ei ole: fookus läheb loendile');
  assert.deepEqual(mergeResults(null, undefined), { rows: [], added: 0, firstNewIndex: -1 });
});

test('keeldumisel on oma lause: kiirusepiir ütleb aja, kadunud seanss saadab sisse logima', () => {
  assert.deepEqual(faultFromResponse(401), { kind: 'session', seconds: 0 });
  assert.deepEqual(faultFromResponse(429, '17'), { kind: 'rate', seconds: 17 });
  assert.deepEqual(faultFromResponse(429, '0.2'), { kind: 'rate', seconds: 1 });
  assert.deepEqual(faultFromResponse(429, null), { kind: 'rate', seconds: 0 });
  assert.deepEqual(faultFromResponse(429, 'Wed, 21 Oct 2026 07:28:00 GMT'), { kind: 'rate', seconds: 0 }, 'kuupäeva kuju: aega ei arvata');
  assert.deepEqual(faultFromResponse(429, '999999'), { kind: 'rate', seconds: 3600 });
  for (const status of [500, 503, 400, 403, 0, undefined]) assert.deepEqual(faultFromResponse(status), { kind: 'general', seconds: 0 }, String(status));
});

test('osaline vastus ilma ridadeta ei ole „vasteid ei leitud”', () => {
  assert.equal(viewAfterFirstPage({ rows: [{}], unavailableKinds: [] }), 'results');
  assert.equal(viewAfterFirstPage({ rows: [{}], unavailableKinds: ['journey'] }), 'results');
  assert.equal(viewAfterFirstPage({ rows: [], unavailableKinds: [] }), 'empty');
  assert.equal(viewAfterFirstPage({ rows: [], unavailableKinds: ['journey'] }), 'partial-empty');
  assert.equal(viewAfterFirstPage(), 'empty');
});

test('lehe tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const match of read(PAGE).matchAll(/\bt\(\s*"((?:personal_search|api\.common)\.[a-z_.0-9]+)"/g)) keys.add(match[1]);
  assert.ok(keys.size >= 20, `võtmeid leiti ${keys.size}`);
  for (const key of ['api.common.unauthorized', 'personal_search.scope', 'personal_search.more_error', 'personal_search.partial_empty', 'personal_search.rate_limited', 'personal_search.rate_limited_wait', 'personal_search.sign_in']) {
    assert.ok(keys.has(key), `leht kasutab võtit ${key}`);
  }
  for (const lang of LANGS) {
    const messages = catalog(lang);
    assert.deepEqual([...keys].filter((key) => typeof at(messages, key) !== 'string'), [], lang);
    assert.ok(messages.personal_search.rate_limited_wait.includes('{seconds}'), `${lang}: ooteaeg on lauses`);
    assert.ok(messages.personal_search.partial_empty.includes('{kinds}') && messages.personal_search.partial.includes('{kinds}'), `${lang}: lugemata allikas on nimetatud`);
    assert.ok(messages.personal_search.found.includes('{count}') && messages.personal_search.added.includes('{added}') && messages.personal_search.added.includes('{count}'), `${lang}: arvud on lauses`);
  }
});

test('igal liigil ja seisul, mille otsing võib tagastada, on sõna kolmes keeles', () => {
  /* Võtmed pannakse kokku jooksvalt (`personal_search.status.${…}`), kataloogi kontroll
     neid ei näe: siin käiakse läbi skeemi enda loendid. */
  const documentKinds = enumValues('DocumentKind');
  const journeyStatuses = enumValues('JourneyStatus');
  assert.ok(documentKinds.includes('FIELD_PHOTO') && documentKinds.includes('SERVICE_LOG_REPORT') && documentKinds.length >= 10, documentKinds.join(','));
  assert.deepEqual(journeyStatuses.sort(), ['ACTIVE', 'ARCHIVED', 'DRAFT']);
  const statuses = [...documentKinds, ...journeyStatuses, 'PINNED', 'ACTIVE'].map((value) => value.toLowerCase());
  for (const lang of LANGS) {
    const words = catalog(lang).personal_search;
    assert.deepEqual(statuses.filter((value) => typeof words.status[value] !== 'string' || !words.status[value]), [], `${lang}: seisud`);
    for (const kind of ['conversation', 'journey', 'document']) {
      assert.ok(words.kinds[kind] && words.untitled[kind], `${lang}: ${kind}`);
    }
  }
});

test('eestikeelsetes tekstides ei ole mõttekriipsu ega sirgeid jutumärke', () => {
  const walk = (node) => Object.values(node).flatMap((value) => (typeof value === 'string' ? [value] : walk(value)));
  for (const text of walk(catalog('et').personal_search)) {
    assert.ok(!/[\u2013\u2014"]/.test(text), text);
  }
  assert.ok(/[\u0400-\u04FF]/.test(catalog('ru').personal_search.scope), 'vene tekst on kirillitsas');
});

/* Võltsitud päring otsingu käigu jaoks: jätab meelde, mida küsiti, ja vastab järjekorras
   ette antud vastustega (vastus võib olla ka lubadus, mille test ise lahendab). */
function fakeRequest(answers) {
  const sent = [];
  const queue = [...answers];
  const request = async (body, signal) => {
    sent.push({ body: JSON.parse(JSON.stringify(body)), signal });
    return queue.shift();
  };
  return { sent, request };
}
const page1 = (rows, extra = {}) => ({ ok: true, rows, hasMore: true, nextCursor: { conversation: UUID, journey: JOURNEY_ID, document: '__done__' }, unavailable: [], ...extra });
const hit = (id, kind = 'journey') => ({ kind, href: `/${kind}/${id}`, title: `Rida ${id}`, status: 'ACTIVE', updatedAt: '2026-10-01T08:00:00.000Z' });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('„Näita rohkem” laeb juurde ekraanil oleva loendi ridu, ükskõik mis väljal seisab', async () => {
  const views = [];
  const { sent, request } = fakeRequest([
    page1([hit('a'), hit('b')]),
    { ok: true, rows: [hit('c')], hasMore: false, nextCursor: { conversation: '__done__', journey: '__done__', document: '__done__' }, unavailable: [] }
  ]);
  const session = createSearchSession({ request, onChange: (view) => views.push(view) });
  assert.equal(session.view(), IDLE_VIEW);

  await session.search('  rabakivi ');
  assert.deepEqual(sent[0].body, { query: 'rabakivi', cursor: null });
  assert.equal(session.view().state, 'results');
  assert.deepEqual(session.view().announce, { append: false, added: 2, total: 2, hasMore: true });

  /* Inimene muudab välja teksti või teeb selle tühjaks ja vajutab „Näita rohkem”:
     käik ei tea väljast midagi ja ka kaasa antud tekst (või vajutuse sündmus) ei loe. */
  await session.loadMore('Rabakivi vestlus nr 1');
  assert.deepEqual(sent[1].body, { query: 'rabakivi', cursor: { conversation: UUID, journey: JOURNEY_ID, document: '__done__' } });
  assert.equal(session.shownQuery(), 'rabakivi');
  const view = session.view();
  assert.deepEqual(view.results.map((item) => item.href), ['/journey/a', '/journey/b', '/journey/c']);
  assert.equal(view.hasMore, false);
  assert.deepEqual(view.announce, { append: true, added: 1, total: 3, hasMore: false }, 'lisandunud ridade arv on teada');
  assert.deepEqual(view.appended, { firstNewIndex: 2 }, 'fookus läheb esimesele uuele reale');
  assert.ok(views.some((item) => item.loadingMore === true) && view.loadingMore === false);

  /* Leht annab nupule käigu enda funktsiooni ja otsib välja tekstiga ainult vormi saatmisel. */
  const page = read(PAGE);
  assert.ok(page.includes('onClick={session.loadMore}'));
  assert.equal(page.split('session.search(').length - 1, 1, 'välja tekst läheb otsingusse ühes kohas');
  assert.ok(page.includes('const onSubmit = (event) => { event.preventDefault(); session.search(query); };'));
});

test('ebaõnnestunud juurde laadimine jätab read alles ja uus vajutus küsib sama lehte', async () => {
  const first = page1([hit('a'), hit('b')], { unavailable: ['document'] });
  const { sent, request } = fakeRequest([
    first,
    { ok: false, fault: faultFromResponse(500) },
    { ok: false, fault: faultFromResponse(429, '12') },
    { ok: true, rows: [hit('c'), hit('a')], hasMore: true, nextCursor: { conversation: CUID, journey: '__done__', document: '__done__' }, unavailable: [] }
  ]);
  const session = createSearchSession({ request });
  await session.search('rabakivi');

  await session.loadMore();
  let view = session.view();
  assert.equal(view.state, 'results', 'vaade ei vahetu veavaateks');
  assert.deepEqual(view.results, first.rows, 'juba laetud read on alles');
  assert.equal(view.hasMore, true);
  assert.deepEqual(view.unavailableKinds, ['document'], 'loendi kohta käiv teade jääb');
  assert.deepEqual(view.moreFault, { kind: 'general', seconds: 0 });
  assert.equal(view.fault, null);
  assert.equal(view.loadingMore, false);

  await session.loadMore();
  assert.deepEqual(sent[2].body, sent[1].body, '„Proovi uuesti” küsib sama lehte sama kursoriga');
  assert.deepEqual(session.view().moreFault, { kind: 'rate', seconds: 12 });
  assert.deepEqual(session.view().results, first.rows);

  await session.loadMore();
  assert.deepEqual(sent[3].body, sent[1].body);
  view = session.view();
  assert.equal(view.moreFault, null);
  assert.deepEqual(view.results.map((item) => item.href), ['/journey/a', '/journey/b', '/journey/c']);
  assert.deepEqual(view.unavailableKinds, [], 'vahepeal lugemata jäänud allikas tuli kätte: teade kaob');
  assert.equal(sent.length, 4);
});

test('teine vajutus, kui esimene veel käib, ei saada teist päringut', async () => {
  const slow = deferred();
  const lastPage = { ok: true, rows: [hit('c')], hasMore: false, nextCursor: { conversation: '__done__', journey: '__done__', document: '__done__' }, unavailable: [] };
  const { sent, request } = fakeRequest([page1([hit('a')]), slow.promise, lastPage]);
  const session = createSearchSession({ request });
  await session.search('rabakivi');
  const pressed = session.loadMore();
  const pressedAgain = session.loadMore();
  assert.equal(sent.length, 2, 'üks otsing ja üks juurde laadimine');
  slow.resolve(page1([hit('b')], { nextCursor: { conversation: CUID, journey: '__done__', document: '__done__' } }));
  await Promise.all([pressed, pressedAgain]);
  assert.equal(session.view().results.length, 2);
  await session.loadMore();
  assert.equal(sent.length, 3, 'pärast vastust saab uuesti küsida');
  assert.deepEqual(sent[2].body.cursor, { conversation: CUID, journey: '__done__', document: '__done__' }, 'järgmine leht küsitakse uue kursoriga');
  /* Viimane leht on käes: rohkem ei küsita (kursorita päring algaks jälle esimesest lehest). */
  await session.loadMore();
  assert.equal(sent.length, 3);
  assert.equal(session.view().results.length, 3);
});

test('uus otsing algab ilma eelmise otsingu teadeteta ja hiljaks jäänud vastust ei rakendata', async () => {
  const slowMore = deferred();
  const slowSearch = deferred();
  const { sent, request } = fakeRequest([
    page1([hit('a')], { unavailable: ['journey'] }),
    slowMore.promise,
    slowSearch.promise,
    { ok: false, fault: faultFromResponse(500) }
  ]);
  const session = createSearchSession({ request });
  await session.search('rabakivi');
  assert.deepEqual(session.view().unavailableKinds, ['journey']);

  const more = session.loadMore();
  const next = session.search('tuhkpuu');
  /* Kohe, enne vastust: vana teade ja vana loend ei seisa uue otsingu ees. */
  assert.deepEqual(session.view(), { ...IDLE_VIEW, state: 'loading' });
  assert.equal(sent[1].signal.aborted, true, 'pooleli juurde laadimine katkestati');
  slowMore.resolve({ ok: true, rows: [hit('vana')], hasMore: true, nextCursor: null, unavailable: [] });
  await more;
  assert.equal(session.view().state, 'loading', 'katkestatud päringu vastus ei jõua ekraanile');
  slowSearch.resolve({ ok: true, rows: [hit('t')], hasMore: false, nextCursor: null, unavailable: [] });
  await next;
  assert.deepEqual(session.view().results.map((item) => item.href), ['/journey/t']);
  assert.equal(session.view().loadingMore, false, 'katkestatud juurde laadimine ei jäta nuppu kinni');

  /* Ebaõnnestunud otsing: eelmise otsingu read ja teated ei jää uue vea kõrvale. */
  await session.search('kolmas');
  assert.deepEqual(session.view(), { ...IDLE_VIEW, state: 'error', fault: { kind: 'general', seconds: 0 } });
  await session.loadMore();
  assert.equal(sent.length, 4, 'veavaates ei ole loendit, mille kohta juurde küsida');
});

test('osaline vastus ilma ridadeta: ei öelda „vasteid ei leitud” ja sama otsingut saab korrata', async () => {
  const { sent, request } = fakeRequest([
    { ok: true, rows: [], hasMore: true, nextCursor: { conversation: '__done__', journey: null, document: '__done__' }, unavailable: ['journey'] },
    { ok: true, rows: [], hasMore: false, nextCursor: null, unavailable: [] }
  ]);
  const session = createSearchSession({ request });
  await session.search('tuhkpuu');
  assert.equal(session.view().state, 'partial-empty');
  assert.deepEqual(session.view().unavailableKinds, ['journey']);
  await session.retry();
  assert.deepEqual(sent[1].body, { query: 'tuhkpuu', cursor: null });
  assert.equal(session.view().state, 'empty', 'kõik allikad loetud ja ridu ei ole: nüüd on „vasteid ei leitud” tõsi');
});

test('tühi väli ei saada päringut ja viib vaate algseisu', async () => {
  const { sent, request } = fakeRequest([page1([hit('a')])]);
  const session = createSearchSession({ request });
  await session.search('rabakivi');
  await session.search('   ');
  assert.equal(session.view(), IDLE_VIEW);
  await session.loadMore();
  assert.equal(sent.length, 1);
});

test('päring serverile: keha, vastuse lugemine ja keeldumised', async () => {
  const calls = [];
  const answerWith = (response) => async (url, init) => { calls.push({ url, init }); return response; };
  const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

  const ok = await requestSearchPage({ query: 'abc', cursor: null }, undefined, answerWith(json({
    ok: true, results: [hit('a')], partial: true, unavailableKinds: ['document'], pagination: { hasMore: true, nextCursor: { conversation: UUID, journey: null, document: null } }
  })));
  assert.equal(calls[0].url, '/api/otsi');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { query: 'abc', cursor: null });
  assert.deepEqual(ok, { ok: true, rows: [hit('a')], hasMore: true, nextCursor: { conversation: UUID, journey: null, document: null }, unavailable: ['document'] });

  const body = { query: 'abc', cursor: null };
  assert.deepEqual(await requestSearchPage(body, undefined, answerWith(json({ ok: false, messageKey: 'api.common.rate_limited' }, 429, { 'Retry-After': '31' }))), { ok: false, fault: { kind: 'rate', seconds: 31 } });
  assert.deepEqual(await requestSearchPage(body, undefined, answerWith(json({ ok: false, messageKey: 'api.common.unauthorized' }, 401))), { ok: false, fault: { kind: 'session', seconds: 0 } });
  assert.deepEqual(await requestSearchPage(body, undefined, answerWith(json({ ok: false, messageKey: 'api.search.unavailable' }, 500))), { ok: false, fault: { kind: 'general', seconds: 0 } });
  assert.deepEqual(await requestSearchPage(body, undefined, answerWith(new Response('<html>', { status: 502 }))), { ok: false, fault: { kind: 'general', seconds: 0 } });
  assert.deepEqual(await requestSearchPage(body, undefined, answerWith(json({ ok: false }, 200))), { ok: false, fault: { kind: 'general', seconds: 0 } }, 'ok:true puudub');
  /* Võrguviga: brauseri enda tekst („Failed to fetch”) ekraanile ei jõua. */
  const offline = await requestSearchPage(body, undefined, async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(offline, { ok: false, fault: { kind: 'general', seconds: 0 } });
  const aborted = await requestSearchPage(body, undefined, async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }); });
  assert.deepEqual(aborted, { aborted: true });
});

test('leht hoiab oma lubadusi: kuuldav seis, fookus, oma laused keeldumisele', () => {
  const page = read(PAGE);
  /* Seis on kuuldav: rida on alati lehel, mitte display:none; status-rolli ei ole. */
  assert.ok(page.includes('aria-live="polite"') && !page.includes('role="status"'));
  assert.ok(page.includes('className={statusVisible ? styles.status : "sr-only"}'), 'tühi või ainult kuuldav rida jääb lehele, ruumi võtmata');
  assert.ok(!/\.status:empty/.test(read('../components/search/search.module.css')), 'tühi seisu rida ei ole display:none');
  /* Pärast juurde laadimist saab fookuse esimene uus rida või loend, aga ainult siis,
     kui inimene ei ole vahepeal mujale läinud. */
  assert.ok(page.includes('(row || list).focus()') && page.includes('focusIsFree(moreActionRef.current)'));
  assert.ok(page.includes('<ol ref={listRef} tabIndex={-1}'), 'loend saab fookuse võtta');
  /* Vea korral jääb sama nupp paigale: sama element, teine silt. */
  assert.ok(page.includes('loadingMore ? t("personal_search.loading_more") : moreFault ? t("personal_search.retry") : t("personal_search.load_more")'));
  /* Kadunud seanss viib sisse logima ja toob tagasi sellele lehele. */
  assert.ok(page.includes('loginHref("/otsi")') && page.includes('t("api.common.unauthorized")'));
  /* Brauseri enda veatekst ekraanile ei jõua. */
  assert.ok(!page.includes('error.message') && !page.includes('error?.message') && !page.includes('fetch('));
});
