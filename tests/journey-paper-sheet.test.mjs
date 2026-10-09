// TEEKOND K1-e — paberleht: inimese Teekond ühel prinditaval lehel.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_SHEET_CSP,
  PAPER_SHEET_HEADERS,
  PAPER_SHEET_PARTS,
  escapeHtml,
  normalizePaperSheetParts,
  renderPaperSheetHtml
} from '../lib/journey/paperSheet.js';

const journey = {
  id: 'jrn_1',
  title: 'Ema vajab kodus abi <b>',
  summary: 'Ema kukkus ja ei saa enam üksi poes käia.\nElab Rakveres üksi.',
  riskSignals: ['SALAJANE-RISKIMÄRGE: võimalik hooletusse jätmine'],
  missingInfo: ['Kas vald pakub koduteenust?', { title: 'Kui pikk on järjekord?' }],
  context: { personWish: 'Tahan, et ema saaks kodus edasi elada. "Jutumärgid" & <script>alert(1)</script>' },
  steps: [
    { id: 's1', title: 'Helistan vallavalitsusse', doer: 'mina', dueOn: '2026-10-15', state: 'TODO', note: null },
    { id: 's2', title: 'Küsin arstilt tõendit', doer: null, dueOn: null, state: 'DONE', doneAt: '2026-10-08T09:00:00Z', note: 'Tõend on käes.' },
    { id: 's3', title: 'ÄRAJÄETUD-SAMM', doer: null, dueOn: null, state: 'DROPPED', doneAt: '2026-10-08T09:00:00Z', note: null }
  ],
  linkedPreInquiries: [
    { id: 'p1', topic: 'Koduteenus emale', state: 'ANSWERED', sentAt: '2026-10-05T08:00:00Z', lastReplyAt: '2026-10-07T10:00:00Z' },
    { id: 'p2', topic: 'MUSTAND-PÖÖRDUMINE', state: 'DRAFT', sentAt: null, lastReplyAt: null },
    { id: 'p3', topic: null, state: 'SENT', sentAt: '2026-10-08T08:00:00Z', lastReplyAt: null },
    { id: 'p4', topic: 'TAGASI-VÕETUD', state: 'RECALLED', sentAt: '2026-10-08T08:00:00Z', lastReplyAt: null },
    { id: 'p5', topic: 'ASENDATUD-PARANDUSEGA', state: 'REPLACED', sentAt: '2026-10-08T08:00:00Z', lastReplyAt: null },
    { id: 'p6', topic: 'ARHIIVIS', state: 'ARCHIVED', sentAt: null, lastReplyAt: null },
    { id: 'p7', topic: 'TUNDMATU-SEIS', state: 'MIDAGI_UUT', sentAt: null, lastReplyAt: null }
  ],
  assessments: {
    baseline: { id: 'a1', level: 2, note: 'Raske on.', createdAt: '2026-10-01T08:00:00Z', change: 'BASELINE' },
    latest: { id: 'a2', level: 4, note: 'Koduteenus käib.', createdAt: '2026-10-20T08:00:00Z', change: 'BETTER' },
    change: 'BETTER',
    items: []
  }
};
const now = new Date('2026-10-21T08:00:00Z');

test('paberleht: valitud osad, inimese tekst ohutult, riskimärkmeid ei ole kunagi', () => {
  /* Osade valik aadressist: tühi tähendab kõiki, tundmatu jäetakse välja, järjekord on lehe järjekord. */
  assert.deepEqual(normalizePaperSheetParts(undefined), [...PAPER_SHEET_PARTS]);
  assert.deepEqual(normalizePaperSheetParts(''), [...PAPER_SHEET_PARTS]);
  assert.deepEqual(normalizePaperSheetParts('steps, wish,midagi,WISH'), ['wish', 'steps']);
  assert.deepEqual(normalizePaperSheetParts(['questions', 'summary']), ['summary', 'questions']);
  assert.deepEqual(normalizePaperSheetParts('midagi'), []);

  const html = renderPaperSheetHtml({ journey, locale: 'et', now });

  /* Terviklik dokument oma sisuturbe poliitikaga ja ilma skriptita. */
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes(`<meta http-equiv="Content-Security-Policy" content="${escapeHtml(PAPER_SHEET_CSP)}">`));
  assert.equal(/<script/i.test(html), false);
  assert.equal(PAPER_SHEET_CSP.includes('script-src'), false);
  assert.ok(PAPER_SHEET_HEADERS['Cache-Control'].includes('no-store'));
  assert.ok(PAPER_SHEET_HEADERS['Content-Security-Policy'].includes("frame-ancestors 'none'"));

  /* Inimese tekst on lehel, aga märgistusena see ei käivitu. */
  assert.ok(html.includes('Tahan, et ema saaks kodus edasi elada. &quot;Jutumärgid&quot; &amp; &lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('<h1>Ema vajab kodus abi &lt;b&gt;</h1>'));
  /* Vahelehe pealkirjas Teekonna nime ei ole (see jääb brauseri ajalukku). */
  assert.equal(/<title>[^<]*Ema vajab/.test(html), false);

  /* Sisu: soov, kokkuvõte, tegemata ja tehtud sammud, saadetud pöördumised, hinnang, küsimused, märkmeread. */
  assert.ok(html.includes('Ema kukkus ja ei saa enam üksi poes käia.'));
  assert.ok(html.includes('Helistan vallavalitsusse') && html.includes('Teeb: mina') && html.includes('Tähtaeg: 15.10.2026'));
  assert.ok(html.includes('Küsin arstilt tõendit') && html.includes('tehtud 08.10.2026') && html.includes('Tõend on käes.'));
  assert.ok(html.includes('Koduteenus emale') && html.includes('saaja on vastanud') && html.includes('saadetud 05.10.2026') && html.includes('viimane vastus 07.10.2026'));
  assert.ok(html.includes('Algseis 01.10.2026: raske.') && html.includes('Viimane märge 20.10.2026: pigem hästi.') && html.includes('Võrreldes algusega on läinud paremaks.'));
  assert.ok(html.includes('Kas vald pakub koduteenust?') && html.includes('Kui pikk on järjekord?'));
  assert.ok(html.includes('Prinditud 21.10.2026'));
  assert.equal((html.match(/<div><\/div>/g) || []).length, 8);

  /* MIDA LEHEL EI OLE: riskimärkmed (mitte kunagi), ära jäetud samm, sisemised tunnused ning
     pöördumine, mis ei ole teel: mustand, tagasi võetu, parandusega asendatu, arhiivis olev ja
     seis, mida leht ei tunne (uus seis ei lähe lehele enne, kui keegi on selle üle otsustanud). */
  assert.equal(html.includes('SALAJANE-RISKIMÄRGE'), false);
  assert.equal(html.includes('ÄRAJÄETUD-SAMM'), false);
  for (const absent of ['MUSTAND-PÖÖRDUMINE', 'TAGASI-VÕETUD', 'ASENDATUD-PARANDUSEGA', 'ARHIIVIS', 'TUNDMATU-SEIS']) {
    assert.equal(html.includes(absent), false, absent);
  }
  for (const id of ['jrn_1', 's1', 'p1', 'a1']) assert.equal(html.includes(`>${id}<`) || html.includes(`"${id}"`), false, id);

  /* Ainult valitud osad: soov üksi ei too kaasa kokkuvõtet, samme ega hinnangut; märkmeread on alati. */
  const onlyWish = renderPaperSheetHtml({ journey, parts: ['wish'], locale: 'et', now });
  assert.ok(onlyWish.includes('Tahan, et ema saaks kodus edasi elada.'));
  for (const absent of ['Ema kukkus', 'Helistan vallavalitsusse', 'Koduteenus emale', 'Algseis', 'Kas vald pakub']) {
    assert.equal(onlyWish.includes(absent), false, absent);
  }
  assert.equal((onlyWish.match(/<div><\/div>/g) || []).length, 8);

  /* Tühi Teekond ei tee katkist lehte: pealkiri ja märkmeread. */
  const empty = renderPaperSheetHtml({ journey: { title: 'Tühi' }, locale: 'et', now });
  assert.ok(empty.includes('<h1>Tühi</h1>'));
  assert.equal(/<h2>/.test(empty.replace(/<h2>Märkmed<\/h2>/, '')), false);

  /* Teised keeled: pealkirjad on tõlgitud, ükski võti ei jää lehele. */
  for (const locale of ['en', 'ru']) {
    const other = renderPaperSheetHtml({ journey, locale, now });
    assert.equal(/journey\.(paper|assessment|related)\./.test(other), false, locale);
    assert.ok(other.includes(`<html lang="${locale}">`));
  }
});
