-- CreateTable
CREATE TABLE "AnalyzeUsage" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "AnalyzeUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "AnalyzeUsage_userId_day_key" ON "AnalyzeUsage"("userId", "day");
CREATE INDEX "AnalyzeUsage_userId_idx" ON "AnalyzeUsage"("userId");
