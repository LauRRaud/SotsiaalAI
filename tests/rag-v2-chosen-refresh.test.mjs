import test from 'node:test';
import assert from 'node:assert/strict';
import { CHOSEN_REFRESH, SHRINK_HELD_BELOW, readingEntry, rechosenAction, stateAgainstLists, seedPlan } from '../lib/rag-v2/chosen-refresh.js';
import { decidePage } from '../lib/rag-v2/web-page.js';
import { selectPage, chosenMetadata, lowerWords } from '../lib/rag-v2/web-select.js';

// ADR-141 (11.10.2026): the pages chosen for the corpus by the selection rule (the organisations' pages, the guidance
// pages of the coverage lists, the associations' pages) are read again every month like the other web pages. Their
// corpus copies are not the collector's reading, so the collector never places them: a page whose reading changed
// twice the same way is chosen again by the rule, and the two decisions below keep that from doing harm.

const filler = 'Teenus on mõeldud inimesele, kes vajab igapäevaelus kõrvalabi ja soovib elada oma kodus nii kaua kui võimalik ning saada selleks tuge.';
const stored = body => `<!doctype html><html lang="et"><meta charset="utf-8"><title>Leht</title><body><article>\n${body}\n</article></body></html>\n`;
const meta = (more = {}) => ({ source_id: 'naidis_leht', url: 'https://naidis.example/leht', title: 'Näidis: Leht', register_title: 'Leht', publisher: 'Näidis', source_type: 'organization_page', language: 'et',
  content_sha256: 'read-1', collection: { collector: 'rag-v2/web-page-2', region: 'main', warnings: [], needs_review: false, stats: { words: 60 } }, ...more });
const context = { lower: lowerWords([stored(`<p>${filler}</p>`)]), places: new Set(), leaveOut: null };
const chosenCopy = (body, about = meta()) => { const page = { html: stored(body), meta: about }, chosen = selectPage(page, context); return { html: chosen.html, meta: chosenMetadata(about, chosen) }; };

test('a stored chosen page is read by its own address, with the title it was read with and its list entry\'s region hint', () => {
  assert.equal(CHOSEN_REFRESH, 'rag-v2/chosen-refresh-1');
  const listed = new Map([['naidis_leht', { source_id: 'naidis_leht', region: '.sisu' }], ['naidis_avaleht', { source_id: 'naidis_avaleht', region: '#keha', subpages: { depth: 2 } }]]);
  // A page listed by itself: its own entry's hint. The title is the one the list gave when the page was read.
  assert.deepEqual(readingEntry(meta(), listed), { source_id: 'naidis_leht', url: 'https://naidis.example/leht', title: 'Leht', publisher: 'Näidis', source_type: 'organization_page', language: 'et', region: '.sisu', subpages: false });
  // A page found below a listed front page: the front page's hint, as on the day it was collected.
  assert.equal(readingEntry(meta({ source_id: 'naidis_avaleht--teenused--koduabi' }), listed).region, '#keha');
  // No list entry, or an entry without a hint: read as the markup gives it. Sub-pages are never looked for.
  assert.equal('region' in readingEntry(meta({ source_id: 'muu_leht' }), listed), false);
  assert.equal('region' in readingEntry(meta(), new Map([['naidis_leht', { source_id: 'naidis_leht' }]])), false);
  assert.equal(readingEntry(meta({ register_title: undefined })).title, 'Näidis: Leht');
  assert.equal(readingEntry(meta()).subpages, false);
  // Where the page's own date stands (ADR-143) is the list entry's too, and is given only when the entry names it.
  assert.equal('updated_region' in readingEntry(meta(), listed), false);
  assert.deepEqual(readingEntry(meta(), new Map([['naidis_leht', { source_id: 'naidis_leht', region: 'main .sisu', updated_region: '.kontrollitud' }]])),
    { source_id: 'naidis_leht', url: 'https://naidis.example/leht', title: 'Leht', publisher: 'Näidis', source_type: 'organization_page', language: 'et', region: 'main .sisu', updated_region: '.kontrollitud', subpages: false });
});

test('a page that reads as it did is not judged anew; a changed one is chosen again only on the second equal reading', () => {
  // The collector compares today's reading with the reading the page was chosen from, which the chosen copy keeps.
  const before = chosenCopy(`<h1>Leht</h1>\n<p>${filler}</p>\n<p>${filler}</p>\n<p>Küsimustele vastab Mari Tammsalu.</p>`);
  assert.equal(before.meta.content_sha256, 'read-1');
  assert.equal(before.html.includes('Tammsalu'), false);
  assert.equal(decidePage({ contentSha256: 'read-1' }, before.meta, null), 'unchanged');
  assert.equal(decidePage({ contentSha256: 'read-2' }, before.meta, null), 'proposed');
  assert.equal(decidePage({ contentSha256: 'read-2' }, before.meta, { content_sha256: 'read-2' }), 'confirmed');
});

test('what happens to a confirmed change: replaced, the same, left out by the rule, or held for a person', () => {
  const paragraphs = count => `<p>${filler}</p>\n`.repeat(count);
  const before = chosenCopy(`<h1>Leht</h1>\n${paragraphs(5)}<p>Küsimustele vastab Mari Tammsalu.</p>`);
  const reading = (body, about = meta({ content_sha256: 'read-2' })) => { const page = { html: stored(body), meta: about }; return { page, chosen: selectPage(page, context) }; };
  // The page's own text changed: the chosen copy is replaced.
  const changed = reading(`<h1>Leht</h1>\n${paragraphs(4)}<p>${filler} Taotluse saab esitada ka e-posti teel.</p>\n<p>Küsimustele vastab Mari Tammsalu.</p>`);
  assert.deepEqual(rechosenAction({ before, ...changed }), { action: 'replace' });
  // Only the paragraph the rule takes out changed (another person answers now): nothing changes in the corpus.
  const person = reading(`<h1>Leht</h1>\n${paragraphs(5)}<p>Küsimustele vastab Jaan Tamm.</p>`);
  assert.deepEqual(rechosenAction({ before, ...person }), { action: 'same' });
  // The rule now leaves the page out: it stays as it is, with the rule's reason, for a person.
  const thin = reading('<h1>Leht</h1>\n<p>Leht on kolinud.</p>');
  assert.deepEqual(rechosenAction({ before, ...thin }), { action: 'left_out', why: 'under 30 words' });
  // The content region is found another way than when the page was chosen (the hint no longer matches and the whole
  // page body is read, menus and all): held, also when the text is longer.
  const body = reading(`<h1>Leht</h1>\n${paragraphs(5)}<p>${filler} Menüü: avaleht, teenused, kontakt, uudised.</p>`, meta({ content_sha256: 'read-2', collection: { ...meta().collection, region: 'body' } }));
  assert.deepEqual(rechosenAction({ before, ...body }), { action: 'held', why: 'the content region is found by "body", it was "main"' });
  // The chosen text fell under half of what it was: held.
  const short = reading(`<h1>Leht</h1>\n${paragraphs(2)}`);
  assert.equal(SHRINK_HELD_BELOW, 0.5);
  assert.equal(short.chosen.words < before.meta.selection.words * SHRINK_HELD_BELOW, true);
  assert.deepEqual(rechosenAction({ before, ...short }), { action: 'held', why: `the chosen text is ${short.chosen.words} words, it was ${before.meta.selection.words}` });
  // A person has looked at a held page and approved it by its id: placed. The rule's own "left out" is not overruled.
  assert.deepEqual(rechosenAction({ before, ...body, approved: true }), { action: 'replace' });
  assert.deepEqual(rechosenAction({ before, ...short, approved: true }), { action: 'replace' });
  assert.equal(rechosenAction({ before, ...thin, approved: true }).action, 'left_out');
  // A text that grew is not held.
  const longer = reading(`<h1>Leht</h1>\n${paragraphs(9)}`);
  assert.deepEqual(rechosenAction({ before, ...longer }), { action: 'replace' });
});

test('a list that names every page by itself is compared with the state; a list of front pages is not', () => {
  const byPage = { pages: [{ source_id: 'a', subpages: false }, { source_id: 'b', subpages: false }] };
  assert.deepEqual(stateAgainstLists(['a', 'b'], [byPage]), { notInLists: [], notInState: [] });
  assert.deepEqual(stateAgainstLists(['b', 'c'], [byPage, { pages: [{ source_id: 'd', subpages: false }] }]), { notInLists: ['c'], notInState: ['a', 'd'] });
  assert.equal(stateAgainstLists(['a'], [{ pages: [{ source_id: 'a', subpages: { depth: 2 } }] }]), null);
  assert.equal(stateAgainstLists(['a'], [{ pages: [{ source_id: 'a' }] }]), null);
  assert.equal(stateAgainstLists(['a'], []), null);
});

test('a group is seeded only with the bytes the corpus holds, and with nothing when anything is amiss', () => {
  const lists = [{ pages: [{ source_id: 'a' }, { source_id: 'b' }] }], copy = (id, sha256 = `sha-${id}`, declared = sha256) => ({ rel: `naidis/${id}`, id, sha256, declared });
  assert.deepEqual(seedPlan({ sources: [copy('b'), copy('a'), copy('extra')], lists, inCorpus: new Set(['sha-a', 'sha-b']) }), { copies: [{ id: 'a', rel: 'naidis/a' }, { id: 'b', rel: 'naidis/b' }], problems: [] });
  // Without a review the bytes are checked against the copy's own metadata only.
  assert.equal(seedPlan({ sources: [copy('a'), copy('b')], lists }).copies.length, 2);
  // A listed page without a copy, a copy whose bytes are not what its metadata names, and bytes the corpus does not hold.
  assert.deepEqual(seedPlan({ sources: [copy('a')], lists }), { copies: [], problems: ['no copy of b'] });
  assert.deepEqual(seedPlan({ sources: [copy('a'), copy('b', 'sha-b', 'sha-other')], lists }), { copies: [], problems: ['the bytes of b are not the ones its metadata names'] });
  assert.deepEqual(seedPlan({ sources: [copy('a'), copy('b')], lists, inCorpus: new Set(['sha-a']) }), { copies: [], problems: ['the bytes of b are not in the corpus increment\'s review'] });
  assert.deepEqual(seedPlan({ sources: [copy('a'), copy('b')], lists: [{ pages: [{ source_id: 'a' }, { source_id: 'a' }, { source_id: 'b' }] }] }).problems, ['the lists name a page twice']);
});
