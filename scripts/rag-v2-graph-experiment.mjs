#!/usr/bin/env node
// The graph experiment (Codex follow-up review 29.09, 7.7): does a graph add the deciding condition that the chat's search
// leaves out, compared with the same extra room for plain ranked text? Each question runs through five retrieval profiles
// of the chat's knowledge lane (profiles.js GRAPH_EXPERIMENT_PROFILES: A no graph, B more ranked text, C knowledge cards,
// D the act's own cross-references, E structural neighbours; B-E with the same 13 sources and 13000 tokens).
// Frozen: the corpus generation, the date (legal versions in force on it), no municipality (no municipal texts), the
// search plan's queries (written into the catalogue before any run) and no reranker, so every arm is repeatable. The
// question and its queries are embedded once and the vectors kept in --out, so a repeat run makes no model call at all.
// It measures whether the catalogue's deciding phrases reach the evidence, what each arm added and at what size and time;
// whether the answer would use them is a separate, paid measurement.
// ADR-063 adds: L, the live chat profile v3, and V, the chat profile v1 it grew from; R, what following the acts' own
// pointers from V's passages would add in the room v3 gives its cross-references (four passages, 3000 tokens): the exact
// subsection a pointer names, pointers within a section, the provisions that point at a selected one, and a named other
// act; and S, today's rule (the first passage of each referenced section) simulated the same way, to check the
// simulation against L. R and S are computed here from the stored bundles (scripts/rag-v2-relation-gold.mjs), with no
// change to the search code. A question may name its municipality (`region`), which then joins the scope as in the chat.
// Usage (server):
//   node --env-file=... scripts/rag-v2-graph-experiment.mjs --catalogue tests/evaluation/graph/hard-conditions-3.json --out <dir> [--manifest docs/rag-v2/legal-acts-in-index.json]
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, assertProfileGeneration, GRAPH_EXPERIMENT_PROFILES, CHAT_PROFILE, CHAT_REFERENCES_PROFILE, CHAT_NAMED_ACTS_PROFILE, CHAT_SUBSECTIONS_PROFILE } from '../lib/rag-v2/search/profiles.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';
import { chunkSection } from '../lib/rag-v2/search/legal-references.js';
import { actGold, actPassages, pointerAdditions, firstPassageAdditions } from './rag-v2-relation-gold.mjs';
import { unifiedDirectory, municipalScope } from '../lib/rag-v2/search/unified.js';
import { legalReference, legalValidityScope } from '../lib/rag-v2/search/legal-validity.js';

const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : null; };
const cataloguePath = option('--catalogue'), out = option('--out'), tenant = option('--tenant') || 'sotsiaalai-corpus';
const manifestPath = option('--manifest') || 'docs/rag-v2/legal-acts-in-index.json';
// --cold: without the server's verified marks, every source verified in this process as before (ADR-069).
const cold = args.includes('--cold');
// O (ADR-068): chat v6, whose own-act cross-references add the named subsection's passages; without a reranker it
// differs from N (v4) in that alone (v5's pool limit needs a reranker).
const ARMS = { ...GRAPH_EXPERIMENT_PROFILES, L: CHAT_REFERENCES_PROFILE, N: CHAT_NAMED_ACTS_PROFILE, O: CHAT_SUBSECTIONS_PROFILE, V: CHAT_PROFILE };
const POINTER_ROOM = { additions: 4, tokens: 3000 };
if (!cataloguePath || !out) { console.error('usage: --catalogue <json> --out <dir> [--tenant <id>]'); process.exit(2); }
const catalogue = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
const problems = [];
if (!/^\d{4}-\d{2}-\d{2}$/u.test(catalogue.date || '')) problems.push('date');
for (const q of catalogue.questions || []) {
  if (!/^[a-z0-9-]+$/u.test(q.id || '') || typeof q.text !== 'string' || !Array.isArray(q.queries) || q.queries.length > 3
    || !Array.isArray(q.evidence_text) || !q.evidence_text.length || !['within_document', 'across_documents'].includes(q.kind)
    || (q.region !== undefined && !/^[a-z_]+$/u.test(q.region))) problems.push(q.id || '?');
}
if (problems.length || !catalogue.questions?.length) { console.error(JSON.stringify({ ok: false, problems })); process.exit(2); }
await fs.mkdir(out, { recursive: true });

const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
// The server's marks, read only: sources it has checked are read at once; nothing is written.
const verifiedMarks = cold ? 0 : await postgres.inheritVerified({ keep: false }).catch(() => 0);
const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
const context = { subject: 'graph-experiment', tenant, usage: 'development_only' };
try {
  const generation = await postgres.active(tenant);
  const documents = Object.keys(generation.snapshot.documents);
  const groups = unifiedDirectory(await postgres.retrievalDirectory(tenant, generation, documents));
  // The knowledge lane as the chat builds it: legal versions in force on the date; municipal texts only of the
  // municipality a question names, none when it names none.
  const legal = legalValidityScope(groups.knowledge, legalReference(catalogue.date, []));
  const scopes = new Map();
  const eligibleFor = region => {
    if (!scopes.has(region ?? '')) scopes.set(region ?? '', municipalScope(legal.eligible, region ? { region } : null).eligible.map(row => row.document_id));
    return scopes.get(region ?? '');
  };
  const eligible = eligibleFor(null);
  // The acts of the passages a question selected, read once: their bundle and the pointers their text makes.
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8').catch(() => '{"acts":[]}')).acts, acts = new Map();
  const actOf = async documentId => {
    if (!acts.has(documentId)) {
      const [bundle] = await postgres.bundles(tenant, generation.id, [documentId]);
      const act = bundle?.document.fields.act_reference?.value ?? null;
      acts.set(documentId, bundle && bundle.version.source_format === 'xml' && act ? { act, bundle, gold: actGold(act, bundle) } : null);
    }
    return acts.get(documentId);
  };

  // One embedding per text, kept with the results.
  const vectorFile = path.join(out, 'vectors.json');
  const vectors = new Map(Object.entries(await fs.readFile(vectorFile, 'utf8').then(JSON.parse).catch(() => ({}))));
  const texts = [...new Set(catalogue.questions.flatMap(q => [q.text, ...q.queries]))].filter(text => !vectors.has(text));
  if (texts.length) {
    const config = generation.config.embedding;
    const response = await fetch(config.endpoint || 'https://api.openai.com/v1/embeddings', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: config.model, input: texts, dimensions: config.dimensions, encoding_format: 'float' }) });
    if (!response.ok) throw Object.assign(new Error(`embedding_failed_${response.status}`), { code: 'embedding_failed' });
    const body = await response.json();
    body.data.forEach((item, index) => vectors.set(texts[index], item.embedding));
    await fs.writeFile(vectorFile, JSON.stringify(Object.fromEntries(vectors)));
    console.error(JSON.stringify({ embedded: texts.length, tokens: body.usage?.total_tokens ?? null }));
  }

  const spaced = text => text.replace(/\s+/gu, ' ');
  const rows = [];
  for (const question of catalogue.questions) {
    const allowed = eligibleFor(question.region ?? null);
    const policy = { async allowed() { return { documents: allowed, revision: `graph-experiment-${generation.id}-${question.region ?? 'none'}` }; } };
    for (const [arm, profileId] of Object.entries(ARMS)) {
      const profile = retrievalProfile(profileId);
      assertProfileGeneration(profile, generation);
      const query = queryForProfile(profile, { text: question.text, language: 'et', generation_id: generation.id });
      if (question.queries.length) query.variants = question.queries;
      const started = performance.now();
      const packet = await retrieve({ postgres, qdrant, policy, context, query, allowLexicalFallback: false,
        embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) } });
      const ms = Math.round(performance.now() - started);
      if (['error', 'degraded'].includes(packet.state)) throw Object.assign(new Error(packet.error || 'retrieval_failed'), { code: 'retrieval_failed' });
      const evidence = packet.evidence || [], texts = evidence.map(entry => spaced(entry.source_text));
      const cards = spaced(JSON.stringify(packet.dependency_context || {}));
      const found = question.evidence_text.map(phrase => ({ phrase, in_evidence: texts.some(text => text.includes(spaced(phrase))),
        in_cards: cards.includes(spaced(phrase)) }));
      const reasons = {};
      for (const entry of evidence) { const type = entry.selection.reason?.type || entry.selection.reason; reasons[type] = (reasons[type] || 0) + 1; }
      rows.push({ question: question.id, kind: question.kind, ...(question.shape ? { shape: question.shape } : {}), arm, profile: profileId, ms, found,
        found_all: found.every(item => item.in_evidence), found_any: found.some(item => item.in_evidence),
        sources: evidence.length, reasons, context_tokens: packet.measurements?.context_tokens ?? null,
        additions: evidence.filter(entry => (entry.selection.reason?.type || entry.selection.reason) !== 'ranked_seed')
          .map(entry => ({ title: entry.bibliography?.title || '', reason: entry.selection.reason?.type || entry.selection.reason,
            ...(entry.selection.reason?.section ? { section: entry.selection.reason.section } : {}),
            ...(entry.selection.reason?.named_act ? { named_act: entry.selection.reason.named_act } : {}) })),
        // What the arm selected, in order: v4 (N) must select what v3 (L) selects and then only a named act's passages.
        selected: evidence.map(entry => entry.chunk_id),
        cross_references: packet.measurements?.cross_references ?? null, named_act_references: packet.measurements?.named_act_references ?? null });
      if (arm !== 'V') continue;
      // R and S from V's passages. A seed is a selected passage of a Riigi Teataja act, in the selection's order.
      const seeds = [];
      for (const entry of evidence) {
        const own = await actOf(entry.document_id), passage = own ? actPassages(own.bundle).findIndex(chunk => chunk.id === entry.chunk_id) : -1;
        if (passage >= 0) seeds.push({ document_id: entry.document_id, passage });
      }
      const known = new Map([...acts].filter(([, own]) => own));
      rows.at(-1).seeds = seeds.map(seed => { const own = known.get(seed.document_id); return { act: own.act, section: chunkSection(actPassages(own.bundle)[seed.passage]), passage: seed.passage }; });
      // Another act a seed names, in the question's scope and in the generation's version; read before the pointers are followed.
      const others = new Map();
      for (const seed of seeds) for (const link of known.get(seed.document_id).gold.links.filter(item => item.class === 'other_act' && item.to_act && item.from_passage === seed.passage)) {
        if (others.has(link.to_act)) continue;
        const listed = manifest.find(item => item.globaal_id === link.to_act && allowed.includes(item.document_id) && generation.snapshot.documents[item.document_id]?.version_id === item.version_id);
        const bundle = listed ? (await actOf(listed.document_id))?.bundle ?? null : null;
        others.set(link.to_act, bundle ? { document_id: listed.document_id, bundle } : null);
      }
      const simulated = { R: pointerAdditions({ seeds, acts: known, otherAct: act => others.get(act) ?? null, limits: POINTER_ROOM, tokens: tokenCount }),
        S: firstPassageAdditions({ seeds, acts: known, limits: POINTER_ROOM, tokens: tokenCount }) };
      for (const [name, result] of Object.entries(simulated)) {
        const added = result.additions.map(item => spaced(item.source_text));
        const reached = question.evidence_text.map(phrase => {
          const position = result.candidates.findIndex(item => spaced(item.source_text).includes(spaced(phrase))), item = result.candidates[position];
          const seeded = texts.some(text => text.includes(spaced(phrase)));
          return { phrase, in_evidence: seeded || added.some(text => text.includes(spaced(phrase))), in_seeds: seeded,
            ...(item ? { class: item.class, position, within_room: item.added, from: item.from, to: item.to } : {}) };
        });
        rows.push({ question: question.id, kind: question.kind, ...(question.shape ? { shape: question.shape } : {}), arm: name,
          profile: name === 'R' ? 'simulated-chat-v1-plus-pointers' : 'simulated-chat-v1-plus-first-passages', ms: 0, found: reached,
          found_all: reached.every(item => item.in_evidence), found_any: reached.some(item => item.in_evidence), sources: evidence.length + result.additions.length,
          reasons: {}, context_tokens: (packet.measurements?.context_tokens ?? 0) + result.additions.reduce((sum, item) => sum + item.tokens, 0),
          additions: result.additions.map(item => ({ act: acts.get(item.document_id)?.act ?? item.document_id, passage: item.passage, reason: item.class, exception: item.exception, from: item.from, to: item.to })),
          candidates: result.candidates.length, cross_references: null });
      }
    }
  }
  const summary = {};
  for (const arm of [...Object.keys(ARMS), 'R', 'S']) {
    const own = rows.filter(row => row.arm === arm);
    summary[arm] = { profile: ARMS[arm] ?? own[0]?.profile, questions: own.length, found_all: own.filter(row => row.found_all).length,
      found_any: own.filter(row => row.found_any).length,
      within_document: own.filter(row => row.kind === 'within_document' && row.found_all).length,
      across_documents: own.filter(row => row.kind === 'across_documents' && row.found_all).length,
      mean_sources: +(own.reduce((n, row) => n + row.sources, 0) / own.length).toFixed(2),
      mean_context_tokens: Math.round(own.reduce((n, row) => n + (row.context_tokens || 0), 0) / own.length),
      median_ms: own.map(row => row.ms).sort((a, b) => a - b)[Math.floor(own.length / 2)] };
  }
  // Per shape of question (catalogue 3), how many each arm found; and how often the simulated S finds what L found.
  const shapes = {};
  for (const row of rows.filter(item => item.shape)) {
    shapes[row.shape] ??= {}; shapes[row.shape][row.arm] ??= { questions: 0, found_all: 0 };
    shapes[row.shape][row.arm].questions++; if (row.found_all) shapes[row.shape][row.arm].found_all++;
  }
  const foundBy = arm => new Map(rows.filter(row => row.arm === arm).map(row => [row.question, row.found_all]));
  const live = foundBy('L'), today = foundBy('S');
  // ADR-063: arm N against arm L, question by question: the same passages in the same order, then N's own additions.
  const selectedBy = arm => new Map(rows.filter(row => row.arm === arm).map(row => [row.question, row]));
  const v3 = selectedBy('L'), v4 = selectedBy('N');
  const namedActs = { questions: v4.size, keeps_v3: 0, with_additions: 0, additions: 0, gained: [], lost: [], mean_added_tokens: 0 };
  for (const [question, row] of v4) {
    const base = v3.get(question), added = row.additions.filter(item => item.named_act).length;
    if (base.selected.every((chunk, index) => row.selected[index] === chunk) && row.selected.length === base.selected.length + added) namedActs.keeps_v3++;
    if (added) namedActs.with_additions++;
    namedActs.additions += added;
    if (row.found_all && !base.found_all) namedActs.gained.push(question);
    if (!row.found_all && base.found_all) namedActs.lost.push(question);
    namedActs.mean_added_tokens += (row.context_tokens - base.context_tokens) / v4.size;
  }
  namedActs.mean_added_tokens = Math.round(namedActs.mean_added_tokens);
  // ADR-068: arm O against arm N, question by question: what the subsection rule changes, finds and loses.
  const v6 = selectedBy('O');
  const ownSubsections = { questions: v6.size, changed: [], gained: [], lost: [], mean_token_change: 0 };
  for (const [question, row] of v6) {
    const base = v4.get(question);
    if (JSON.stringify(row.selected) !== JSON.stringify(base.selected)) ownSubsections.changed.push(question);
    if (row.found_all && !base.found_all) ownSubsections.gained.push(question);
    if (!row.found_all && base.found_all) ownSubsections.lost.push(question);
    ownSubsections.mean_token_change += (row.context_tokens - base.context_tokens) / v6.size;
  }
  ownSubsections.mean_token_change = Math.round(ownSubsections.mean_token_change);
  const report = { schema_version: 'rag-v2/graph-experiment-4', generation: generation.id, date: catalogue.date, catalogue: cataloguePath, verified_marks: verifiedMarks,
    eligible_documents: eligible.length, excluded_legal_versions: legal.excluded.length, pointer_room: POINTER_ROOM,
    simulation_check: { questions: live.size, s_equals_l: [...live].filter(([question, found]) => today.get(question) === found).length }, named_acts: namedActs, own_subsections: ownSubsections, summary, shapes, rows };
  await fs.writeFile(path.join(out, 'graph-experiment.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ok: true, summary, named_acts: namedActs, own_subsections: ownSubsections }, null, 1));
} finally { await postgres.close?.(); }
