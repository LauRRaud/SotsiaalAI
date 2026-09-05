import { performance } from 'node:perf_hooks';
import { fail, hash, stable } from '../contracts.js';
import { retrieve } from './retrieval.js';
import { indexUnit } from './embedding.js';

export function resolveAnchorGroups(snapshot, groups) {
  if (!groups?.families || Array.isArray(groups.families)) fail('invalid_anchor_groups');
  return Object.fromEntries(Object.entries(groups.families).map(([family, required]) => {
    if (!Array.isArray(required) || new Set(required.map(group => group.id)).size !== required.length) fail('invalid_anchor_groups');
    return [family, required.map(group => {
      if (typeof group.id !== 'string' || !group.id || !Array.isArray(group.alternatives) || !group.alternatives.length) fail('invalid_anchor_group');
      return { ...group, alternatives: group.alternatives.map(anchor => {
        const pdfHash = anchor.pdf_sha256 ?? groups.source_pdf_sha256;
        if (!/^[a-f0-9]{64}$/.test(pdfHash ?? '') || !Number.isInteger(anchor.pdf_page) || anchor.pdf_page < 1
          || typeof anchor.contains !== 'string' || !anchor.contains) fail('invalid_anchor');
        const matches = snapshot.bundles.filter(bundle => bundle.version.pdf_hash === pdfHash);
        if (matches.length !== 1) fail('anchor_asset_missing');
        const bundle = matches[0];
        const spans = bundle.spans.filter(span => span.pdf_page === anchor.pdf_page && span.source_text.includes(anchor.contains));
        if (!spans.length) fail('anchor_source_missing');
        return { ...anchor, pdf_sha256: pdfHash, document_id: bundle.document.id, version_id: bundle.version.id, span_ids: spans.map(span => span.id) };
      }) };
    })];
  }));
}
export function anchorCoverage(entries, required) {
  return required.map(group => ({ id: group.id, covered: group.alternatives.some(a => entries.some(e =>
    e.document_id === a.document_id && e.document_version_id === a.version_id && e.pdf_pages.includes(a.pdf_page)
    && a.span_ids.some(s => e.span_ids.includes(s)) && e.source_text.includes(a.contains))) }));
}
export function validateEvaluationQuestions(questions) {
  if (!questions || !Array.isArray(questions.cases) || !questions.cases.length) fail('invalid_evaluation_questions');
  const familySplits = new Map(), ids = new Set();
  for (const question of questions.cases) {
    if (!question || typeof question.id !== 'string' || !question.id || ids.has(question.id)
      || typeof question.family !== 'string' || !question.family || typeof question.query !== 'string' || !question.query
      || !['et', 'en', 'ru'].includes(question.language)) fail('invalid_evaluation_question');
    ids.add(question.id);
    const split = question.split ?? 'legacy';
    if (!['development', 'control', 'legacy'].includes(split)) fail('invalid_evaluation_split');
    if (familySplits.has(question.family) && familySplits.get(question.family) !== split) fail('evaluation_family_split_leakage');
    familySplits.set(question.family, split);
  }
  return familySplits;
}
export async function evaluateRetrieval({ snapshot, questions, groups, postgres, qdrant, embedding, policy, context }) {
  const anchors = resolveAnchorGroups(snapshot, groups); // Resolve before querying, never from winners.
  const methods = [
    { name: 'lexical', method: 'lexical', topK: 5, graph: false },
    { name: 'vector', method: 'vector', topK: 5, graph: false },
    { name: 'hybrid', method: 'hybrid', topK: 5, graph: false },
    { name: 'hybrid_structure', method: 'hybrid', topK: 3, graph: true },
  ];
  const topKValues = questions.top_k ?? [1, 3, 5];
  if (stable(topKValues) !== stable([1, 3, 5])) fail('unsupported_evaluation_top_k');
  const contextTokens = questions.context_tokens ?? 6000;
  if (!Number.isInteger(contextTokens) || contextTokens < 1 || contextTokens > 32000) fail('invalid_evaluation_context_budget');
  const familySplits = validateEvaluationQuestions(questions);
  const rows = [], start = performance.now();
  const rawEntries = new Map(snapshot.bundles.flatMap(b => b.chunks.map(c => [indexUnit(c, b, embedding.config).id, {
    document_id: b.document.id, document_version_id: b.version.id, title: b.document.fields.title.value,
    source_text: c.source_text, pdf_pages: c.pdf_pages, span_ids: c.span_ids,
  }])));
  for (const question of questions.cases) for (const method of methods) {
    const before = embedding.reads ?? embedding.calls ?? 0;
    const packet = await retrieve({ postgres, qdrant, embedding, policy, context, allowLexicalFallback: false,
      query: { text: question.query, language: question.language, method: method.method, graph: method.graph,
        includeDocumentLabels: false, contextMode: 'compact', finalLimit: 5,
        limits: { topK: method.topK, perDocument: 5, contextTokens, graphAdditions: 2, graphSteps: 8, candidates: 40 } } });
    const required = anchors[question.family]; if (!required) fail('question_anchor_family_missing');
    const ranking = packet.raw_rankings[method.method] || [];
    const coverage = anchorCoverage(packet.evidence, required);
    const top = Object.fromEntries([1, 3, 5].map(k => {
      const entries = ranking.slice(0, k).map(r => rawEntries.get(r.id)).filter(Boolean);
      return [k, { actual_count: entries.length, groups: anchorCoverage(entries, required),
        all_required: required.length ? anchorCoverage(entries, required).every(g => g.covered) : null }];
    }));
    const first = ranking.findIndex(r => anchorCoverage([rawEntries.get(r.id)].filter(Boolean), required).some(g => g.covered));
    const expectation = question.expected_metadata ?? (question.family === 'bibliography' && questions.source_pdf_sha256
      ? { pdf_sha256: questions.source_pdf_sha256, field: 'authors' } : null);
    let metadataFound = null, metadataProvenance = null;
    if (expectation) {
      if (expectation.field !== 'authors' || !/^[a-f0-9]{64}$/.test(expectation.pdf_sha256 ?? '')) fail('invalid_metadata_expectation');
      const sources = snapshot.bundles.filter(bundle => bundle.version.pdf_hash === expectation.pdf_sha256);
      if (sources.length !== 1) fail('metadata_asset_missing');
      const source = sources[0], expectedValue = expectation.value ?? source.document.fields.authors.value;
      metadataFound = packet.evidence.some(entry => entry.document_id === source.document.id && stable(entry.bibliography.authors) === stable(expectedValue));
      metadataProvenance = metadataFound ? source.document.fields.authors.provenance : null;
    }
    const expectedDocuments = new Set(required.flatMap(group => group.alternatives.map(anchor => anchor.document_id)));
    if (expectation) {
      const source = snapshot.bundles.find(bundle => bundle.version.pdf_hash === expectation.pdf_sha256);
      if (source) expectedDocuments.add(source.document.id);
    }
    const expectedSupport = question.expected_support ?? (question.kind === 'unanswerable_in_supplied_corpus' ? 'absent' : 'full');
    if (!['full', 'partial', 'absent'].includes(expectedSupport)) fail('invalid_expected_support');
    if (expectedSupport === 'absent' && required.length || expectedSupport !== 'absent' && !required.length && !expectation) fail('evaluation_support_contract_mismatch');
    const coveredCount = coverage.filter(group => group.covered).length;
    const supportClass = !required.length ? 'not_applicable' : coveredCount === required.length ? 'full' : coveredCount ? 'partial' : 'absent';
    const graphAdded = packet.evidence.filter(entry => typeof entry.selection.reason === 'object').map(entry => entry.unit_id);
    const selectedIds = new Set(packet.evidence.map(entry => entry.unit_id));
    const displaced = method.graph ? ranking.slice(0, 5).map(row => row.id).filter(id => !selectedIds.has(id)) : [];
    const sourceTexts = packet.evidence.map(e => e.source_text);
    rows.push({ question_id: question.id, family: question.family, split: question.split ?? 'legacy', language: question.language,
      kind: question.kind, expected_support: expectedSupport, method: method.name,
      state: packet.state, first_anchor_rank: first < 0 ? null : first + 1, top_k: top, final_groups: coverage,
      all_required_in_final_context: required.length ? coverage.every(g => g.covered) : null,
      observed_support: supportClass, metadata_author_available: metadataFound, metadata_author_provenance: metadataProvenance,
      expected_document_ids: [...expectedDocuments].sort(),
      selected_sources: packet.evidence.map(entry => ({ document_id: entry.document_id, title: entry.bibliography.title,
        pdf_pages: entry.pdf_pages, expected_source: expectedDocuments.has(entry.document_id), selection_reason: entry.selection.reason })),
      distractor_units_in_raw_top_5: ranking.slice(0, 5).map(row => rawEntries.get(row.id)).filter(entry => entry && !expectedDocuments.has(entry.document_id))
        .map(entry => ({ document_id: entry.document_id, title: entry.title, pdf_pages: entry.pdf_pages })),
      outcome: packet.state === 'error' ? 'technical_error' : expectedSupport === 'absent' ? 'required_evidence_absent_by_dataset'
        : expectation ? metadataFound ? 'metadata_resolved' : 'metadata_missing'
          : expectedSupport === 'partial' ? coverage.every(g => g.covered) ? 'partial_support_found' : 'partial_support_missing'
            : coverage.every(g => g.covered) ? 'support_found' : 'support_missing',
      final_count: packet.evidence.length, graph_additions: packet.measurements.graph_additions,
      graph_opportunity: packet.measurements.graph_opportunity, graph_added_units: graphAdded, graph_displaced_seed_units: displaced,
      repeated_source_chars: sourceTexts.reduce((n, text, i) => n + (sourceTexts.indexOf(text) < i ? text.length : 0), 0),
      vector_reads: (embedding.reads ?? embedding.calls ?? 0) - before, measurements: packet.measurements, packet });
  }
  const misses = rows.filter(r => r.method.startsWith('hybrid') && ['support_missing', 'partial_support_missing', 'metadata_missing', 'technical_error'].includes(r.outcome))
    .map(r => ({ question_id: r.question_id, method: r.method, outcome: r.outcome }));
  return { schema_version: 'rag-v2/retrieval-pilot-results-1', embedding_mode: embedding.config.embedding_mode,
    semantic_claim: embedding.config.embedding_mode === 'real' && embedding.provenance === 'openai_https'
      ? snapshot.bundles.length > 1 ? 'multi_source_case_results_only' : 'single_article_case_results_only' : 'NOT_PROVEN_test_mechanics_only',
    config: embedding.config, questions_sha256: hash(stable(questions)), anchor_groups_sha256: hash(stable(groups)),
    corpus_document_count: snapshot.bundles.length, question_family_count: familySplits.size, question_case_count: questions.cases.length,
    splits: Object.fromEntries([...familySplits.entries()].sort()), methods, fixed_final_limit: 5, fixed_model_context_budget: contextTokens, rows, failures: misses,
    local_evaluation_ms: performance.now() - start, external_embedding_calls_during_comparison: 0, generation_calls: 0,
    limitations: ['Translations are not independent situations.', snapshot.bundles.length > 1 ? 'This is a bounded selected corpus, not a whole-corpus benchmark.' : 'Two content families on one PDF page are not a corpus benchmark.',
      'Unanswerable queries may still return candidates.', 'Dataset support labels are evaluator knowledge, not a runtime sufficiency classifier.', 'No Luna response is tested.'] };
}
