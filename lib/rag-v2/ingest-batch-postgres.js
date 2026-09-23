import { randomUUID } from 'node:crypto';
import { fail, hash, stable } from './contracts.js';
import { validateIngestBatch } from './ingest-batch.js';
import { PostgresCatalog } from './search/postgres.js';

/** Local development database only, using the same connection boundary as the search catalog. */
export class IngestBatchQueue extends PostgresCatalog {
  async verifyStore(tenant, batchId, storeRoot) {
    const row = (await this.pool.query('SELECT storage_root FROM rag_v2_ingest_batch WHERE tenant=$1 AND id=$2', [tenant, batchId])).rows[0];
    if (row?.storage_root !== storeRoot) fail('batch_storage_mismatch');
  }

  async bindStore(tenant, batchId, storeRoot) {
    const result = await this.pool.query(`UPDATE rag_v2_ingest_batch SET storage_root=$3
      WHERE tenant=$1 AND id=$2 AND (storage_root IS NULL OR storage_root=$3) RETURNING id`, [tenant, batchId, storeRoot]);
    if (result.rowCount !== 1) fail('batch_storage_mismatch');
  }

  async enqueue(input) {
    const plan = validateIngestBatch(input), fingerprint = hash(stable(plan));
    await this.transaction(async client => {
      await client.query(`INSERT INTO rag_v2_ingest_batch(tenant,id,manifest,manifest_hash,item_count)
        VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, [plan.tenant, plan.id, plan, fingerprint, plan.items.length]);
      const stored = (await client.query('SELECT * FROM rag_v2_ingest_batch WHERE tenant=$1 AND id=$2 FOR UPDATE', [plan.tenant, plan.id])).rows[0];
      if (stored.manifest_hash !== fingerprint || hash(stable(stored.manifest)) !== fingerprint || stored.item_count !== plan.items.length) fail('batch_manifest_changed');
      for (const item of plan.items) await client.query(`INSERT INTO rag_v2_ingest_item(tenant,batch_id,id,document_id)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [plan.tenant, plan.id, item.id, item.document_id]);
      const actual = (await client.query('SELECT id,document_id FROM rag_v2_ingest_item WHERE tenant=$1 AND batch_id=$2', [plan.tenant, plan.id])).rows;
      const expected = new Map(plan.items.map(item => [item.id, item.document_id]));
      if (actual.length !== expected.size || actual.some(item => expected.get(item.id) !== item.document_id)) fail('batch_item_scope_mismatch');
    });
    return this.status(plan.tenant, plan.id);
  }

  async manifest(tenant, batchId) {
    const row = (await this.pool.query('SELECT manifest,manifest_hash FROM rag_v2_ingest_batch WHERE tenant=$1 AND id=$2', [tenant, batchId])).rows[0];
    if (!row) fail('batch_not_found');
    const plan = validateIngestBatch(row.manifest);
    if (plan.tenant !== tenant || plan.id !== batchId || hash(stable(plan)) !== row.manifest_hash) fail('batch_manifest_changed');
    return plan;
  }

  async claim(tenant, batchId, leaseSeconds = 120) {
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) fail('invalid_batch_lease');
    await this.manifest(tenant, batchId);
    return this.transaction(async client => {
      // Three lost local attempts need operator review, not an infinite crash/retry loop.
      await client.query(`UPDATE rag_v2_ingest_item SET state='needs_review',error_code='batch_attempt_limit',lease_token=NULL,lease_until=NULL
        WHERE tenant=$1 AND batch_id=$2 AND state='processing' AND lease_until<=clock_timestamp() AND attempts>=3`, [tenant, batchId]);
      const result = await client.query(`WITH candidate AS (
        SELECT id FROM rag_v2_ingest_item WHERE tenant=$1 AND batch_id=$2 AND attempts<3
          AND (state='queued' OR (state='processing' AND lease_until<=clock_timestamp()))
        ORDER BY id COLLATE "C" FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE rag_v2_ingest_item i SET state='processing',attempts=i.attempts+1,lease_token=$3,
        lease_until=clock_timestamp()+($4::integer * interval '1 second'),error_code=NULL
        FROM candidate c WHERE i.tenant=$1 AND i.batch_id=$2 AND i.id=c.id RETURNING i.*`,
      [tenant, batchId, randomUUID(), leaseSeconds]);
      return result.rows[0] || null;
    });
  }

  async finish(claim, { result = null, error = null }) {
    if ((!result && !error) || (result && error) || (error && !/^[a-z][a-z0-9_]+$/.test(error))) fail('invalid_batch_result');
    if (result && result.document_id !== claim.document_id) fail('batch_item_scope_mismatch');
    const saved = await this.pool.query(`UPDATE rag_v2_ingest_item SET state=$5,result=$6,error_code=$7,lease_token=NULL,lease_until=NULL
      WHERE tenant=$1 AND batch_id=$2 AND id=$3 AND lease_token=$4 AND state='processing' AND lease_until>clock_timestamp() RETURNING id`,
    [claim.tenant, claim.batch_id, claim.id, claim.lease_token, error ? 'needs_review' : 'prepared', result, error]);
    if (saved.rowCount !== 1) fail('batch_lease_lost');
  }

  async status(tenant, batchId) {
    const plan = await this.manifest(tenant, batchId);
    const items = (await this.pool.query(`SELECT id,document_id,state,attempts,result,error_code,
      (state='processing' AND lease_until<=clock_timestamp()) AS lease_expired
      FROM rag_v2_ingest_item WHERE tenant=$1 AND batch_id=$2 ORDER BY id COLLATE "C"`, [tenant, batchId])).rows;
    const expected = new Map(plan.items.map(item => [item.id, item.document_id]));
    if (items.length !== expected.size || items.some(item => expected.get(item.id) !== item.document_id)) fail('batch_item_scope_mismatch');
    const counts = { queued: 0, processing: 0, prepared: 0, needs_review: 0 };
    for (const item of items) counts[item.state]++;
    return { batch_id: batchId, tenant, counts, items, publication: 'not_checked', model_calls: 0,
      state: counts.prepared === items.length ? 'prepared' : counts.needs_review ? 'needs_review' : 'pending' };
  }
}
