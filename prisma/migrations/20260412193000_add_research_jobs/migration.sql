CREATE TABLE "public"."ResearchJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "result" JSONB,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResearchJob_userId_status_updatedAt_idx" ON "public"."ResearchJob"("userId", "status", "updatedAt");
CREATE INDEX "ResearchJob_status_updatedAt_idx" ON "public"."ResearchJob"("status", "updatedAt");
CREATE INDEX "ResearchJob_endedAt_idx" ON "public"."ResearchJob"("endedAt");

ALTER TABLE "public"."ResearchJob"
ADD CONSTRAINT "ResearchJob_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
