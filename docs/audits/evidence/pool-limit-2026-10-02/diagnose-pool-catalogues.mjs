// A free look at the rerank pool over whole catalogues (no answer model, no reranker): how many of the fused pool's
// places one document takes, where the passage with a question's deciding phrase stands, and what a per-document cap on
// the fused pool would do to both. Run from the app root on the server. Prints counts, ranks and titles only.
import fs from 'node:fs/promises';
const A = '/home/ubuntu/apps/sotsiaalai';
const { PostgresCatalog } = await import(`${A}/lib/rag-v2/search/postgres.js`);
const { QdrantIndex } = await import(`${A}/lib/rag-v2/search/qdrant.js`);
const { retrieve, RERANK_POOL } = await import(`${A}/lib/rag-v2/search/retrieval.js`);
const { retrievalProfile, queryForProfile, CHAT_NAMED_ACTS_PROFILE } = await import(`${A}/lib/rag-v2/search/profiles.js`);
const { unifiedDirectory, municipalScope, NATIONAL_LAW_RESERVE } = await import(`${A}/lib/rag-v2/search/unified.js`);
const { legalReference, legalValidityScope } = await import(`${A}/lib/rag-v2/search/legal-validity.js`);

const [, , out, ...files] = process.argv, CAPS = [6, 8, 10, 12, 15];
const tenant = 'sotsiaalai-corpus', postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
const context = { subject: 'search-diagnosis', tenant, usage: 'development_only' }, spaced = text => text.replace(/\s+/gu, ' ');
try {
  const generation = await postgres.active(tenant), documents = Object.keys(generation.snapshot.documents);
  const groups = unifiedDirectory(await postgres.retrievalDirectory(tenant, generation, documents));
  const report = { generation: generation.id, fused_pool: RERANK_POOL, caps: CAPS, catalogues: [] };
  for (const file of files) {
    const catalogue = JSON.parse(await fs.readFile(`${A}/${file}`, 'utf8'));
    const number = file.match(/(\d+)\.json$/u)[1];
    const vectors = new Map(Object.entries(JSON.parse(await fs.readFile(`/home/ubuntu/rag-v2-work/eval-files/graph-hard-${number}/vectors.json`, 'utf8'))));
    const legal = legalValidityScope(groups.knowledge, legalReference(catalogue.date, []));
    const rows = [];
    for (const question of catalogue.questions) {
      const allowed = municipalScope(legal.eligible, question.region ? { region: question.region } : null).eligible.map(row => row.document_id), inScope = new Set(allowed);
      const national = groups.nationalLaw.filter(row => inScope.has(row.document_id)).map(row => row.document_id);
      const policy = { async allowed() { return { documents: allowed, revision: `search-diagnosis-${generation.id}-${question.region ?? 'none'}` }; } };
      const query = queryForProfile(retrievalProfile(CHAT_NAMED_ACTS_PROFILE), { text: question.text, language: 'et', generation_id: generation.id });
      if (question.queries.length) query.variants = question.queries;
      query.poolReserve = { documents: national, ...NATIONAL_LAW_RESERVE };
      const packet = await retrieve({ postgres, qdrant, policy, context, query, allowLexicalFallback: false,
        embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) },
        hooks: { rerank: async () => null } });
      if (['error', 'degraded'].includes(packet.state)) throw new Error(packet.error || 'retrieval_failed');
      const hybrid = packet.raw_rankings.hybrid, docs = [...new Set(hybrid.map(row => row.document_id ?? null))];
      // The unit rows of every ranked document: which document a ranked unit is of, and its text.
      const ids = new Set(hybrid.map(row => row.id)), unitRows = new Map();
      const address = new Map();
      for (const directory of groups.knowledge) if (inScope.has(directory.document_id)) for (const unit of directory.units) if (ids.has(unit.id)) address.set(unit.id, directory.document_id);
      const loaded = await postgres.units(tenant, generation.id, [...new Set(address.values())]);
      for (const unit of loaded) if (ids.has(unit.id)) unitRows.set(unit.id, unit);
      const ranked = hybrid.map((row, index) => ({ rank: index + 1, id: row.id, document: address.get(row.id), title: unitRows.get(row.id)?.title ?? '',
        holds: question.evidence_text.some(phrase => spaced(unitRows.get(row.id)?.input_text ?? '').includes(spaced(phrase))) }));
      const count = list => { const per = new Map(); for (const item of list) per.set(item.document, (per.get(item.document) || 0) + 1); return per; };
      const pool = ranked.slice(0, RERANK_POOL), per = count(pool), top = [...per].sort((a, b) => b[1] - a[1])[0];
      const capped = cap => { const seen = new Map(), kept = []; for (const item of ranked) { if (kept.length >= RERANK_POOL) break; const n = seen.get(item.document) || 0; if (n >= cap) continue; seen.set(item.document, n + 1); kept.push(item); } return kept; };
      const phrase = ranked.filter(item => item.holds).map(item => item.rank);
      rows.push({ question: question.id, ranked: ranked.length, documents_in_pool: per.size, top_document: { title: pool.find(item => item.document === top[0])?.title ?? '', passages: top[1] },
        phrase_ranks: phrase.slice(0, 5), phrase_in_pool: phrase.some(rank => rank <= RERANK_POOL),
        phrase_in_reserve: (packet.rerank?.reserved || []).some(id => ranked.find(item => item.id === id)?.holds),
        with_cap: Object.fromEntries(CAPS.map(cap => { const kept = capped(cap); return [cap, { phrase_at: kept.findIndex(item => item.holds) + 1 || null, documents: count(kept).size,
          // The pool's leading nine as the fused order has them: does the cap change the seeds of a search with no reranker?
          same_first_nine: kept.slice(0, 9).every((item, index) => item.id === ranked[index].id) }]; })) });
      void docs;
    }
    report.catalogues.push({ file, questions: rows });
  }
  await fs.writeFile(`${out}/pool-diagnosis.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ok: true, questions: report.catalogues.map(item => item.questions.length) }));
} finally { await postgres.close?.(); }
