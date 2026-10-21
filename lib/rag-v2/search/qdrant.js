import { fail, hash, stable } from '../contracts.js';
import { localQdrantUrl } from './local-config.js';
import { validateVector } from './embedding.js';
import { generationVersions, sharedLayout } from './layout.js';

// ADR-159: the temporary speed probe of query() (see there); off once the search is changed.
const SPEED_PROBE = true;
export function pointId(unitId) { const h = hash(unitId); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; }
export function collectionName(tenant, generationId, mode = 'mock') {
  if (!['mock', 'real'].includes(mode)) fail('invalid_embedding_mode');
  return `ragv2_${mode}_${hash(stable([tenant, generationId])).slice(0, 40)}`;
}
/** ADR-036: one collection per tenant and search config; points belong to a document version, not a generation. */
export function versionCollectionName(tenant, configId, mode = 'mock') {
  if (!['mock', 'real'].includes(mode)) fail('invalid_embedding_mode');
  return `ragv2_${mode}_v_${hash(stable([tenant, 'versions-v1', configId])).slice(0, 40)}`;
}
export function generationCollection(tenant, generationId, config, shared) {
  return shared ? versionCollectionName(tenant, config.id, config.embedding.embedding_mode) : collectionName(tenant, generationId, config.embedding.embedding_mode);
}

function verifyPoint(point, unit, vector, generation) {
  const p = point.payload;
  if (!unit || !p || point.id !== pointId(unit.id) || p.tenant !== generation.tenant || p.generation_id !== (sharedLayout(generation) ? undefined : generation.id)
    || p.config_id !== generation.config.id || p.embedding_mode !== generation.config.embedding.embedding_mode
    || p.document_id !== unit.document_id || p.version_id !== unit.version_id || p.input_hash !== unit.input_hash || p.unit_id !== unit.id) fail('qdrant_point_integrity_failed');
  validateVector(point.vector, generation.config.embedding); validateVector(vector, generation.config.embedding);
  const norm = Math.hypot(...vector), actualNorm = Math.hypot(...point.vector);
  if (point.vector.some((v, i) => Math.abs(v / actualNorm - vector[i] / norm) > 0.00001)) fail('qdrant_vector_content_mismatch');
}
export class QdrantIndex {
  constructor(url, key) {
    this.url = localQdrantUrl(url);
    if (typeof key !== 'string' || key.length < 24) fail('qdrant_key_required');
    this.key = key;
  }
  async request(route, method = 'GET', body, { withTime = false } = {}) {
    let response;
    const started = performance.now();
    try { response = await fetch(`${this.url}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { 'api-key': this.key, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (error) {
      // The cause (timeout, refused, reset) goes to the server log; the key and body never do.
      console.error('[rag-v2] qdrant request failed', method, route.split('/').slice(0, 3).join('/'), error?.name, error?.cause?.code || '', Math.round(performance.now() - started) + 'ms');
      throw Object.assign(new Error('qdrant_request_failed'), { code: 'qdrant_request_failed', cause_name: error?.name, cause_code: error?.cause?.code });
    }
    if (!response.ok) throw Object.assign(new Error('qdrant_request_failed'), { code: 'qdrant_request_failed', status: response.status });
    const data = await response.json();
    if (data.status !== 'ok' && data.status !== undefined) fail('qdrant_invalid_response');
    return withTime ? { result: data.result, time: data.time } : data.result ?? data;
  }
  route(generation) {
    if (generation.collection !== generationCollection(generation.tenant, generation.id, generation.config, sharedLayout(generation))) fail('qdrant_collection_scope_mismatch');
    return `/collections/${generation.collection}`;
  }
  async ensure(generation) {
    const route = this.route(generation), cfg = generation.config.embedding;
    try { await this.request(route); }
    catch (e) { if (e.status !== 404) throw e; await this.request(route, 'PUT', { vectors: { size: cfg.dimensions, distance: cfg.distance } }); }
    const info = await this.request(route);
    if (info.config.params.vectors.size !== cfg.dimensions || info.config.params.vectors.distance !== cfg.distance) fail('qdrant_vector_space_mismatch');
    for (const field of ['tenant', 'generation_id', 'document_id', 'version_id', 'config_id']) await this.request(`${route}/index?wait=true`, 'PUT', { field_name: field, field_schema: 'keyword' });
  }
  async upsert(generation, units, vectors) {
    const shared = sharedLayout(generation);
    const points = units.map((u, i) => ({ id: pointId(u.id), vector: validateVector(vectors[i], generation.config.embedding), payload: {
      tenant: generation.tenant, ...(shared ? {} : { generation_id: generation.id }), document_id: u.document_id, version_id: u.version_id,
      unit_id: u.id, input_hash: u.input_hash, config_id: generation.config.id, embedding_mode: generation.config.embedding.embedding_mode,
    } }));
    for (let offset = 0; offset < points.length; offset += 100) await this.request(`${this.route(generation)}/points?wait=true`, 'PUT', { points: points.slice(offset, offset + 100) });
  }
  // A shared collection holds every indexed version of the config; the generation's versions of the documents
  // scope it (a version ID names its document, so a document filter would only repeat the same scope).
  filter(generation, documentIds) { return { must: [
    { key: 'tenant', match: { value: generation.tenant } },
    ...sharedLayout(generation) ? [{ key: 'version_id', match: { any: generationVersions(generation, documentIds) } }]
      : [{ key: 'generation_id', match: { value: generation.id } }, { key: 'document_id', match: { any: documentIds } }],
    { key: 'config_id', match: { value: generation.config.id } },
    { key: 'embedding_mode', match: { value: generation.config.embedding.embedding_mode } },
  ] }; }
  async verify(generation, units, vectors) {
    const expected = new Map(units.map(u => [pointId(u.id), u]));
    if (!Array.isArray(vectors) || vectors.length !== units.length) fail('expected_vectors_required');
    const vectorMap = new Map(units.map((u, i) => [pointId(u.id), validateVector(vectors[i], generation.config.embedding)]));
    let offset, count = 0;
    do {
      const page = await this.request(`${this.route(generation)}/points/scroll`, 'POST', { limit: 100, with_payload: true, with_vector: true, ...(offset ? { offset } : {}) });
      for (const point of page.points) {
        verifyPoint(point, expected.get(point.id), vectorMap.get(point.id), generation);
        expected.delete(point.id); count++;
      }
      offset = page.next_page_offset;
    } while (offset);
    if (expected.size || count !== units.length) fail('qdrant_count_mismatch');
    if (units.length) await this.query(generation, [units[0].document_id], Array.from({ length: generation.config.embedding.dimensions }, (_, i) => i === 0 ? 1 : 0), 1);
  }
  async verifyBatch(generation, units, vectors) {
    if (!units.length || units.length > 100 || !Array.isArray(vectors) || vectors.length !== units.length) fail('invalid_index_batch');
    const expected = new Map(units.map((unit, index) => [pointId(unit.id), { unit, vector: vectors[index] }]));
    if (expected.size !== units.length) fail('invalid_index_batch');
    const points = await this.request(`${this.route(generation)}/points`, 'POST', {
      ids: [...expected.keys()], with_payload: true, with_vector: true,
    });
    for (const point of points) {
      const wanted = expected.get(point.id);
      verifyPoint(point, wanted?.unit, wanted?.vector, generation);
      expected.delete(point.id);
    }
    if (expected.size) fail('qdrant_count_mismatch');
  }
  async verifyCount(generation) {
    // A shared collection also holds other generations' versions: count the ones this generation lists.
    const documents = Object.keys(generation.snapshot?.documents || {});
    const result = await this.request(`${this.route(generation)}/points/count`, 'POST', sharedLayout(generation)
      ? { exact: true, filter: this.filter(generation, documents) } : { exact: true });
    if (result.count !== generation.expected_count) fail('qdrant_count_mismatch');
  }
  /** Reads every vector of these documents' versions once: an exact query with a stored vector of the same scope as the
   *  query (no embedding call). A deploy's build pushes the vectors out of the page cache even under memory.low, and the
   *  first question then waited 8.4 s per query in Qdrant (28.09.2026, ADR-039). Returns the number of queries run. */
  async warm(generation, documentIds) {
    if (!documentIds.length || sharedLayout(generation) && !generationVersions(generation, documentIds).length) return 0;
    const { points } = await this.request(`${this.route(generation)}/points/scroll`, 'POST',
      { limit: 1, filter: this.filter(generation, documentIds), with_vector: true, with_payload: false });
    if (!points?.length) return 0;
    await this.query(generation, documentIds, points[0].vector, 1);
    return 1;
  }
  // The stored vectors of units of the generation, by unit id (ADR-149): a passage's own vector is the query for what
  // stands near it in the index, so nothing is embedded. A point of another tenant, version or config is refused as in query.
  async vectors(generation, unitIds) {
    if (!unitIds.length) return new Map();
    const points = await this.request(`${this.route(generation)}/points`, 'POST', { ids: unitIds.map(pointId), with_vector: true, with_payload: true });
    const found = new Map();
    for (const p of points) {
      const scoped = sharedLayout(generation) ? p.payload.generation_id === undefined && p.payload.version_id === generation.snapshot.documents[p.payload.document_id]?.version_id
        : p.payload.generation_id === generation.id;
      if (p.payload.tenant !== generation.tenant || !scoped || p.payload.config_id !== generation.config.id
        || p.payload.embedding_mode !== generation.config.embedding.embedding_mode || !unitIds.includes(p.payload.unit_id) || pointId(p.payload.unit_id) !== p.id) fail('qdrant_result_scope_mismatch');
      found.set(p.payload.unit_id, validateVector(p.vector, generation.config.embedding));
    }
    return found;
  }
  async query(generation, documentIds, vector, limit, unitIds = null) {
    if (!documentIds.length || unitIds?.length === 0) return [];
    validateVector(vector, generation.config.embedding);
    // No version of these documents in the generation: nothing to search (an empty match would be rejected).
    if (sharedLayout(generation) && !generationVersions(generation, documentIds).length) return [];
    const filter = this.filter(generation, documentIds), prepared = performance.now();
    if (unitIds) filter.must.push({ has_id: unitIds.map(pointId) });
    // ADR-159 (21.10.2026, temporary): a speed probe. The exact query below scans every vector its filter keeps and took 4 s
    // (up to 23 s) in the owner's 75-question test, while the narrow reserve queries took 0.1-0.2 s. Before the search is
    // changed, each wide query of a turn is also run as an HNSW query (first, so it reads a cold cache) and as an HNSW query
    // without the unit id list (the list is filtered afterwards); their times and how many of the exact query's hits they
    // find go to the lane's timings, with the time spent hashing the id list and the filter's size. The answer still uses
    // the exact query.
    const probe = SPEED_PROBE && limit >= 10 ? { ids_ms: performance.now() - prepared, units: unitIds?.length ?? 0, body_kb: Math.round(JSON.stringify(filter).length / 1024) } : null;
    if (probe) {
      try { const r = await this.request(`${this.route(generation)}/points/query`, 'POST', { query: vector, filter, limit, with_payload: false, params: { hnsw_ef: 256, exact: false } }, { withTime: true });
        probe.hnsw = { ms: (r.time ?? NaN) * 1000, ids: r.result.points.map(p => p.id) }; } catch { probe.hnsw = null; }
    }
    const { result, time } = await this.request(`${this.route(generation)}/points/query`, 'POST',
      { query: vector, filter, limit, with_payload: true, params: { exact: true } }, { withTime: true });
    if (probe && unitIds) {
      const plain = { must: filter.must.filter(item => !item.has_id) }, allowed = new Set(filter.must.find(item => item.has_id).has_id);
      try { const r = await this.request(`${this.route(generation)}/points/query`, 'POST', { query: vector, filter: plain, limit: limit + 60, with_payload: false, params: { hnsw_ef: 256, exact: false } }, { withTime: true });
        probe.free = { ms: (r.time ?? NaN) * 1000, ids: r.result.points.map(p => p.id).filter(id => allowed.has(id)).slice(0, limit) }; } catch { probe.free = null; }
    }
    const hits = result.points.map(p => {
      const scoped = sharedLayout(generation) ? p.payload.generation_id === undefined && p.payload.version_id === generation.snapshot.documents[p.payload.document_id]?.version_id
        : p.payload.generation_id === generation.id;
      if (p.payload.tenant !== generation.tenant || !scoped || p.payload.config_id !== generation.config.id
        || p.payload.embedding_mode !== generation.config.embedding.embedding_mode || !documentIds.includes(p.payload.document_id)
        || unitIds && !unitIds.includes(p.payload.unit_id) || pointId(p.payload.unit_id) !== p.id || !Number.isFinite(p.score)) fail('qdrant_result_scope_mismatch');
      return { id: p.payload.unit_id, score: p.score, document_id: p.payload.document_id, version_id: p.payload.version_id, input_hash: p.payload.input_hash };
    }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    // Qdrant's own time for the query (not enumerable, so results compare as before): a slow call that Qdrant served
    // quickly lost its time outside the search, e.g. in the request body or on the event loop.
    if (Number.isFinite(time)) Object.defineProperty(hits, 'server_ms', { value: time * 1000 });
    if (probe) {
      // Overlap in percent: the lane's timings keep whole numbers.
      const exact = new Set(result.points.map(p => p.id)), share = ids => (exact.size ? Math.round(100 * ids.filter(id => exact.has(id)).length / exact.size) : 100);
      Object.defineProperty(hits, 'probe', { value: { ids_ms: probe.ids_ms, units: probe.units, body_kb: probe.body_kb,
        ...(probe.hnsw ? { hnsw_ms: probe.hnsw.ms, hnsw_overlap: share(probe.hnsw.ids) } : {}),
        ...(probe.free ? { free_ms: probe.free.ms, free_overlap: share(probe.free.ids) } : {}) } });
    }
    return hits;
  }
}
