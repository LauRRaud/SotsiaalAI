// Seeds a group of the refresh's state with the pages an increment put into the corpus as the selection rule chose
// them (ADR-141): the copies of the pages the lists name are taken from the increment's sources and put under
// <state>/accepted/<group>/. Every listed page must have a copy; a copy's bytes must be the ones its metadata names
// and, with --review, the ones the corpus holds (the source hashes of the reviews the increment was published with).
// Nothing is copied when anything is amiss, and a copy already in the state is replaced only with --replace.
// Run it once after such an increment; the monthly refresh (scripts/rag-v2-assistive-refresh.mjs) reads the group
// from then on. No reading of any site, no model or embedding call. Prints counts and ids; never page text.
//   node scripts/rag-v2-chosen-seed.mjs --state <dir outside the repository> --group coverage|associations|organisations
//     --lists a.json,b.json --sources <dir with veebilehed/>,<dir> [--review review.json,review.json] [--replace] [--dry-run]
// A later --sources folder wins over an earlier one for the same page (a follow-up increment that read a site again).
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { CHOSEN_REFRESH, seedPlan } from '../lib/rag-v2/chosen-refresh.js';

const { values } = parseArgs({ options: { state: { type: 'string' }, group: { type: 'string' }, lists: { type: 'string' }, sources: { type: 'string' }, review: { type: 'string', default: '' },
  replace: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false } } });
if (!values.state || !/^[a-z]+$/u.test(values.group || '') || !values.lists || !values.sources) throw Error('usage: --state <dir> --group <name> --lists a.json,b.json --sources <dir>,<dir> [--review review.json,…] [--replace] [--dry-run]');
const split = text => text.split(',').map(item => item.trim()).filter(Boolean), readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const walk = async (dir, base = dir) => (await fs.readdir(dir, { withFileTypes: true }).catch(() => [])).reduce(async (list, item) => {
  const full = path.join(dir, item.name);
  return [...await list, ...(item.isDirectory() ? await walk(full, base) : [path.relative(base, full).split(path.sep).join('/')])];
}, Promise.resolve([]));

const lists = await Promise.all(split(values.lists).map(readJson)), found = new Map();
for (const root of split(values.sources)) {
  const base = path.join(root, 'veebilehed');
  for (const file of (await walk(base)).filter(name => name.endsWith('.json'))) {
    const meta = await readJson(path.join(base, file)), rel = file.replace(/\.json$/u, ''), html = await fs.readFile(path.join(base, `${rel}.html`)).catch(() => null);
    if (!meta?.source_id || !html) continue;
    found.set(meta.source_id, { rel, id: meta.source_id, sha256: createHash('sha256').update(html).digest('hex'), declared: meta.source_sha256, base });
  }
}
const inCorpus = values.review ? new Set((await Promise.all(split(values.review).map(readJson))).flatMap(review => review.items.map(item => item.source_sha256))) : null;
const plan = seedPlan({ sources: [...found.values()], lists, inCorpus }), folder = path.join(path.resolve(values.state), 'accepted', values.group);
const present = new Set((await walk(folder)).filter(name => name.endsWith('.json')).map(name => name.replace(/\.json$/u, '')));
const clash = plan.copies.filter(copy => present.has(copy.rel));
if (clash.length && !values.replace) plan.problems.push(`${clash.length} of the pages are in the state already (first: ${clash[0].id}); --replace to put the corpus copies in their place`);
if (!plan.problems.length && !values['dry-run']) for (const copy of plan.copies) {
  const from = found.get(copy.id).base;
  for (const extension of ['html', 'json']) { const target = path.join(folder, `${copy.rel}.${extension}`); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(path.join(from, `${copy.rel}.${extension}`), target); }
}
console.log(JSON.stringify({ refresh: CHOSEN_REFRESH, group: values.group, listed: lists.reduce((sum, list) => sum + list.pages.length, 0), copies: plan.problems.length ? 0 : plan.copies.length,
  checkedAgainstCorpus: Boolean(inCorpus), dryRun: values['dry-run'], problems: plan.problems.length, firstProblems: plan.problems.slice(0, 8) }));
if (plan.problems.length) process.exit(1);
