ALTER TABLE "PracticeReflection"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestHash" TEXT;

CREATE UNIQUE INDEX "PracticeReflection_ownerUserId_idempotencyKey_key"
ON "PracticeReflection"("ownerUserId", "idempotencyKey");

CREATE TABLE "PracticeReflectionRateLimitBucket" (
    "key" VARCHAR(64) NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeReflectionRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "PracticeReflectionRateLimitBucket_resetAt_idx"
ON "PracticeReflectionRateLimitBucket"("resetAt");
