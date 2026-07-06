ALTER TABLE "public"."ResearchJob"
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "workerId" TEXT,
ADD COLUMN "leaseUntil" TIMESTAMP(3);

CREATE INDEX "ResearchJob_status_leaseUntil_updatedAt_idx"
ON "public"."ResearchJob"("status", "leaseUntil", "updatedAt");

CREATE INDEX "ResearchJob_workerId_idx"
ON "public"."ResearchJob"("workerId");
