// M3 measurement (free: no model call, no embedding request): passages that hold only their own heading.
// Every section of a document becomes at least one passage (lib/rag-v2/chunking.js), so a section with a heading and no
// text of its own (a cover line, a chapter heading right above its first subheading) is a passage whose text repeats the
// end of its heading path. ADR-065 saw such passages take rerank places ("a title or the word JUHEND").
//
//   census <out directory>
//     How many such passages the active index holds, in which kinds of documents, and the commonest ones.
//   search <out directory> <catalogue.json>=<vectors.json> ...
//     The production profile's fused search (lexical and vector, national-law reserve, rerank hook that calls no model)
//     over catalogues whose query vectors are already saved, twice: as it is, and with the heading-only passages left
//     out of both channels. A question with a text that has no saved vector is skipped, never embedded.
//   turns <out directory> <conversation-eval.json> ...
//     What the real chat did with such passages in turns the conversation evaluator already ran (nothing is run again):
//     how many reached the evidence the answer model read, and how many an answer cited. Only turns listed in the
//     evaluator's own reports are read, and only when their conversation is one the evaluator made ("Hindamine …").
//
// A graph catalogue gives a question its queries, municipality and deciding phrase; a dialogue catalogue gives the first
// turn's text (and municipality and phrase when its expectations name them).
// Run on the server from the app's scripts directory (the imports are relative to it): copy this file there as a
// temporary script, then
//   node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/<copy>.mjs census <out directory>
// and remove the copy.
import fs from 'node:fs/promises';
import path from 'node:path';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { retrieve } from '../lib/rag-v2/search/retrieval.js';
import { retrievalProfile, queryForProfile, assertProfileGeneration, CHAT_SUBSECTIONS_PROFILE } from '../lib/rag-v2/search/profiles.js';
import { unifiedDirectory, municipalScope, nationalLegalText, NATIONAL_LAW_RESERVE } from '../lib/rag-v2/search/unified.js';
import { legalReference, legalValidityScope } from '../lib/rag-v2/search/legal-validity.js';
import { VERSION_LAYOUT } from '../lib/rag-v2/search/layout.js';

const tenant = 'sotsiaalai-corpus', [mode, out, ...rest] = process.argv.slice(2);
if (!['census', 'search', 'turns'].includes(mode) || !out) throw new Error('usage: census <out> | search <out> <catalogue.json>=<vectors.json> ... | turns <out> <conversation-eval.json> ...');
const norm = text => text.replace(/\s+/gu, ' ').trim().toLowerCase(), spaced = text => text.replace(/\s+/gu, ' ');
const share = (part, whole) => whole ? +(part / whole).toFixed(4) : 0;

// A passage's indexed text is its heading path, a blank line and its body. Heading-only: the body repeats the path's end.
function passageKind(inputText) {
  const cut = inputText.indexOf('\n\n'), prefix = cut < 0 ? '' : inputText.slice(0, cut), body = norm(cut < 0 ? inputText : inputText.slice(cut + 2));
  return { headingOnly: Boolean(body) && norm(prefix).endsWith(body), bodyChars: body.length, body };
}
const documentClass = row => row.source.record_kind !== null ? 'record' : nationalLegalText(row) ? 'national_law'
  : Array.isArray(row.fields.regions?.value) && row.fields.regions.value.length ? (row.fields.valid_from?.value ? 'municipal_act' : 'municipal_other')
    : row.source.journal ? 'journal' : 'other_knowledge';

await fs.mkdir(out, { recursive: true });
if (mode === 'turns') {
  const { default: prisma } = await import('../lib/prisma.js');
  try {
    const listed = [];
    for (const file of rest) {
      const run = JSON.parse(await fs.readFile(file, 'utf8'));
      for (const scenario of run.scenarios || []) for (const turn of scenario.turns || []) if (turn.turn_id) listed.push({ run: path.basename(path.dirname(file)), scenario: scenario.id, id: turn.turn_id });
    }
    const stored = new Map();
    for (let start = 0; start < listed.length; start += 50) {
      for (const row of await prisma.m4PilotTurn.findMany({ where: { id: { in: listed.slice(start, start + 50).map(item => item.id) } },
        select: { id: true, payload: true, chatTurn: { select: { conversation: { select: { title: true } } } } } })) stored.set(row.id, row);
    }
    // An evidence entry carries its heading path and its text: the same test as for an index passage. A catalogue
    // record's entry is its name by design and comes from another lane: not counted.
    const reasonOf = entry => entry.selection?.reason?.type || entry.selection?.reason || 'unknown', knowledge = entry => reasonOf(entry) !== 'structured_record';
    const headingOnly = entry => { const body = norm(entry.source_text || ''); return knowledge(entry) && Boolean(body) && norm(entry.search_aids?.heading_prefix || '').endsWith(body); };
    const report = { runs: rest.length, turns_listed: listed.length, turns_stored: 0, turns_with_evidence: 0, turns_reranked_by_the_model: 0, evidence_passages: 0, heading_only_in_evidence: 0,
      turns_with_heading_only_evidence: 0, heading_only_kept_by_the_model: 0, heading_only_cited: 0, turns_citing_heading_only: 0, other_under_100_chars_in_evidence: 0, other_under_100_chars_cited: 0, heading_only_reasons: {}, items: [] };
    for (const item of listed) {
      const row = stored.get(item.id);
      if (!row || !row.chatTurn?.conversation?.title?.startsWith('Hindamine ')) continue;
      report.turns_stored++;
      const packet = row.payload.packet, evidence = packet?.evidence || [], reranked = Array.isArray(row.payload.searchAssist?.rerank?.selected);
      if (!evidence.length) continue;
      report.turns_with_evidence++; if (reranked) report.turns_reranked_by_the_model++;
      report.evidence_passages += evidence.filter(knowledge).length;
      const cited = new Set((row.payload.answer?.blocks || []).flatMap(block => block.refs || []).map(ref => packet.reference_map?.[ref]?.evidence_id).filter(Boolean));
      const found = evidence.filter(headingOnly);
      for (const entry of evidence.filter(other => knowledge(other) && !headingOnly(other) && norm(other.source_text || '').length < 100)) { report.other_under_100_chars_in_evidence++; if (cited.has(entry.evidence_id)) report.other_under_100_chars_cited++; }
      if (!found.length) continue;
      report.turns_with_heading_only_evidence++; report.heading_only_in_evidence += found.length;
      if (found.some(entry => cited.has(entry.evidence_id))) report.turns_citing_heading_only++;
      for (const entry of found) {
        const reason = reasonOf(entry);
        report.heading_only_reasons[reason] = (report.heading_only_reasons[reason] || 0) + 1;
        if (reranked && reason === 'ranked_seed') report.heading_only_kept_by_the_model++;
        if (cited.has(entry.evidence_id)) report.heading_only_cited++;
        report.items.push({ run: item.run, scenario: item.scenario, title: entry.bibliography?.title || '', text: norm(entry.source_text).slice(0, 80), reason, reranked, cited: cited.has(entry.evidence_id) });
      }
    }
    await fs.writeFile(path.join(out, 'heading-passages-turns.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify({ ...report, items: report.items.slice(0, 40) }, null, 1));
  } finally { await prisma.$disconnect(); }
  process.exit(0);
}
const postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
try {
  await postgres.inheritVerified({ keep: false }).catch(() => 0);
  const generation = await postgres.active(tenant), documents = Object.keys(generation.snapshot.documents);
  if (generation.config.embedding.input_version !== 'title-section-text-v1') throw new Error('the heading path is read from the title-section-text-v1 input');
  const directories = await postgres.retrievalDirectory(tenant, generation, documents);
  const classOf = new Map(directories.map(row => [row.document_id, documentClass(row)]));
  const eligible = new Set(directories.flatMap(row => row.units.filter(unit => unit.role.evidence_eligible).map(unit => unit.id)));

  // Every passage of the index, read from its unit row (the text the channels search).
  const { layout } = await postgres.layoutOf(tenant, generation.id);
  const scope = layout === VERSION_LAYOUT
    ? { from: 'rag_v2_version_unit u', where: `u.tenant=$1 AND u.config_id=(SELECT config->>'id' FROM rag_v2_generation WHERE tenant=$1 AND id=$2)
        AND u.version_id IN (SELECT version_id FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2 AND document_id=ANY($3::text[]))` }
    : { from: 'rag_v2_unit u', where: 'u.tenant=$1 AND u.generation_id=$2 AND u.document_id=ANY($3::text[])' };
  const units = new Map();
  for (let start = 0; start < documents.length; start += 300) {
    const rows = (await postgres.pool.query(`SELECT u.id,u.document_id,u.chunk_id,u.ordinal,u.title,u.data->>'input_text' AS input_text,(u.data->>'input_tokens')::int AS tokens
      FROM ${scope.from} WHERE ${scope.where}`, [tenant, generation.id, documents.slice(start, start + 300)])).rows;
    for (const row of rows) {
      const kind = passageKind(row.input_text);
      units.set(row.id, { id: row.id, document: row.document_id, chunk: row.chunk_id, ordinal: row.ordinal, title: row.title, tokens: row.tokens, class: classOf.get(row.document_id),
        eligible: eligible.has(row.id), headingOnly: kind.headingOnly, bodyChars: kind.bodyChars, ...(kind.bodyChars < 100 ? { body: kind.body } : {}) });
    }
  }
  const headingOnly = new Set([...units.values()].filter(unit => unit.eligible && unit.headingOnly).map(unit => unit.id));

  if (mode === 'census') {
    const classes = {}, perDocument = new Map(), all = [...units.values()];
    for (const unit of all) {
      const row = classes[unit.class] ||= { documents: new Set(), passages: 0, not_evidence_already: 0, heading_only: 0, heading_only_tokens: 0, other_under_100_chars: 0, other_under_200_chars: 0, documents_with_heading_only: new Set() };
      row.documents.add(unit.document); row.passages++;
      if (!unit.eligible) { row.not_evidence_already++; continue; }
      if (unit.headingOnly) { row.heading_only++; row.heading_only_tokens += unit.tokens; row.documents_with_heading_only.add(unit.document); perDocument.set(unit.document, (perDocument.get(unit.document) || 0) + 1); }
      else if (unit.bodyChars < 100) row.other_under_100_chars++;
      else if (unit.bodyChars < 200) row.other_under_200_chars++;
    }
    const perClass = Object.fromEntries(Object.entries(classes).map(([name, row]) => [name, { ...row, documents: row.documents.size, documents_with_heading_only: row.documents_with_heading_only.size,
      heading_only_share: share(row.heading_only, row.passages) }]));
    const top = (list, n) => { const count = new Map(); for (const text of list) count.set(text, (count.get(text) || 0) + 1); return [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n); };
    const passagesOf = new Map(); for (const unit of all) passagesOf.set(unit.document, (passagesOf.get(unit.document) || 0) + 1);
    const titleOf = new Map(all.map(unit => [unit.document, unit.title]));
    const heading = all.filter(unit => headingOnly.has(unit.id)), short = all.filter(unit => unit.eligible && !unit.headingOnly && unit.bodyChars < 100);
    const counts = [...perDocument.values()];
    const report = { generation: generation.id, documents: documents.length, passages: all.length, heading_only: heading.length, heading_only_share: share(heading.length, all.length),
      heading_only_tokens: heading.reduce((sum, unit) => sum + unit.tokens, 0), classes: perClass,
      documents_with_heading_only: { one_or_more: counts.length, five_or_more: counts.filter(n => n >= 5).length, ten_or_more: counts.filter(n => n >= 10).length, twenty_or_more: counts.filter(n => n >= 20).length },
      heading_only_body_chars: { under_20: heading.filter(unit => unit.bodyChars < 20).length, under_50: heading.filter(unit => unit.bodyChars < 50).length, under_100: heading.filter(unit => unit.bodyChars < 100).length, all: heading.length },
      commonest_heading_only_texts: top(heading.filter(unit => unit.body !== undefined).map(unit => unit.body), 40),
      documents_with_most: [...perDocument].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([document, count]) => ({ title: titleOf.get(document), class: classOf.get(document), passages: passagesOf.get(document), heading_only: count })),
      other_short_passages: { under_100_chars: short.length, commonest_texts: top(short.map(unit => unit.body), 40),
        by_class: Object.fromEntries(Object.entries(perClass).map(([name, row]) => [name, row.other_under_100_chars])) } };
    await fs.writeFile(path.join(out, 'heading-passages-census.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify({ generation: report.generation, documents: report.documents, passages: report.passages, heading_only: report.heading_only, share: report.heading_only_share,
      tokens: report.heading_only_tokens, documents_with_heading_only: report.documents_with_heading_only, body_chars: report.heading_only_body_chars }));
    for (const [name, row] of Object.entries(perClass)) console.log(JSON.stringify({ class: name, ...row }));
    console.log(JSON.stringify({ commonest_heading_only: report.commonest_heading_only_texts.slice(0, 25) }));
    console.log(JSON.stringify({ documents_with_most: report.documents_with_most.slice(0, 15) }));
    console.log(JSON.stringify({ other_short: report.other_short_passages.under_100_chars, commonest: report.other_short_passages.commonest_texts.slice(0, 25) }));
  } else {
    const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
    const context = { subject: 'heading-passages', tenant, usage: 'development_only' };
    const groups = unifiedDirectory(directories), byChunk = new Map([...units.values()].map(unit => [unit.chunk, unit]));
    // The second arm: the same catalogue and index, the heading-only passages outside both channels' unit lists.
    const kept = ids => { if (!Array.isArray(ids)) throw new Error('the search passes its eligible passages'); return ids.filter(unit => !headingOnly.has(unit)); };
    const proxy = (target, name, at) => new Proxy(target, { get(object, key) {
      if (key === name) return (...args) => object[name](...args.map((arg, index) => index === at ? kept(arg) : arg));
      const value = object[key]; return typeof value === 'function' ? value.bind(object) : value;
    } });
    const arms = { now: { postgres, qdrant }, without: { postgres: proxy(postgres, 'lexical', 5), qdrant: proxy(qdrant, 'query', 4) } };
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Tallinn' });
    const report = { generation: generation.id, profile: CHAT_SUBSECTIONS_PROFILE, heading_only_passages: headingOnly.size, search: 'fused lexical and vector, no rerank model, no answer model, saved query vectors only', catalogues: [] };
    for (const pair of rest) {
      const [cataloguePath, vectorPath] = pair.split('='), catalogue = JSON.parse(await fs.readFile(cataloguePath, 'utf8'));
      const vectors = new Map(Object.entries(JSON.parse(await fs.readFile(vectorPath, 'utf8'))));
      const questions = catalogue.questions ? catalogue.questions.map(question => ({ id: question.id, text: question.text, queries: question.queries || [], region: question.region ?? null, phrases: question.evidence_text || [] }))
        : catalogue.scenarios.map(scenario => ({ id: scenario.id, text: scenario.turns[0].text, queries: [], region: scenario.turns[0].expect?.region ?? null, phrases: scenario.turns[0].expect?.evidence_text || [] }));
      const legal = legalValidityScope(groups.knowledge, legalReference(catalogue.date || today, []));
      const rows = [], skipped = [];
      for (const question of questions) {
        if ([question.text, ...question.queries].some(text => !vectors.has(text))) { skipped.push(question.id); continue; }
        const allowed = municipalScope(legal.eligible, question.region ? { region: question.region } : null).eligible.map(row => row.document_id), allowedSet = new Set(allowed);
        const policy = { async allowed() { return { documents: allowed, revision: `heading-passages-${generation.id}-${question.region ?? 'none'}` }; } };
        const row = { question: question.id, region: question.region, has_phrase: question.phrases.length > 0 };
        for (const [arm, stores] of Object.entries(arms)) {
          const profile = retrievalProfile(CHAT_SUBSECTIONS_PROFILE);
          assertProfileGeneration(profile, generation);
          const query = queryForProfile(profile, { text: question.text, language: 'et', generation_id: generation.id });
          if (question.queries.length) query.variants = question.queries;
          const reserve = groups.nationalLaw.filter(item => allowedSet.has(item.document_id));
          if (reserve.length) query.poolReserve = { documents: reserve.map(item => item.document_id), ...NATIONAL_LAW_RESERVE };
          let pool = null;
          const packet = await retrieve({ ...stores, policy, context, query, allowLexicalFallback: false, hooks: { rerank: async passages => { pool = passages; return null; } },
            embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) } });
          if (['error', 'degraded'].includes(packet.state)) throw Object.assign(new Error(packet.error || 'retrieval_failed'), { code: 'retrieval_failed' });
          const candidates = packet.rerank?.candidates || [], reserved = new Set(packet.rerank?.reserved || []), fused = candidates.filter(unit => !reserved.has(unit));
          const holds = text => question.phrases.length > 0 && question.phrases.every(phrase => spaced(text).includes(spaced(phrase)));
          const place = (pool || []).findIndex(passage => holds(passage.text)), evidence = packet.evidence || [];
          const seeds = evidence.filter(entry => (entry.selection.reason?.type || entry.selection.reason) === 'ranked_seed');
          // Which channel ranked a passage: its best place in the lexical list and in the vector lists (the question's and its queries').
          const fusedRank = new Map((packet.raw_rankings?.hybrid || []).map(rank => [rank.id, rank.ranks]));
          const channelsOf = unit => { const ranks = fusedRank.get(unit) || {}, vector = Object.entries(ranks).filter(([name]) => name.startsWith('vector')).map(([, place]) => place);
            return { lexical: ranks.lexical ?? null, vector: vector.length ? Math.min(...vector) : null }; };
          const example = (unit, index) => ({ place: index + 1, title: units.get(unit).title, class: units.get(unit).class, text: (pool[index]?.text.split('\n\n').slice(1).join(' ') || '').replace(/\s+/gu, ' ').slice(0, 90), ...channelsOf(unit) });
          row[arm] = { candidates, fused: fused.length, reserve: reserved.size, documents_in_fused: new Set(fused.map(unit => units.get(unit).document)).size,
            heading_only_in_fused: fused.filter(unit => headingOnly.has(unit)).length, heading_only_places: fused.map((unit, index) => headingOnly.has(unit) ? index + 1 : 0).filter(Boolean),
            heading_only_in_first_nine: fused.slice(0, 9).filter(unit => headingOnly.has(unit)).length, heading_only_in_reserve: [...reserved].filter(unit => headingOnly.has(unit)).length,
            heading_only_by_class: Object.fromEntries(Object.entries(Object.groupBy(fused.filter(unit => headingOnly.has(unit)), unit => units.get(unit).class)).map(([name, list]) => [name, list.length])),
            heading_only_examples: fused.map((unit, index) => headingOnly.has(unit) ? example(unit, index) : null).filter(Boolean),
            other_under_100_chars_in_fused: fused.filter(unit => !headingOnly.has(unit) && units.get(unit).bodyChars < 100).length,
            other_under_100_chars_examples: fused.map((unit, index) => !headingOnly.has(unit) && units.get(unit).bodyChars < 100 ? example(unit, index) : null).filter(Boolean),
            deciding_place: place < 0 ? null : place + 1, deciding_part: place < 0 ? null : place < fused.length ? 'fused' : 'national_law_reserve',
            final: { passages: evidence.length, seeds: seeds.length, context_tokens: packet.measurements?.context_tokens ?? null, chunks: evidence.map(entry => entry.chunk_id),
              heading_only: evidence.filter(entry => headingOnly.has(byChunk.get(entry.chunk_id)?.id)).length, heading_only_seeds: seeds.filter(entry => headingOnly.has(byChunk.get(entry.chunk_id)?.id)).length,
              deciding_selected: question.phrases.length > 0 && question.phrases.every(phrase => evidence.some(entry => spaced(entry.source_text).includes(spaced(phrase)))) } };
        }
        const before = new Set(row.now.candidates), after = new Set(row.without.candidates), finalBefore = new Set(row.now.final.chunks);
        row.change = { entered_candidates: row.without.candidates.filter(unit => !before.has(unit)).length, left_candidates: row.now.candidates.filter(unit => !after.has(unit)).length,
          entered_titles: [...new Set(row.without.candidates.filter(unit => !before.has(unit)).map(unit => units.get(unit).title))].slice(0, 6),
          final_entered: row.without.final.chunks.filter(chunk => !finalBefore.has(chunk)).length, context_tokens: (row.without.final.context_tokens ?? 0) - (row.now.final.context_tokens ?? 0) };
        for (const arm of ['now', 'without']) { delete row[arm].candidates; delete row[arm].final.chunks; }
        rows.push(row);
      }
      report.catalogues.push({ catalogue: cataloguePath, date: catalogue.date || today, questions: rows, skipped_no_saved_vector: skipped });
    }
    const all = report.catalogues.flatMap(item => item.questions), withPhrase = all.filter(row => row.has_phrase), mean = list => list.length ? +(list.reduce((a, b) => a + b, 0) / list.length).toFixed(2) : null;
    const summary = arm => ({ mean_heading_only_in_fused: mean(all.map(row => row[arm].heading_only_in_fused)), max_heading_only_in_fused: Math.max(...all.map(row => row[arm].heading_only_in_fused)),
      questions_with_one_or_more: all.filter(row => row[arm].heading_only_in_fused >= 1).length, with_three_or_more: all.filter(row => row[arm].heading_only_in_fused >= 3).length,
      with_five_or_more: all.filter(row => row[arm].heading_only_in_fused >= 5).length, with_one_in_first_nine: all.filter(row => row[arm].heading_only_in_first_nine >= 1).length,
      heading_only_seeds_in_final: all.reduce((sum, row) => sum + row[arm].final.heading_only_seeds, 0), questions_with_heading_only_seed: all.filter(row => row[arm].final.heading_only_seeds >= 1).length,
      heading_only_in_final: all.reduce((sum, row) => sum + row[arm].final.heading_only, 0),
      deciding_among_candidates: withPhrase.filter(row => row[arm].deciding_place).length, deciding_in_fused: withPhrase.filter(row => row[arm].deciding_part === 'fused').length,
      mean_deciding_place: mean(withPhrase.filter(row => row.now.deciding_place && row.without.deciding_place).map(row => row[arm].deciding_place)),
      deciding_in_final_without_model: withPhrase.filter(row => row[arm].final.deciding_selected).length, mean_context_tokens: mean(all.map(row => row[arm].final.context_tokens ?? 0)) });
    const examples = all.flatMap(row => row.now.heading_only_examples), others = all.flatMap(row => row.now.other_under_100_chars_examples);
    const tally = (list, key) => Object.fromEntries(Object.entries(Object.groupBy(list, key)).map(([name, items]) => [name, items.length]));
    report.heading_only_among_candidates = { places: examples.length, of_candidate_places: all.reduce((sum, row) => sum + row.now.fused, 0), by_class: tally(examples, item => item.class),
      // 40 is the profile's candidate limit per channel list: a passage with a place in a list was found by that channel.
      found_by: tally(examples, item => item.lexical && item.vector ? 'both channels' : item.lexical ? 'lexical only' : 'vector only') };
    report.other_short_among_candidates = { places: others.length, questions: all.filter(row => row.now.other_under_100_chars_in_fused).length, by_class: tally(others, item => item.class) };
    report.summary = { questions: all.length, with_deciding_phrase: withPhrase.length, skipped: report.catalogues.reduce((sum, item) => sum + item.skipped_no_saved_vector.length, 0), now: summary('now'), without: summary('without'),
      questions_whose_candidates_change: all.filter(row => row.change.entered_candidates).length, questions_whose_final_changes: all.filter(row => row.change.final_entered).length,
      deciding_gained: withPhrase.filter(row => !row.now.final.deciding_selected && row.without.final.deciding_selected).map(row => row.question),
      deciding_lost: withPhrase.filter(row => row.now.final.deciding_selected && !row.without.final.deciding_selected).map(row => row.question),
      deciding_candidate_gained: withPhrase.filter(row => !row.now.deciding_place && row.without.deciding_place).map(row => row.question),
      deciding_candidate_lost: withPhrase.filter(row => row.now.deciding_place && !row.without.deciding_place).map(row => row.question) };
    await fs.writeFile(path.join(out, 'heading-passages-search.json'), JSON.stringify(report, null, 1));
    console.log(JSON.stringify(report.summary));
    console.log(JSON.stringify({ heading_only_among_candidates: report.heading_only_among_candidates, other_short_among_candidates: report.other_short_among_candidates }));
    for (const row of all.filter(item => item.now.heading_only_in_fused)) console.log(JSON.stringify({ question: row.question,
      now: { heading_only: row.now.heading_only_in_fused, deciding: row.now.deciding_place, selected: row.now.final.deciding_selected, seeds: row.now.final.heading_only_seeds },
      without: { deciding: row.without.deciding_place, selected: row.without.final.deciding_selected }, change: row.change,
      examples: row.now.heading_only_examples.map(item => `${item.place}. ${item.title.slice(0, 50)} | ${item.text.slice(0, 50)} | lex ${item.lexical} vec ${item.vector}`) }));
    console.log(JSON.stringify({ other_short_examples: others.slice(0, 30).map(item => `${item.class} | ${item.title.slice(0, 40)} | ${item.text.slice(0, 70)}`) }));
  }
} finally { await postgres.close(); }
