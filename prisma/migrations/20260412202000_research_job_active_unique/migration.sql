CREATE UNIQUE INDEX "ResearchJob_userId_active_unique_idx"
ON "public"."ResearchJob"("userId")
WHERE status IN ('queued', 'running');
