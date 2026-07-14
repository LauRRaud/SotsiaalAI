ALTER TABLE "CovisionClosure"
  DROP CONSTRAINT "CovisionClosure_closedById_fkey";

ALTER TABLE "CovisionClosure"
  ALTER COLUMN "closedById" DROP NOT NULL;

ALTER TABLE "CovisionClosure"
  ADD CONSTRAINT "CovisionClosure_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
