import { fail, hash, stable } from '../contracts.js';
import { localQdrantUrl } from './local-config.js';
import { validateVector } from './embedding.js';

export function pointId(unitId) { const h = hash(unitId); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; }
export function collectionName(tenant, generationId) { return `ragv2_mock_${hash(stable([tenant, generationId])).slice(0, 40)}`; }
export class QdrantIndex {
  constructor(url, key) {
    this.url = localQdrantUrl(url);
    if (typeof key !== 'string' || key.length < 24) fail('qdrant_key_required');
    this.key = key;
  }
  async request(route, method = 'GET', body) {
    const response = await fetch(`${this.url}${route}`, { method, redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'api-key': this.key, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw Object.assign(new Error('qdrant_request_failed'), { code: 'qdrant_request_failed', status: response.status });
    const data = await response.json();
    if (data.status !== 'ok' && data.status !== undefined) fail('qdrant_invalid_response');
    return data.result ?? data;
  }
  route(generation) {
    if (generation.collection !== collectionName(generation.tenant, generation.id)) fail('qdrant_collection_scope_mismatch');
    return `/collections/${generation.collection}`;
  }
  async ensure(generation) {
    const route = this.route(generation), cfg = generation.config.embedding;
    try { await this.request(route); }
    catch (e) { if (e.status !== 404) throw e; await this.request(route, 'PUT', { vectors: { size: cfg.dimensions, distance: cfg.distance } }); }
    const info = await this.request(route);
    if (info.config.params.vectors.size !== cfg.dimensions || info.config.params.vectors.distance !== cfg.distance) fail('qdrant_vector_space_mismatch');
    for (const field of ['tenant', 'generation_id', 'document_id', 'config_id']) await this.request(`${route}/index?wait=true`, 'PUT', { field_name: field, field_schema: 'keyword' });
  }
  async upsert(generation, units, vectors) {
    const points = units.map((u, i) => ({ id: pointId(u.id), vector: validateVector(vectors[i], generation.config.embedding), payload: {
      tenant: generation.tenant, generation_id: generation.id, document_id: u.document_id, version_id: u.version_id,
      unit_id: u.id, input_hash: u.input_hash, config_id: generation.config.id, embedding_mode: 'mock',
    } }));
    for (let offset = 0; offset < points.length; offset += 100) await this.request(`${this.route(generation)}/points?wait=true`, 'PUT', { points: points.slice(offset, offset + 100) });
  }
  filter(generation, documentIds) { return { must: [
    { key: 'tenant', match: { value: generation.tenant } }, { key: 'generation_id', match: { value: generation.id } },
    { key: 'config_id', match: { value: generation.config.id } }, { key: 'document_id', match: { any: documentIds } },
    { key: 'embedding_mode', match: { value: 'mock' } },
  ] }; }
  async verify(generation, units) {
    const expected = new Map(units.map(u => [pointId(u.id), u]));
    let offset, count = 0;
    do {
      const page = await this.request(`${this.route(generation)}/points/scroll`, 'POST', { limit: 100, with_payload: true, with_vector: true, ...(offset ? { offset } : {}) });
      for (const point of page.points) {
        const u = expected.get(point.id), p = point.payload;
        if (!u || p.tenant !== generation.tenant || p.generation_id !== generation.id || p.config_id !== generation.config.id || p.embedding_mode !== 'mock'
          || p.document_id !== u.document_id || p.version_id !== u.version_id || p.input_hash !== u.input_hash || p.unit_id !== u.id) fail('qdrant_point_integrity_failed');
        validateVector(point.vector, generation.config.embedding); expected.delete(point.id); count++;
      }
      offset = page.next_page_offset;
    } while (offset);
    if (expected.size || count !== units.length) fail('qdrant_count_mismatch');
    if (units.length) await this.query(generation, [units[0].document_id], Array.from({ length: generation.config.embedding.dimensions }, (_, i) => i === 0 ? 1 : 0), 1);
  }
  async query(generation, documentIds, vector, limit) {
    if (!documentIds.length) return [];
    validateVector(vector, generation.config.embedding);
    const result = await this.request(`${this.route(generation)}/points/query`, 'POST', { query: vector, filter: this.filter(generation, documentIds), limit, with_payload: true, params: { exact: true } });
    return result.points.map(p => {
      if (p.payload.tenant !== generation.tenant || p.payload.generation_id !== generation.id || p.payload.config_id !== generation.config.id
        || p.payload.embedding_mode !== 'mock' || !documentIds.includes(p.payload.document_id) || pointId(p.payload.unit_id) !== p.id || !Number.isFinite(p.score)) fail('qdrant_result_scope_mismatch');
      return { id: p.payload.unit_id, score: p.score, document_id: p.payload.document_id, version_id: p.payload.version_id, input_hash: p.payload.input_hash };
    }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
}
