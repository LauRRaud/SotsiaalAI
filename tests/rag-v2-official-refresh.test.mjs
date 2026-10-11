import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePage, pageActions, robotsCrawlDelay } from '../lib/rag-v2/web-page.js';
import { siteManners, CRAWL_DELAY_CAP_MS } from '../lib/rag-v2/web-collect.js';
import { pageOutcome, refreshSummary, registerAfterRefresh, markdownAfterRefresh, incrementSelection, restEntries, checksAfterRefresh, WEB_PAGE_CHECKS } from '../lib/rag-v2/official-refresh.js';

// ADR-116 (09.10.2026): the 330 official guidance pages of the corpus are read again every month. An answer now says
// a page's figure as of the day the page was last changed (ADR-114), so a stored copy that has gone stale shows as an
// old date or an old amount. The rule for collected data holds: a change is a proposal first, the stored copy is
// replaced on the second equal reading, a page marked for review waits for a person, nothing is deleted.

test('a changed page is a proposal on the first reading and replaces the stored copy on the second equal one', () => {
  const stored = { content_sha256: 'stored' }, page = { contentSha256: 'changed' };
  // First round: the page differs from the stored copy and nothing was proposed before.
  const first = decidePage(page, stored, null);
  assert.equal(first, 'proposed');
  assert.deepEqual(pageActions(first, { apply: true }), { keepRunCopy: true, propose: true, place: false, keepPrevious: false, dropProposal: false });
  // Second round: the same change again. The stored copy is replaced, the old one kept aside, the proposal dropped.
  const second = decidePage(page, stored, { content_sha256: 'changed' });
  assert.equal(second, 'confirmed');
  assert.deepEqual(pageActions(second, { apply: true }), { keepRunCopy: true, propose: false, place: true, keepPrevious: true, dropProposal: true });
  // A second round that reads something else again is a new proposal, not a confirmation.
  assert.equal(decidePage({ contentSha256: 'another' }, stored, { content_sha256: 'changed' }), 'proposed');
  // A page that reads as stored again: the earlier proposal is forgotten.
  assert.deepEqual(pageActions(decidePage({ contentSha256: 'stored' }, stored, { content_sha256: 'changed' }), { apply: true }),
    { keepRunCopy: false, propose: false, place: false, keepPrevious: false, dropProposal: true });
});

test('a page marked for review is not placed by itself, a round that only looks places nothing, and no decision removes a stored copy', () => {
  for (const decision of ['new', 'confirmed']) {
    assert.equal(pageActions(decision, { apply: true, needsReview: true }).place, false, decision);
    assert.equal(pageActions(decision, { apply: true, needsReview: true, approved: true }).place, true, decision);
    assert.equal(pageActions(decision, { apply: false }).place, false, decision);
    // The proposal of a held page stays, so that the person's approval places exactly what was read twice.
    assert.equal(pageActions(decision, { apply: true, needsReview: true }).dropProposal, false, decision);
  }
  for (const decision of ['new', 'unchanged', 'proposed', 'confirmed']) for (const options of [{}, { apply: true }, { apply: true, needsReview: true, approved: true }]) {
    assert.deepEqual(Object.keys(pageActions(decision, options)).sort(), ['dropProposal', 'keepPrevious', 'keepRunCopy', 'place', 'propose'], 'there is no action that deletes');
  }
  // A first placement keeps nothing aside: there was no stored copy.
  assert.equal(pageActions('new', { apply: true }).keepPrevious, false);
});

test('a round is told per publisher; a page that could not be read keeps its place among the stored and is named', () => {
  const row = (id, publisher, status, extra = {}) => ({ id, listed: id, url: `https://amet.example/${id}`, publisher, status, words: 120, ...extra });
  const rows = [row('a', 'Amet', 'unchanged'), row('b', 'Amet', 'proposed'), row('c', 'Amet', 'confirmed', { applied: true }),
    row('d', 'Amet', 'confirmed', { applied: false, needsReview: true, warnings: ['personal_contact_removed'] }), row('e', 'Koda', 'failed', { error: 'http_404', words: undefined }),
    row('f', 'Koda', 'robots_disallowed', { words: undefined }), row('g', 'Koda', 'duplicate'), row('h', 'Koda', 'new', { applied: true })];
  assert.deepEqual(rows.map(pageOutcome), ['unchanged', 'proposed', 'replaced', 'held', 'unreachable', 'unreachable', 'other', 'new']);
  const summary = refreshSummary(rows);
  assert.deepEqual(summary.total, { unchanged: 1, proposed: 1, replaced: 1, held: 1, new: 1, unreachable: 2, other: 1 });
  assert.deepEqual(summary.publishers.Amet, { unchanged: 1, proposed: 1, replaced: 1, held: 1, new: 0, unreachable: 0, other: 0 });
  assert.deepEqual(summary.publishers.Koda, { unchanged: 0, proposed: 0, replaced: 0, held: 0, new: 1, unreachable: 2, other: 1 });
  assert.deepEqual(summary.held, [{ id: 'd', url: 'https://amet.example/d', review: ['personal_contact_removed'], words: 120 }]);
  assert.deepEqual(summary.unreachable, [{ id: 'e', url: 'https://amet.example/e', error: 'http_404' }, { id: 'f', url: 'https://amet.example/f' }]);
  // What is told is ids, addresses and counts: no title and no text of a page.
  assert.equal(JSON.stringify(summary).includes('title'), false);
});

test('the register names a replaced page\'s new bytes and title; the page waits for the next increment once', () => {
  const entry = (path, role, extra = {}) => ({ path, category: 'veebilehed', role, sha256: `old-${path}`, ...extra });
  const register = { entries: [entry('veebilehed/amet/a.html', 'source', { title: 'Toetus', document_id: 'web-a', corpus_documents: 1 }), entry('veebilehed/amet/a.json', 'metadata'),
    entry('veebilehed/amet/b.html', 'source', { title: 'Teine', document_id: 'web-b' }), entry('veebilehed/amet/b.json', 'metadata')] };
  const { changes } = registerAfterRefresh(register, [{ path: 'veebilehed/amet/a.html', sha256: 'new-html', metadata_path: 'veebilehed/amet/a.json', metadata_sha256: 'new-json', title: 'Toetus ja hüvitis' }]);
  assert.deepEqual(register.entries.slice(0, 2).map(item => item.sha256), ['new-html', 'new-json']);
  assert.deepEqual([register.entries[0].title, register.entries[0].document_id, register.entries[0].corpus_documents], ['Toetus ja hüvitis', 'web-a', 1]);
  assert.deepEqual(register.entries.slice(2).map(item => item.sha256), ['old-veebilehed/amet/b.html', 'old-veebilehed/amet/b.json'], 'another page is untouched');
  assert.deepEqual(changes, [{ path: 'veebilehed/amet/a.html', bytes_changed: true, title_before: 'Toetus', title: 'Toetus ja hüvitis' }]);
  assert.throws(() => registerAfterRefresh(register, [{ path: 'veebilehed/amet/x.html', sha256: 's', metadata_path: 'veebilehed/amet/x.json', metadata_sha256: 'm', title: 'X' }]), /refresh_register_entry_missing/u);
  const markdown = '| Pealkiri | Fail |\r\n| Toetus | [veebilehed/amet/a.html](<veebilehed/amet/a.html>) |\r\n| Teine | [veebilehed/amet/b.html](<veebilehed/amet/b.html>) |\r\n';
  assert.equal(markdownAfterRefresh(markdown, changes), markdown.replace('| Toetus |', '| Toetus ja hüvitis |'));
  assert.equal(markdownAfterRefresh(markdown, [{ path: 'veebilehed/amet/b.html', bytes_changed: true }]), markdown, 'a page whose title stayed keeps its row');
  assert.deepEqual(incrementSelection([{ source: 'veebilehed/amet/b.html' }], ['veebilehed/amet/a.html', 'veebilehed/amet/b.html']),
    [{ source: 'veebilehed/amet/a.html' }, { source: 'veebilehed/amet/b.html' }]);
  assert.deepEqual(incrementSelection(null, []), []);
});

test('a site is asked no faster than its robots.txt asks: the collector\'s own group, else the group for all, at most a minute', async () => {
  const robots = 'User-agent: *\nCrawl-delay: 10\nDisallow: /x\n\nUser-agent: sotsiaalai\nCrawl-delay: 4\n';
  assert.equal(robotsCrawlDelay(robots), 4);
  assert.equal(robotsCrawlDelay(robots, 'muu robot'), 10);
  assert.equal(robotsCrawlDelay('User-agent: *\ncrawl-delay: 2.5 # sekundit\n', 'muu'), 2.5);
  for (const none of ['', 'User-agent: *\nDisallow: /x\n', 'User-agent: *\nCrawl-delay: palju\n', 'Crawl-delay: 9\n']) assert.equal(robotsCrawlDelay(none), null, none);
  const pauses = async (text, delayMs) => {
    const slept = [], manners = siteManners({ delayMs, sleep: async ms => { slept.push(ms); }, fetchImpl: async () => new Response(text, { status: 200, headers: { 'content-type': 'text/plain' } }) });
    await manners.robots(new URL('https://www.amet.example/a')); await manners.wait('amet.example'); await manners.wait('amet.example');
    return slept;
  };
  const asked = await pauses('User-agent: *\nCrawl-delay: 10\n', 2500);
  assert.equal(asked.length, 1); assert(asked[0] > 9000 && asked[0] <= 10000, String(asked[0]));
  const own = await pauses('User-agent: *\nCrawl-delay: 1\n', 2500);
  assert(own[0] > 2000 && own[0] <= 2500, 'the run\'s own pause when the site asks for less');
  const capped = await pauses('User-agent: *\nCrawl-delay: 3600\n', 2500);
  assert(capped[0] > CRAWL_DELAY_CAP_MS - 1000 && capped[0] <= CRAWL_DELAY_CAP_MS);
});

// ADR-117 (09.10.2026): the first official pages were collected with the pages below them, so their stored copies are
// in no list; and a page that reads unchanged kept the day of its first reading as the day it was checked.
test('the stored pages no list names are read by their own addresses; a listed page and another refresh\'s pages are left to their own round', () => {
  const meta = (id, more = {}) => ({ source_id: id, url: `https://amet.example/${id}`, title: `Leht ${id}`, register_title: `Loendi pealkiri ${id}`, publisher: 'Näidisamet', source_type: 'web_page', language: 'et', ...more });
  const stored = [{ folder: 'naidisamet', meta: meta('juhis--alaleht', { jurisdiction_level: 'NATIONAL', tags: ['Ligipääsetavus'] }) }, { folder: 'naidisamet', meta: meta('juhis') },
    { folder: 'naidisamet', meta: meta('loendis') }, { folder: 'naidisamet', meta: meta('abivahend') }, { folder: 'naidisamet', meta: meta('abivahend--alaleht') }, { folder: 'naidisamet', meta: meta('abivahendid_muu') }];
  const entries = restEntries(stored, ['loendis'], ['abivahend']);
  assert.deepEqual(entries.map(entry => entry.source_id), ['abivahendid_muu', 'juhis', 'juhis--alaleht']);
  // The entry is the stored copy's own: the list's title when the copy keeps one, and no sub-page is looked for.
  assert.deepEqual(entries[2], { source_id: 'juhis--alaleht', url: 'https://amet.example/juhis--alaleht', title: 'Loendi pealkiri juhis--alaleht', publisher: 'Näidisamet', source_type: 'web_page', language: 'et',
    jurisdiction_level: 'NATIONAL', topic_tags: ['Ligipääsetavus'], subpages: false });
  assert.equal(restEntries([{ folder: 'naidisamet', meta: { ...meta('vana'), register_title: undefined } }], [])[0].title, 'Leht vana');
  // A copy that does not lie in its publisher's folder could not be found again by the collector: an error, not a guess.
  assert.throws(() => restEntries([{ folder: 'muu-kaust', meta: meta('juhis') }], []), { code: 'refresh_stored_page_unreadable' });
  assert.throws(() => restEntries([{ folder: 'naidisamet', meta: { ...meta('juhis'), url: null } }], []), { code: 'refresh_stored_page_unreadable' });
  assert.deepEqual(restEntries([{ folder: 'naidisamet', meta: null }, { folder: 'naidisamet', meta: {} }], []), []);
});

test('the table of confirmed readings: a day only moves forward, nothing is taken out, and a bad hash, day or table is an error', () => {
  const a = 'a'.repeat(64), b = 'b'.repeat(64), c = 'c'.repeat(64);
  const first = checksAfterRefresh(null, [b, a, a], '2026-11-01');
  assert.deepEqual(first, { table: { schema_version: WEB_PAGE_CHECKS, checks: { [a]: '2026-11-01', [b]: '2026-11-01' } }, moved: 2 });
  assert.deepEqual(Object.keys(first.table.checks), [a, b]);
  // The second round of the month confirms one page, brings a new copy, and does not name the third: that one keeps its day.
  const second = checksAfterRefresh(first.table, [a, c], '2026-11-03');
  assert.deepEqual(second, { table: { schema_version: WEB_PAGE_CHECKS, checks: { [a]: '2026-11-03', [b]: '2026-11-01', [c]: '2026-11-03' } }, moved: 2 });
  // A round dated earlier (a clock set back, a report read again) moves nothing.
  assert.deepEqual(checksAfterRefresh(second.table, [a, b, c], '2026-10-15'), { table: second.table, moved: 0 });
  assert.deepEqual(checksAfterRefresh(second.table, [], '2026-12-01'), { table: second.table, moved: 0 });
  assert.deepEqual(first.table.checks, { [a]: '2026-11-01', [b]: '2026-11-01' });
  for (const hash of ['abc', 'A'.repeat(64), `${a}0`, null, 7]) assert.throws(() => checksAfterRefresh(null, [hash], '2026-11-01'), { code: 'refresh_check_hash_invalid' });
  for (const day of ['1.11.2026', '2026-13-40', '2026-11-01T09:00:00Z', null]) assert.throws(() => checksAfterRefresh(null, [a], day), { code: 'refresh_check_day_invalid' });
  assert.throws(() => checksAfterRefresh({ schema_version: 'other', checks: {} }, [a], '2026-11-01'), { code: 'refresh_check_table_invalid' });
});
