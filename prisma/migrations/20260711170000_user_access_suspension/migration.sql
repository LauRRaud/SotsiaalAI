ALTER TABLE "User"
  ADD COLUMN "accessSuspendedAt" TIMESTAMP(3),
  ADD COLUMN "accessSuspendedReason" TEXT,
  ADD COLUMN "accessSuspendedByUserId" TEXT;

CREATE INDEX "User_accessSuspendedAt_idx" ON "User"("accessSuspendedAt");
