// M3 measurement, second pass: the municipal case of an act named by abbreviation with the production profile's fused
// search (lexical and vector), as the chat's knowledge lane builds it. Catalogue
// tests/evaluation/graph/abbreviation-municipal-1.json (fixed before any search).
// Paid: ONE embedding request for the catalogue's question and query texts (owner 02.10.2026: one request, at most
// 0.001 USD); the vectors are kept in <out directory>/vectors.json, and a run that finds them there sends nothing.
// No rerank model and no answer model: the rerank hook only records the candidates it is given and keeps the fused order.
// For each question: whether the deciding provision is among the candidates the rerank model would read (30 fused, at
// most 10 of one document, and the national-law reserve), whether it is in the model-free final selection, and what
// following the abbreviation references of that selection would add (the full-name rule's two places, no cap, and
// from legal XML passages only).
// Run on the server from the app's scripts directory (the imports are relative to it): copy this file there as a
// temporary script, then
//   node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/<copy>.mjs <catalogue.json> <out directory>
// and remove the copy.
import fs from 'node:fs/promises';
import path from 'node:path';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, assertProfileGeneration, CHAT_SUBSECTIONS_PROFILE } from '../lib/rag-v2/search/profiles.js';
import { actSections, provisionChunks, resolveSection, keepsSuperscripts } from '../lib/rag-v2/search/legal-references.js';
import { unifiedDirectory, municipalScope, NATIONAL_LAW_RESERVE } from '../lib/rag-v2/search/unified.js';
import { legalReference, legalValidityScope } from '../lib/rag-v2/search/legal-validity.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';

const tenant = 'sotsiaalai-corpus', [cataloguePath, out] = process.argv.slice(2), MAX_USD = 0.001;
const catalogue = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
const KNOWN = { SHS: 'Sotsiaalhoolekande seadus', LasteKS: 'Lastekaitseseadus', PKS: 'Perekonnaseadus', HMS: 'Haldusmenetluse seadus', SÜS: 'Sotsiaalseadustiku üldosa seadus', RLS: 'Riigilõivuseadus' };
const ABBR = /(?<![\p{L}\p{N}])((?=\p{L}*\p{Lu}\p{L}*\p{Lu})\p{Lu}\p{L}{1,9})(?:-?(?:i|s|is|st|le|ga))?\s*§{1,2}\s*-?(?:des|de|s|i)?\s*(\d{1,3})([¹²³⁴⁵⁶⁷⁸⁹⁰]*)(?:\s*(?:lg|lõige|lõike|lõikes|lõiget|lõigete|lõigetes)\.?\s*(\d{1,2})([¹²³⁴⁵⁶⁷⁸⁹⁰]*))?/gu;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', plainSup = text => [...text].map(char => SUP.indexOf(char)).join('');
const spaced = text => text.replace(/\s+/gu, ' ');
const LIVE_PLACES = 2; // limits.namedActAdditions of the chat profile

await fs.mkdir(out, { recursive: true });
const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
const context = { subject: 'abbreviation-municipal', tenant, usage: 'development_only' };
const report = { catalogue: cataloguePath, date: catalogue.date, profile: CHAT_SUBSECTIONS_PROFILE, search: 'fused lexical and vector, no rerank model, no answer model', questions: [] };
try {
  await postgres.inheritVerified({ keep: false }).catch(() => 0);
  const generation = await postgres.active(tenant);
  report.generation = generation.id;

  // One embedding request for every text that has no stored vector; none when all are stored.
  const vectorFile = path.join(out, 'vectors.json');
  const vectors = new Map(Object.entries(await fs.readFile(vectorFile, 'utf8').then(JSON.parse).catch(() => ({}))));
  const texts = [...new Set(catalogue.questions.flatMap(question => [question.text, ...question.queries]))].filter(text => !vectors.has(text));
  if (texts.length) {
    const config = generation.config.embedding, plan = JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8'));
    const estimate = texts.reduce((sum, text) => sum + tokenCount(text), 0) * plan.prices.embeddingInput / 1e9;
    if (!(estimate <= MAX_USD)) throw Object.assign(new Error('embedding_estimate_above_the_allowed_cost'), { code: 'cost_limit', estimate });
    const response = await fetch(config.endpoint || 'https://api.openai.com/v1/embeddings', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: config.model, input: texts, dimensions: config.dimensions, encoding_format: 'float' }) });
    if (!response.ok) throw Object.assign(new Error(`embedding_failed_${response.status}`), { code: 'embedding_failed' });
    const body = await response.json();
    body.data.forEach((item, index) => vectors.set(texts[index], item.embedding));
    await fs.writeFile(vectorFile, JSON.stringify(Object.fromEntries(vectors)));
    report.embedding = { requests: 1, texts: texts.length, tokens: body.usage?.total_tokens ?? null, model: config.model,
      usd_at_plan_price: body.usage?.total_tokens ? +(body.usage.total_tokens * plan.prices.embeddingInput / 1e9).toFixed(8) : null, estimate_usd: +estimate.toFixed(8) };
  } else report.embedding = { requests: 0, texts: 0, reused: vectors.size };

  const documents = Object.keys(generation.snapshot.documents);
  const groups = unifiedDirectory(await postgres.retrievalDirectory(tenant, generation, documents));
  const legal = legalValidityScope(groups.knowledge, legalReference(catalogue.date, []));
  const titles = await postgres.documentTitles(tenant, generation.id, legal.eligible.map(row => row.document_id));
  const bundles = new Map();
  const bundleOf = async documentId => {
    if (!bundles.has(documentId)) {
      const [bundle] = await postgres.bundles(tenant, generation.id, [documentId]);
      const chunks = [...bundle.chunks].sort((a, b) => a.ordinal - b.ordinal);
      let sections = []; try { sections = actSections(chunks); } catch { /* not an act */ }
      bundles.set(documentId, { bundle, chunks, sections });
    }
    return bundles.get(documentId);
  };
  for (const question of catalogue.questions) {
    // The knowledge lane as the chat builds it: the municipality's own texts, the acts in force, the national-law reserve.
    const kept = municipalScope(legal.eligible, { region: question.region }).eligible.map(row => row.document_id), keptSet = new Set(kept);
    const policy = { async allowed() { return { documents: kept, revision: `abbreviation-municipal-${generation.id}-${question.region}` }; } };
    const profile = retrievalProfile(CHAT_SUBSECTIONS_PROFILE);
    assertProfileGeneration(profile, generation);
    const query = queryForProfile(profile, { text: question.text, language: 'et', generation_id: generation.id });
    query.variants = question.queries;
    const reserve = groups.nationalLaw.filter(row => keptSet.has(row.document_id));
    if (reserve.length) query.poolReserve = { documents: reserve.map(row => row.document_id), ...NATIONAL_LAW_RESERVE };
    // The rerank hook calls no model: it records what the model would read and leaves the fused order.
    let pool = null;
    const packet = await retrieve({ postgres, qdrant, policy, context, query, allowLexicalFallback: false, hooks: { rerank: async passages => { pool = passages; return null; } },
      embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) } });
    if (['error', 'degraded'].includes(packet.state)) throw Object.assign(new Error(packet.error || 'retrieval_failed'), { code: 'retrieval_failed' });
    const reserved = packet.rerank?.reserved?.length || 0, fused = (pool?.length || 0) - reserved;
    const inPool = phrase => { const at = (pool || []).findIndex(passage => spaced(passage.text).includes(spaced(phrase))); return at < 0 ? null : { place: at + 1, part: at < fused ? 'fused' : 'national_law_reserve', title: pool[at].title }; };
    const evidence = packet.evidence || [], has = phrase => evidence.some(entry => spaced(entry.source_text).includes(spaced(phrase)));
    const actDocument = title => kept.filter(documentId => titles.get(documentId) === title && groups.nationalLaw.some(row => row.document_id === documentId));
    const selected = new Set(evidence.map(entry => entry.chunk_id)), references = [];
    for (const entry of evidence) {
      const pointing = await bundleOf(entry.document_id), exact = keepsSuperscripts(pointing.bundle.version);
      for (const found of entry.source_text.matchAll(ABBR)) {
        const act = KNOWN[found[1]], item = { from: titles.get(entry.document_id) || entry.bibliography?.title || entry.document_id, from_legal_xml: exact, reference: found[0], act: act || null };
        if (!act) { references.push({ ...item, outcome: 'act_not_in_index' }); continue; }
        const versions = actDocument(act);
        if (versions.length !== 1) { references.push({ ...item, outcome: `versions_in_scope_${versions.length}` }); continue; }
        const target = await bundleOf(versions[0]), key = resolveSection(found[2], found[3] || '', target.sections, exact);
        if (!key) { references.push({ ...item, outcome: 'section_not_resolved' }); continue; }
        const subsection = found[4] ? found[4] + (found[5] ? `^${plainSup(found[5])}` : '') : null;
        const passages = provisionChunks(target.bundle, target.chunks, key, subsection, { exactNumbers: exact });
        references.push({ ...item, section: key, subsection, outcome: 'resolved', passages: passages.map(chunk => ({ chunk_id: chunk.id, tokens: tokenCount(chunk.source_text),
          deciding: question.evidence_text.some(phrase => spaced(chunk.source_text).includes(spaced(phrase))), already_selected: selected.has(chunk.id) })) });
      }
    }
    const follow = (places, only = () => true) => {
      const added = [], seen = new Set(selected);
      for (const reference of references.filter(item => item.outcome === 'resolved' && only(item))) for (const passage of reference.passages) {
        if (seen.has(passage.chunk_id) || added.length >= places) continue;
        seen.add(passage.chunk_id); added.push({ reference: reference.reference, from: reference.from, section: reference.section, subsection: reference.subsection, tokens: passage.tokens, deciding: passage.deciding });
      }
      return { additions: added.length, tokens: added.reduce((sum, item) => sum + item.tokens, 0), brings_deciding: added.some(item => item.deciding),
        other_additions: added.filter(item => !item.deciding).length, other_tokens: added.filter(item => !item.deciding).reduce((sum, item) => sum + item.tokens, 0), added };
    };
    report.questions.push({ question: question.id, region: question.region, scope_documents: kept.length, channels: packet.channels, warnings: packet.warnings,
      candidates: { read_by_the_rerank_model: pool?.length ?? 0, fused, national_law_reserve: reserved, pointing_passage: inPool(question.pointing_text), deciding_passage: inPool(question.evidence_text[0]),
        titles: [...new Set((pool || []).map(passage => passage.title))] },
      final_without_model: { passages: evidence.length, context_tokens: packet.measurements?.context_tokens ?? null, pointing_passage_selected: has(question.pointing_text),
        deciding_passage_selected: question.evidence_text.every(has), reasons: evidence.map(entry => entry.selection.reason?.type || entry.selection.reason),
        selected_titles: [...new Set(evidence.map(entry => titles.get(entry.document_id) || entry.bibliography?.title))],
        named_act_references: packet.measurements?.named_act_references ?? null, cross_references: packet.measurements?.cross_references ?? null },
      abbreviation_references_in_selection: references,
      following_with_live_places: follow(LIVE_PLACES), following_without_cap: follow(Infinity), following_from_legal_xml_only: follow(LIVE_PLACES, item => item.from_legal_xml) });
  }
  await fs.writeFile(path.join(out, 'abbreviation-municipal-hybrid.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ embedding: report.embedding }));
  for (const row of report.questions) console.log(JSON.stringify({ question: row.question, channels: row.channels, warnings: row.warnings,
    candidates: { read: row.candidates.read_by_the_rerank_model, fused: row.candidates.fused, reserve: row.candidates.national_law_reserve, pointing: row.candidates.pointing_passage, deciding: row.candidates.deciding_passage },
    final: { passages: row.final_without_model.passages, tokens: row.final_without_model.context_tokens, pointing: row.final_without_model.pointing_passage_selected, deciding: row.final_without_model.deciding_passage_selected,
      reasons: row.final_without_model.reasons, named: row.final_without_model.named_act_references },
    references: row.abbreviation_references_in_selection.map(item => `${item.reference} (${item.from_legal_xml ? 'xml' : 'other'}) → ${item.outcome}${item.section ? ` ${item.section}${item.subsection ? `(${item.subsection})` : ''}` : ''}`),
    live_places: row.following_with_live_places, no_cap: { additions: row.following_without_cap.additions, tokens: row.following_without_cap.tokens, brings_deciding: row.following_without_cap.brings_deciding },
    legal_xml_only: { additions: row.following_from_legal_xml_only.additions, tokens: row.following_from_legal_xml_only.tokens, brings_deciding: row.following_from_legal_xml_only.brings_deciding,
      other_tokens: row.following_from_legal_xml_only.other_tokens } }, null, 1));
} finally { await postgres.close(); }
