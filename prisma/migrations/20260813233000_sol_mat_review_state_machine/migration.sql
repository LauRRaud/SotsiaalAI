ALTER TABLE "MaterialSubmission"
  ADD COLUMN "reviewRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_status_check"
  CHECK ("status" IN ('pending', 'reviewed', 'rejected', 'imported'));

ALTER TABLE "MaterialSubmission"
  ADD CONSTRAINT "MaterialSubmission_reviewRevision_check"
  CHECK ("reviewRevision" >= 0);

CREATE OR REPLACE FUNCTION "enforce_material_review_transition"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'pending' OR NEW."reviewRevision" <> 0 THEN
      RAISE EXCEPTION 'material submission must start pending at revision zero' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" = OLD."status" THEN
    IF NEW."reviewRevision" <> OLD."reviewRevision" THEN
      RAISE EXCEPTION 'material review revision cannot change without a status transition' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (
    (OLD."status" = 'pending' AND NEW."status" IN ('reviewed', 'rejected')) OR
    (OLD."status" = 'reviewed' AND NEW."status" IN ('pending', 'rejected', 'imported')) OR
    (OLD."status" = 'rejected' AND NEW."status" IN ('pending', 'reviewed'))
  ) THEN
    RAISE EXCEPTION 'invalid material review transition: % -> %', OLD."status", NEW."status" USING ERRCODE = '23514';
  END IF;

  IF NEW."reviewRevision" <> OLD."reviewRevision" + 1 THEN
    RAISE EXCEPTION 'material review transition must increment revision exactly once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "MaterialSubmission_review_transition_guard"
BEFORE INSERT OR UPDATE OF "status", "reviewRevision" ON "MaterialSubmission"
FOR EACH ROW EXECUTE FUNCTION "enforce_material_review_transition"();
