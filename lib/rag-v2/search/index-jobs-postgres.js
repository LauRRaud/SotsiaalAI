import { randomUUID } from 'node:crypto';
import { fail, hash, stable } from '../contracts.js';
import { PostgresCatalog } from './postgres.js';
import { validateIndexPlan, validateIndexProgress } from './index-jobs.js';
import { generationCollection } from './qdrant.js';
import { VERSION_LAYOUT, indexLayout } from './layout.js';

const UNIT_COLUMNS = ['id', 'document_id', 'version_id', 'chunk_id', 'ordinal', 'title', 'authors', 'body', 'search_aids'];

export class IndexJobStore extends PostgresCatalog {
  async enqueueIndex(plan, storageRoot) {
    validateIndexPlan(plan);
    const layout = indexLayout(plan.layout);
    const generation = await this.beginGeneration(plan.tenant, { id: plan.generation_id, snapshot: plan.source, config: plan.config, layout,
      collection: generationCollection(plan.tenant, plan.generation_id, plan.config, layout === VERSION_LAYOUT), expected_count: plan.total_units });
    await this.pool.query(`INSERT INTO rag_v2_index_job(tenant,generation_id,plan,plan_hash,storage_root)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [plan.tenant, plan.generation_id, plan, hash(stable(plan)), storageRoot]);
    const job = await this.indexJob(plan.tenant, plan.generation_id);
    if (stable(job.plan) !== stable(plan) || job.storage_root !== storageRoot) fail('index_job_plan_mismatch');
    return generation;
  }
  async indexJob(tenant, generationId) {
    const row = (await this.pool.query('SELECT * FROM rag_v2_index_job WHERE tenant=$1 AND generation_id=$2', [tenant, generationId])).rows[0];
    if (!row) fail('index_job_not_found');
    validateIndexPlan(row.plan);
    if (row.plan.tenant !== tenant || row.plan.generation_id !== generationId || hash(stable(row.plan)) !== row.plan_hash) fail('index_job_plan_mismatch');
    validateIndexProgress(row.plan, row);
    return row;
  }
  async indexStatus(tenant, generationId) {
    const job = await this.indexJob(tenant, generationId);
    return { generation_id: generationId, state: job.state, completed_documents: job.document_offset,
      completed_units: job.completed_units, total_documents: job.plan.items.length, total_units: job.plan.total_units,
      embedding_mode: job.plan.config.embedding.embedding_mode, external_embedding_calls: 0 };
  }
  async claimIndex(tenant, generationId, leaseSeconds = 120) {
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) fail('invalid_index_lease');
    await this.indexJob(tenant, generationId);
    const row = (await this.pool.query(`UPDATE rag_v2_index_job SET lease_token=$3,lease_until=clock_timestamp()+($4::integer * interval '1 second')
      WHERE tenant=$1 AND generation_id=$2 AND state='pending' AND (lease_token IS NULL OR lease_until<=clock_timestamp()) RETURNING *`,
    [tenant, generationId, randomUUID(), leaseSeconds])).rows[0];
    if (!row) fail('index_job_busy_or_ready');
    return row;
  }
  async renewIndex(claim, leaseSeconds) {
    const saved = await this.pool.query(`UPDATE rag_v2_index_job SET lease_until=clock_timestamp()+($4::integer * interval '1 second')
      WHERE tenant=$1 AND generation_id=$2 AND lease_token=$3 AND lease_until>clock_timestamp() AND state='pending'`,
    [claim.tenant, claim.generation_id, claim.lease_token, leaseSeconds]);
    if (saved.rowCount !== 1) fail('index_lease_lost');
  }
  async advanceIndex(claim, next) {
    validateIndexProgress(claim.plan, { ...next, state: 'pending' });
    const saved = await this.pool.query(`UPDATE rag_v2_index_job SET document_offset=$4,unit_offset=$5,completed_units=$6
      WHERE tenant=$1 AND generation_id=$2 AND lease_token=$3 AND state='pending' AND lease_until>clock_timestamp()
        AND document_offset=$7 AND unit_offset=$8 AND completed_units=$9 RETURNING *`,
    [claim.tenant, claim.generation_id, claim.lease_token, next.document_offset, next.unit_offset, next.completed_units,
      claim.document_offset, claim.unit_offset, claim.completed_units]);
    if (saved.rowCount !== 1) fail('index_lease_lost');
    return saved.rows[0];
  }
  async releaseIndex(claim) {
    await this.pool.query(`UPDATE rag_v2_index_job SET lease_token=NULL,lease_until=NULL WHERE tenant=$1 AND generation_id=$2 AND lease_token=$3`,
      [claim.tenant, claim.generation_id, claim.lease_token]);
  }
  // --- Version layout (ADR-036): a version's rows are written once per search config and sealed after their check.
  /** Items of the versions sealed under this config, by version ID. */
  async sealedItems(tenant, configId, versionIds) {
    const rows = (await this.pool.query(`SELECT version_id,item FROM rag_v2_version_index
      WHERE tenant=$1 AND config_id=$2 AND state='ready' AND version_id=ANY($3::text[])`, [tenant, configId, versionIds])).rows;
    return new Map(rows.map(row => [row.version_id, row.item]));
  }
  /** Lists sealed versions in a staged generation, with the directory each version stored when it was written. */
  async attachSealed(tenant, generation, items) {
    const versions = items.map(item => item.version_id), documents = items.map(item => item.document_id);
    await this.transaction(async client => {
      await client.query(`INSERT INTO rag_v2_generation_document(tenant,generation_id,document_id,version_id,retrieval_directory,retrieval_hash)
        SELECT v.tenant,$2,v.document_id,v.version_id,v.retrieval_directory,v.retrieval_hash FROM rag_v2_version_index v
        WHERE v.tenant=$1 AND v.config_id=$3 AND v.state='ready' AND v.version_id=ANY($4::text[]) ON CONFLICT DO NOTHING`, [tenant, generation.id, generation.config.id, versions]);
      const rows = (await client.query(`SELECT d.document_id,d.version_id,v.item,v.state,
          (d.retrieval_hash IS NOT DISTINCT FROM v.retrieval_hash AND d.retrieval_directory IS NOT DISTINCT FROM v.retrieval_directory) AS same_directory
        FROM rag_v2_generation_document d LEFT JOIN rag_v2_version_index v ON v.tenant=d.tenant AND v.config_id=$3 AND v.version_id=d.version_id
        WHERE d.tenant=$1 AND d.generation_id=$2 AND d.document_id=ANY($4::text[])`, [tenant, generation.id, generation.config.id, documents])).rows;
      const planned = new Map(items.map(item => [item.document_id, item]));
      if (rows.length !== items.length || rows.some(row => row.state !== 'ready' || !row.same_directory
        || row.version_id !== planned.get(row.document_id)?.version_id || stable(row.item) !== stable(planned.get(row.document_id)))) fail('version_index_integrity_failed');
    });
  }
  /** Seals a written version: its unit rows must match the plan item's digests and their stored morphology the
   * digest taken when it was analysed (no second analysis); the generation must list it with its directory. */
  async sealVersion(tenant, generation, item) {
    await this.transaction(async client => {
      const index = (await client.query(`SELECT * FROM rag_v2_version_index WHERE tenant=$1 AND config_id=$2 AND version_id=$3 FOR UPDATE`,
        [tenant, generation.config.id, item.version_id])).rows[0];
      if (!index || index.document_id !== item.document_id || stable(index.item) !== stable(item)) fail('version_index_integrity_failed');
      const version = (await client.query('SELECT bundle_hash FROM rag_v2_version WHERE tenant=$1 AND id=$2 AND document_id=$3', [tenant, item.version_id, item.document_id])).rows[0];
      if (version?.bundle_hash !== item.bundle_sha256) fail('version_index_integrity_failed');
      const units = (await client.query(`SELECT * FROM rag_v2_version_unit WHERE tenant=$1 AND config_id=$2 AND version_id=$3 ORDER BY ordinal,id`,
        [tenant, generation.config.id, item.version_id])).rows;
      if (units.some(row => UNIT_COLUMNS.some(key => row[key] !== row.data[key])) || units.length !== item.units
        || hash(stable(units.map(row => row.data))) !== item.units_sha256) fail('index_unit_integrity_failed');
      if (hash(stable(units.map(row => row.morphology))) !== index.morphology_hash) fail('index_morphology_integrity_failed');
      const listed = (await client.query(`SELECT version_id,retrieval_directory,retrieval_hash FROM rag_v2_generation_document
        WHERE tenant=$1 AND generation_id=$2 AND document_id=$3`, [tenant, generation.id, item.document_id])).rows[0];
      if (listed?.version_id !== item.version_id || listed.retrieval_hash !== index.retrieval_hash
        || stable(listed.retrieval_directory) !== stable(index.retrieval_directory)) fail('retrieval_directory_integrity_failed');
      await client.query("UPDATE rag_v2_version_index SET state='ready' WHERE tenant=$1 AND config_id=$2 AND version_id=$3", [tenant, generation.config.id, item.version_id]);
    });
  }
  async activateIndex(claim, generation) {
    await this.activate(claim.tenant, generation, async client => {
      const saved = await client.query(`UPDATE rag_v2_index_job SET state='ready',lease_token=NULL,lease_until=NULL
        WHERE tenant=$1 AND generation_id=$2 AND lease_token=$3 AND lease_until>clock_timestamp()
          AND document_offset=$4 AND unit_offset=0 AND completed_units=$5 AND state='pending'`,
      [claim.tenant, claim.generation_id, claim.lease_token, claim.plan.items.length, claim.plan.total_units]);
      if (saved.rowCount !== 1) fail('index_lease_lost');
      const actual = (await client.query('SELECT document_id,version_id FROM rag_v2_generation_document WHERE tenant=$1 AND generation_id=$2',
        [claim.tenant, claim.generation_id])).rows;
      if (actual.length !== claim.plan.items.length || actual.some(row => claim.plan.source.documents[row.document_id]?.version_id !== row.version_id)) fail('index_snapshot_scope_mismatch');
      if (indexLayout(claim.plan.layout) === VERSION_LAYOUT) {
        // Every listed version is sealed with the plan's item and listed with the directory it stored.
        const rows = (await client.query(`SELECT d.document_id,v.item,v.state,
            (d.retrieval_hash IS NOT DISTINCT FROM v.retrieval_hash AND d.retrieval_directory IS NOT DISTINCT FROM v.retrieval_directory) AS same_directory
          FROM rag_v2_generation_document d LEFT JOIN rag_v2_version_index v ON v.tenant=d.tenant AND v.config_id=$3 AND v.version_id=d.version_id
          WHERE d.tenant=$1 AND d.generation_id=$2`, [claim.tenant, claim.generation_id, claim.plan.config.id])).rows;
        const planned = new Map(claim.plan.items.map(item => [item.document_id, item]));
        if (rows.length !== planned.size || rows.some(row => row.state !== 'ready' || !row.same_directory
          || stable(row.item) !== stable(planned.get(row.document_id)))) fail('version_index_integrity_failed');
      }
    });
  }
}
