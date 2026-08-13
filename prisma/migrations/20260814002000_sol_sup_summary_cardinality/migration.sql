-- SOL-SUP-08: live summary cardinality is a database invariant. DISCARDED
-- drafts may be replaced deliberately, so both constraints are partial.
DROP INDEX IF EXISTS "SupervisionSummary_meetingId_key";

CREATE UNIQUE INDEX "SupervisionSummary_one_live_meeting_summary"
ON "SupervisionSummary" ("meetingId")
WHERE "meetingId" IS NOT NULL AND "status" <> 'DISCARDED';

CREATE UNIQUE INDEX "SupervisionSummary_one_live_final_per_process"
ON "SupervisionSummary" ("processId")
WHERE "kind" = 'FINAL' AND "status" <> 'DISCARDED';
