-- Legacy rows were created without the immutable snapshot, explicit reviewer
-- assignment and version-bound privacy gates introduced by the new workflow.
-- They must not stay public or queryable in RAG merely because their old status
-- happened to be PUBLISHED/REVIEW/ANONYMITY_CHECK.

INSERT INTO "DataDeletionJob" (
  "id", "createdAt", "updatedAt", "action", "resourceType", "resourceId",
  "externalRef", "storagePath", "status", "attempts"
)
SELECT
  md5('legacy-effective-practice-rag:' || ep."id" || ':' || ep."ragSourceId"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'RAG_DELETE',
  'EffectivePractice',
  ep."id",
  ep."ragSourceId",
  'legacy_workflow_quarantine',
  'pending',
  0
FROM "EffectivePractice" ep
WHERE ep."ragSourceId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "DataDeletionJob" job
    WHERE job."action" = 'RAG_DELETE'
      AND job."resourceType" = 'EffectivePractice'
      AND job."resourceId" = ep."id"
      AND job."externalRef" = ep."ragSourceId"
      AND job."status" IN ('pending', 'failed')
  );

-- Older ingest code also used a deterministic identifier without persisting it
-- reliably. Deletion is idempotent, so quarantine that possible document for
-- every pre-snapshot row, including hidden/archived rows and failed link writes.
INSERT INTO "DataDeletionJob" (
  "id", "createdAt", "updatedAt", "action", "resourceType", "resourceId",
  "externalRef", "storagePath", "status", "attempts"
)
SELECT
  md5('legacy-effective-practice-computed-rag:' || ep."id"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'RAG_DELETE',
  'EffectivePractice',
  ep."id",
  'effective-practice::' || ep."id",
  'legacy_workflow_computed_id_quarantine',
  'pending',
  0
FROM "EffectivePractice" ep
WHERE NOT EXISTS (
  SELECT 1
  FROM "DataDeletionJob" job
  WHERE job."action" = 'RAG_DELETE'
    AND job."resourceType" = 'EffectivePractice'
    AND job."resourceId" = ep."id"
    AND job."externalRef" = 'effective-practice::' || ep."id"
    AND job."status" IN ('pending', 'failed')
);

UPDATE "EffectivePractice"
SET
  "status" = 'NEEDS_CHANGES',
  "version" = "version" + 1,
  "contentVersion" = "contentVersion" + 1,
  "ownerConfirmedNoIdentifiersAt" = NULL,
  "ownerConfirmedNoIdentifiersVersion" = NULL,
  "anonymityCheckedAt" = NULL,
  "anonymityCheckedVersion" = NULL,
  "professionalReviewedAt" = NULL,
  "publishedAt" = NULL,
  "publishedVersion" = NULL,
  "ragMetadata" = jsonb_build_object(
    'syncStatus', 'removal_pending',
    'reason', 'legacy_workflow_quarantine',
    'checkedAt', CURRENT_TIMESTAMP
  )
WHERE "status" IN ('PUBLISHED', 'REVIEW', 'ANONYMITY_CHECK');
