// A free look at one question's search (no answer model): where the passages of a named act's sections stand in each
// channel, in the fused order, in the rerank pool (the chat's pool with the national-law reserve) and in the selection.
// Run from the app root on the server; prints titles, headings, ranks and short passage starts of corpus texts only.
import fs from 'node:fs/promises';
const A = '/home/ubuntu/apps/sotsiaalai';
const { PostgresCatalog } = await import(`${A}/lib/rag-v2/search/postgres.js`);
const { QdrantIndex } = await import(`${A}/lib/rag-v2/search/qdrant.js`);
const { retrieve, RERANK_POOL } = await import(`${A}/lib/rag-v2/search/retrieval.js`);
const { retrievalProfile, queryForProfile, CHAT_NAMED_ACTS_PROFILE } = await import(`${A}/lib/rag-v2/search/profiles.js`);
const { chunkSection } = await import(`${A}/lib/rag-v2/search/legal-references.js`);
const { unifiedDirectory, municipalScope, NATIONAL_LAW_RESERVE } = await import(`${A}/lib/rag-v2/search/unified.js`);
const { legalReference, legalValidityScope } = await import(`${A}/lib/rag-v2/search/legal-validity.js`);

const spec = JSON.parse(await fs.readFile(process.argv[2], 'utf8')), out = process.argv[3];
const tenant = 'sotsiaalai-corpus', postgres = new PostgresCatalog(process.env.RAG_V2_POSTGRES_URL);
const qdrant = new QdrantIndex(process.env.RAG_V2_QDRANT_URL, process.env.RAG_V2_QDRANT_KEY);
const context = { subject: 'search-diagnosis', tenant, usage: 'development_only' };
try {
  const generation = await postgres.active(tenant), documents = Object.keys(generation.snapshot.documents);
  const groups = unifiedDirectory(await postgres.retrievalDirectory(tenant, generation, documents));
  const legal = legalValidityScope(groups.knowledge, legalReference(spec.date, []));
  const allowed = municipalScope(legal.eligible, null).eligible.map(row => row.document_id), inScope = new Set(allowed);
  const national = groups.nationalLaw.filter(row => inScope.has(row.document_id)).map(row => row.document_id);
  const titles = await postgres.documentTitles(tenant, generation.id, allowed);
  const target = [...titles].filter(([, title]) => title === spec.act).map(([doc]) => doc);
  if (target.length !== 1) throw new Error(`act documents in scope: ${target.length}`);
  const [bundle] = await postgres.bundles(tenant, generation.id, target), units = await postgres.units(tenant, generation.id, target);
  const wanted = new Map();
  for (const chunk of bundle.chunks) {
    const section = chunkSection(chunk);
    if (spec.sections.includes(section)) wanted.set(units.find(unit => unit.chunk_id === chunk.id).id, `§ ${section} #${chunk.ordinal}`);
  }
  const vectorFile = `${out}/vectors.json`;
  const vectors = new Map(Object.entries(await fs.readFile(vectorFile, 'utf8').then(JSON.parse).catch(() => ({}))));
  const missing = [...new Set(spec.sets.flatMap(set => [set.text, ...set.queries]))].filter(text => !vectors.has(text));
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
  const report = { generation: generation.id, date: spec.date, act: spec.act, in_scope: allowed.length, national_acts: national.length, wanted: [...wanted.values()], sets: [] };
  for (const set of spec.sets) {
    const query = queryForProfile(retrievalProfile(CHAT_NAMED_ACTS_PROFILE), { text: set.text, language: 'et', generation_id: generation.id });
    if (set.queries.length) query.variants = set.queries;
    query.poolReserve = { documents: national, ...NATIONAL_LAW_RESERVE };
    let pool = null;
    const packet = await retrieve({ postgres, qdrant, policy, context, query, allowLexicalFallback: false,
      embedding: { config: generation.config.embedding, source: 'persisted_vectors', embed: async text => vectors.get(text) },
      // The chat's pool, read and left in the fused order (null: no reranker).
      hooks: { rerank: async passages => { pool = passages; return null; } } });
    if (['error', 'degraded'].includes(packet.state)) throw new Error(packet.error || 'retrieval_failed');
    const rank = (rows, unit) => { const at = (rows || []).findIndex(row => row.id === unit); return at < 0 ? null : at + 1; };
    const channels = Object.keys(packet.raw_rankings);
    const places = [...wanted].map(([unit, name]) => ({ passage: name,
      ...Object.fromEntries(channels.map(channel => [channel, rank(packet.raw_rankings[channel], unit)])),
      pool: rank((packet.rerank?.candidates || []).map(id => ({ id })), unit), reserved: (packet.rerank?.reserved || []).includes(unit),
      selected: packet.evidence.some(entry => entry.chunk_id === units.find(item => item.id === unit).chunk_id && entry.document_id === target[0]) }));
    const head = text => text.replace(/\s+/gu, ' ').slice(0, 150);
    report.sets.push({ name: set.name, text: set.text, queries: set.queries, channel_sizes: Object.fromEntries(channels.map(channel => [channel, packet.raw_rankings[channel].length])),
      places, pool_size: pool?.length ?? null, fused_pool: RERANK_POOL,
      pool: (pool || []).map((passage, index) => ({ n: index + 1, title: passage.title, start: head(passage.text) })),
      selected: packet.evidence.map(entry => ({ title: entry.bibliography?.title || '', reason: entry.selection.reason?.type || entry.selection.reason,
        section: entry.selection.reason?.section ?? null, start: head(entry.source_text) })),
      named_act_references: packet.measurements.named_act_references ?? null, cross_references: packet.measurements.cross_references ?? null });
  }
  await fs.writeFile(`${out}/diagnosis.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ok: true, sets: report.sets.map(set => ({ name: set.name, places: set.places })) }, null, 1));
} finally { await postgres.close?.(); }
