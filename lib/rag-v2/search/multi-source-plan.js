import { fail, hash, id, stable } from '../contracts.js';
import { assertSnapshot } from './snapshot.js';
import { checkedTokens } from './embedding.js';
import { costNanos, formatUsd, realEmbeddingConfig, validatePrice } from './pilot-manifest.js';

function evaluationInputs(snapshot, questionSets, config) {
  const byHash = new Map();
  const add = (text, use) => {
    const inputHash = hash(text), tokens = checkedTokens(text, config), prior = byHash.get(inputHash);
    if (prior && prior.text !== text) fail('evaluation_input_hash_collision');
    if (prior) prior.uses.push(use);
    else byHash.set(inputHash, { text, input_hash: inputHash, tokens, uses: [use] });
  };
  for (const bundle of snapshot.bundles) for (const chunk of bundle.chunks) add(chunk.retrieval_text, {
    kind: 'document', document_id: bundle.document.id, version_id: bundle.version.id, chunk_id: chunk.id,
  });
  for (const set of questionSets) {
    if (!set || typeof set.name !== 'string' || !set.name || !Array.isArray(set.questions?.cases)) fail('invalid_evaluation_question_set');
    for (const question of set.questions.cases) add(question.query, {
      kind: 'query', question_set: set.name, query_id: question.id, family: question.family, language: question.language,
    });
  }
  return [...byHash.values()].map(input => ({ ...input, uses: input.uses.sort((a, b) => stable(a).localeCompare(stable(b))) }))
    .sort((a, b) => a.input_hash.localeCompare(b.input_hash));
}

export function buildMultiSourcePlan({ snapshot, questionSets, reuseCatalog = null, price = null, baseline = null }) {
  assertSnapshot(snapshot);
  const config = realEmbeddingConfig();
  if (reuseCatalog && stable(reuseCatalog.config) !== stable(config)) fail('stored_embedding_config_mismatch');
  if (price) validatePrice(price);
  const allInputs = evaluationInputs(snapshot, questionSets, config);
  const reusable = [], external = [];
  for (const input of allInputs) {
    const receipt = reuseCatalog?.receipts.get(input.input_hash);
    if (receipt) {
      if (receipt.tokens !== input.tokens) fail('stored_embedding_token_mismatch');
      reusable.push({ ...input, receipt });
    } else external.push(input);
  }
  const files = snapshot.bundles.map(bundle => ({ document_id: bundle.document.id, version_id: bundle.version.id,
    pdf_sha256: bundle.version.pdf_hash, metadata_sha256: bundle.version.metadata_hash })).sort((a, b) => a.document_id.localeCompare(b.document_id));
  const questionSetsDescriptor = questionSets.map(set => ({ name: set.name, sha256: hash(stable(set.questions)),
    cases: set.questions.cases.length, families: new Set(set.questions.cases.map(question => question.family)).size }));
  const sourcePlanId = id('multi_source_plan', snapshot.tenant, snapshot.snapshot_hash, files, questionSetsDescriptor,
    reusable.map(input => ({ input_hash: input.input_hash, receipt: input.receipt })));
  const externalInputs = external.map((input, index) => ({ id: id('pilot_input', 'multi_source', index, input.input_hash),
    kind: input.uses.every(use => use.kind === 'query') ? 'query' : 'document', input_hash: input.input_hash, tokens: input.tokens, uses: input.uses }));
  const manifest = { schema_version: 'rag-v2/egress-manifest-2', tenant: snapshot.tenant, source_plan_id: sourcePlanId, config, files,
    inputs: externalInputs, reused_inputs: reusable.map(input => ({ input_hash: input.input_hash, tokens: input.tokens,
      uses: input.uses, receipt: input.receipt })), all_input_count: allInputs.length,
    all_input_tokens: allInputs.reduce((sum, input) => sum + input.tokens, 0),
    reused_input_count: reusable.length, reused_input_tokens: reusable.reduce((sum, input) => sum + input.tokens, 0),
    total_input_tokens: external.reduce((sum, input) => sum + input.tokens, 0), max_api_attempts: external.length,
    retries: 0, generation_calls: 0 };
  const manifestSha256 = hash(stable(manifest));
  const differences = [];
  if (baseline) {
    if (baseline.schema_version !== 'rag-v2/multi-source-evaluation-plan-1') differences.push('baseline_schema');
    if (baseline.egress_manifest_sha256 !== manifestSha256 || stable(baseline.egress_manifest) !== stable(manifest)) differences.push('egress_manifest');
  }
  const preparedInputs = external.map((input, index) => ({ ...externalInputs[index], text: input.text }));
  const plan = { schema_version: 'rag-v2/multi-source-evaluation-plan-1', plan_id: sourcePlanId,
    state: 'prepared_not_authorized_not_run', tenant: snapshot.tenant, corpus_snapshot_sha256: snapshot.snapshot_hash,
    source_generation_id: snapshot.source_generation, question_sets: questionSetsDescriptor,
    document_count: snapshot.bundles.length, all_input_count: allInputs.length, reusable_input_count: reusable.length,
    external_input_count: external.length, all_input_tokens: manifest.all_input_tokens, reusable_input_tokens: manifest.reused_input_tokens,
    max_total_input_tokens: manifest.total_input_tokens, max_api_attempts: manifest.max_api_attempts,
    estimated_external_cost_usd: price ? formatUsd(costNanos(manifest.total_input_tokens, price)) : null,
    price: price ? { input_per_million: price.input_per_million, currency: price.currency, version: price.version,
      source: price.source, checked_at: price.checked_at } : null,
    request_strategy: 'one missing input per request; verified stored vectors reused; no retries', generation_calls: 0,
    egress_manifest_sha256: manifestSha256, egress_manifest: manifest };
  return { plan, manifest, manifest_sha256: manifestSha256, inputs: preparedInputs,
    reusable_inputs: reusable, matches_baseline: baseline ? differences.length === 0 : true, differences };
}
