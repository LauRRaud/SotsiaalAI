// M3 measurement, free and read-only: the municipal case of an act named by abbreviation (catalogue
// tests/evaluation/graph/abbreviation-municipal-1.json, fixed before any search).
// For each question: today's search (chat profile v6, the lexical channel only: no embedding, no model call), and the
// same selection with every abbreviation reference to an act of the index followed, as the full-name rule (ADR-064)
// follows a named act: the passages that hold the named subsection, at most two additions in reading order (the live
// rule's places), and without that cap for comparison.
// Run on the server from the app's scripts directory (the imports are relative to it): copy this file there as a
// temporary script, then
//   node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/<copy>.mjs <catalogue.json> <report.json>
// and remove the copy.
import fs from 'node:fs/promises';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, assertProfileGeneration, CHAT_SUBSECTIONS_PROFILE } from '../lib/rag-v2/search/profiles.js';
import { actSections, provisionChunks, resolveSection, keepsSuperscripts } from '../lib/rag-v2/search/legal-references.js';
import { unifiedDirectory, municipalScope } from '../lib/rag-v2/search/unified.js';
import { legalReference, legalValidityScope } from '../lib/rag-v2/search/legal-validity.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';
import { withoutStopwords } from '../lib/rag-v2/search/query-stopwords.js';

const tenant = 'sotsiaalai-corpus', [cataloguePath, out] = process.argv.slice(2);
const catalogue = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
const KNOWN = { SHS: 'Sotsiaalhoolekande seadus', LasteKS: 'Lastekaitseseadus', PKS: 'Perekonnaseadus', HMS: 'Haldusmenetluse seadus', SÜS: 'Sotsiaalseadustiku üldosa seadus', RLS: 'Riigilõivuseadus' };
const ABBR = /(?<![\p{L}\p{N}])((?=\p{L}*\p{Lu}\p{L}*\p{Lu})\p{Lu}\p{L}{1,9})(?:-?(?:i|s|is|st|le|ga))?\s*§{1,2}\s*-?(?:des|de|s|i)?\s*(\d{1,3})([¹²³⁴⁵⁶⁷⁸⁹⁰]*)(?:\s*(?:lg|lõige|lõike|lõikes|lõiget|lõigete|lõigetes)\.?\s*(\d{1,2})([¹²³⁴⁵⁶⁷⁸⁹⁰]*))?/gu;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹', plainSup = text => [...text].map(char => SUP.indexOf(char)).join('');
const spaced = text => text.replace(/\s+/gu, ' ');
const LIVE_PLACES = 2; // limits.namedActAdditions of the chat profile

const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
const context = { subject: 'abbreviation-municipal', tenant, usage: 'development_only' };
const report = { catalogue: cataloguePath, date: catalogue.date, channel: 'postgres_lexical only (no embedding, no model call)', profile: CHAT_SUBSECTIONS_PROFILE, questions: [] };
try {
  await postgres.inheritVerified({ keep: false }).catch(() => 0);
  const generation = await postgres.active(tenant);
  report.generation = generation.id;
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
    const allowed = municipalScope(legal.eligible, { region: question.region }).eligible.map(row => row.document_id);
    const policy = { async allowed() { return { documents: allowed, revision: `abbreviation-municipal-${generation.id}-${question.region}` }; } };
    const profile = retrievalProfile(CHAT_SUBSECTIONS_PROFILE);
    assertProfileGeneration(profile, generation);
    const query = { ...queryForProfile(profile, { text: question.text, language: 'et', generation_id: generation.id }), variants: question.queries, method: 'lexical' };
    const packet = await retrieve({ postgres, qdrant, policy, context, query, allowLexicalFallback: false,
      embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async () => { throw new Error('no_model_call_in_this_measurement'); } } });
    if (['error', 'degraded'].includes(packet.state)) throw Object.assign(new Error(packet.error || 'retrieval_failed'), { code: 'retrieval_failed' });
    const evidence = packet.evidence || [], has = phrase => evidence.some(entry => spaced(entry.source_text).includes(spaced(phrase)));
    // Where the pointing passage and the deciding passage stand in the lexical channel of this scope, read as the search
    // reads it (the profile's stop words and rank); the search itself takes the first 40.
    const lexicalText = [question.text, ...question.queries].join('\n');
    const ranked = await postgres.lexical(tenant, generation.id, allowed, query.lexicalStopwords ? withoutStopwords(lexicalText) : lexicalText, 300, null,
      query.lexicalRank ? { rank: query.lexicalRank } : {});
    const bodies = new Map((await postgres.pool.query('SELECT id, body FROM rag_v2_version_unit WHERE tenant=$1 AND id=ANY($2::text[])', [tenant, ranked.map(row => row.id)])).rows.map(row => [row.id, row.body]));
    const rankOf = phrase => { const at = ranked.findIndex(row => spaced(bodies.get(row.id) || '').includes(spaced(phrase))); return at < 0 ? null : at + 1; };
    // The national act of the scope with a title, in force on the catalogue's date.
    const actDocument = title => allowed.filter(documentId => titles.get(documentId) === title && groups.nationalLaw.some(row => row.document_id === documentId));
    const selected = new Set(evidence.map(entry => entry.chunk_id)), references = [];
    for (const entry of evidence) {
      const pointing = await bundleOf(entry.document_id), exact = keepsSuperscripts(pointing.bundle.version);
      for (const found of entry.source_text.matchAll(ABBR)) {
        const act = KNOWN[found[1]], item = { from: titles.get(entry.document_id) || entry.bibliography?.title || entry.document_id, reference: found[0], act: act || null };
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
    // Following in reading order: a passage already selected or already added is not added again.
    const follow = places => {
      const added = [], seen = new Set(selected);
      for (const reference of references.filter(item => item.outcome === 'resolved')) for (const passage of reference.passages) {
        if (seen.has(passage.chunk_id) || added.length >= places) continue;
        seen.add(passage.chunk_id); added.push({ reference: reference.reference, section: reference.section, subsection: reference.subsection, tokens: passage.tokens, deciding: passage.deciding });
      }
      return { additions: added.length, tokens: added.reduce((sum, item) => sum + item.tokens, 0), brings_deciding: added.some(item => item.deciding),
        other_additions: added.filter(item => !item.deciding).length, other_tokens: added.filter(item => !item.deciding).reduce((sum, item) => sum + item.tokens, 0), added };
    };
    report.questions.push({ question: question.id, region: question.region, scope_documents: allowed.length, channels: packet.channels,
      today: { passages: evidence.length, context_tokens: packet.measurements?.context_tokens ?? null, pointing_passage_selected: has(question.pointing_text),
        deciding_passage_selected: question.evidence_text.every(has), reasons: evidence.map(entry => entry.selection.reason?.type || entry.selection.reason),
        selected_titles: [...new Set(evidence.map(entry => titles.get(entry.document_id) || entry.bibliography?.title))],
        lexical_rank_of_pointing_passage: rankOf(question.pointing_text), lexical_rank_of_deciding_passage: rankOf(question.evidence_text[0]), lexical_candidates: ranked.length,
        named_act_references: packet.measurements?.named_act_references ?? null, cross_references: packet.measurements?.cross_references ?? null },
      abbreviation_references_in_selection: references,
      following_with_live_places: follow(LIVE_PLACES), following_without_cap: follow(Infinity) });
  }
  await fs.writeFile(out, JSON.stringify(report, null, 1));
  for (const row of report.questions) console.log(JSON.stringify({ question: row.question, today: { passages: row.today.passages, tokens: row.today.context_tokens, pointing: row.today.pointing_passage_selected,
    deciding: row.today.deciding_passage_selected, rank_pointing: row.today.lexical_rank_of_pointing_passage, rank_deciding: row.today.lexical_rank_of_deciding_passage, channels: row.channels },
  references: row.abbreviation_references_in_selection.map(item => `${item.reference} → ${item.outcome}${item.section ? ` ${item.section}${item.subsection ? `(${item.subsection})` : ''}` : ''}`),
  live_places: row.following_with_live_places, no_cap: { additions: row.following_without_cap.additions, tokens: row.following_without_cap.tokens, brings_deciding: row.following_without_cap.brings_deciding,
    other_additions: row.following_without_cap.other_additions, other_tokens: row.following_without_cap.other_tokens } }, null, 1));
} finally { await postgres.close(); }
