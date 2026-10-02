// A free look at the rerank pool for the first turns of dialogue catalogues (no answer model, no reranker, no search
// variants: the chat's planner writes its own). Per question: the places one document takes among the 30 fused
// candidates and how many places a ten-per-document limit changes. Prints counts and titles only.
import fs from 'node:fs/promises';
const A = '/home/ubuntu/apps/sotsiaalai';
const { PostgresCatalog } = await import(`${A}/lib/rag-v2/search/postgres.js`);
const { QdrantIndex } = await import(`${A}/lib/rag-v2/search/qdrant.js`);
const { retrieve, RERANK_POOL } = await import(`${A}/lib/rag-v2/search/retrieval.js`);
const { retrievalProfile, queryForProfile, CHAT_NAMED_ACTS_PROFILE } = await import(`${A}/lib/rag-v2/search/profiles.js`);
const { unifiedDirectory, municipalScope, NATIONAL_LAW_RESERVE } = await import(`${A}/lib/rag-v2/search/unified.js`);
const { legalReference, legalValidityScope } = await import(`${A}/lib/rag-v2/search/legal-validity.js`);

const [, , out, ...files] = process.argv, CAP = 10;
const tenant = 'sotsiaalai-corpus', postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
const context = { subject: 'search-diagnosis', tenant, usage: 'development_only' };
try {
  const generation = await postgres.active(tenant), documents = Object.keys(generation.snapshot.documents);
  const groups = unifiedDirectory(await postgres.retrievalDirectory(tenant, generation, documents));
  const legal = legalValidityScope(groups.knowledge, legalReference('2026-10-02', []));
  const allowed = municipalScope(legal.eligible, null).eligible.map(row => row.document_id), inScope = new Set(allowed);
  const national = groups.nationalLaw.filter(row => inScope.has(row.document_id)).map(row => row.document_id);
  const address = new Map();
  for (const directory of groups.knowledge) if (inScope.has(directory.document_id)) for (const unit of directory.units) address.set(unit.id, directory.document_id);
  const titles = await postgres.documentTitles(tenant, generation.id, allowed);
  const questions = [];
  for (const file of files) {
    const raw = JSON.parse(await fs.readFile(`${A}/${file}`, 'utf8'));
    for (const scenario of raw.scenarios) questions.push({ file, id: scenario.id, text: scenario.turns[0].text });
  }
  const vectorFile = `${out}/vectors.json`, vectors = new Map(Object.entries(await fs.readFile(vectorFile, 'utf8').then(JSON.parse).catch(() => ({}))));
  for (const n of ['1', '2', '3']) {
    const stored = await fs.readFile(`/home/ubuntu/rag-v2-work/eval-files/graph-hard-${n}/vectors.json`, 'utf8').then(JSON.parse).catch(() => ({}));
    for (const [text, vector] of Object.entries(stored)) if (!vectors.has(text)) vectors.set(text, vector);
  }
  const missing = [...new Set(questions.map(question => question.text))].filter(text => !vectors.has(text));
  if (missing.length) {
    const config = generation.config.embedding;
    const response = await fetch(config.endpoint || 'https://api.openai.com/v1/embeddings', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: config.model, input: missing, dimensions: config.dimensions, encoding_format: 'float' }) });
    if (!response.ok) throw new Error(`embedding_failed_${response.status}`);
    const body = await response.json();
    body.data.forEach((item, index) => vectors.set(missing[index], item.embedding));
    await fs.writeFile(vectorFile, JSON.stringify(Object.fromEntries(vectors)));
    console.error(JSON.stringify({ embedded: missing.length, tokens: body.usage?.total_tokens ?? null }));
  }
  const policy = { async allowed() { return { documents: allowed, revision: `search-diagnosis-${generation.id}` }; } };
  const rows = [];
  for (const question of questions) {
    const query = queryForProfile(retrievalProfile(CHAT_NAMED_ACTS_PROFILE), { text: question.text, language: 'et', generation_id: generation.id });
    query.poolReserve = { documents: national, ...NATIONAL_LAW_RESERVE };
    const packet = await retrieve({ postgres, qdrant, policy, context, query, allowLexicalFallback: false,
      embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) },
      hooks: { rerank: async () => null } });
    if (['error', 'degraded'].includes(packet.state)) throw new Error(packet.error || 'retrieval_failed');
    const ranked = packet.raw_rankings.hybrid.map(row => ({ id: row.id, document: address.get(row.id) }));
    const pool = ranked.slice(0, RERANK_POOL), per = new Map();
    for (const item of pool) per.set(item.document, (per.get(item.document) || 0) + 1);
    const [topDocument, topPassages] = [...per].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
    const seen = new Map(), capped = [];
    for (const item of ranked) {
      if (capped.length >= RERANK_POOL) break;
      const n = seen.get(item.document) || 0;
      if (n >= CAP) continue;
      seen.set(item.document, n + 1); capped.push(item);
    }
    const inPool = new Set(pool.map(item => item.id));
    rows.push({ file: question.file.split('/').pop(), question: question.id, text: question.text.slice(0, 80), documents_in_pool: per.size,
      top_document: titles.get(topDocument) ?? topDocument, top_passages: topPassages, changed_by_cap: capped.filter(item => !inPool.has(item.id)).length });
  }
  await fs.writeFile(`${out}/pool-diagnosis-dialogue.json`, JSON.stringify({ generation: generation.id, cap: CAP, rows }, null, 1));
  console.log(JSON.stringify({ ok: true, questions: rows.length, changed: rows.filter(row => row.changed_by_cap).length }));
} finally { await postgres.close?.(); }
