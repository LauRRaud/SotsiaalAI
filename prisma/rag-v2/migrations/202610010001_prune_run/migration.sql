-- ADR-060: a prune run that has marked versions and has not yet removed their rows. The row is written with the marks
-- and removed with the rows; while it stands no generation of the tenant begins. Unlike the run's advisory lock it
-- outlives the run's session, whose last Qdrant delete may still be applied after the session is gone.
CREATE TABLE rag_v2_prune_run (
 tenant text PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
