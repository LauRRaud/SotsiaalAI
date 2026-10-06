-- ADR-094, step 4: the large parts of a chat turn's audit row (the evidence packet, the request as sent, the query
-- vector) get their own columns. A turn's row is written about eighteen times; each of those writes used to rewrite
-- the whole payload, large parts included. In their own columns they are written once: a write that does not name a
-- column leaves its stored value in place. Rows written before this keep their parts inside "payload"; both are read.
ALTER TABLE "M4PilotTurn" ADD COLUMN "packet" JSONB, ADD COLUMN "requestAudit" JSONB, ADD COLUMN "vector" JSONB;
