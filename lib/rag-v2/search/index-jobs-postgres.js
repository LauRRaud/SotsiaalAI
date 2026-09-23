import { randomUUID } from 'node:crypto';
import { fail, hash, stable } from '../contracts.js';
import { PostgresCatalog } from './postgres.js';
import { validateIndexPlan, validateIndexProgress } from './index-jobs.js';
import { collectionName } from './qdrant.js';

export class IndexJobStore extends PostgresCatalog {
  async enqueueIndex(plan, storageRoot) {
    validateIndexPlan(plan);
    const generation = await this.beginGeneration(plan.tenant, { id: plan.generation_id, snapshot: plan.source, config: plan.config,
      collection: collectionName(plan.tenant, plan.generation_id, plan.config.embedding.embedding_mode), expected_count: plan.total_units });
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
    });
  }
}
