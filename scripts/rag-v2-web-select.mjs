// Chooses, of the pages a collector run read (scripts/rag-v2-web-pages.mjs), the ones that go into the corpus, and
// takes out of them the paragraphs that name a person (lib/rag-v2/web-select.js says by what rule). For the lists of
// sites too large to look at page by page: the organisations' own sites.
//   --check    the tally: chosen, left out and why, and the listed publishers without a page
//   --titles   the titles of the chosen pages that are new or changed against --earlier
//   --place    copies those pages, as chosen, under <dir>/veebilehed/<publisher>/ with their metadata, and writes
//              <dir>/left-out.json: the pages of --earlier that the rule now leaves out
// --earlier names the sources of an earlier increment (<dir>/veebilehed/…): a page chosen there and not read in this
// run is chosen again by today's rule from its stored copy, and the tally says which pages of the corpus the rule
// would now change or leave out. Nothing is removed from the corpus by this script.
// Prints counts, titles and publishers' names; never page text.
//   node scripts/rag-v2-web-select.mjs --run <collector run dir> [--list <list.json>] [--earlier <sources dir>]
//     [--municipalities Andmebaasi/KOV] --check | --titles | --place <dir>
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { WEB_SELECTION, chosenMetadata, lowerWords, selectPage } from '../lib/rag-v2/web-select.js';

const { values } = parseArgs({ options: { run: { type: 'string' }, list: { type: 'string' }, earlier: { type: 'string' }, municipalities: { type: 'string', default: 'Andmebaasi/KOV' },
  check: { type: 'boolean', default: false }, titles: { type: 'boolean', default: false }, place: { type: 'string' } } });
if (!values.run || [values.check, values.titles, Boolean(values.place)].filter(Boolean).length !== 1) throw Error('usage: --run <collector run dir> [--list <list.json>] [--earlier <sources dir>] --check | --titles | --place <dir>');
const walk = (dir, found = []) => {
  if (!fs.existsSync(dir)) return found;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, item.name); if (item.isDirectory()) walk(full, found); else if (item.name.endsWith('.json') && item.name !== 'report.json') found.push(full); }
  return found;
};
const load = (file, root) => ({ id: path.basename(file, '.json'), rel: path.relative(root, file).replace(/\.json$/u, ''), meta: JSON.parse(fs.readFileSync(file, 'utf8')), html: fs.readFileSync(file.replace(/\.json$/u, '.html'), 'utf8') });
const runRoot = path.join(values.run, 'pages'), read = walk(runRoot).sort().map(file => load(file, runRoot)).filter(page => page.meta.collection);
const earlierRoot = values.earlier ? path.join(values.earlier, 'veebilehed') : null, earlier = new Map((earlierRoot ? walk(earlierRoot) : []).map(file => load(file, earlierRoot)).map(page => [page.id, page]));
// A page of the corpus that this run did not read is judged from its stored copy.
const readIds = new Set(read.map(page => page.id)), pages = [...read, ...[...earlier.values()].filter(page => !readIds.has(page.id))];

const places = new Set();
for (const slug of fs.existsSync(values.municipalities) ? fs.readdirSync(values.municipalities) : []) {
  try { const meta = JSON.parse(fs.readFileSync(path.join(values.municipalities, slug, `${slug}.meta.json`), 'utf8')); for (const word of `${meta.municipality_name || ''} ${meta.county || ''}`.split(/[\s-]+/u)) if (word) places.add(word.toLowerCase()); } catch { /* not a municipality's package */ }
}
const list = values.list ? JSON.parse(fs.readFileSync(values.list, 'utf8')) : null;
const context = { lower: lowerWords(pages.map(page => page.html)), places, leaveOut: list?.selection?.leave_out ? new RegExp(list.selection.leave_out, 'iu') : null };

const reasons = {}, chosen = [], changed = [], gone = [];
for (const page of pages) {
  // A stored copy chosen before is chosen from what the collector read: its own marks are kept as they are.
  const result = selectPage(page, context), was = earlier.get(page.id);
  if (!result.keep) { reasons[result.why] = (reasons[result.why] || 0) + 1; if (was) gone.push({ source_id: was.meta.source_id, title: was.meta.title, why: result.why }); continue; }
  const state = !was ? 'new' : was.html === result.html ? 'same' : 'changed';
  chosen.push({ ...page, result, state });
  if (state === 'changed') changed.push(page.meta.title);
}
const tally = (items, key) => items.reduce((bag, item) => { bag[key(item)] = (bag[key(item)] || 0) + 1; return bag; }, {});
const fresh = chosen.filter(page => page.state !== 'same'), words = items => items.reduce((sum, page) => sum + page.result.words, 0);
if (values.check) {
  const publishers = new Set([...pages.map(page => page.meta.publisher), ...(list?.pages || []).map(entry => entry.publisher).filter(Boolean)]), withPage = new Set(chosen.map(page => page.meta.publisher));
  console.log(JSON.stringify({ selection: WEB_SELECTION, read: read.length, fromEarlierOnly: pages.length - read.length, chosen: chosen.length, state: tally(chosen, page => page.state), words: words(chosen), wordsNewOrChanged: words(fresh),
    paragraphsTakenOut: chosen.reduce((sum, page) => sum + page.result.removed.units, 0), pagesWithParagraphsTakenOut: chosen.filter(page => page.result.removed.units).length,
    leftOut: reasons, publishersWithAPage: withPage.size, publishers: publishers.size }, null, 1));
  console.log('without a page:', [...publishers].filter(name => !withPage.has(name)).sort().join(' | ') || '-');
  console.log('pages by publisher:', Object.entries(tally(chosen, page => page.meta.publisher)).sort().map(([name, n]) => `${name} ${n}`).join(' | '));
  if (changed.length) console.log(`in the corpus, changed by today's rule or reading (${changed.length}):\n  ${changed.join('\n  ')}`);
  if (gone.length) console.log(`in the corpus, left out by today's rule (${gone.length}; nothing is removed by this script):\n  ${gone.map(item => `${item.title}: ${item.why}`).join('\n  ')}`);
} else if (values.titles) {
  console.log(fresh.map(page => `${page.state.padEnd(8)}${String(page.result.words).padStart(5)}w ${page.result.removed.units ? `-${page.result.removed.units}` : '  '} ${String(page.meta.title).slice(0, 110)}`).sort((a, b) => a.slice(17).localeCompare(b.slice(17), 'et')).join('\n'));
} else {
  for (const page of fresh) {
    const target = path.join(values.place, 'veebilehed', page.rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(`${target}.html`, page.result.html);
    fs.writeFileSync(`${target}.json`, `${JSON.stringify(chosenMetadata(page.meta, page.result), null, 2)}\n`);
  }
  // The pages of the earlier increment that today's rule leaves out: for a person to decide (a policy's --remove list).
  fs.writeFileSync(path.join(values.place, 'left-out.json'), `${JSON.stringify(gone, null, 1)}\n`);
  console.log(JSON.stringify({ selection: WEB_SELECTION, placed: fresh.length, state: tally(fresh, page => page.state), words: words(fresh), publishers: new Set(fresh.map(page => page.meta.publisher)).size, earlierLeftOut: gone.length }));
}
