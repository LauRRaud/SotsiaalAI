-- The lifecycle columns were originally added with status='DRAFT'. Only rows
-- that already existed when that migration finished are legacy accounting
-- records. A later legitimate draft must remain editable and deletable.
DO $$
DECLARE
  lifecycle_applied_at TIMESTAMPTZ;
BEGIN
  SELECT "finished_at"
  INTO lifecycle_applied_at
  FROM "_prisma_migrations"
  WHERE "migration_name" = '20260802140000_service_log_correction_trail'
    AND "finished_at" IS NOT NULL
  ORDER BY "finished_at" ASC
  LIMIT 1;

  IF lifecycle_applied_at IS NULL THEN
    RAISE EXCEPTION 'service-log lifecycle migration timestamp is unavailable';
  END IF;

  UPDATE "ServiceEntry"
  SET
    "status" = 'FINAL',
    "finalizedAt" = COALESCE("finalizedAt", "createdAt", "date"),
    "recordedFiscalYear" = COALESCE(
      "recordedFiscalYear",
      EXTRACT(YEAR FROM COALESCE("finalizedAt", "createdAt", "date") AT TIME ZONE 'UTC')::INTEGER
    )
  WHERE "status" = 'DRAFT'
    AND "createdAt" <= (lifecycle_applied_at AT TIME ZONE 'UTC');
END $$;
