-- The lifecycle columns were originally added with status='DRAFT'. PostgreSQL
-- consequently marked every pre-existing accounting entry as a deletable
-- draft. Close that one-time upgrade gap by treating every entry present at
-- this deployment as recorded; entries created afterwards still use DRAFT and
-- can follow the normal finalize API.
UPDATE "ServiceEntry"
SET
  "status" = 'FINAL',
  "finalizedAt" = COALESCE("finalizedAt", "createdAt", "date"),
  "recordedFiscalYear" = COALESCE(
    "recordedFiscalYear",
    EXTRACT(YEAR FROM COALESCE("finalizedAt", "createdAt", "date") AT TIME ZONE 'UTC')::INTEGER
  )
WHERE "status" = 'DRAFT';
