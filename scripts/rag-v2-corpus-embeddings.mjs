#!/usr/bin/env node
// Embedding purchase for a whole published source generation (the local corpus store), one bundle
// in memory at a time. `plan` writes the exact egress manifest, its cost at a verified price and an
// unauthorized approval preview; nothing is sent. `execute` rebuilds the plan, requires it to equal
// the approved baseline and runs the paid runner (approval, price window, spend cap, append-only
// ledger, one input per request, no retries). Vectors land in a private ledger directory that
// rag-v2-index-batch.mjs reads with --vectors. Source text is never written to the plan files.
//   node scripts/rag-v2-corpus-embeddings.mjs --mode plan --store S --tenant T --subject U --policy P --output tmp/DIR [--price F] [--reuse DIR] [--questions F]
//   node scripts/rag-v2-corpus-embeddings.mjs --mode execute ... --baseline tmp/DIR/embedding-plan.json --approval F --price F --output tmp/DIR2
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import { readJson } from '../lib/rag-v2/catalog.js';
import { fail } from '../lib/rag-v2/contracts.js';
import { FilePolicy } from '../lib/rag-v2/search/policy.js';
import { buildCorpusEmbeddingPlan } from '../lib/rag-v2/search/multi-source-plan.js';
import { reusableEmbeddingCatalog, runPilot } from '../lib/rag-v2/search/pilot-runner.js';
import { costNanos, formatUsd } from '../lib/rag-v2/search/pilot-manifest.js';

dotenv.config({ path: '.env.local', quiet: true });
const tmpRoot = path.resolve('tmp');
function privatePath(value) {
  const resolved = path.resolve(value);
  if (!resolved.startsWith(tmpRoot + path.sep)) fail('private_output_required');
  return resolved;
}
const writeNew = (file, value) => fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });

try {
  const { values } = parseArgs({ options: {
    mode: { type: 'string' }, store: { type: 'string' }, tenant: { type: 'string' }, subject: { type: 'string' }, policy: { type: 'string' },
    output: { type: 'string' }, price: { type: 'string' }, reuse: { type: 'string', multiple: true, default: [] },
    questions: { type: 'string', multiple: true, default: [] }, baseline: { type: 'string' }, approval: { type: 'string' },
    'development-only': { type: 'boolean', default: false },
  } });
  if (!['plan', 'execute'].includes(values.mode) || !values['development-only'] || !values.store || !values.tenant || !values.subject
    || !values.policy || !values.output) fail('invalid_corpus_embedding_cli');
  const storeRoot = privatePath(values.store), output = privatePath(values.output);
  await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await fs.mkdir(output, { recursive: false, mode: 0o700 });
  const context = { tenant: values.tenant, subject: values.subject, usage: 'development_only' }, policy = new FilePolicy(values.policy);
  const { documents } = await policy.allowed(context);
  const questionSets = await Promise.all(values.questions.map(async file => ({ name: path.basename(file, path.extname(file)), questions: await readJson(file) })));
  const reuseDirectories = values.reuse.map(value => path.resolve(value));
  const reuseCatalog = reuseDirectories.length ? await reusableEmbeddingCatalog(reuseDirectories, context.tenant) : null;
  const price = values.price ? await readJson(values.price) : null, baseline = values.baseline ? await readJson(values.baseline) : null;
  const prepared = await buildCorpusEmbeddingPlan({ storeRoot, tenant: context.tenant, documents, questionSets, reuseCatalog, price, baseline });
  const summary = { schema_version: 'rag-v2/corpus-embedding-run-1', mode: values.mode, state: 'prepared_not_authorized_not_run',
    documents: prepared.plan.document_count, all_inputs: prepared.plan.all_input_count, reusable_inputs: prepared.plan.reusable_input_count,
    external_inputs: prepared.plan.external_input_count, max_external_input_tokens: prepared.plan.max_total_input_tokens,
    max_api_attempts: prepared.plan.max_api_attempts, estimated_external_cost_usd: prepared.plan.estimated_external_cost_usd,
    egress_manifest_sha256: prepared.manifest_sha256, matches_baseline: prepared.matches_baseline, differences: prepared.differences,
    external_calls_this_run: 0, generation_calls: 0 };
  if (values.mode === 'plan') {
    await writeNew(path.join(output, 'embedding-plan.json'), prepared.plan);
    await writeNew(path.join(output, 'approval.preview.json'), { schema_version: 'rag-v2/pilot-approval-preview-1', state: 'draft_not_authorized',
      material_egress_approved: false, spend_cap_approved: false, approved_by: null, approved_at: null,
      approval_basis: 'Owner must approve this exact manifest and a spend cap before execution.',
      source_plan_id: prepared.manifest.source_plan_id, egress_manifest_sha256: prepared.manifest_sha256, tenant: prepared.manifest.tenant,
      config: prepared.manifest.config, files: prepared.manifest.files, max_api_attempts: prepared.manifest.max_api_attempts,
      max_total_input_tokens: prepared.manifest.total_input_tokens, retries: 0, generation_calls: 0, currency: price?.currency ?? 'USD',
      approved_spend_cap: null });
  } else {
    if (!baseline || !prepared.matches_baseline || !values.approval || !price) fail('approved_unchanged_baseline_required');
    let reported = 0;
    const run = await runPilot({ prepared, approval: await readJson(values.approval), price, policy, context,
      root: path.join(tmpRoot, 'rag-v2-corpus-embeddings', 'usage'), execute: true, apiKey: process.env.OPENAI_API_KEY,
      onProgress: progress => {
        if (progress.succeeded - reported < 500 && progress.succeeded !== progress.total) return;
        reported = progress.succeeded; console.log(JSON.stringify({ event: 'embedding_progress', ...progress }));
      } });
    const succeeded = run.ledger.entries.filter(entry => entry.status === 'succeeded');
    const actualTokens = succeeded.reduce((sum, entry) => sum + entry.usage.prompt_tokens, 0);
    Object.assign(summary, { state: run.state, vectors: run.directory, external_calls_this_run: run.api_attempts_this_run,
      usage: { reserved_attempts: run.ledger.reserved_attempts, succeeded: succeeded.length, unknown: run.ledger.entries.length - succeeded.length,
        reserved_tokens: run.ledger.reserved_tokens, reserved_cost_usd: formatUsd(run.ledger.reserved_nano_usd),
        actual_tokens: actualTokens, usage_cost_usd: formatUsd(costNanos(actualTokens, price)),
        billing_state: run.state === 'complete' ? 'calculated_from_validated_usage_not_invoice' : 'partial_usage_unknown_remaining' } });
  }
  await writeNew(path.join(output, 'run.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
  if (values.mode === 'execute' && summary.state !== 'complete' || baseline && !prepared.matches_baseline) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'corpus_embedding_cli_failed' }));
  process.exitCode = 1;
}
