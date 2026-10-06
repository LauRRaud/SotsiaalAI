// The refresh of the assistive device information in the corpus (ADR-098): reads the sources again, decides what
// changed by the rule for collected data, and leaves the changed sources ready for a corpus increment. No model or
// embedding call: the increment itself (which buys vectors) is a separate step with its own ceiling.
//   1. the Social Insurance Board's table of sales points: a new reading against the accepted one. A new or changed
//      point is applied when the reading before this one showed the same change; a point that is gone is never
//      removed by itself (--approve-removals names the keys a person has approved)
//   2. the points' pages (a municipality's, a county's): made again where the accepted points changed
//   3. the web pages in the corpus (the vendors' pages, the Board's guidance pages): read again with the page
//      collector; a changed page is a proposal first and replaces the stored copy on the second equal reading; a page
//      marked for review is never placed by itself
//   4. the changed sources are collected under <state>/increment with their register, and a report says what was
//      found. --mark-ingested says the increment went into the corpus: the next run compares against it.
// The state lives outside the repository (the pages hold phone numbers and the companies' own texts):
//   <state>/accepted/points.json      the accepted reading of the table
//   <state>/pending.json              the changes the last reading proposed
//   <state>/accepted/pages/           the stored copies of the vendors' pages
//   <state>/ingested/abivahendid/     the points' pages as the corpus has them
//   <state>/increment/sources/        what waits for an increment
//   <state>/reports/<time>.json       every run's report
// Prints counts, names of sales points and page addresses; never a phone number, an e-mail address or page text.
//   node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-assistive-refresh.mjs --state <dir>
//     [--from-reading <points.json>] [--approve-removals key,key] [--skip-points] [--skip-pages] [--dry-run]
//     [--official-list Andmebaasi/register/web_pages.json] [--official id,id] [--official-stored Andmebaasi/veebilehed]
//   node … scripts/rag-v2-assistive-refresh.mjs --state <dir> --mark-ingested
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { collectPoints, csvReader, ASSISTIVE_POINTS, SKA_MAP_CSV } from '../lib/rag-v2/assistive-points.js';
import { COLLECTOR_AGENT } from '../lib/rag-v2/web-collect.js';
import { ASSISTIVE_REFRESH, decidePoints, refreshedPointPages } from '../lib/rag-v2/assistive-refresh.js';

const { values } = parseArgs({ options: { state: { type: 'string' }, municipalities: { type: 'string', default: 'Andmebaasi/KOV' }, 'from-reading': { type: 'string' },
  'approve-removals': { type: 'string', default: '' }, 'skip-points': { type: 'boolean', default: false }, 'skip-pages': { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false }, 'mark-ingested': { type: 'boolean', default: false }, 'delay-ms': { type: 'string', default: '1500' },
  'official-list': { type: 'string', default: 'Andmebaasi/register/web_pages.json' },
  official: { type: 'string', default: 'sotsiaalkindlustusamet_ska_abivahendi_vajajale,sotsiaalkindlustusamet_ska_abivahendi_ettevottele' },
  'official-stored': { type: 'string', default: 'Andmebaasi/veebilehed' } } });
if (!values.state) throw Error('usage: --state <dir outside the repository> [--from-reading <points.json>] [--approve-removals key,key] [--skip-points] [--skip-pages] [--dry-run] | --mark-ingested');
const state = path.resolve(values.state), dry = values['dry-run'];
const readJson = async (file, fallback = null) => fs.readFile(file, 'utf8').then(JSON.parse, () => fallback);
const write = async (file, content) => { if (dry) return; await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const walk = async (dir, base = dir) => (await fs.readdir(dir, { withFileTypes: true }).catch(() => [])).reduce(async (list, item) => {
  const full = path.join(dir, item.name);
  return [...await list, ...(item.isDirectory() ? await walk(full, base) : [path.relative(base, full).split(path.sep).join('/')])];
}, Promise.resolve([]));
const stamp = new Date().toISOString(), increment = path.join(state, 'increment', 'sources');

if (values['mark-ingested']) {
  // The increment went into the corpus: its points' pages are what the corpus has now, and the folder is put away.
  const files = await walk(increment);
  for (const file of files.filter(name => name.startsWith('abivahendid/'))) await write(path.join(state, 'ingested', file), await fs.readFile(path.join(increment, file)));
  if (files.length && !dry) await fs.rename(path.join(state, 'increment'), path.join(state, 'increments-done', stamp.replace(/[:.]/gu, '-')));
  console.log(JSON.stringify({ refresh: ASSISTIVE_REFRESH, markedIngested: files.filter(name => name.endsWith('.html')).length }));
  process.exit(0);
}

const municipalities = [];
for (const slug of (await fs.readdir(values.municipalities)).sort()) {
  const meta = await readJson(path.join(values.municipalities, slug, `${slug}.meta.json`));
  if (meta?.municipality_id && meta?.municipality_name) municipalities.push({ id: meta.municipality_id, name: meta.municipality_name, county: meta.county ?? null });
}
const report = { refresh: ASSISTIVE_REFRESH, at: stamp, dryRun: dry, points: null, pointPages: null, pages: null, increment: null };
const changedSources = [];

if (!values['skip-points']) {
  const accepted = await readJson(path.join(state, 'accepted', 'points.json'));
  if (!accepted?.points) throw Error(`no accepted reading at ${path.join(state, 'accepted', 'points.json')}: seed the state first`);
  let reading;
  if (values['from-reading']) reading = await readJson(values['from-reading']);
  else {
    const delayMs = Number(values['delay-ms']), wait = () => new Promise(resolve => setTimeout(resolve, delayMs));
    const { points, readings, problems } = await collectPoints({ read: csvReader({ wait, agent: COLLECTOR_AGENT }), municipalities });
    reading = { source: { collector: ASSISTIVE_POINTS, table: SKA_MAP_CSV, read_at: stamp, readings }, points, problems };
  }
  const unplaced = reading.points.filter(point => point.municipalities.length !== 1 || point.counties.length !== 1).length;
  // A reading that left points unplaced, or lost a large part of the table, is a fault of the reading, not news.
  if (unplaced || reading.points.length < accepted.points.length * 0.8) throw Error(`the reading is not usable: ${reading.points.length} points, ${unplaced} unplaced (accepted: ${accepted.points.length})`);
  await write(path.join(state, 'readings', `${stamp.replace(/[:.]/gu, '-')}.json`), `${JSON.stringify(reading, null, 1)}\n`);
  const pending = await readJson(path.join(state, 'pending.json'), []);
  const decided = decidePoints({ accepted: accepted.points, read: reading.points, pending, approveRemovals: values['approve-removals'].split(',').map(key => key.trim()).filter(Boolean) });
  const named = list => list.map(change => `${change.kind}: ${change.name} (${change.where})`);
  report.points = { read: reading.points.length, accepted: accepted.points.length, applied: named(decided.applied), proposed: named(decided.proposed.filter(change => !decided.removalsWaiting.includes(change))),
    removalsWaitingForApproval: decided.removalsWaiting.map(change => ({ key: change.key, name: change.name, where: change.where })), acceptedAfter: decided.points.length };
  await write(path.join(state, 'pending.json'), `${JSON.stringify(decided.proposed, null, 1)}\n`);
  const readAt = reading.source.read_at;
  if (decided.applied.length) await write(path.join(state, 'accepted', 'points.json'), `${JSON.stringify({ source: { ...reading.source, accepted_at: stamp }, points: decided.points }, null, 1)}\n`);
  // The pages of the accepted points against the ones the corpus has (and against an increment that still waits).
  const ingested = new Map();
  for (const root of [path.join(state, 'ingested'), increment]) for (const file of (await walk(root)).filter(name => name.startsWith('abivahendid/') && name.endsWith('.html'))) ingested.set(file, await fs.readFile(path.join(root, file), 'utf8'));
  const pages = refreshedPointPages({ points: decided.points, municipalities, readAt, ingested });
  for (const page of pages.changed) {
    await write(path.join(increment, page.path), page.html);
    await write(path.join(increment, page.path.replace(/\.html$/u, '.json')), `${JSON.stringify({ ...page.metadata, source_sha256: sha(page.html) }, null, 2)}\n`);
    changedSources.push(page.path);
  }
  report.pointPages = { unchanged: pages.unchanged, changed: pages.changed.map(page => `${page.state}: ${page.path}`), noLongerMade: pages.gone };
}

if (!values['skip-pages']) {
  const collector = (args, label) => {
    const out = execFileSync(process.execPath, ['scripts/rag-v2-web-pages.mjs', ...args, '--delay-ms', values['delay-ms'], ...(dry ? [] : ['--apply'])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const summary = JSON.parse(out.trim().split('\n').at(-1));
    return { label, summary };
  };
  // The vendors' pages in the corpus: exactly those, by their own addresses (a site's other pages are not looked for).
  const stored = path.join(state, 'accepted', 'pages'), entries = [];
  for (const file of (await walk(stored)).filter(name => name.endsWith('.json'))) {
    const meta = await readJson(path.join(stored, file));
    if (meta?.source_id && meta.url) entries.push({ source_id: meta.source_id, url: meta.url, title: meta.register_title || meta.title, publisher: meta.publisher, source_type: meta.source_type, language: meta.language, subpages: false });
  }
  const runs = [];
  if (entries.length) {
    const list = path.join(state, 'web', 'list.json');
    await fs.mkdir(path.dirname(list), { recursive: true });
    await fs.writeFile(list, `${JSON.stringify({ version: 'web-pages-1', note: 'The vendors\' pages in the corpus, for the refresh.', pages: entries }, null, 1)}\n`);
    runs.push({ ...collector(['--list', list, '--work', path.join(state, 'web'), '--stored', stored, '--no-subpages'], 'vendors'), stored, prefix: 'veebilehed' });
  }
  if (values.official) runs.push({ ...collector(['--list', values['official-list'], '--only', values.official, '--work', path.join(state, 'web-official'), '--stored', values['official-stored']], 'official'),
    stored: values['official-stored'], prefix: 'veebilehed' });
  report.pages = [];
  for (const run of runs) {
    const { rows } = await readJson(path.join(run.summary.run, 'report.json'));
    const applied = rows.filter(row => row.applied);
    for (const row of applied) {
      // The stored copy the collector has just placed: <publisher>/<id>.
      const rel = (await walk(run.stored)).find(name => name.endsWith(`/${row.id}.json`))?.replace(/\.json$/u, '');
      if (!rel) throw Error(`the applied page is not in the store: ${row.id}`);
      for (const ext of ['html', 'json']) await write(path.join(increment, run.prefix, `${rel}.${ext}`), await fs.readFile(path.join(run.stored, `${rel}.${ext}`)));
      changedSources.push(`${run.prefix}/${rel}.html`);
    }
    report.pages.push({ list: run.label, read: rows.length, status: run.summary.status, applied: applied.map(row => `${row.status}: ${row.url}`),
      proposed: rows.filter(row => row.status === 'proposed').map(row => row.url),
      changedButMarkedForReview: rows.filter(row => ['confirmed', 'new'].includes(row.status) && !row.applied).map(row => `${row.url} (${(row.warnings || []).join(',')})`),
      failed: rows.filter(row => ['failed', 'robots_disallowed'].includes(row.status)).map(row => `${row.url} ${row.error || row.status}`) });
  }
}

const waiting = (await walk(increment)).filter(name => name.endsWith('.html'));
if (waiting.length && !dry) execFileSync(process.execPath, ['scripts/rag-v2-export-register.mjs', '--root', increment], { encoding: 'utf8' });
report.increment = waiting.length ? { sources: waiting.length, addedByThisRun: changedSources.length, dir: increment } : null;
await write(path.join(state, 'reports', `${stamp.replace(/[:.]/gu, '-')}.json`), `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify(report, null, 1));
