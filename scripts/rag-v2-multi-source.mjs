import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import dotenv from 'dotenv';
import { readInput, readJson } from '../lib/rag-v2/catalog.js';
import { DEFAULT_CONFIG, fail, hash, stable } from '../lib/rag-v2/contracts.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { resolveAnchorGroups, evaluateRetrieval, validateEvaluationQuestions } from '../lib/rag-v2/search/evaluator.js';
import { buildMultiSourcePlan } from '../lib/rag-v2/search/multi-source-plan.js';
import { reusableEmbeddingCatalog, runPilot } from '../lib/rag-v2/search/pilot-runner.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { indexSnapshot } from '../lib/rag-v2/search/indexing.js';
import { costNanos, formatUsd } from '../lib/rag-v2/search/pilot-manifest.js';
import { artifactProvenance, gitProvenance } from '../lib/rag-v2/search/artifact-provenance.js';
import { pilotReport } from '../lib/rag-v2/search/pilot-report.js';
import { MockEmbedding } from '../lib/rag-v2/search/embedding.js';

dotenv.config({ path: '.env.local', quiet: true });
const tmpRoot = path.resolve('tmp');
function privatePath(value) {
  const resolved = path.resolve(value);
  if (!resolved.startsWith(tmpRoot + path.sep)) fail('private_output_required');
  return resolved;
}
async function writeNew(file, value) {
  await fs.writeFile(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}
function validateQuestionContract(questions, resolved) {
  validateEvaluationQuestions(questions);
  for (const question of questions.cases) {
    const required = resolved[question.family];
    if (!required) fail('question_anchor_family_missing');
    const expected = question.expected_support ?? (question.kind === 'unanswerable_in_supplied_corpus' ? 'absent' : 'full');
    if (!['full', 'partial', 'absent'].includes(expected)
      || (expected === 'absent' && required.length) || (expected !== 'absent' && !required.length && !question.expected_metadata)) fail('evaluation_support_contract_mismatch');
  }
}
function approvalPreview(prepared, price) {
  return { schema_version: 'rag-v2/pilot-approval-preview-1', state: 'draft_not_authorized', material_egress_approved: false,
    spend_cap_approved: false, approved_by: null, approved_at: null,
    approval_basis: 'Owner must approve this exact manifest and a spend cap before execution.',
    source_plan_id: prepared.manifest.source_plan_id, egress_manifest_sha256: prepared.manifest_sha256,
    tenant: prepared.manifest.tenant, config: prepared.manifest.config, files: prepared.manifest.files,
    max_api_attempts: prepared.manifest.max_api_attempts, max_total_input_tokens: prepared.manifest.total_input_tokens,
    retries: 0, generation_calls: 0, currency: price?.currency ?? 'USD', approved_spend_cap: null };
}
function usageSummary(run, plan, price) {
  const succeeded = run.ledger.entries.filter(entry => entry.status === 'succeeded');
  const actualTokens = succeeded.reduce((sum, entry) => sum + entry.usage.prompt_tokens, 0);
  return { transport: run.ledger.transport, new_external_attempts_reserved: run.ledger.reserved_attempts,
    new_external_attempts_this_run: run.api_attempts_this_run, succeeded: succeeded.length,
    unknown: run.ledger.entries.length - succeeded.length, new_external_reserved_tokens: run.ledger.reserved_tokens,
    new_external_actual_tokens: actualTokens, new_external_reserved_cost_usd: formatUsd(run.ledger.reserved_nano_usd),
    new_external_usage_cost_usd: formatUsd(costNanos(actualTokens, price)), reusable_inputs: plan.reusable_input_count,
    reusable_tokens: plan.reusable_input_tokens, generation_calls: 0 };
}

let postgres;
try {
  const { values } = parseArgs({ options: {
    corpus: { type: 'string', default: 'tests/evaluation/multi-source/corpus.json' },
    questions: { type: 'string', default: 'tests/evaluation/multi-source/questions.json' },
    groups: { type: 'string', default: 'tests/evaluation/multi-source/anchor-groups.json' },
    'regression-questions': { type: 'string', default: 'tests/evaluation/rag-v2-queries.json' },
    'regression-groups': { type: 'string', default: 'tests/evaluation/rag-v2-anchor-groups.json' },
    'input-root': { type: 'string', default: '.' }, profile: { type: 'string', default: 'lib/rag-v2/domain-profiles/sotsiaalai.json' },
    store: { type: 'string', default: 'tmp/rag-v2-multi-source/store' }, output: { type: 'string' },
    reuse: { type: 'string', multiple: true, default: [] }, price: { type: 'string' }, baseline: { type: 'string' },
    approval: { type: 'string' }, connections: { type: 'string', default: 'tmp/rag-v2-services/connections.json' },
    execute: { type: 'boolean', default: false }, mechanics: { type: 'boolean', default: false },
  } });
  if (!values.output) fail('output_required');
  if (values.execute && values.mechanics) fail('choose_execute_or_mechanics');
  const inputRoot = path.resolve(values['input-root']), storeRoot = privatePath(values.store), output = privatePath(values.output);
  await fs.mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await fs.mkdir(output, { recursive: false, mode: 0o700 });
  const corpus = await readJson(values.corpus), profile = await readJson(values.profile);
  if (corpus.schema_version !== 'rag-v2/multi-source-corpus-selection-1' || !Array.isArray(corpus.documents)
    || corpus.documents.length < 6 || corpus.documents.length > 10 || typeof corpus.tenant !== 'string') fail('invalid_multi_source_corpus');
  const ingested = [];
  for (const selected of corpus.documents) {
    const metadataBytes = await readInput(inputRoot, selected.metadata_file, DEFAULT_CONFIG.maxMetadataBytes);
    const metadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadataBytes));
    const pdfBytes = await readInput(inputRoot, metadata.source_path, DEFAULT_CONFIG.maxFileBytes);
    if (hash(pdfBytes) !== selected.expected_pdf_sha256 || pdfBytes.length !== selected.expected_size_bytes) fail('corpus_asset_changed');
    const result = await ingest({ tenant: corpus.tenant, inputRoot, metadataFile: selected.metadata_file, storeRoot, profile,
      rights: { access: corpus.use_limits.access, usage: corpus.use_limits.usage } });
    ingested.push({ selected, metadata, result });
  }
  const documentIds = ingested.map(item => item.result.bundle.document.id), context = { tenant: corpus.tenant, subject: 'operator', usage: 'development_only' };
  const policyValue = { tenants: { [corpus.tenant]: { operator: documentIds } } }, policy = new LocalPolicy(policyValue);
  const snapshot = await loadSnapshot(storeRoot, corpus.tenant, documentIds);
  const questions = await readJson(values.questions), groups = await readJson(values.groups);
  const regressionQuestions = await readJson(values['regression-questions']), regressionGroups = await readJson(values['regression-groups']);
  const resolved = resolveAnchorGroups(snapshot, groups), resolvedRegression = resolveAnchorGroups(snapshot, regressionGroups);
  validateQuestionContract(questions, resolved); validateQuestionContract(regressionQuestions, resolvedRegression);
  const reuseDirectories = values.reuse.map(value => path.resolve(value));
  const reuseCatalog = reuseDirectories.length ? await reusableEmbeddingCatalog(reuseDirectories, corpus.tenant) : null;
  const price = values.price ? await readJson(values.price) : null;
  const baseline = values.baseline ? await readJson(values.baseline) : null;
  const questionSets = [{ name: 'multi-source-v1', questions }, { name: 'm2-2-regression', questions: regressionQuestions }];
  const prepared = buildMultiSourcePlan({ snapshot, questionSets, reuseCatalog, price, baseline });
  const corpusManifest = { schema_version: 'rag-v2/multi-source-corpus-manifest-1', created_at: new Date().toISOString(),
    tenant: corpus.tenant, source_generation_id: snapshot.source_generation, snapshot_sha256: snapshot.snapshot_hash,
    purpose: corpus.purpose, same_issue_second_article: corpus.same_issue_second_article, use_limits: corpus.use_limits,
    documents: ingested.map(({ selected, metadata, result }) => ({ source_path: metadata.source_path,
      source_pdf_sha256: result.bundle.version.pdf_hash, source_size_bytes: result.bundle.assets.find(asset => asset.mime_type === 'application/pdf').size_bytes,
      metadata_file: selected.metadata_file, metadata_sha256: result.bundle.version.metadata_hash,
      document_id: result.bundle.document.id, version_id: result.bundle.version.id, title: result.bundle.document.fields.title.value,
      material_role: selected.material_role, duplicate_of: selected.duplicate_of, rights: result.bundle.document.rights,
      pages: result.bundle.pages.length, chunks: result.bundle.chunks.length, source_spans: result.bundle.spans.length,
      parser_quality_state: result.bundle.report.quality_state, parser_warnings: result.bundle.report.warnings.map(warning => warning.code),
      layout_review: selected.layout_review })),
  };
  corpusManifest.manifest_sha256 = hash(stable(corpusManifest));
  await writeNew(path.join(output, 'corpus-manifest.json'), corpusManifest);
  await writeNew(path.join(output, 'policy.json'), policyValue);
  await writeNew(path.join(output, 'resolved-anchor-groups.json'), resolved);
  await writeNew(path.join(output, 'resolved-regression-anchor-groups.json'), resolvedRegression);
  await writeNew(path.join(output, 'evaluation-plan.json'), prepared.plan);
  await writeNew(path.join(output, 'egress-manifest.json'), { ...prepared.manifest, sha256: prepared.manifest_sha256 });
  await writeNew(path.join(output, 'approval.preview.json'), approvalPreview(prepared, price));
  const summary = { schema_version: 'rag-v2/multi-source-run-1', state: 'prepared_not_authorized_not_run', output,
    corpus_documents: snapshot.bundles.length, new_question_families: new Set(questions.cases.map(question => question.family)).size,
    new_question_cases: questions.cases.length, regression_cases: regressionQuestions.cases.length,
    all_inputs: prepared.plan.all_input_count, reusable_inputs: prepared.plan.reusable_input_count,
    external_inputs: prepared.plan.external_input_count, max_external_input_tokens: prepared.plan.max_total_input_tokens,
    max_api_attempts: prepared.plan.max_api_attempts, estimated_external_cost_usd: prepared.plan.estimated_external_cost_usd,
    egress_manifest_sha256: prepared.manifest_sha256, external_calls_this_run: 0, generation_calls: 0,
    matches_baseline: prepared.matches_baseline, differences: prepared.differences };
  if (values.mechanics) {
    const connections = await readJson(values.connections), embedding = new MockEmbedding();
    postgres = new PostgresCatalog(connections.postgresUrl); const qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
    const index = await indexSnapshot({ snapshot, postgres, qdrant, embedding });
    const usage = { transport: 'deterministic_mock', external_api_attempts_this_run: 0, generation_calls: 0,
      semantic_quality: 'NOT_PROVEN_test_mechanics_only' };
    const git = await gitProvenance(['lib/rag-v2', 'scripts/rag-v2-multi-source.mjs', 'tests/evaluation/multi-source', 'tests/rag-v2-pilot.test.mjs']);
    let technicalErrors = 0;
    for (const set of [{ name: 'multi-source-v1', questions, groups }, { name: 'm2-2-regression', questions: regressionQuestions, groups: regressionGroups }]) {
      const results = await evaluateRetrieval({ snapshot, questions: set.questions, groups: set.groups, postgres, qdrant, embedding, policy, context });
      results.index = index; results.usage = usage;
      technicalErrors += results.rows.filter(row => row.outcome === 'technical_error').length;
      const provenance = artifactProvenance({ runKind: `${set.name}-mock-mechanics`, createdAt: new Date().toISOString(), git, snapshot, index, results,
        evaluationSets: [set], vectorSources: [], apiAttemptsThisRun: 0 });
      await writeNew(path.join(output, `${set.name}-mechanics-provenance.json`), provenance);
      await writeNew(path.join(output, `${set.name}-mechanics-results.json`), { ...results, provenance });
      await writeNew(path.join(output, `${set.name}-mechanics-report.html`), pilotReport(results, usage, provenance));
    }
    summary.mechanics = { state: technicalErrors ? 'failed' : 'complete', embedding_mode: 'mock', technical_errors: technicalErrors, index };
    if (technicalErrors) process.exitCode = 1;
  }
  if (values.execute) {
    if (!baseline || !prepared.matches_baseline || !values.approval || !price) fail('approved_unchanged_baseline_required');
    const approval = await readJson(values.approval);
    const run = await runPilot({ prepared, approval, price, policy, context, root: path.join(output, 'usage'), execute: true,
      apiKey: process.env.OPENAI_API_KEY, onProgress: progress => console.log(JSON.stringify({ event: 'embedding_progress', ...progress })) });
    summary.state = run.state; summary.external_calls_this_run = run.api_attempts_this_run;
    if (run.state === 'complete') {
      const combined = await reusableEmbeddingCatalog([...reuseDirectories, run.directory], corpus.tenant);
      const connections = await readJson(values.connections);
      postgres = new PostgresCatalog(connections.postgresUrl); const qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
      const index = await indexSnapshot({ snapshot, postgres, qdrant, embedding: combined.embedding });
      const usage = usageSummary(run, prepared.plan, price), git = await gitProvenance([
        'lib/rag-v2', 'scripts/rag-v2-multi-source.mjs', 'tests/evaluation/multi-source', 'tests/rag-v2-pilot.test.mjs',
      ]);
      for (const set of [{ name: 'multi-source-v1', questions, groups }, { name: 'm2-2-regression', questions: regressionQuestions, groups: regressionGroups }]) {
        const results = await evaluateRetrieval({ snapshot, questions: set.questions, groups: set.groups, postgres, qdrant,
          embedding: combined.embedding, policy, context });
        results.index = index; results.usage = usage;
        const provenance = artifactProvenance({ runKind: set.name, createdAt: new Date().toISOString(), git, snapshot, index, results,
          evaluationSets: [set], vectorSources: combined.sources, apiAttemptsThisRun: run.api_attempts_this_run });
        await writeNew(path.join(output, `${set.name}-provenance.json`), provenance);
        await writeNew(path.join(output, `${set.name}-results.json`), { ...results, provenance });
        await writeNew(path.join(output, `${set.name}-report.html`), pilotReport(results, usage, provenance));
        summary[`${set.name}_failures`] = results.failures;
      }
      summary.usage = usage; summary.index = index;
    }
  }
  await writeNew(path.join(output, 'run.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
  if (values.execute && summary.state !== 'complete' || baseline && !prepared.matches_baseline) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code || error.message || 'multi_source_evaluation_failed' }));
  process.exitCode = 1;
} finally { if (postgres) await postgres.close(); }
