import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import { readJson } from '../lib/rag-v2/catalog.js';
import { hash, stable } from '../lib/rag-v2/contracts.js';
import { FilePolicy } from '../lib/rag-v2/search/policy.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { buildPilotManifest, costNanos, formatUsd } from '../lib/rag-v2/search/pilot-manifest.js';
import { runPilot, StoredEmbedding } from '../lib/rag-v2/search/pilot-runner.js';
import { modelProjection, modelSourceMetadata } from '../lib/rag-v2/search/model-context.js';
import { structuralRole } from '../lib/rag-v2/search/structural-role.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { evaluateRetrieval, resolveAnchorGroups } from '../lib/rag-v2/search/evaluator.js';
import { pilotReport } from '../lib/rag-v2/search/pilot-report.js';
dotenv.config({ path: '.env.local', quiet: true });

let postgres;
try {
  const { values } = parseArgs({ options: {
    tenant: { type: 'string', default: 'sotsiaalai-development' }, subject: { type: 'string', default: 'operator' },
    store: { type: 'string', default: 'tmp/rag-v2-sample' }, policy: { type: 'string', default: 'tmp/rag-v2-services/sample-policy.json' },
    connections: { type: 'string', default: 'tmp/rag-v2-services/connections.json' }, baseline: { type: 'string', default: 'tmp/rag-v2-query/m2-2-plan.json' },
    'baseline-audit': { type: 'string', default: 'tmp/rag-v2-query/evidence.json' },
    questions: { type: 'string', default: 'tests/evaluation/rag-v2-queries.json' }, groups: { type: 'string', default: 'tests/evaluation/rag-v2-anchor-groups.json' },
    approval: { type: 'string' }, price: { type: 'string' }, execute: { type: 'boolean', default: false },
  } });
  const root = path.resolve('tmp/rag-v2-m2-2'); await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const context = { tenant: values.tenant, subject: values.subject, usage: 'development_only' }, policy = new FilePolicy(values.policy);
  const allowed = await policy.allowed(context), snapshot = await loadSnapshot(values.store, values.tenant, allowed.documents);
  const questions = await readJson(values.questions), groups = await readJson(values.groups), baseline = await readJson(values.baseline);
  const prepared = buildPilotManifest(snapshot, questions, baseline);
  const anchors = resolveAnchorGroups(snapshot, groups);
  const audit = await readJson(values['baseline-audit']);
  if (audit.tenant !== values.tenant) throw new Error('baseline_tenant_mismatch');
  const enriched = audit.evidence.map(entry => {
    const b = snapshot.bundles.find(b => b.document.id === entry.document_id && b.version.id === entry.document_version_id);
    const c = b?.chunks.find(c => c.id === entry.chunk_id);
    if (!c || c.source_text !== entry.source_text || stable(c.span_ids) !== stable(entry.span_ids)) throw new Error('baseline_source_mismatch');
    return { ...entry, source_metadata: modelSourceMetadata(b) };
  });
  const roles = snapshot.bundles.flatMap(b=>b.chunks.map(c=>({ chunk_id:c.id, ...structuralRole(c,b) })));
  const same = modelProjection(enriched, audit), selected = enriched.filter(e=>roles.find(r=>r.chunk_id===e.chunk_id).evidence_eligible);
  const compact = modelProjection(selected, audit);
  const comparison = { stored_legacy_context_tokens: audit.measurements.context_tokens,
    remeasured_legacy_sum_entry_tokens: audit.evidence.reduce((n,e)=>n+tokenCount(JSON.stringify(e)),0),
    full_audit_tokens: tokenCount(JSON.stringify(audit)), compact_same_selection: same.measurements,
    compact_role_filtered: compact.measurements, before_count: enriched.length, after_count: selected.length, structural_roles: roles };
  await fs.writeFile(path.join(root,'egress-manifest.json'),JSON.stringify({ ...prepared.manifest, sha256: prepared.manifest_sha256 },null,2),{mode:0o600});
  await fs.writeFile(path.join(root,'context-comparison.json'),JSON.stringify(comparison,null,2),{mode:0o600});
  await fs.writeFile(path.join(root,'compact-example.json'),JSON.stringify(compact,null,2),{mode:0o600});
  await fs.writeFile(path.join(root,'baseline-audit.json'),JSON.stringify(audit,null,2),{mode:0o600});
  await fs.writeFile(path.join(root,'resolved-anchor-groups.json'),JSON.stringify(anchors,null,2),{mode:0o600});
  const approval = values.approval ? await readJson(values.approval) : null, price = values.price ? await readJson(values.price) : null;
  const run = await runPilot({ prepared, approval, price, policy, context, root: path.join(root,'usage'), execute: values.execute,
    apiKey: process.env.OPENAI_API_KEY, onProgress: progress => console.log(JSON.stringify({event:'embedding_progress',...progress})) });
  const summary = { ...run, ledger: undefined, manifest_sha256: prepared.manifest_sha256, matches_baseline: prepared.matches_baseline,
    differences: prepared.differences, model_context_tokens_before: audit.measurements.context_tokens,
    model_context_tokens_after: compact.measurements.model_context_tokens,
    estimated_cost_usd: price ? formatUsd(costNanos(prepared.manifest.total_input_tokens,price)) : null };
  if (run.ledger) summary.usage = { transport: run.ledger.transport, reserved_attempts:run.ledger.reserved_attempts,
    succeeded:run.ledger.entries.filter(e=>e.status==='succeeded').length, unknown:run.ledger.entries.filter(e=>e.status!=='succeeded').length,
    reserved_tokens:run.ledger.reserved_tokens, reserved_cost_usd:formatUsd(run.ledger.reserved_nano_usd),
    actual_usage_tokens:run.ledger.entries.filter(e=>e.status==='succeeded').reduce((n,e)=>n+e.usage.prompt_tokens,0),
    unknown_reported_usage:run.ledger.entries.filter(e=>e.status!=='succeeded').map(e=>e.reported_usage ?? null),
    usage_based_cost_usd:run.ledger.entries.some(e=>e.status==='succeeded') ? formatUsd(costNanos(run.ledger.entries.filter(e=>e.status==='succeeded').reduce((n,e)=>n+e.usage.prompt_tokens,0),price)) : null,
    billing_state:run.state==='complete'?'calculated_from_validated_usage_not_invoice':'partial_usage_unknown_remaining',
    request_ids:run.ledger.entries.map(e=>e.request_id).filter(Boolean), ledger_sha256:hash(stable(run.ledger)) };
  await fs.writeFile(path.join(root,'pilot-run.json'),JSON.stringify(summary,null,2),{mode:0o600});
  if (run.state === 'complete') {
    const embeddings = await StoredEmbedding.load(run.directory,values.tenant), config=await readJson(values.connections);
    postgres=new PostgresCatalog(config.postgresUrl); const qdrant=new QdrantIndex(config.qdrantUrl,config.qdrantKey);
    const indexed=await indexSnapshot({snapshot,postgres,qdrant,embedding:embeddings});
    const results=await evaluateRetrieval({snapshot,questions,groups,postgres,qdrant,embedding:embeddings,policy,context});
    results.index=indexed; results.usage=summary.usage;
    const resultPath=path.join(root,'pilot-results.json');
    try { await fs.writeFile(resultPath,JSON.stringify(results,null,2),{flag:'wx',mode:0o600});
      await fs.writeFile(path.join(root,'pilot-report.html'),pilotReport(results,summary.usage),{flag:'wx',mode:0o600}); }
    catch(e){if(e.code!=='EEXIST')throw e; console.log(JSON.stringify({event:'first_pilot_result_preserved'}));}
    summary.rows=results.rows.length;summary.case_failures=results.failures;
  }
  console.log(JSON.stringify(summary,null,2));
  if (!prepared.matches_baseline || run.state === 'stopped_unknown') process.exitCode=1;
} catch(error) {console.error(JSON.stringify({ok:false,code:error.code || error.message || 'pilot_failed'}));process.exitCode=1;}
finally {if(postgres)await postgres.close();}
