#!/usr/bin/env node
// Source-anchored knowledge (conditions, exceptions, definitions and their relations) for chosen corpus documents in one
// batch (ADR-054). The requests are the administrator path's own (ADR-008): only the document's canonical text, a strict
// schema, a durable reservation before each call and never a second call for the same request. A large document is
// prepared in parts. Plan and draft make no network call; run is the only paid step.
//   plan:  node scripts/rag-v2-knowledge-batch.mjs --mode plan --store <store> --tenant sotsiaalai-corpus --documents <ids.json>
//            --config <knowledge-config.json> --part-bytes 40000 --out <dir>
//   run:   node scripts/rag-v2-knowledge-batch.mjs --mode run --store <store> --out <dir> --batch <hash printed by plan> [--parallel 4]
//            (OPENAI_API_KEY in the environment)
//   draft: node scripts/rag-v2-knowledge-batch.mjs --mode draft --store <store> --out <dir>
//            writes <dir>/knowledge/<source file>.knowledge.json (the registry's knowledge file) and <dir>/draft-report.json
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fail, hash, stable } from '../lib/rag-v2/contracts.js';
import { readJson, writeJson } from '../lib/rag-v2/catalog.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { knowledgePreparationParts, knowledgePartsDraft, validateKnowledgePreparationConfig, KNOWLEDGE_PREPARATION_VERSION } from '../lib/rag-v2/knowledge-preparation.js';
import { KnowledgeJobs } from '../lib/rag-v2/admin/knowledge-jobs.js';
import { REGISTERED_KNOWLEDGE_SCHEMA } from '../lib/rag-v2/registered-source.js';
import { formatUsd } from '../lib/rag-v2/search/pilot-manifest.js';

const BATCH_SCHEMA = 'rag-v2/knowledge-batch-1', ACTOR = 'knowledge-batch';
const { values: v } = parseArgs({ options: { mode: { type: 'string' }, store: { type: 'string' }, tenant: { type: 'string' }, documents: { type: 'string' },
  config: { type: 'string' }, 'part-bytes': { type: 'string', default: '40000' }, out: { type: 'string' }, batch: { type: 'string' }, parallel: { type: 'string', default: '4' } } });
if (!['plan', 'run', 'draft'].includes(v.mode) || !v.out) fail('usage: --mode plan|run|draft --out <dir> (see the header)');
const out = path.resolve(v.out), planFile = path.join(out, 'plan.json'), planPath = hashValue => path.join(out, 'plans', `${hashValue}.json`);
// The ledger and responses are rewritten as a call proceeds; a whole-file rename keeps each write complete.
const replaceJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`); await fs.rename(temporary, file);
};
const titleOf = bundle => bundle.document.fields?.title?.value || bundle.document.id;
const provenanceOf = bundle => bundle.document.legacy_metadata?.registry_provenance || {};

async function loadPlan() {
  const batch = await readJson(planFile);
  if (batch.schema_version !== BATCH_SCHEMA) fail('knowledge_batch_invalid');
  validateKnowledgePreparationConfig(batch.config);
  return { batch, batchHash: hash(stable(batch)) };
}
async function partPlan(hashValue) {
  const plan = await readJson(planPath(hashValue));
  if (hash(stable(plan.manifest)) !== hashValue || plan.hash !== hashValue || plan.manifest.body_hash !== hash(stable(plan.body))) fail('knowledge_batch_plan_changed');
  return plan;
}
const jobsFor = (batch, documentId) => new KnowledgeJobs({ root: path.join(out, 'runs', documentId), fingerprint: batch.config_hash, config: batch.config,
  writeJson: replaceJson, assertAccess: async () => {} });
const receiptFor = hashValue => ({ job_id: `job_${hashValue}`, actor_id: ACTOR });

if (v.mode === 'plan') {
  if (!v.store || !v.tenant || !v.documents || !v.config) fail('usage: plan needs --store --tenant --documents --config');
  const config = await readJson(v.config), documents = await readJson(v.documents), partBytes = Number(v['part-bytes']);
  validateKnowledgePreparationConfig(config);
  const { bundles } = await loadSnapshot(v.store, v.tenant, documents);
  await fs.mkdir(path.join(out, 'plans'), { recursive: true });
  const entries = [];
  let calls = 0, inputTokens = 0, reserved = 0n;
  for (const bundle of bundles) {
    const plans = knowledgePreparationParts(bundle, config, { partBytes });
    for (const plan of plans) {
      await writeJson(planPath(plan.hash), { hash: plan.hash, manifest: plan.manifest, body: plan.body, sources: plan.sources });
      calls++; inputTokens += plan.manifest.input_tokens_reserved; reserved += BigInt(plan.manifest.reserved_nano_usd);
    }
    const { registry_path: registryPath, source_sha256: sourceSha } = provenanceOf(bundle);
    entries.push({ document_id: bundle.document.id, version_id: bundle.version.id, title: titleOf(bundle), registry_path: registryPath || null,
      source_sha256: sourceSha || null, valid_from: bundle.document.fields?.valid_from?.value ?? null, valid_to: bundle.document.fields?.valid_to?.value ?? null,
      plans: plans.map(plan => plan.hash) });
  }
  const batch = { schema_version: BATCH_SCHEMA, tenant: v.tenant, config, config_hash: hash(stable(config)), part_bytes: partBytes, documents: entries,
    totals: { documents: entries.length, calls, input_tokens_reserved: inputTokens, max_cost_usd: formatUsd(reserved) } };
  await writeJson(planFile, batch);
  console.log(JSON.stringify({ batch: hash(stable(batch)), ...batch.totals,
    documents: entries.map(entry => ({ title: entry.title.slice(0, 70), valid_from: entry.valid_from, parts: entry.plans.length })) }, null, 2));
}

if (v.mode === 'run') {
  const { batch, batchHash } = await loadPlan();
  if (v.batch !== batchHash) fail('knowledge_batch_hash_mismatch');
  if (!v.store) fail('usage: run needs --store');
  const { bundles } = await loadSnapshot(v.store, batch.tenant, batch.documents.map(entry => entry.document_id));
  const byId = new Map(bundles.map(bundle => [bundle.document.id, bundle]));
  const results = [];
  const queue = [...batch.documents];
  const worker = async () => {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const bundle = byId.get(entry.document_id);
      if (bundle?.version.id !== entry.version_id) { results.push({ document_id: entry.document_id, error: 'knowledge_batch_version_changed' }); continue; }
      const jobs = jobsFor(batch, entry.document_id);
      for (const hashValue of entry.plans) {
        const plan = await partPlan(hashValue), started = Date.now();
        let state = 'draft_ready', error = null;
        // A strict single-request draft may refuse the response; the response is kept and the batch draft reads it item by item.
        try { await jobs.run(receiptFor(hashValue), plan, bundle); }
        catch (cause) { state = 'response_kept_or_failed'; error = cause.code || 'knowledge_preparation_failed'; }
        results.push({ document_id: entry.document_id, part: plan.manifest.part?.index ?? 1, parts: plan.manifest.part?.count ?? 1, state, error, ms: Date.now() - started });
        console.log(JSON.stringify(results.at(-1)));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Number(v.parallel) || 1) }, worker));
  console.log(JSON.stringify({ batch: batchHash, calls: results.length, errors: results.filter(result => result.error).length }));
}

if (v.mode === 'draft') {
  const { batch, batchHash } = await loadPlan();
  if (!v.store) fail('usage: draft needs --store');
  const { bundles } = await loadSnapshot(v.store, batch.tenant, batch.documents.map(entry => entry.document_id));
  const byId = new Map(bundles.map(bundle => [bundle.document.id, bundle]));
  const report = { schema_version: `${BATCH_SCHEMA}-draft`, batch: batchHash, documents: [] };
  let input = 0, output = 0;
  for (const entry of batch.documents) {
    const bundle = byId.get(entry.document_id);
    if (bundle?.version.id !== entry.version_id) { report.documents.push({ title: entry.title, error: 'knowledge_batch_version_changed' }); continue; }
    const parts = [], usage = { input: 0, output: 0, reasoning: 0 }, failures = [];
    for (const hashValue of entry.plans) {
      const plan = await partPlan(hashValue);
      const file = path.join(out, 'runs', entry.document_id, 'jobs', receiptFor(hashValue).job_id, 'knowledge-response.json');
      const response = await readJson(file).catch(() => null);
      if (!response || response.schema_version !== KNOWLEDGE_PREPARATION_VERSION || response.plan_hash !== hashValue || response.actor_id !== ACTOR
        || response.config_fingerprint !== batch.config_hash) { failures.push({ part: plan.manifest.part?.index ?? 1, error: 'response_missing' }); continue; }
      usage.input += response.usage?.input || 0; usage.output += response.usage?.output || 0; usage.reasoning += response.usage?.reasoning || 0;
      if (response.error) { failures.push({ part: plan.manifest.part?.index ?? 1, error: response.error }); continue; }
      parts.push({ plan, value: response.value });
    }
    input += usage.input; output += usage.output;
    const draft = parts.length ? knowledgePartsDraft(parts, bundle) : null;
    const counts = draft?.knowledge ? {
      cards: Object.fromEntries(Object.entries(Object.groupBy(draft.knowledge.cards, card => card.kind)).map(([kind, list]) => [kind, list.length])),
      dependencies: Object.fromEntries(Object.entries(Object.groupBy(draft.knowledge.dependencies, edge => edge.type)).map(([type, list]) => [type, list.length])),
      gaps: draft.knowledge.gaps.length } : null;
    report.documents.push({ title: entry.title, document_id: entry.document_id, registry_path: entry.registry_path, valid_from: entry.valid_from,
      counts, dropped: draft?.dropped ?? null, missing_parts: draft?.missing_parts ?? entry.plans.map((_, i) => i + 1), failures, usage });
    if (!draft?.knowledge || !entry.registry_path || !entry.source_sha256) continue;
    const name = path.basename(entry.registry_path).replace(/\.[^.]+$/u, '');
    await replaceJson(path.join(out, 'knowledge', `${name}.knowledge.json`), {
      schema_version: REGISTERED_KNOWLEDGE_SCHEMA, source_path: entry.registry_path, source_sha256: entry.source_sha256,
      preparation: { schema_version: draft.schema_version, model: batch.config.model, reasoning: batch.config.reasoning, batch: batchHash,
        plan_hashes: draft.plan_hashes, draft_hash: draft.hash, source_version_id: draft.source_version_id, verification_state: draft.verification_state,
        dropped: draft.dropped, missing_parts: draft.missing_parts, usage },
      knowledge: draft.knowledge });
  }
  report.usage = { input, output, cost_usd_at_config_prices: formatUsd(BigInt(input) * BigInt(batch.config.prices.input) + BigInt(output) * BigInt(batch.config.prices.output)) };
  await replaceJson(path.join(out, 'draft-report.json'), report);
  console.log(JSON.stringify(report, null, 2));
}
