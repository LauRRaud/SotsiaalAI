DROP INDEX "public"."ResearchJob_userId_active_unique_idx";

-- A cancellation request remains an active cost/concurrency slot until the worker has observed it.
-- This also prevents DELETE from erasing the only cross-process stop signal before acknowledgement.
CREATE UNIQUE INDEX "ResearchJob_userId_active_unique_idx"
ON "public"."ResearchJob"("userId")
WHERE status IN ('queued', 'running')
   OR (status = 'cancelled' AND (payload->>'cancelAcknowledgedAt') IS NULL);
