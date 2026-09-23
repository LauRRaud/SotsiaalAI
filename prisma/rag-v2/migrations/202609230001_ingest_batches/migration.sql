CREATE TABLE rag_v2_ingest_batch (
 tenant text NOT NULL, id text NOT NULL, manifest jsonb NOT NULL, manifest_hash text NOT NULL,
 item_count integer NOT NULL CHECK(item_count BETWEEN 1 AND 1000), storage_root text, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant,id)
);
CREATE TABLE rag_v2_ingest_item (
 tenant text NOT NULL, batch_id text NOT NULL, id text NOT NULL, document_id text NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','prepared','needs_review')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease_token uuid, lease_until timestamptz, result jsonb, error_code text,
 PRIMARY KEY(tenant,batch_id,id), UNIQUE(tenant,batch_id,document_id),
 FOREIGN KEY(tenant,batch_id) REFERENCES rag_v2_ingest_batch(tenant,id),
 CHECK((state='processing' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (state<>'processing' AND lease_token IS NULL AND lease_until IS NULL)),
 CHECK((state='prepared' AND result IS NOT NULL) OR (state<>'prepared' AND result IS NULL)),
 CHECK((state='needs_review' AND error_code IS NOT NULL) OR (state<>'needs_review' AND error_code IS NULL))
);
CREATE INDEX rag_v2_ingest_item_claim_idx ON rag_v2_ingest_item(tenant,batch_id,state,id);
