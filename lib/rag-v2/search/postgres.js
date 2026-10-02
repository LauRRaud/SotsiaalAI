import { locationFields } from '../source-locations.js';
import { chunkExcerpt } from './excerpt.js';
import pg from 'pg';
import { fail, hash, id, stable } from '../contracts.js';
import { localPostgresUrl } from './local-config.js';
import { verifiedBundle, tenantId } from './snapshot.js';
import { indexUnit } from './embedding.js';
import { LEGACY_LEXICAL, LEXICAL_CONFIGS } from './morphology.js';
import { LEXICAL_RANK_CD, LEXICAL_RANK_PLAIN, LEXICAL_RANKS } from './ranking.js';
import { lexicalFields, lexicalQuery } from './lexical-analysis.js';
import { ESTNLTK_ANALYZER_VERSION } from './estnltk.js';
import { retrievalDirectory, verifyDirectory, LEGACY_DISCOVERY_SCHEMA } from './discovery.js';
import { GENERATION_LAYOUT, VERSION_LAYOUT, indexLayout } from './layout.js';

// One catalog per process and database: its verified-read cache then survives between chat turns
// (a catalog per call re-verified every source on every turn, latency audit 27.09.2026).
const CATALOGS = Symbol.for('sotsiaalai.rag-v2.postgres-catalogs');
export function processCatalog(url, options) {
  const catalogs = globalThis[CATALOGS] ||= new Map();
  if (!catalogs.has(url)) {
    const catalog = new PostgresCatalog(url, options);
    // A long-lived pool: an idle client's error must not end the process; the next query reconnects.
    catalog.pool.on('error', error => console.error('[rag-v2] postgres pool error', error.code || 'unknown'));
    catalogs.set(url, catalog);
  }
  return catalogs.get(url);
}

// One directory row's mark in SQL; retrievalDirectory builds the same text from the rows it reads.
const DIRECTORY_MARK_SQL = `d.document_id||'/'||d.version_id||'/'||coalesce(d.retrieval_hash,'')||'/'||v.bundle_hash||'/'||d.xmin::text||'/'||v.xmin::text||'/'||(d.retrieval_directory IS NULL)::text`;
// The unit rows a generation serves for the documents $3: its own rows, or in the version layout (ADR-036) the shared
// rows of the versions it lists. $1 is the tenant, $2 the generation.
const UNIT_SCOPE = {
  [GENERATION_LAYOUT]: { from: 'rag_v2_unit u', where: 'u.tenant=$1 AND u.generation_id=$2 AND u.document_id=ANY($3::text[])' },
  [VERSION_LAYOUT]: { from: 'rag_v2_version_unit u', where: `u.tenant=$1 AND u.config_id=(SELECT config->>'id' FROM rag_v2_generation WHERE tenant=$1 AND id=$2)
    AND u.version_id IN (SELECT version_id FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2 AND document_id=ANY($3::text[]))` },
};
const UNIT_COLUMNS = ['id', 'document_id', 'version_id', 'chunk_id', 'ordinal', 'title', 'authors', 'body', 'search_aids'];
const UNIT_RECORDSET = 'x(id text,document_id text,version_id text,chunk_id text,ordinal integer,data jsonb,title text,authors text,body text,search_aids text,morphology jsonb)';
// Rows go to Postgres as one JSON array per statement: a law text's thousands of objects were one round trip each.
const ROWS_PER_STATEMENT = 500;
async function insertRows(client, sql, values, rows) {
  for (let offset = 0; offset < rows.length; offset += ROWS_PER_STATEMENT) await client.query(sql, [...values, JSON.stringify(rows.slice(offset, offset + ROWS_PER_STATEMENT))]);
}
const unitRow = (unit, morphology) => ({ id: unit.id, document_id: unit.document_id, version_id: unit.version_id, chunk_id: unit.chunk_id, ordinal: unit.ordinal,
  data: unit, title: unit.title, authors: unit.authors, body: unit.body, search_aids: unit.search_aids, morphology });
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const item of Object.values(value)) deepFreeze(item); }
  return value;
}
// ADR-060: a tenant's prune lock, two-int advisory key ($1 is the tenant). A prune holds it for its whole run, and
// beginGeneration takes it shared for its transaction: no generation of the tenant starts while a prune runs. The lock
// ends with the prune's session; the prune's row in rag_v2_prune_run does not, and beginGeneration refuses on it too.
export const PRUNE_LOCK = "hashtext('rag_v2_prune'),hashtext($1)";
// ADR-069: what a mark that outlives its process stands for: these checks and this analyzer. A change to either makes
// every earlier mark unknown. The mark is a hash of the read's key and digest, so it names exact row versions.
export const VERIFIED_MARKS = `rag-v2/verified-read-1/${ESTNLTK_ANALYZER_VERSION}`;
export const verifiedMark = (key, digest) => hash(`${VERIFIED_MARKS}\0${key}\0${digest}`);
// The warm-up of a process that inherited marks lets a chat turn go first: it waits until no turn has used the catalog
// for quietMs, at most maxWaitMs for one batch.
export const WARM_QUIET = Object.freeze({ quietMs: 15000, maxWaitMs: 120000, stepMs: 500 });
const MARK_LIMITS = Object.freeze({ days: 30, read: 500000, statement: 5000, unsaved: 200000, saveAfterMs: 5000 });
export class PostgresCatalog {
  constructor(url, { analyzer, lexicalWorkers = 3 } = {}) {
    this.pool = new pg.Pool({ connectionString: localPostgresUrl(url), max: 5, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
    this.analyzer = analyzer;
    // Parallel workers for the lexical SQL on a large generation: its ranking of every match was the
    // floor of a query (1.6-1.8 s serial, 0.63-0.71 s with up to 3 workers on the server, 26.09.2026).
    // The order is deterministic either way (score, then unit ID); small tables stay serial.
    this.lexicalWorkers = lexicalWorkers;
    // Reads verified in full in this process, by a digest of what was verified. A later read with
    // the same digest skips the expensive recheck (a document's morphology re-analysed, every source
    // object compared); any change to the rows changes the digest and the full check runs again.
    this.verified = new Map();
    // ADR-069: marks of full checks that earlier processes left in the database for the same row versions
    // (inheritVerified). A read they cover is used at once; this process still checks every source in full in its
    // warm-up (own), and any failure there ends the trust. unsaved: this process's own marks on their way to the table.
    this.inherited = new Set(); this.unsaved = new Set(); this.keepsMarks = false; this.saveTimer = null;
    // When a chat turn last used this catalog (foreground).
    this.foregroundAt = 0;
    // Verified bundles and directories of this process, reused while their rows keep the same row
    // versions (xmin): a turn then reads only small version marks instead of every bundle again.
    // Bundles are shared read-only objects; the bundle cache is bounded by stored size (LRU).
    this.bundleCache = new Map(); this.bundleCacheBytes = 0;
    this.bundleCacheLimit = Number(process.env.RAG_V2_BUNDLE_CACHE_BYTES) > 0 ? Number(process.env.RAG_V2_BUNDLE_CACHE_BYTES) : 96 * 1024 * 1024;
    this.directoryCache = new Map(); this.directoryLists = new Map();
    // Ready generation rows (each with a snapshot of every document) by row version: parsed once.
    this.generations = new Map();
    // A generation's layout and config ID never change for its ID (both are part of it); read once.
    this.layouts = new Map();
    // A generation's document titles (documentTitles): a generation fixes each document's version, so read once.
    this.titles = new Map();
  }
  async layoutOf(tenant, generationId) {
    const key = `${tenant}\0${generationId}`;
    if (!this.layouts.has(key)) {
      const row = (await this.pool.query("SELECT layout,config->>'id' AS config_id,config->>'lexical' AS lexical FROM rag_v2_generation WHERE tenant=$1 AND id=$2", [tenant, generationId])).rows[0];
      // Unknown here (another tenant, a deleted generation): the caller decides, as before the layouts existed.
      if (!row) return null;
      if (this.layouts.size >= 64) this.layouts.delete(this.layouts.keys().next().value);
      this.layouts.set(key, { layout: indexLayout(row.layout), configId: row.config_id, lexical: row.lexical });
    }
    return this.layouts.get(key);
  }
  // A cached row is shared: frozen, so no caller can change what the next one reads.
  rememberGeneration(tenant, { row_version: rowVersion, ...row }) {
    const key = `${tenant}\0${row.id}`;
    this.generations.delete(key); this.generations.set(key, { rowVersion, row: deepFreeze(row) });
    if (this.generations.size > 8) this.generations.delete(this.generations.keys().next().value);
    return row;
  }
  async readyGeneration(tenant, generationId, rowVersion = null) {
    const cached = this.generations.get(`${tenant}\0${generationId}`);
    const current = rowVersion ?? (await this.pool.query("SELECT xmin::text AS row_version FROM rag_v2_generation WHERE tenant=$1 AND id=$2 AND state='ready'", [tenant, generationId])).rows[0]?.row_version;
    if (!current) return null;
    if (cached?.rowVersion === current) return cached.row;
    const row = (await this.pool.query("SELECT *,xmin::text AS row_version FROM rag_v2_generation WHERE tenant=$1 AND id=$2 AND state='ready'", [tenant, generationId])).rows[0];
    return row ? this.rememberGeneration(tenant, row) : null;
  }
  cacheBundle(key, mark, bundle, bytes) {
    const previous = this.bundleCache.get(key);
    if (previous) { this.bundleCache.delete(key); this.bundleCacheBytes -= previous.bytes; }
    if (bytes > this.bundleCacheLimit / 4) return;
    this.bundleCache.set(key, { mark, bundle, bytes }); this.bundleCacheBytes += bytes;
    for (const [oldest, entry] of this.bundleCache) {
      if (this.bundleCacheBytes <= this.bundleCacheLimit) break;
      this.bundleCache.delete(oldest); this.bundleCacheBytes -= entry.bytes;
    }
  }
  rememberVerified(key, digest) {
    this.verified.delete(key); this.verified.set(key, digest);
    if (this.verified.size > 100000) this.verified.delete(this.verified.keys().next().value);
    if (!this.keepsMarks) return;
    if (this.unsaved.size >= MARK_LIMITS.unsaved) this.unsaved.clear();
    this.unsaved.add(verifiedMark(key, digest));
    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.saveVerified().catch(error => console.error('[rag-v2] verified marks not saved', error?.code || error?.name));
      }, MARK_LIMITS.saveAfterMs);
      this.saveTimer.unref?.();
    }
  }
  /** Whether a read with this digest was verified in full: by this process, or (unless own) by an earlier one whose
   *  mark this process inherited. */
  known(key, digest, own = false) {
    return this.verified.get(key) === digest || (!own && this.inherited?.size > 0 && this.inherited.has(verifiedMark(key, digest)));
  }
  /** ADR-069: reads the marks earlier processes left and starts keeping this process's own. Returns their number. */
  async inheritVerified() {
    await this.pool.query(`DELETE FROM rag_v2_verified_read WHERE verified_at < clock_timestamp() - interval '${MARK_LIMITS.days} days'`);
    const rows = (await this.pool.query('SELECT mark FROM rag_v2_verified_read LIMIT $1', [MARK_LIMITS.read])).rows;
    this.inherited = new Set(rows.map(row => row.mark)); this.keepsMarks = true;
    return this.inherited.size;
  }
  async saveVerified() {
    const marks = [...this.unsaved]; this.unsaved.clear();
    try {
      for (let offset = 0; offset < marks.length; offset += MARK_LIMITS.statement) {
        await this.pool.query(`INSERT INTO rag_v2_verified_read(mark) SELECT jsonb_array_elements_text($1::jsonb)
          ON CONFLICT (mark) DO UPDATE SET verified_at=clock_timestamp()`, [JSON.stringify(marks.slice(offset, offset + MARK_LIMITS.statement))]);
      }
    } catch (error) { for (const mark of marks) this.unsaved.add(mark); throw error; }
    return marks.length;
  }
  /** Ends the trust in inherited marks, here and for the next process: every stored mark goes. This process's own
   *  checks stand, and marks it saves afterwards are kept. */
  async disinherit() {
    this.inherited = new Set();
    await this.pool.query('DELETE FROM rag_v2_verified_read');
  }
  foreground() { this.foregroundAt = Date.now(); }
  async close() { clearTimeout(this.saveTimer); await this.pool.end(); }
  // Verifies sources ahead of use, a few at a time, so the first questions after a start do not pay
  // for it: bundles are checked (not kept) and units' morphology is analysed once for this process.
  // The checks are this process's own (ADR-069): an inherited mark does not skip them, and a warm-up that fails
  // ends the trust in inherited marks. While marks are inherited a chat turn goes first.
  async warm(tenant, generationId, documentIds, { batch = 6, quiet = WARM_QUIET } = {}) {
    try {
      for (let i = 0; i < documentIds.length; i += batch) {
        const ids = documentIds.slice(i, i + batch);
        for (const started = Date.now(); this.inherited.size && Date.now() - this.foregroundAt < quiet.quietMs && Date.now() - started < quiet.maxWaitMs;) {
          await new Promise(resolve => setTimeout(resolve, quiet.stepMs));
        }
        await this.bundles(tenant, generationId, ids, { cache: false, own: true });
        await this.units(tenant, generationId, ids, { own: true });
        await new Promise(resolve => setImmediate(resolve));
      }
    } catch (error) {
      if (this.inherited.size) await this.disinherit().catch(() => { /* the trust has ended here; the rows go with the next failure or expiry */ });
      throw error;
    }
  }
  async parallelRead(text, values) {
    if (!this.lexicalWorkers) return (await this.pool.query(text, values)).rows;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query(`SET LOCAL max_parallel_workers_per_gather=${Number(this.lexicalWorkers)}`);
      await client.query('SET LOCAL parallel_setup_cost=10'); await client.query('SET LOCAL parallel_tuple_cost=0.001');
      const { rows } = await client.query(text, values);
      await client.query('COMMIT');
      return rows;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  }
  async transaction(fn) {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async beginGeneration(tenant, generation) {
    tenantId(tenant);
    return this.transaction(async client => {
      // Held to the commit: a prune that starts later finds this generation not ready and refuses (ADR-060).
      if (!(await client.query(`SELECT pg_try_advisory_xact_lock_shared(${PRUNE_LOCK}) AS locked`, [tenant])).rows[0].locked) fail('index_prune_running');
      // A prune that lost its session left its row: a Qdrant delete it sent may still be applied, so nothing begins
      // until a prune run has completed it.
      if ((await client.query('SELECT 1 FROM rag_v2_prune_run WHERE tenant=$1', [tenant])).rowCount) fail('index_prune_unresolved');
      const layout = indexLayout(generation.layout);
      await client.query(`INSERT INTO rag_v2_generation(tenant,id,snapshot,config,collection,expected_count,layout)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`, [tenant, generation.id, generation.snapshot, generation.config, generation.collection, generation.expected_count, layout]);
      const row = (await client.query('SELECT * FROM rag_v2_generation WHERE tenant=$1 AND id=$2', [tenant, generation.id])).rows[0];
      if (stable(row.snapshot) !== stable(generation.snapshot) || stable(row.config) !== stable(generation.config) || row.layout !== layout
        || row.collection !== generation.collection || row.expected_count !== generation.expected_count) fail('generation_identity_conflict');
      await client.query(`INSERT INTO rag_v2_head(tenant,requested_sequence) VALUES($1,$2)
        ON CONFLICT(tenant) DO UPDATE SET requested_sequence=GREATEST(rag_v2_head.requested_sequence,excluded.requested_sequence)`, [tenant, row.sequence]);
      return row;
    });
  }
  /** Stores a snapshot's documents in a staged generation. In the version layout (ADR-036) the unit rows are keyed by
   * search config and version and shared with other generations; `items` (the index plan's item per document) goes
   * into each version's index row, which a job later seals. */
  async importSnapshot(snapshot, generationId, units, { partial = false, items = null } = {}) {
    const generation = (await this.pool.query('SELECT config,snapshot,layout FROM rag_v2_generation WHERE tenant=$1 AND id=$2', [snapshot.tenant, generationId])).rows[0];
    if (!generation || !LEXICAL_CONFIGS.includes(generation.config.lexical)) fail('unknown_lexical_config');
    const shared = indexLayout(generation.layout) === VERSION_LAYOUT, configId = generation.config.id;
    const documentIds = Object.keys(snapshot.documents);
    if (documentIds.some(documentId => stable(snapshot.documents[documentId]) !== stable(generation.snapshot.documents[documentId]))
      || units.some(unit => snapshot.documents[unit.document_id]?.version_id !== unit.version_id)) fail('index_snapshot_scope_mismatch');
    if (shared && snapshot.bundles.some(b => items?.[b.document.id]?.version_id !== b.version.id)) fail('index_snapshot_scope_mismatch');
    // Analyze before opening a write transaction; a cold Python start must not hold its locks.
    const analyzed = await lexicalFields(units, generation.config.lexical, this.analyzer);
    const morphology = new Map(units.map((unit, index) => [unit.id, analyzed[index]]));
    return this.transaction(async client => {
      const current = (await client.query('SELECT config,snapshot,layout FROM rag_v2_generation WHERE tenant=$1 AND id=$2', [snapshot.tenant, generationId])).rows[0];
      if (stable(current) !== stable(generation)) fail('generation_identity_conflict');
      for (const b of snapshot.bundles) {
        verifiedBundle(b, snapshot.tenant);
        const digest = hash(stable(b));
        await client.query('INSERT INTO rag_v2_document(tenant,id,external_ids) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [snapshot.tenant, b.document.id, b.document.external_ids]);
        await client.query(`INSERT INTO rag_v2_version(tenant,id,document_id,bundle,bundle_hash,assets) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
          [snapshot.tenant, b.version.id, b.document.id, b, digest, snapshot.assets[b.version.id]]);
        const stored = (await client.query('SELECT bundle_hash,bundle FROM rag_v2_version WHERE tenant=$1 AND id=$2', [snapshot.tenant, b.version.id])).rows[0];
        if (stored.bundle_hash !== digest || hash(stable(stored.bundle)) !== digest) fail('immutable_version_conflict');
        const groups = { document: [b.document], version: [b.version], asset: b.assets, section: b.sections, block: b.blocks, span: b.spans, chunk: b.chunks,
          knowledge_card: b.knowledge_cards || [], dependency: b.dependencies || [], knowledge_gap: b.knowledge_gaps || [], relation: b.relations };
        // Relations come last, so every object a relation names is inserted before it or in the same statement.
        await insertRows(client, `INSERT INTO rag_v2_object(tenant,version_id,id,kind,data,from_id,to_id)
          SELECT $1,$2,x.id,x.kind,x.data,x.from_id,x.to_id FROM jsonb_to_recordset($3::jsonb) AS x(id text,kind text,data jsonb,from_id text,to_id text)
          ON CONFLICT DO NOTHING`, [snapshot.tenant, b.version.id],
        Object.entries(groups).flatMap(([kind, entries]) => entries.map(entity => ({ id: entity.id, kind, data: entity, from_id: entity.from_id ?? null, to_id: entity.to_id ?? null }))));
        const actual = (await client.query('SELECT id,data FROM rag_v2_object WHERE tenant=$1 AND version_id=$2', [snapshot.tenant, b.version.id])).rows;
        const expected = new Map(Object.values(groups).flat().map(e => [e.id, stable(e)]));
        if (actual.length !== expected.size || actual.some(e => expected.get(e.id) !== stable(e.data))) fail('source_object_integrity_failed');
        const directory = retrievalDirectory(b, generation.config.embedding, generation.config.directory || LEGACY_DISCOVERY_SCHEMA), directoryHash = hash(stable(directory));
        if (shared) {
          // The version's own index row: its plan item, directory and morphology digest, staged until a job seals it.
          const morphologyHash = hash(stable(units.filter(unit => unit.version_id === b.version.id).map(unit => morphology.get(unit.id))));
          await client.query(`INSERT INTO rag_v2_version_index(tenant,config_id,version_id,document_id,item,retrieval_directory,retrieval_hash,morphology_hash)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`, [snapshot.tenant, configId, b.version.id, b.document.id, items[b.document.id], directory, directoryHash, morphologyHash]);
          const index = (await client.query(`SELECT document_id,item,retrieval_directory,retrieval_hash,morphology_hash FROM rag_v2_version_index
            WHERE tenant=$1 AND config_id=$2 AND version_id=$3`, [snapshot.tenant, configId, b.version.id])).rows[0];
          if (index.document_id !== b.document.id || stable(index.item) !== stable(items[b.document.id]) || index.retrieval_hash !== directoryHash
            || stable(index.retrieval_directory) !== stable(directory) || index.morphology_hash !== morphologyHash) fail('version_index_integrity_failed');
        }
        await client.query(`INSERT INTO rag_v2_generation_document(tenant,generation_id,document_id,version_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [snapshot.tenant, generationId, b.document.id, b.version.id]);
        await client.query(`UPDATE rag_v2_generation_document SET retrieval_directory=$4,retrieval_hash=$5
          WHERE tenant=$1 AND generation_id=$2 AND document_id=$3 AND retrieval_directory IS NULL`,
        [snapshot.tenant, generationId, b.document.id, directory, directoryHash]);
        const saved = (await client.query(`SELECT retrieval_directory,retrieval_hash FROM rag_v2_generation_document
          WHERE tenant=$1 AND generation_id=$2 AND document_id=$3`, [snapshot.tenant, generationId, b.document.id])).rows[0];
        if (saved?.retrieval_hash !== directoryHash || stable(saved.retrieval_directory) !== stable(directory)) fail('retrieval_directory_integrity_failed');
      }
      const rows = units.map(unit => unitRow(unit, morphology.get(unit.id)));
      if (shared) await insertRows(client, `INSERT INTO rag_v2_version_unit(tenant,config_id,id,document_id,version_id,chunk_id,ordinal,data,title,authors,body,search_aids,morphology)
        SELECT $1,$2,x.id,x.document_id,x.version_id,x.chunk_id,x.ordinal,x.data,x.title,x.authors,x.body,x.search_aids,x.morphology
        FROM jsonb_to_recordset($3::jsonb) AS ${UNIT_RECORDSET} ON CONFLICT DO NOTHING`, [snapshot.tenant, configId], rows);
      else await insertRows(client, `INSERT INTO rag_v2_unit(tenant,generation_id,id,document_id,version_id,chunk_id,ordinal,data,title,authors,body,search_aids,morphology)
        SELECT $1,$2,x.id,x.document_id,x.version_id,x.chunk_id,x.ordinal,x.data,x.title,x.authors,x.body,x.search_aids,x.morphology
        FROM jsonb_to_recordset($3::jsonb) AS ${UNIT_RECORDSET} ON CONFLICT DO NOTHING`, [snapshot.tenant, generationId], rows);
      const actual = shared
        ? (await client.query('SELECT id,data,morphology FROM rag_v2_version_unit WHERE tenant=$1 AND config_id=$2 AND version_id=ANY($3::text[])',
          [snapshot.tenant, configId, snapshot.bundles.map(b => b.version.id)])).rows
        : (await client.query(`SELECT id,data,morphology FROM rag_v2_unit WHERE tenant=$1 AND generation_id=$2
          AND ($3::text[] IS NULL OR document_id=ANY($3::text[]))`, [snapshot.tenant, generationId, partial ? documentIds : null])).rows;
      const expected = new Map(units.map(u => [u.id, stable(u)]));
      if (actual.length !== units.length || actual.some(u => expected.get(u.id) !== stable(u.data)
        || stable(u.morphology) !== stable(morphology.get(u.id)))) fail('index_unit_integrity_failed');
    });
  }
  async activate(tenant, generation, guard) {
    return this.transaction(async client => {
      if (guard) await guard(client);
      const head = (await client.query('SELECT * FROM rag_v2_head WHERE tenant=$1 FOR UPDATE', [tenant])).rows[0];
      if (head.requested_sequence !== generation.sequence) fail('superseded_index_job');
      const { rows } = indexLayout(generation.layout) === VERSION_LAYOUT
        ? await client.query(`SELECT count(*)::integer AS count FROM rag_v2_version_unit WHERE tenant=$1 AND config_id=$3
          AND version_id IN (SELECT version_id FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2)`, [tenant, generation.id, generation.config.id])
        : await client.query('SELECT count(*)::integer AS count FROM rag_v2_unit WHERE tenant=$1 AND generation_id=$2', [tenant, generation.id]);
      if (rows[0].count !== generation.expected_count) fail('index_count_mismatch');
      await client.query("UPDATE rag_v2_generation SET state='ready' WHERE tenant=$1 AND id=$2", [tenant, generation.id]);
      await client.query('UPDATE rag_v2_head SET active_id=$2 WHERE tenant=$1', [tenant, generation.id]);
    });
  }
  async active(tenant) {
    tenantId(tenant);
    const head = (await this.pool.query(`SELECT g.id,g.state,g.xmin::text AS row_version FROM rag_v2_head h JOIN rag_v2_generation g ON g.tenant=h.tenant AND g.id=h.active_id WHERE h.tenant=$1`, [tenant])).rows[0];
    if (!head || head.state !== 'ready') fail('no_active_search_generation');
    const row = await this.readyGeneration(tenant, head.id, head.row_version);
    if (!row) fail('no_active_search_generation');
    return row;
  }
  // own (ADR-069): only this process's own full checks count; an inherited mark does not skip one.
  async bundles(tenant, generationId, documentIds, { cache = true, own = false } = {}) {
    // The bundle's hash and directory are recomputed once per process for a row version: an update
    // of the version or directory row changes its xmin, and then they are recomputed again.
    const rowKey = r => `bundle\0${tenant}\0${generationId}\0${r.id}\0${r.bundle_hash}`, rowMark = r => `${r.version_row}/${r.directory_row}`;
    const heads = (await this.pool.query(`SELECT d.document_id,v.id,v.bundle_hash,v.xmin::text AS version_row,d.xmin::text AS directory_row,pg_column_size(v.bundle) AS bytes
      FROM rag_v2_generation_document d JOIN rag_v2_version v ON v.tenant=d.tenant AND v.id=d.version_id AND v.document_id=d.document_id
      WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($3::text[]) ORDER BY d.document_id`, [tenant, generationId, documentIds])).rows;
    const hits = new Map();
    for (const head of heads) {
      const entry = this.bundleCache.get(rowKey(head));
      if (entry && entry.mark === rowMark(head) && this.known(rowKey(head), rowMark(head), own)) {
        this.bundleCache.delete(rowKey(head)); this.bundleCache.set(rowKey(head), entry);
        hits.set(head.document_id, { ...head, bundle: entry.bundle, cached: true });
      }
    }
    const missing = heads.filter(head => !hits.has(head.document_id)).map(head => head.document_id);
    const fetched = missing.length ? (await this.pool.query(`SELECT v.*,d.retrieval_directory,d.retrieval_hash,g.config,v.xmin::text AS version_row,d.xmin::text AS directory_row,pg_column_size(v.bundle) AS bytes
      FROM rag_v2_generation_document d JOIN rag_v2_version v
      ON v.tenant=d.tenant AND v.id=d.version_id AND v.document_id=d.document_id
      JOIN rag_v2_generation g ON g.tenant=d.tenant AND g.id=d.generation_id
      WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($3::text[]) ORDER BY d.document_id`, [tenant, generationId, missing])).rows : [];
    const rows = [...hits.values(), ...fetched].sort((a, b) => a.document_id < b.document_id ? -1 : a.document_id > b.document_id ? 1 : 0);
    const bundles = rows.map(r => {
      if (r.cached) return r.bundle;
      if (this.known(rowKey(r), rowMark(r), own) && r.bundle.document.id === r.document_id && r.bundle.version.id === r.id) return verifiedBundle(r.bundle, tenant);
      if (hash(stable(r.bundle)) !== r.bundle_hash || r.bundle.document.id !== r.document_id || r.bundle.version.id !== r.id) fail('source_integrity_failed');
      if (r.retrieval_directory !== null && (hash(stable(r.retrieval_directory)) !== r.retrieval_hash
        || stable(retrievalDirectory(r.bundle, r.config.embedding, r.config.directory || LEGACY_DISCOVERY_SCHEMA)) !== stable(r.retrieval_directory))) fail('retrieval_directory_integrity_failed');
      const verified = verifiedBundle(r.bundle, tenant);
      this.rememberVerified(rowKey(r), rowMark(r));
      if (cache) this.cacheBundle(rowKey(r), rowMark(r), verified, Number(r.bytes) || 0);
      return verified;
    });
    for (const r of fetched) if (cache && this.known(rowKey(r), rowMark(r), own) && !this.bundleCache.has(rowKey(r))) this.cacheBundle(rowKey(r), rowMark(r), r.bundle, Number(r.bytes) || 0);
    // A version's source objects are compared in full once per process; afterwards only their count
    // and newest row version (xmin, which any insert or update raises) are read, without loading the
    // objects. A delete changes the count, so any change leads to the full comparison again.
    const marks = new Map((await this.pool.query(`SELECT version_id,count(*)::bigint AS n,max(xmin::text::bigint) AS latest FROM rag_v2_object
      WHERE tenant=$1 AND version_id=ANY($2::text[]) GROUP BY version_id`, [tenant, rows.map(r => r.id)])).rows.map(r => [r.version_id, `${r.n}/${r.latest}`]));
    const key = r => `objects\0${tenant}\0${r.id}\0${r.bundle_hash}`;
    const pending = bundles.filter((b, index) => !this.known(key(rows[index]), marks.get(rows[index].id) ?? 'none', own));
    if (pending.length) {
      const objects = (await this.pool.query('SELECT version_id,id,data,from_id,to_id FROM rag_v2_object WHERE tenant=$1 AND version_id=ANY($2::text[])',
        [tenant, pending.map(b => b.version.id)])).rows;
      const expected = new Map(pending.flatMap(b => [b.document, b.version, ...b.assets, ...b.sections, ...b.blocks, ...b.spans, ...b.chunks,
        ...(b.knowledge_cards || []), ...(b.dependencies || []), ...(b.knowledge_gaps || []), ...b.relations].map(e => [`${b.version.id}/${e.id}`, e])));
      if (objects.length !== expected.size || objects.some(o => {
        const e = expected.get(`${o.version_id}/${o.id}`);
        return !e || stable(e) !== stable(o.data) || o.from_id !== (e.from_id ?? null) || o.to_id !== (e.to_id ?? null);
      })) fail('source_object_integrity_failed');
      for (const row of rows) if (pending.some(b => b.version.id === row.id)) this.rememberVerified(key(row), marks.get(row.id) ?? 'none');
    }
    return bundles;
  }
  async retrievalDirectory(tenant, generation, documentIds) {
    // An unchanged list for the same generation object is answered from one digest row: the heads
    // of every allowed document (~6000 rows) were most of a history load (acceptance G5, 27.09.2026).
    const listKey = hash(`${tenant}\0${generation.id}\0${documentIds.join('\0')}`), known = this.directoryLists.get(listKey);
    if (known?.generation === generation) {
      const print = (await this.pool.query(`SELECT count(*)::int AS n,encode(sha256(convert_to(coalesce(string_agg(${DIRECTORY_MARK_SQL},E'\\n' ORDER BY d.document_id),''),'UTF8')),'hex') AS digest
        FROM rag_v2_generation_document d JOIN rag_v2_version v ON v.tenant=d.tenant AND v.id=d.version_id AND v.document_id=d.document_id
        WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($3::text[])`, [tenant, generation.id, documentIds])).rows[0];
      if (print.n === documentIds.length && print.digest === known.digest) return known.directories;
    }
    // Row marks first; a directory verified in this process with the same marks is reused as parsed.
    const heads = (await this.pool.query(`SELECT d.document_id,d.version_id,d.retrieval_hash,v.bundle_hash,d.xmin::text AS directory_row,v.xmin::text AS version_row,
      d.retrieval_directory IS NULL AS no_directory FROM rag_v2_generation_document d JOIN rag_v2_version v
        ON v.tenant=d.tenant AND v.id=d.version_id AND v.document_id=d.document_id
      WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($3::text[]) ORDER BY d.document_id`,
    [tenant, generation.id, documentIds])).rows;
    if (heads.length !== documentIds.length) fail('missing_generation_source');
    const key = row => `${tenant}\0${generation.id}\0${row.document_id}`;
    const mark = row => `${row.version_id}/${row.retrieval_hash}/${row.bundle_hash}/${row.directory_row}/${row.version_row}`;
    const missing = heads.filter(row => !row.no_directory && this.directoryCache.get(key(row))?.mark !== mark(row)).map(row => row.document_id);
    const fetched = new Map(missing.length ? (await this.pool.query(`SELECT d.document_id,d.version_id,d.retrieval_directory,d.retrieval_hash,v.bundle_hash,d.xmin::text AS directory_row,v.xmin::text AS version_row
      FROM rag_v2_generation_document d JOIN rag_v2_version v
        ON v.tenant=d.tenant AND v.id=d.version_id AND v.document_id=d.document_id
      WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($3::text[])`, [tenant, generation.id, missing])).rows.map(row => [row.document_id, row]) : []);
    const rows = heads.map(head => head.no_directory ? { ...head, retrieval_directory: null }
      : fetched.get(head.document_id) || { ...head, retrieval_directory: this.directoryCache.get(key(head)).directory });
    // Do not hide corruption behind a legacy fallback when some documents have directories.
    const directories = rows.map(row => {
      if (row.retrieval_directory === null && row.retrieval_hash === null) return null;
      if (!fetched.has(row.document_id)) {
        // Reused: the marks equal a full check done in this process; the snapshot binding is rechecked.
        if (generation.snapshot.documents[row.document_id]?.version_id !== row.version_id) fail('retrieval_directory_integrity_failed');
        return row.retrieval_directory;
      }
      const directory = verifyDirectory(row, generation);
      if (this.directoryCache.size < 50000 || this.directoryCache.has(key(row))) this.directoryCache.set(key(row), { mark: mark(row), directory });
      return directory;
    });
    if (directories.some(directory => directory === null)) return null;
    // An unchanged answer returns the same (frozen) array, so its digest is computed once (directoryDigest).
    const digest = hash(heads.map(row => `${row.document_id}/${row.version_id}/${row.retrieval_hash ?? ''}/${row.bundle_hash}/${row.directory_row}/${row.version_row}/${row.no_directory}`).join('\n'));
    const list = !fetched.size && known?.digest === digest ? known.directories : Object.freeze(directories);
    this.directoryLists.delete(listKey);
    if (this.directoryLists.size >= 32) this.directoryLists.delete(this.directoryLists.keys().next().value);
    this.directoryLists.set(listKey, { generation, digest, directories: list });
    return list;
  }
  /** The titles of a generation's documents, by document, from their unit rows (every unit row carries its document's
   *  title). They choose a document to load; whoever uses a title checks it against the loaded source. */
  async documentTitles(tenant, generationId, documentIds) {
    const key = doc => `${tenant}\0${generationId}\0${doc}`, missing = documentIds.filter(doc => !this.titles.has(key(doc)));
    if (missing.length) {
      const known = await this.layoutOf(tenant, generationId);
      if (!known) return new Map();
      const scope = UNIT_SCOPE[known.layout];
      const rows = (await this.pool.query(`SELECT DISTINCT u.document_id,u.title FROM ${scope.from} WHERE ${scope.where}`, [tenant, generationId, missing])).rows;
      if (this.titles.size > 50000) this.titles.clear();
      for (const row of rows) this.titles.set(key(row.document_id), row.title);
    }
    return new Map(documentIds.filter(doc => this.titles.has(key(doc))).map(doc => [doc, this.titles.get(key(doc))]));
  }
  async units(tenant, generationId, documentIds, { own = false } = {}) {
    const known = await this.layoutOf(tenant, generationId);
    if (!known) return [];
    const { layout, configId, lexical } = known, scope = UNIT_SCOPE[layout];
    const rows = (await this.pool.query(`SELECT u.*,u.xmin::text AS row_version FROM ${scope.from}
      WHERE ${scope.where} ORDER BY u.document_id,u.ordinal,u.id`, [tenant, generationId, documentIds])).rows;
    const byDocument = new Map();
    for (const r of rows) {
      for (const key of UNIT_COLUMNS) if (r[key] !== r.data[key]) fail('index_unit_integrity_failed');
      if (!byDocument.has(r.document_id)) byDocument.set(r.document_id, []);
      byDocument.get(r.document_id).push(r);
    }
    // A document's stored morphology is re-analysed once per process; a later read whose unit rows
    // have the same row versions (xmin, raised by any update) is not analysed again, a changed one is.
    // Shared version rows (ADR-036) are the same rows in every generation that lists the version.
    const owner = layout === VERSION_LAYOUT ? `config\0${configId}` : generationId;
    const pending = [...byDocument.values()].map(group => ({ group, key: `units\0${tenant}\0${owner}\0${group[0].document_id}\0${group[0].version_id}\0${lexical}`,
      digest: `${group.length}/${group.map(r => r.row_version).sort().join(',')}` })).filter(entry => !this.known(entry.key, entry.digest, own));
    const check = pending.flatMap(entry => entry.group);
    const fields = check.length ? await lexicalFields(check.map(r => r.data), lexical, this.analyzer) : [];
    if (check.some((r, index) => stable(r.morphology) !== stable(fields[index]))) fail('index_morphology_integrity_failed');
    for (const entry of pending) this.rememberVerified(entry.key, entry.digest);
    return rows.map(r => r.data);
  }
  async canonicalReference(reference, options) {
    return (await this.canonicalReferences([reference], options))[0];
  }
  async canonicalReferences(references, { checkBundle } = {}) {
    if (!Array.isArray(references) || references.length > 2000) fail('invalid_canonical_references');
    if (!references.length) return [];
    const first = references[0];
    tenantId(first?.tenant);
    if (references.some(ref => ref?.tenant !== first.tenant || ref.generation_id !== first.generation_id || ref.query_id !== first.query_id)) fail('reference_scope_mismatch');
    const generation = await this.readyGeneration(first.tenant, first.generation_id);
    if (!generation || references.some(ref => generation.snapshot.documents?.[ref.document_id]?.version_id !== ref.document_version_id)) fail('canonical_generation_missing');
    const bundles = await this.bundles(first.tenant, first.generation_id, [...new Set(references.map(ref => ref.document_id))]);
    if (checkBundle) for (const bundle of bundles) await checkBundle(bundle);
    const byDocument = new Map(bundles.map(bundle => [bundle.document.id, bundle]));
    // A shared version row (ADR-036) belongs to this generation through the version check below.
    const units = (indexLayout(generation.layout) === VERSION_LAYOUT
      ? await this.pool.query(`SELECT id,document_id,version_id,chunk_id,data FROM rag_v2_version_unit
        WHERE tenant=$1 AND config_id=$2 AND id=ANY($3::text[])`, [first.tenant, generation.config.id, references.map(ref => ref.unit_id)])
      : await this.pool.query(`SELECT id,document_id,version_id,chunk_id,data FROM rag_v2_unit
        WHERE tenant=$1 AND generation_id=$2 AND id=ANY($3::text[])`, [first.tenant, first.generation_id, references.map(ref => ref.unit_id)])).rows;
    const byUnit = new Map(units.map(unit => [unit.id, unit]));
    return references.map(reference => {
      const bundle = byDocument.get(reference.document_id), chunk = bundle?.chunks.find(item => item.id === reference.chunk_id);
      const row = byUnit.get(reference.unit_id), unit = row?.data;
      if (row?.document_id !== reference.document_id || row?.version_id !== reference.document_version_id || row?.chunk_id !== reference.chunk_id) fail('canonical_reference_missing');
      if (!chunk || !unit || stable(indexUnit(chunk, bundle, generation.config.embedding)) !== stable(unit)) fail('canonical_reference_missing');
      const spans = chunk.span_ids.map(spanId => bundle.spans.find(span => span.id === spanId));
      if (spans.some(span => !span) || chunk.source_text !== spans.map(span => span.source_text).join('\n')) fail('canonical_reference_missing');
      // A record catalogue cites the excerpt its view shows (structured-record-source.js); nothing else may.
      // Anything else resolves to the whole chunk, so a forged span list fails the comparison.
      const excerpt = () => { try { return chunkExcerpt(bundle, chunk, reference.span_ids); } catch { return chunk; } };
      const cited = stable(reference.span_ids) !== stable(chunk.span_ids) && bundle.document.fields.structured_record?.value ? excerpt() : chunk;
      return { tenant: reference.tenant, query_id: reference.query_id, generation_id: reference.generation_id,
        evidence_id: id('evidence', reference.tenant, bundle.version.id, unit.id), document_id: bundle.document.id,
        document_version_id: bundle.version.id, unit_id: unit.id, chunk_id: chunk.id, span_ids: cited.span_ids,
        ...locationFields(cited), pdf_pages: chunk.pdf_pages, source_text_sha256: hash(cited.source_text) };
    });
  }
  async lexical(tenant, generationId, documentIds, text, limit, unitIds = null, { rank = LEXICAL_RANK_CD } = {}) {
    if (!LEXICAL_RANKS.includes(rank)) fail('unsupported_lexical_rank');
    // ts_rank weighs the matched terms without their cover density; on a query that matches most of
    // the corpus it costs a fraction of ts_rank_cd (Codex lexical audit P1-1). Versioned per query.
    const score = rank === LEXICAL_RANK_PLAIN ? 'ts_rank' : 'ts_rank_cd';
    if (!documentIds.length || !text.trim()) return [];
    const { layout, lexical } = await this.layoutOf(tenant, generationId) || {}, scope = UNIT_SCOPE[layout];
    if (!LEXICAL_CONFIGS.includes(lexical)) fail('unknown_lexical_config');
    if (lexical !== LEGACY_LEXICAL) return this.parallelRead(`WITH q AS (
      SELECT replace(plainto_tsquery('pg_catalog.simple',$4)::text,' & ',' | ')::tsquery AS exact,
        replace(plainto_tsquery('pg_catalog.simple',$7)::text,' & ',' | ')::tsquery AS stems)
      SELECT u.id,${score}(u.search_vector,q.exact) + 0.35 * ${score}(u.morphology_vector,q.stems) AS score
      FROM ${scope.from},q WHERE ${scope.where}
        AND (u.search_vector @@ q.exact OR u.morphology_vector @@ q.stems) AND ($6::text[] IS NULL OR u.id=ANY($6::text[]))
      ORDER BY score DESC,u.id COLLATE "C" ASC LIMIT $5`, [tenant, generationId, documentIds, text, limit, unitIds, await lexicalQuery(text, lexical, this.analyzer)]);
    return this.parallelRead(`WITH q AS (SELECT replace(plainto_tsquery('pg_catalog.simple',$4)::text,' & ',' | ')::tsquery AS query)
      SELECT u.id,${score}(u.search_vector,q.query) AS score FROM ${scope.from},q
      WHERE ${scope.where} AND u.search_vector @@ q.query AND ($6::text[] IS NULL OR u.id=ANY($6::text[]))
      ORDER BY score DESC,u.id COLLATE "C" ASC LIMIT $5`, [tenant, generationId, documentIds, text, limit, unitIds]);
  }
  async checkLexicalAnalyzer(lexical) {
    // An empty local analysis checks the package/dictionary before any paid
    // query embedding, without reading source bodies or storing query text.
    await lexicalQuery('', lexical, this.analyzer);
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
