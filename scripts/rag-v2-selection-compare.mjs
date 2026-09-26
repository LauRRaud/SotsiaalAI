// Replays recorded real candidate lists through the production selector. No index writes or provider calls.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { fail, hash, id, stable } from '../lib/rag-v2/contracts.js';
import { readJson } from '../lib/rag-v2/catalog.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { ledgerFiles, StoredEmbedding } from '../lib/rag-v2/search/pilot-runner.js';
import { indexUnit } from '../lib/rag-v2/search/embedding.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, assertProfileGeneration, RETRIEVAL_PROFILE_IDS } from '../lib/rag-v2/search/profiles.js';
import { verifyInputs, verifyRubric, makeReviewPacket, validateDecisions, canonicalContext, contextId, assessContext, digest } from '../lib/rag-v2/evaluation/rubric-v2.js';

let networkAttempts = 0;
const deny = () => { networkAttempts++; fail('selection_replay_network_forbidden'); };
globalThis.fetch = deny; net.Socket.prototype.connect = deny;
http.request = deny; http.get = deny; https.request = deny; https.get = deny;
const equal = (a, b, code) => { if (stable(a) !== stable(b)) fail(code); };
const counts = rows => rows.reduce((sum, row) => { sum[row.assessment.status]++; return sum; }, { full: 0, partial: 0, absent: 0, needs_review: 0 });
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pre = x => `<pre>${esc(typeof x === 'string' ? x : JSON.stringify(x, null, 2))}</pre>`;
const page = (title, body) => `<!doctype html><html lang="et"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${esc(title)}</title><style>body{font:16px/1.6 system-ui;max-width:1200px;margin:32px auto;padding:0 20px;color:#243733;background:#fafaf5}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.5 ui-monospace,monospace;background:#edf1ec;padding:12px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccd6ce;padding:8px;text-align:left;vertical-align:top}details{margin:14px 0;border:1px solid #ccd6ce;padding:12px}small{overflow-wrap:anywhere}</style><h1>${esc(title)}</h1>${body}</html>`;

function transition(old, next) {
  if ([old, next].some(row => row.assessment.status === 'needs_review')) return 'unresolved';
  if (old.assessment.status === next.assessment.status) return 'equal_support';
  const stronger = { absent: ['partial', 'full'], partial: ['full'], full: [] };
  return stronger[old.assessment.status].includes(next.assessment.status) ? 'gain' : 'loss';
}

try {
  const { values: v } = parseArgs({ options: {
    results: { type: 'string', default: 'tmp/rag-v2-multi-source/server-real-9526a805-1/multi-source-v1-results.json' },
    questions: { type: 'string', default: 'tests/evaluation/multi-source/questions.json' },
    anchors: { type: 'string', default: 'tests/evaluation/multi-source/anchor-groups.json' },
    corpus: { type: 'string', default: 'tmp/rag-v2-multi-source/server-real-9526a805-1/corpus-manifest.json' },
    store: { type: 'string', default: 'tmp/rag-v2-multi-source/store' },
    vectors: { type: 'string', default: 'tmp/rag-v2-multi-source/server-real-9526a805-1/usage/pilot_2be546a0b998b304f89bb42d0a46d41efaf8bca48cafeba7e4a22c0a48687d40' },
    rubric: { type: 'string', default: 'tmp/rag-v2-m2-3/rubric-v2-proposal-2/rubric-v2.json' },
    decisions: { type: 'string', default: 'tmp/rag-v2-m2-3/review-decisions-batch-accepted.json' },
    output: { type: 'string' },
  } });
  if (!v.output) fail('output_required');
  const out = path.resolve(v.output), privateRoot = await fs.realpath('tmp');
  if (!out.startsWith(privateRoot + path.sep) || await fs.stat(out).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; })) fail('new_private_output_required');
  const inputs = [v.results, v.questions, v.anchors, v.corpus, v.rubric, v.decisions, ...await ledgerFiles(v.vectors)].map(p => path.resolve(p));
  if (inputs.some(p => p === out || p.startsWith(out + path.sep))) fail('output_overlaps_input');
  const before = await Promise.all(inputs.map(async p => ({ path: p, sha256: hash(await fs.readFile(p)) })));
  const [results, questions, groups, cm, rubric, decisions] = await Promise.all([v.results, v.questions, v.anchors, v.corpus, v.rubric, v.decisions].map(readJson));
  const snapshot = await loadSnapshot(v.store, cm.tenant, cm.documents.map(d => d.document_id));
  const verified = verifyInputs(results, questions, snapshot, groups);
  equal(snapshot.snapshot_hash, cm.snapshot_sha256, 'corpus_snapshot_changed');
  for (const doc of cm.documents) {
    const b = snapshot.bundles.find(b => b.document.id === doc.document_id);
    if (!b || b.version.id !== doc.version_id || b.version.pdf_hash !== doc.source_pdf_sha256 || b.version.metadata_hash !== doc.metadata_sha256) fail('corpus_manifest_mismatch');
  }
  const bindings = { source_payload_sha256: verified.payload_sha256, questions_sha256: verified.questions_sha256,
    v1_anchors_sha256: verified.anchors_sha256, corpus_snapshot_sha256: snapshot.snapshot_hash };
  verifyRubric(rubric, snapshot, bindings);
  validateDecisions(decisions, rubric, makeReviewPacket(results, questions, snapshot, rubric).targets);
  const embedding = await StoredEmbedding.load(v.vectors, cm.tenant);
  equal(embedding.config, results.config, 'replay_embedding_mismatch');
  const source = { source_generation: snapshot.source_generation, documents: snapshot.documents, snapshot_hash: snapshot.snapshot_hash };
  const config = results.rows[0].packet.config;
  const generation = { id: id('search_generation', cm.tenant, source, config), snapshot: source, config };
  equal(generation.id, results.provenance.corpus.search_generation_id, 'replay_generation_mismatch');
  const units = snapshot.bundles.flatMap(b => b.chunks.map(c => indexUnit(c, b, embedding.config)));
  const context = { tenant: cm.tenant, subject: 'recorded-selection-review', usage: 'development_only' };
  const policy = new LocalPolicy({ tenants: { [cm.tenant]: { [context.subject]: Object.keys(snapshot.documents) } } });
  // The replay queries one profile; it must match the recorded generation. Other profiles are
  // listed with their compatibility: they need other lexical indexes (ADR-024), not this one.
  assertProfileGeneration(retrievalProfile('hybrid-ranked-first-neighbors-v1'), generation);
  const compatible = profile => { try { assertProfileGeneration(profile, generation); return true; } catch { return false; } };
  const profiles = RETRIEVAL_PROFILE_IDS.map(retrievalProfile).map(profile => ({ ...profile, compatible_with_generation: compatible(profile) }));
  const rows = [], changes = [], unseen = new Map(); let reproduced = 0, unchangedWithHybrid = 0;

  for (const question of questions.cases) {
    const historical = Object.fromEntries(results.rows.filter(r => r.question_id === question.id).map(r => [r.method, r]));
    const candidates = historical.hybrid.packet.raw_rankings;
    equal(candidates.lexical, historical.hybrid_structure.packet.raw_rankings.lexical, 'historical_lexical_candidates_differ');
    equal(candidates.vector, historical.hybrid_structure.packet.raw_rankings.vector, 'historical_vector_candidates_differ');
    equal(candidates.vector, historical.vector.packet.raw_rankings.vector, 'vector_candidates_differ');
    // Only recorded channel results cross this adapter. Rubric, family and labels stay outside retrieve().
    const scopeCheck = (tenant, gen, docs) => {
      if (tenant !== cm.tenant || gen !== generation.id || docs.some(d => !snapshot.documents[d])) fail('replay_scope_mismatch');
    };
    const postgres = {
      active: async tenant => { scopeCheck(tenant, generation.id, []); return generation; },
      bundles: async (tenant, gen, docs) => { scopeCheck(tenant, gen, docs); return snapshot.bundles.filter(b => docs.includes(b.document.id)); },
      units: async (tenant, gen, docs) => { scopeCheck(tenant, gen, docs); return units.filter(u => docs.includes(u.document_id)); },
      lexical: async (tenant, gen, docs, text, limit, eligible) => {
        scopeCheck(tenant, gen, docs);
        if (text !== question.query || limit !== 40 || candidates.lexical.some(r => !eligible.includes(r.id))) fail('replay_candidate_scope_changed');
        return candidates.lexical;
      },
    };
    const qdrant = { query: async (gen, docs, vector, limit, eligible) => {
      scopeCheck(cm.tenant, gen.id, docs);
      equal(vector, embedding.vectors.get(hash(question.query)), 'replay_query_vector_changed');
      if (limit !== 40 || candidates.vector.some(r => !eligible.includes(r.id))) fail('replay_candidate_scope_changed');
      return candidates.vector;
    } };
    const oldQuery = name => {
      const s = historical[name].packet.selection_config;
      equal(s.limits, { topK: name === 'hybrid_structure' ? 3 : 5, perDocument: 5, candidates: 40, contextTokens: 6000, graphSteps: 8, graphAdditions: 2 }, 'pilot_limits_changed');
      if (s.final_limit !== 5 || s.context_mode !== 'compact' || s.include_document_labels !== false) fail('pilot_profile_changed');
      return { text: question.query, language: question.language, method: s.method, graph: name === 'hybrid_structure',
        includeDocumentLabels: s.include_document_labels, contextMode: s.context_mode, finalLimit: s.final_limit, limits: s.limits };
    };
    for (const method of ['vector', 'hybrid', 'hybrid_structure', 'ranked_first_neighbors']) {
      const profile = method === 'ranked_first_neighbors' ? retrievalProfile('hybrid-ranked-first-neighbors-v1') : null;
      const query = profile ? queryForProfile(profile, { text: question.query, language: question.language }) : oldQuery(method);
      const packet = await retrieve({ postgres, qdrant, embedding, policy, context, query, allowLexicalFallback: false });
      if (packet.state === 'error') fail(packet.error);
      if (packet.evidence.length > 5 || packet.measurements.model_context_tokens > 6000) fail('replay_budget_exceeded');
      if (!profile) {
        equal(packet.evidence, historical[method].packet.evidence, 'historical_evidence_replay_mismatch');
        equal(packet.model_context, historical[method].packet.model_context, 'historical_context_replay_mismatch');
        equal(packet.measurements.model_context_tokens, historical[method].measurements.model_context_tokens, 'historical_tokens_replay_mismatch');
        reproduced++;
      }
      const canonical = canonicalContext(packet.evidence, snapshot), key = contextId(question.family, canonical);
      const assessment = assessContext(question.family, packet.evidence, key, rubric, decisions);
      const row = { question_id: question.id, family: question.family, language: question.language, method,
        category: question.family === 'worker-safety-author' ? 'bibliography' : 'content',
        profile_id: profile?.id ?? `historical-${method}`, review_context_id: key, assessment,
        corpus_availability: decisions.decisions[`corpus:${question.family}`].availability,
        existing_receipt_reused: decisions.decisions[key]?.state === 'approved',
        token_count: packet.measurements.model_context_tokens, unit_count: packet.evidence.length,
        selection_ms: packet.measurements.timings_ms.fusion_selection + packet.measurements.timings_ms.expansion,
        packet };
      rows.push(row);
      if (!decisions.decisions[key]) unseen.set(key, { id: key, family: question.family, context: canonical, human_decision: 'pending', contradiction: 'needs_review' });
    }
    const current = rows.filter(r => r.question_id === question.id), next = current.find(r => r.method === 'ranked_first_neighbors');
    const hybrid = current.find(r => r.method === 'hybrid'), old = current.find(r => r.method === 'hybrid_structure');
    // The same authorized, pinned ranked seeds may never disappear in optional expansion.
    equal(next.packet.evidence.slice(0, hybrid.packet.evidence.length), hybrid.packet.evidence, 'ranked_seed_displaced');
    const sameHybrid = stable(next.packet.model_context) === stable(hybrid.packet.model_context);
    if (sameHybrid) unchangedWithHybrid++;
    const previousIds = new Set(old.packet.evidence.map(e => e.unit_id)), nextIds = new Set(next.packet.evidence.map(e => e.unit_id));
    const entry = e => ({ unit_id: e.unit_id, document_id: e.document_id, version_id: e.document_version_id,
      title: e.bibliography.title, pdf_pages: e.pdf_pages, text: e.source_text, selection_reason: e.selection.reason });
    const added = next.packet.evidence.filter(e => !previousIds.has(e.unit_id)).map(entry);
    const removed = old.packet.evidence.filter(e => !nextIds.has(e.unit_id)).map(entry);
    changes.push({ question_id: question.id, family: question.family,
      historical_context: old.review_context_id, candidate_context: next.review_context_id,
      historical_status: old.assessment.status, candidate_status: next.assessment.status,
      transition: transition(old, next), exact_hybrid_equivalence: sameHybrid, added, removed,
      historical_tokens: old.token_count, candidate_tokens: next.token_count,
      selection_cause: 'Historical topK=3 reserved capacity for optional neighbors; ranked-first uses topK=finalLimit=5 before expansion.',
      requirements: next.assessment.requirements.map(req => {
        const prior = old.assessment.requirements.find(r => r.id === req.id);
        const present = r => r.sets.filter(s => s.present && s.approved).map(s => s.id);
        return { id: req.id, before: prior.status, after: req.status, confirmed_support_before: prior.confirmed_support,
          confirmed_support_after: req.confirmed_support, sets_before: present(prior), sets_after: present(req),
          lost_sets: present(prior).filter(s => !present(req).includes(s)), added_sets: present(req).filter(s => !present(prior).includes(s)) };
      }) });
  }
  const byMethod = Object.fromEntries(['vector', 'hybrid', 'hybrid_structure', 'ranked_first_neighbors'].map(method => [method, counts(rows.filter(r => r.method === method))]));
  const byFamily = Object.fromEntries(questions.cases.map(q => q.family).filter((x, i, a) => a.indexOf(x) === i).map(family => [family,
    Object.fromEntries(Object.keys(byMethod).map(method => [method, counts(rows.filter(r => r.family === family && r.method === method))]))]));
  const acceptedBaseline = results.rows.map(r => {
    const key = contextId(r.family, canonicalContext(r.packet.evidence, snapshot));
    return { method: r.method, family: r.family, assessment: assessContext(r.family, r.packet.evidence, key, rubric, decisions) };
  });
  const baselineByMethod = Object.fromEntries(results.methods.map(m => [m.name, counts(acceptedBaseline.filter(r => r.method === m.name))]));
  const semanticTransitions = changes.reduce((s, c) => { s[c.transition] = (s[c.transition] || 0) + 1; return s; }, {});
  const after = await Promise.all(inputs.map(async p => ({ path: p, sha256: hash(await fs.readFile(p)) })));
  equal(before, after, 'replay_input_files_changed');
  const summary = { historical_rows_reproduced: reproduced, replay_rows: rows.length,
    exact_candidate_equals_hybrid: unchangedWithHybrid, question_count: questions.cases.length,
    transitions_vs_historical_structure: semanticTransitions, new_unique_contexts_requiring_review: unseen.size,
    baseline_by_method: baselineByMethod, by_method: byMethod, by_family: byFamily };
  const run = { schema_version: 'rag-v2/selection-replay-run-1', created_at: new Date().toISOString(),
    git_head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    git_dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    bindings, rubric_sha256: digest(rubric), decisions_sha256: digest(decisions), inputs: before,
    generation_id: generation.id, verified_vector_ledger_sha256: digest(embedding.ledger),
    stored_query_vector_reads: embedding.reads, network_attempts: networkAttempts, provider_calls: 0, generation_calls: 0,
    database_calls: 0, qdrant_service_calls: 0, index_activations: 0, source_files_unchanged: true,
    execution: 'Production retrieve() with recorded real channel lists, canonical local units and validated stored query vectors; no live DB/Qdrant integration.',
    limitations: ['Retrospective development/regression evidence, not a new held-out benchmark.',
      'Selection duration excludes real DB/Qdrant search and provider latency.', 'Confirmed mapping presence does not approve a changed context.',
      'Bibliography and corpus-absent questions are separate from answerable content quality.'], summary };
  await fs.mkdir(out, { recursive: true });
  for (const [name, value] of Object.entries({ 'run.json': run, 'comparison-results.json': { summary, rows, changes },
    'changed-context-review.json': { bindings, new_contexts: [...unseen.values()], changes },
    'profile-candidates.json': { status: 'candidate_for_M4_not_deployed', profiles, embedding: embedding.config, generation_id: generation.id } })) {
    await fs.writeFile(path.join(out, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  }
  const header = '<tr><th>Meetod</th><th>Full</th><th>Partial</th><th>Absent</th><th>Needs review</th></tr>';
  const table = object => `<table>${header}${Object.entries(object).map(([m, c]) => `<tr><td>${esc(m)}</td><td>${c.full}</td><td>${c.partial}</td><td>${c.absent}</td><td>${c.needs_review}</td></tr>`).join('')}</table>`;
  const body = `<p>Põhileiud enne naabreid. Ajaloolised tulemused säilivad. Võrdlus ei ole Luna vastuse ega üldise täpsusprotsendi hinnang.</p><h2>Ametlik koondvastuvõtt meetodite kaupa</h2>${table(baselineByMethod)}<h2>Valikukatse sama kandidaatide hulga peal</h2>${table(byMethod)}${pre({ reproduced, unchangedWithHybrid, semanticTransitions, new_contexts: unseen.size })}<p>Uue profiili ja struktuurita hübriidi võrdsus on võrdsus, mitte graafi võit. Korpuses puuduvad nõuded ja bibliograafia on iga rea juures eristatavad. Lahtine hinnang ei ole võit ega kaotus.</p><h2>Perekondade kaupa</h2>${Object.entries(byFamily).map(([f, c]) => `<details><summary>${esc(f)}</summary>${table(c)}</details>`).join('')}<h2>Lisandunud ja eemaldunud tekstid</h2>${changes.map(c => `<details><summary>${esc(c.question_id)} — ${esc(c.transition)} (${esc(c.historical_status)} → ${esc(c.candidate_status)})</summary>${pre(c)}</details>`).join('')}<h2>Nõuded, korpusepiir ja mõõtmised</h2>${rows.map(r => `<details><summary>${esc(r.question_id)} · ${esc(r.method)} · ${esc(r.assessment.status)}</summary>${pre({ category: r.category, corpus: r.corpus_availability, receipt_reused: r.existing_receipt_reused, context_id: r.review_context_id, tokens: r.token_count, units: r.unit_count, selection_ms: r.selection_ms, assessment: r.assessment, selection_trace: r.packet.selection_trace })}</details>`).join('')}<h2>Jooksu ulatus</h2>${pre(run)}`;
  await fs.writeFile(path.join(out, 'report.html'), page('M2.3 kontekstivaliku võrdlus', body), { flag: 'wx' });
  console.log(JSON.stringify({ output: out, summary, network_attempts: networkAttempts, stored_query_vector_reads: embedding.reads }, null, 2));
} catch (error) { console.error(JSON.stringify({ ok: false, code: error.code || 'selection_replay_failed', message: error.code ? undefined : error.message })); process.exitCode = 1; }
