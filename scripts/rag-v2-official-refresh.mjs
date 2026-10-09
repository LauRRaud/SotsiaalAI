// The re-reading of the official guidance pages in the corpus (ADR-116): the pages of the state-help lists are read
// again with the page collector, each list in its own work folder, and compared with the stored copies under
// Andmebaasi/veebilehed. A changed page is a proposal on the first reading and replaces the stored copy on the second
// equal one; a page the collector marks for review is never placed by itself (--approve names the ones a person has
// looked at); a page that cannot be read keeps its stored copy; nothing is deleted. Each site is asked no faster than
// --delay-ms and no faster than its own robots.txt asks (Crawl-delay).
// After a round that replaced pages: the source register (REGISTER.json, REGISTER.md) names the new bytes, and
// <state>/increment/selection.json lists the pages that wait for a corpus increment. The increment itself (the
// ingest, the purchase of vectors, the index) is a separate step with its own ceiling: this command buys nothing and
// makes no model or embedding call.
//   node scripts/rag-v2-official-refresh.mjs --state <dir> [--dry-run] [--approve id,id] [--delay-ms 2500]
//     [--lists a.json,b.json] [--stored Andmebaasi/veebilehed] [--root Andmebaasi]
//   node scripts/rag-v2-official-refresh.mjs --state <dir> --mark-ingested
// --dry-run only looks: it reads into its own folder under <state>/dry-run, so no proposal is kept and nothing is
// placed; every page that differs from its stored copy shows as proposed.
// --mark-ingested says the waiting pages went into the corpus: the selection is set aside under its time.
// Prints counts per publisher and the ids and addresses of the pages to look at; never page text.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { hash } from '../lib/rag-v2/contracts.js';
import { OFFICIAL_REFRESH, refreshSummary, registerAfterRefresh, markdownAfterRefresh, incrementSelection } from '../lib/rag-v2/official-refresh.js';

const DEFAULT_LISTS = ['web_pages_state_help.json', 'web_pages_state_help_2.json', 'web_pages_state_help_3.json'].map(name => `Andmebaasi/register/${name}`).join(',');
const { values } = parseArgs({ options: { state: { type: 'string' }, lists: { type: 'string', default: DEFAULT_LISTS }, stored: { type: 'string', default: 'Andmebaasi/veebilehed' },
  root: { type: 'string', default: 'Andmebaasi' }, approve: { type: 'string' }, 'delay-ms': { type: 'string', default: '2500' }, 'dry-run': { type: 'boolean', default: false },
  'mark-ingested': { type: 'boolean', default: false } } });
if (!values.state) throw Error('usage: --state <dir> [--dry-run] [--approve id,id] [--delay-ms 2500] [--lists a.json,b.json] | --state <dir> --mark-ingested');
const stamp = new Date().toISOString().replace(/[:.]/gu, '-'), state = path.resolve(values.state), selectionFile = path.join(state, 'increment', 'selection.json');
const readJson = async file => { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const writeJson = async (file, value, indent = 2) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, `${JSON.stringify(value, null, indent)}\n`); };

if (values['mark-ingested']) {
  const waiting = await readJson(selectionFile);
  if (!waiting?.length) console.log(JSON.stringify({ ingested: 0, note: 'nothing was waiting' }));
  else { await fs.rename(selectionFile, path.join(state, 'increment', `ingested-${stamp}.json`)); console.log(JSON.stringify({ ingested: waiting.length })); }
  process.exit(0);
}

const lists = values.lists.split(',').map(item => item.trim()).filter(Boolean), rows = [], rounds = [];
for (const list of lists) {
  const entries = (await readJson(list))?.pages;
  if (!Array.isArray(entries)) throw Error(`the list has no pages: ${list}`);
  const name = path.basename(list, '.json'), work = values['dry-run'] ? path.join(state, 'dry-run', stamp, name) : path.join(state, name);
  const run = spawnSync(process.execPath, ['scripts/rag-v2-web-pages.mjs', '--list', list, '--work', work, '--stored', values.stored, '--delay-ms', values['delay-ms'],
    ...(values['dry-run'] ? [] : ['--apply']), ...(values.approve ? ['--approve', values.approve] : [])], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw Error(`the collector failed on ${list}: ${String(run.stderr).split('\n').filter(Boolean).at(-1) ?? run.status}`);
  const summary = JSON.parse(run.stdout.trim().split('\n').at(-1)), report = await readJson(path.join(summary.run, 'report.json'));
  const publisher = new Map(entries.map(entry => [entry.source_id, entry.publisher]));
  rows.push(...report.rows.map(row => ({ ...row, list: name, publisher: publisher.get(row.listed) ?? '?' })));
  rounds.push({ list, run: summary.run, listed: summary.listed, status: summary.status });
}
const summary = refreshSummary(rows);

// A page the round replaced: the register names its new bytes, and it waits for the next increment.
const slug = value => value.toLowerCase().normalize('NFKD').replace(/\p{M}+/gu, '').replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '') || 'muu';
const replaced = [];
for (const row of rows.filter(item => item.status === 'confirmed' && item.applied)) {
  const base = `${path.basename(values.stored)}/${slug(row.publisher)}/${row.id}`, file = extension => path.join(values.stored, slug(row.publisher), `${row.id}.${extension}`);
  const metadataBytes = await fs.readFile(file('json'));
  replaced.push({ path: `${base}.html`, sha256: hash(await fs.readFile(file('html'))), metadata_path: `${base}.json`, metadata_sha256: hash(metadataBytes), title: JSON.parse(metadataBytes.toString('utf8')).title });
}
let registerChanges = [];
if (replaced.length) {
  const registerFile = path.join(values.root, 'REGISTER.json'), markdownFile = path.join(values.root, 'REGISTER.md');
  const outcome = registerAfterRefresh(JSON.parse(await fs.readFile(registerFile, 'utf8')), replaced);
  registerChanges = outcome.changes;
  await fs.writeFile(registerFile, `${JSON.stringify(outcome.register, null, 2)}\n`);
  await fs.writeFile(markdownFile, markdownAfterRefresh(await fs.readFile(markdownFile, 'utf8'), registerChanges));
  await writeJson(selectionFile, incrementSelection(await readJson(selectionFile), replaced.map(page => page.path)), 1);
}
const waiting = (await readJson(selectionFile)) ?? [];
const report = { version: OFFICIAL_REFRESH, at: new Date().toISOString(), dry_run: values['dry-run'], lists: rounds, ...summary, register_changes: registerChanges, waiting_for_increment: waiting.length };
await writeJson(path.join(state, 'reports', `${stamp}${values['dry-run'] ? '-dry-run' : ''}.json`), report);
console.log(JSON.stringify({ dry_run: values['dry-run'], pages: summary.pages, total: summary.total, waiting_for_increment: waiting.length }));
for (const [name, counts] of Object.entries(summary.publishers)) console.log(`${name}: ${Object.entries(counts).filter(([, count]) => count).map(([key, count]) => `${key} ${count}`).join(', ')}`);
for (const key of ['replaced', 'held', 'proposed', 'new', 'unreachable']) for (const page of summary[key]) console.log(`${key.padEnd(12)} ${page.id} ${page.url}${page.review ? ` [${page.review.join(',')}]` : ''}${page.error ? ` (${page.error})` : ''}`);
