-- The usage ledger is now the sole quota and analytics source. Preserve the
-- historical daily counters for a later retention decision instead of
-- destructively dropping production data in this migration.
ALTER TABLE "AnalyzeUsage" RENAME TO "AnalyzeUsageLegacy";
ALTER INDEX "AnalyzeUsage_userId_day_key" RENAME TO "AnalyzeUsageLegacy_userId_day_key";
ALTER INDEX "AnalyzeUsage_userId_idx" RENAME TO "AnalyzeUsageLegacy_userId_idx";
