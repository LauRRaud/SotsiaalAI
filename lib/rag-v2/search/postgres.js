import pg from 'pg';
import { fail, hash, id, stable } from '../contracts.js';
import { localPostgresUrl } from './local-config.js';
import { verifiedBundle, tenantId } from './snapshot.js';
import { indexUnit } from './embedding.js';

export class PostgresCatalog {
  constructor(url) { this.pool = new pg.Pool({ connectionString: localPostgresUrl(url), max: 5, connectionTimeoutMillis: 5000, statement_timeout: 15000 }); }
  async close() { await this.pool.end(); }
  async transaction(fn) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async beginGeneration(tenant, generation) {
    tenantId(tenant);
    return this.transaction(async client => {
      await client.query(`INSERT INTO rag_v2_generation(tenant,id,snapshot,config,collection,expected_count)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [tenant, generation.id, generation.snapshot, generation.config, generation.collection, generation.expected_count]);
      const row = (await client.query('SELECT * FROM rag_v2_generation WHERE tenant=$1 AND id=$2', [tenant, generation.id])).rows[0];
      if (stable(row.snapshot) !== stable(generation.snapshot) || stable(row.config) !== stable(generation.config)
        || row.collection !== generation.collection || row.expected_count !== generation.expected_count) fail('generation_identity_conflict');
      await client.query(`INSERT INTO rag_v2_head(tenant,requested_sequence) VALUES($1,$2)
        ON CONFLICT(tenant) DO UPDATE SET requested_sequence=GREATEST(rag_v2_head.requested_sequence,excluded.requested_sequence)`, [tenant, row.sequence]);
      return row;
    });
  }
  async importSnapshot(snapshot, generationId, units) {
    return this.transaction(async client => {
      for (const b of snapshot.bundles) {
        verifiedBundle(b, snapshot.tenant);
        const digest = hash(stable(b));
        await client.query('INSERT INTO rag_v2_document(tenant,id,external_ids) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [snapshot.tenant, b.document.id, b.document.external_ids]);
        await client.query(`INSERT INTO rag_v2_version(tenant,id,document_id,bundle,bundle_hash,assets) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [snapshot.tenant, b.version.id, b.document.id, b, digest, snapshot.assets[b.version.id]]);
        const stored = (await client.query('SELECT bundle_hash,bundle FROM rag_v2_version WHERE tenant=$1 AND id=$2', [snapshot.tenant, b.version.id])).rows[0];
        if (stored.bundle_hash !== digest || hash(stable(stored.bundle)) !== digest) fail('immutable_version_conflict');
        const groups = { document: [b.document], version: [b.version], asset: b.assets, section: b.sections, block: b.blocks, span: b.spans, chunk: b.chunks, relation: b.relations };
        for (const [kind, entries] of Object.entries(groups)) for (const entity of entries) {
          await client.query(`INSERT INTO rag_v2_object(tenant,version_id,id,kind,data,from_id,to_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
            [snapshot.tenant, b.version.id, entity.id, kind, entity, entity.from_id ?? null, entity.to_id ?? null]);
        }
        const actual = (await client.query('SELECT id,data FROM rag_v2_object WHERE tenant=$1 AND version_id=$2', [snapshot.tenant, b.version.id])).rows;
        const expected = new Map(Object.values(groups).flat().map(e => [e.id, stable(e)]));
        if (actual.length !== expected.size || actual.some(e => expected.get(e.id) !== stable(e.data))) fail('source_object_integrity_failed');
        await client.query(`INSERT INTO rag_v2_generation_document(tenant,generation_id,document_id,version_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [snapshot.tenant, generationId, b.document.id, b.version.id]);
      }
      for (const unit of units) {
        await client.query(`INSERT INTO rag_v2_unit(tenant,generation_id,id,document_id,version_id,chunk_id,ordinal,data,title,authors,body,search_aids)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING`,
          [snapshot.tenant, generationId, unit.id, unit.document_id, unit.version_id, unit.chunk_id, unit.ordinal, unit, unit.title, unit.authors, unit.body, unit.search_aids]);
      }
      const actual = (await client.query('SELECT id,data FROM rag_v2_unit WHERE tenant=$1 AND generation_id=$2', [snapshot.tenant, generationId])).rows;
      const expected = new Map(units.map(u => [u.id, stable(u)]));
      if (actual.length !== units.length || actual.some(u => expected.get(u.id) !== stable(u.data))) fail('index_unit_integrity_failed');
    });
  }
  async activate(tenant, generation) {
    return this.transaction(async client => {
      const head = (await client.query('SELECT * FROM rag_v2_head WHERE tenant=$1 FOR UPDATE', [tenant])).rows[0];
      if (head.requested_sequence !== generation.sequence) fail('superseded_index_job');
      const { rows } = await client.query('SELECT count(*)::integer AS count FROM rag_v2_unit WHERE tenant=$1 AND generation_id=$2', [tenant, generation.id]);
      if (rows[0].count !== generation.expected_count) fail('index_count_mismatch');
      await client.query("UPDATE rag_v2_generation SET state='ready' WHERE tenant=$1 AND id=$2", [tenant, generation.id]);
      await client.query('UPDATE rag_v2_head SET active_id=$2 WHERE tenant=$1', [tenant, generation.id]);
    });
  }
  async active(tenant) {
    tenantId(tenant);
    const row = (await this.pool.query(`SELECT g.* FROM rag_v2_head h JOIN rag_v2_generation g ON g.tenant=h.tenant AND g.id=h.active_id WHERE h.tenant=$1`, [tenant])).rows[0];
    if (!row || row.state !== 'ready') fail('no_active_search_generation');
    return row;
  }
  async bundles(tenant, generationId, documentIds) {
    const rows = (await this.pool.query(`SELECT v.* FROM rag_v2_generation_document d JOIN rag_v2_version v
      ON v.tenant=d.tenant AND v.id=d.version_id AND v.document_id=d.document_id
      WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($3::text[]) ORDER BY d.document_id`, [tenant, generationId, documentIds])).rows;
    const bundles = rows.map(r => {
      if (hash(stable(r.bundle)) !== r.bundle_hash || r.bundle.document.id !== r.document_id || r.bundle.version.id !== r.id) fail('source_integrity_failed');
      return verifiedBundle(r.bundle, tenant);
    });
    const objects = (await this.pool.query('SELECT version_id,id,data,from_id,to_id FROM rag_v2_object WHERE tenant=$1 AND version_id=ANY($2::text[])', [tenant, rows.map(r => r.id)])).rows;
    const expected = new Map(bundles.flatMap(b => [b.document, b.version, ...b.assets, ...b.sections, ...b.blocks, ...b.spans, ...b.chunks, ...b.relations].map(e => [`${b.version.id}/${e.id}`, e])));
    if (objects.length !== expected.size || objects.some(o => {
      const e = expected.get(`${o.version_id}/${o.id}`);
      return !e || stable(e) !== stable(o.data) || o.from_id !== (e.from_id ?? null) || o.to_id !== (e.to_id ?? null);
    })) fail('source_object_integrity_failed');
    return bundles;
  }
  async units(tenant, generationId, documentIds) {
    return (await this.pool.query('SELECT * FROM rag_v2_unit WHERE tenant=$1 AND generation_id=$2 AND document_id=ANY($3::text[]) ORDER BY document_id,ordinal,id', [tenant, generationId, documentIds])).rows.map(r => {
      for (const key of ['id', 'document_id', 'version_id', 'chunk_id', 'ordinal', 'title', 'authors', 'body', 'search_aids']) if (r[key] !== r.data[key]) fail('index_unit_integrity_failed');
      return r.data;
    });
  }
  async canonicalReference(reference) {
    tenantId(reference?.tenant);
    const generation = (await this.pool.query("SELECT snapshot,config FROM rag_v2_generation WHERE tenant=$1 AND id=$2 AND state='ready'", [reference.tenant, reference.generation_id])).rows[0];
    if (!generation || generation.snapshot.documents?.[reference.document_id]?.version_id !== reference.document_version_id) fail('canonical_generation_missing');
    const bundles = await this.bundles(reference.tenant, reference.generation_id, [reference.document_id]);
    const bundle = bundles[0], chunk = bundle?.chunks.find(item => item.id === reference.chunk_id);
    const unit = (await this.pool.query(`SELECT data FROM rag_v2_unit WHERE tenant=$1 AND generation_id=$2 AND id=$3
      AND document_id=$4 AND version_id=$5 AND chunk_id=$6`, [reference.tenant, reference.generation_id, reference.unit_id,
      reference.document_id, reference.document_version_id, reference.chunk_id])).rows[0]?.data;
    if (!chunk || !unit || stable(indexUnit(chunk, bundle, generation.config.embedding)) !== stable(unit)) fail('canonical_reference_missing');
    const spans = chunk.span_ids.map(spanId => bundle.spans.find(span => span.id === spanId));
    if (spans.some(span => !span) || chunk.source_text !== spans.map(span => span.source_text).join('\n')) fail('canonical_reference_missing');
    return { tenant: reference.tenant, query_id: reference.query_id, generation_id: reference.generation_id,
      evidence_id: id('evidence', reference.tenant, bundle.version.id, unit.id), document_id: bundle.document.id,
      document_version_id: bundle.version.id, unit_id: unit.id, chunk_id: chunk.id, span_ids: chunk.span_ids,
      pdf_pages: chunk.pdf_pages, source_text_sha256: hash(chunk.source_text) };
  }
  async lexical(tenant, generationId, documentIds, text, limit, unitIds = null) {
    if (!documentIds.length || !text.trim()) return [];
    return (await this.pool.query(`WITH q AS (SELECT replace(plainto_tsquery('pg_catalog.simple',$4)::text,' & ',' | ')::tsquery AS query)
      SELECT u.id,ts_rank_cd(u.search_vector,q.query) AS score FROM rag_v2_unit u,q
      WHERE u.tenant=$1 AND u.generation_id=$2 AND u.document_id=ANY($3::text[]) AND u.search_vector @@ q.query AND ($6::text[] IS NULL OR u.id=ANY($6::text[]))
      ORDER BY score DESC,u.id COLLATE "C" ASC LIMIT $5`, [tenant, generationId, documentIds, text, limit, unitIds])).rows;
  }
  async cacheGet(tenant, key, configId, inputHash) {
    const row = (await this.pool.query('SELECT * FROM rag_v2_vector_cache WHERE tenant=$1 AND key=$2', [tenant, key])).rows[0];
    if (row && (row.config_id !== configId || row.input_hash !== inputHash)) fail('embedding_cache_mismatch');
    return row?.vector;
  }
  async cachePut(tenant, key, configId, inputHash, vector) {
    await this.pool.query(`INSERT INTO rag_v2_vector_cache(tenant,key,config_id,input_hash,vector) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`, [tenant, key, configId, inputHash, JSON.stringify(vector)]);
  }
}
