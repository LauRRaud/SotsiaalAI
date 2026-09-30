#!/usr/bin/env node
// The corpus refresh path (ADR-059), after `rag-v2-law-validity.mjs check --download DIR` or
// `rag-v2-municipal-acts.mjs scan --download DIR`:
//   register --from DIR --out WORK [--root Andmebaasi]
//     Registers the downloaded Riigi Teataja XML (new acts added, changed bytes replaced, derived annexes read again)
//     and writes WORK/selection.json for `rag-v2-ingest-batch.mjs --mode plan` and WORK/register.json; replaced bytes go
//     to WORK/previous. WORK keeps the registry it started from and its state: the same command completes a stopped
//     work (take it up with the same WORK), and on a finished one prints the same summary and writes nothing. A new
//     refresh takes a new WORK; it refuses a registry a stopped work left half written.
//   review --draft WORK/review-draft.json --out WORK/review.json --reviewer "<who, on whose instruction>"
//     Writes the review when every item is clean; otherwise lists the items a person has to decide (exit 2).
//   package --store S --policy PREVIOUS/policy.json --review WORK/review.json --out OUT [--tenant T] [--remove FILE]
//     After publication: OUT/policy.json, OUT/ship.tgz (the store head and the new versions) and OUT/ship.json with its
//     hash and the head generations the server run checks (scripts/rag-v2-corpus-run.sh). --remove takes the municipal
//     scan's report (its `superseded` acts) or a list of { document_id, reason } to leave the policy (ADR-058).
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { hash, id } from '../lib/rag-v2/contracts.js';
import { readActive } from '../lib/rag-v2/catalog.js';
import { autoReview, nextPolicy, registerDownloads } from '../lib/rag-v2/corpus-refresh.js';

const usage = () => Object.assign(new Error('usage'), { code: 'corpus_refresh_usage' });
try {
  const [mode, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { from: { type: 'string' }, out: { type: 'string' }, root: { type: 'string', default: 'Andmebaasi' },
    draft: { type: 'string' }, reviewer: { type: 'string' }, store: { type: 'string' }, policy: { type: 'string' }, review: { type: 'string' },
    tenant: { type: 'string', default: 'sotsiaalai-corpus' }, remove: { type: 'string' } } });
  if (mode === 'register') {
    if (!values.from || !values.out) throw usage();
    const result = await registerDownloads({ root: values.root, from: values.from, work: values.out });
    const summary = { added: result.added.length, replaced: result.replaced.length, unchanged: result.unchanged.length,
      annexes: result.annexes.length, knowledge_to_rebind: result.knowledge, selection: result.selection.length };
    console.log(JSON.stringify(summary));
    if (result.knowledge.length) console.error(`Knowledge cards to rebind first: node scripts/rag-v2-knowledge-reanchor.mjs --input-root ${values.root} --previous-root ${path.join(values.out, 'previous')} --write`);
  } else if (mode === 'review') {
    if (!values.draft || !values.out || !values.reviewer) throw usage();
    const outcome = autoReview(JSON.parse(await fs.readFile(values.draft, 'utf8')), { reviewer: values.reviewer });
    if (outcome.held) { console.log(JSON.stringify({ review: 'held', items: outcome.held }, null, 1)); process.exitCode = 2; }
    else {
      await fs.writeFile(values.out, `${JSON.stringify(outcome.review, null, 2)}\n`, { flag: 'wx' });
      console.log(JSON.stringify({ review: 'written', items: outcome.review.items.length }));
    }
  } else if (mode === 'package') {
    if (!values.store || !values.policy || !values.review || !values.out) throw usage();
    const tenantDir = path.resolve(values.store, id('tenant', values.tenant)), active = await readActive(tenantDir);
    const review = JSON.parse(await fs.readFile(values.review, 'utf8'));
    const listed = values.remove ? JSON.parse(await fs.readFile(values.remove, 'utf8')) : [];
    const remove = (Array.isArray(listed) ? listed : listed.superseded ?? []).map(entry => ({ document_id: entry.document_id,
      reason: entry.reason && entry.id ? `${entry.id} ${entry.reason}${entry.replaced_by ? ` ${entry.replaced_by}` : ''}: ${entry.title}` : entry.reason }));
    const next = nextPolicy(JSON.parse(await fs.readFile(values.policy, 'utf8')), review, active, values.tenant, remove);
    await fs.mkdir(values.out, { recursive: true });
    await fs.writeFile(path.join(values.out, 'policy.json'), JSON.stringify(next.policy));
    // A relative archive name: GNU tar reads "C:\..." as a remote host.
    const ship = path.resolve(values.out, 'ship.tgz');
    const tar = spawnSync('tar', ['czf', 'ship.tgz', '-C', tenantDir, 'active.json', 'publications', ...next.versions.map(version => `versions/${version}`)],
      { cwd: path.resolve(values.out), stdio: 'inherit' });
    if (tar.status !== 0) throw Object.assign(new Error('tar'), { code: 'corpus_refresh_tar_failed' });
    const info = { sha256: hash(await fs.readFile(ship)), base_generation: review.base_generation, head_generation: active.generation,
      policy_documents: next.policy.tenants[values.tenant].operator.length, added_documents: next.added, removed_documents: next.removed,
      versions: next.versions.length };
    await fs.writeFile(path.join(values.out, 'ship.json'), `${JSON.stringify(info, null, 2)}\n`);
    console.log(JSON.stringify(info));
  } else throw usage();
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/u.test(error.code) ? error.code : 'corpus_refresh_failed',
    ...(error.code ? {} : { message: String(error.message).slice(0, 300) }) }));
  process.exitCode = 1;
}
