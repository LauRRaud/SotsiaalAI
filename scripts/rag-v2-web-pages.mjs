// Collects web pages as corpus sources and checks collected ones for changes (lib/rag-v2/web-page.js says what is kept
// of a page, lib/rag-v2/web-collect.js how pages are fetched). For every page of the list, and the sub-pages below it:
// fetch, keep the content region as a small standalone HTML file with its metadata, and compare with the stored copy.
//   new        no stored copy yet
//   unchanged  the content is the stored one
//   proposed   the content differs: written as a proposal, the stored copy stays
//   confirmed  the content differs and equals the proposal of an earlier run (a second equal read)
// Without --apply nothing under --stored is written: the run's pages, the proposals and the report go under --work
// (git-ignored tmp/). With --apply a new page is placed under --stored and a confirmed change replaces the stored copy
// (the old one moves to <work>/previous/); a page marked for review is never placed by itself, and nothing is deleted.
// The list names pages by their id in the master register (Andmebaasi/register/master_sources_final.json), or gives a
// page of its own with url, title and publisher. A page's sub-pages are read two levels down, 25 at most, unless the
// list or the options say otherwise ("subpages": false, or { "depth": 1, "max": 10 }; "only": a pattern over a
// sub-page's address and link text, for a site whose listed page is its front page; "except": a pattern for the
// sub-pages that are not read).
// No model or embedding call. Prints counts and addresses, never page text.
//   node scripts/rag-v2-web-pages.mjs --list Andmebaasi/register/web_pages.json [--only id,id] [--no-subpages]
//     [--depth 2] [--max 25] [--delay-ms 1500] [--work tmp/rag-v2-web] [--stored Andmebaasi/veebilehed] [--apply]
//     [--approve id,id]   pages marked for review that a person has looked at: --apply places these too
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { collectEntry, siteManners } from '../lib/rag-v2/web-collect.js';
import { pageMetadata, decidePage, pageActions, WEB_PAGE_COLLECTOR } from '../lib/rag-v2/web-page.js';

const { values } = parseArgs({ options: { list: { type: 'string' }, master: { type: 'string', default: 'Andmebaasi/register/master_sources_final.json' },
  work: { type: 'string', default: 'tmp/rag-v2-web' }, stored: { type: 'string', default: 'Andmebaasi/veebilehed' }, only: { type: 'string' },
  'no-subpages': { type: 'boolean', default: false }, depth: { type: 'string', default: '2' }, max: { type: 'string', default: '25' }, 'delay-ms': { type: 'string', default: '1500' },
  approve: { type: 'string' }, apply: { type: 'boolean', default: false } } });
const depth = Number(values.depth), max = Number(values.max), delayMs = Number(values['delay-ms']);
if (!values.list || !Number.isInteger(depth) || depth < 0 || depth > 4 || !Number.isInteger(max) || max < 0 || max > 200 || !(delayMs >= 500 && delayMs <= 60000)) {
  throw Error('usage: --list <file> [--only id,id] [--no-subpages] [--depth <0-4>] [--max <0-200>] [--delay-ms <500-60000>] [--work <dir>] [--stored <dir>] [--apply] [--approve id,id]');
}
const readJson = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const list = await readJson(values.list), master = new Map((await readJson(values.master) || []).map(entry => [entry.source_id, entry]));
if (!Array.isArray(list?.pages)) throw Error('the list has no pages');
const only = values.only ? new Set(values.only.split(',').map(id => id.trim())) : null;
// Pages a person has looked at and found fit: with --apply these are placed though the collector marked them for review.
const approved = new Set((values.approve || '').split(',').map(id => id.trim()).filter(Boolean));
const entries = list.pages.filter(item => !only || only.has(item.source_id)).map(item => {
  const known = master.get(item.source_id), entry = { ...(known ? { source_id: known.source_id, url: known.url, title: known.title, publisher: known.publisher, source_type: known.source_type,
    language: known.language, topic_tags: known.topic_tags } : {}), ...item };
  if (!entry.source_id || !entry.url || !entry.title || !entry.publisher) throw Error(`a listed page needs an id, url, title and publisher: ${item.source_id ?? '?'}`);
  return entry;
});
const stamp = new Date().toISOString().replace(/[:.]/gu, '-'), run = path.join(values.work, 'runs', stamp);
const slug = value => value.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'muu';
const write = async (file, content) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
const manners = siteManners({ delayMs }), rows = [], skipped = [], contents = new Map();
for (const entry of entries) {
  const collected = await collectEntry(entry, { site: manners, defaults: { depth: values['no-subpages'] ? 0 : depth, max: values['no-subpages'] ? 0 : max } });
  skipped.push(...collected.skipped.map(url => ({ listed: entry.source_id, url })));
  for (const item of collected.pages) {
    const row = { listed: entry.source_id, id: item.id, parent: item.parent, depth: item.depth, url: item.url, ...(item.finalUrl && item.finalUrl !== item.url ? { finalUrl: item.finalUrl } : {}) };
    if (item.status !== 'read') { rows.push({ ...row, status: item.status, ...(item.error ? { error: item.error } : {}) }); continue; }
    // A page listed by itself and found again as another listed page's sub-page is one source: the first reading.
    if (contents.has(item.page.contentSha256)) { rows.push({ ...row, status: 'duplicate', sameAs: contents.get(item.page.contentSha256) }); continue; }
    contents.set(item.page.contentSha256, item.id);
    const rel = path.join(slug(entry.publisher), item.id), storedMeta = await readJson(path.join(values.stored, `${rel}.json`)), proposal = await readJson(path.join(values.work, 'proposals', `${rel}.json`));
    const decision = decidePage(item.page, storedMeta, proposal), metadata = pageMetadata({ entry: item.entry, page: item.page, fetched: item.fetched, sourcePath: `${item.id}.html` });
    const files = async dir => { await write(path.join(dir, `${rel}.html`), item.page.html); await write(path.join(dir, `${rel}.json`), `${JSON.stringify(metadata, null, 2)}\n`); };
    const dropProposal = async () => { for (const ext of ['html', 'json']) await fs.rm(path.join(values.work, 'proposals', `${rel}.${ext}`), { force: true }); };
    let applied = false;
    // What happens to the reading is the rule's (pageActions): the same rule the refresh of official pages runs by.
    const act = pageActions(decision, { apply: values.apply, needsReview: item.page.needsReview, approved: approved.has(item.id) });
    if (act.keepRunCopy) await files(path.join(run, 'pages'));
    if (act.dropProposal && !act.place) await dropProposal();
    if (act.propose) await files(path.join(values.work, 'proposals'));
    // A page that needs review is looked at by a person first; the run's copy and the report say why.
    if (act.place) {
      if (act.keepPrevious) for (const ext of ['html', 'json']) await write(path.join(values.work, 'previous', stamp, `${rel}.${ext}`), await fs.readFile(path.join(values.stored, `${rel}.${ext}`)));
      await files(values.stored); await dropProposal(); applied = true;
    }
    rows.push({ ...row, status: decision, applied, title: item.page.title, region: item.page.region, ...item.page.stats, documents: item.page.documents.length, contacts: item.page.contacts,
      warnings: item.page.warnings, needsReview: item.page.needsReview });
  }
}
const count = key => rows.reduce((bag, row) => { const value = row[key]; bag[value] = (bag[value] || 0) + 1; return bag; }, {});
const read = rows.filter(row => ['new', 'unchanged', 'proposed', 'confirmed'].includes(row.status));
const summary = { collector: WEB_PAGE_COLLECTOR, at: new Date().toISOString(), listed: entries.length, pages: rows.length, subpages: rows.filter(row => row.depth > 0).length, status: count('status'),
  words: read.reduce((sum, row) => sum + row.words, 0), needsReview: read.filter(row => row.needsReview).length, applied: rows.filter(row => row.applied).length,
  documentsLinked: read.reduce((sum, row) => sum + row.documents, 0), subpagesLeftOutByLimit: skipped.length, run };
await write(path.join(run, 'report.json'), `${JSON.stringify({ summary, rows, skipped }, null, 2)}\n`);
for (const row of rows) console.log([row.status.padEnd(18), String(row.words ?? '').padStart(6), row.needsReview ? 'review' : '      ', '  '.repeat(row.depth) + row.url, (row.warnings || []).join(',') || row.error || ''].join(' '));
console.log(JSON.stringify(summary));
