CREATE TABLE "HelpRateLimitBucket" (
    "key" VARCHAR(64) NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "HelpRateLimitBucket_resetAt_idx" ON "HelpRateLimitBucket"("resetAt");
