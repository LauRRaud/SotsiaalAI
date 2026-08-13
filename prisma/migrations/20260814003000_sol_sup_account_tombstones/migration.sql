-- SOL-SUP-03 / SOL-SUP-09
-- Shared supervision evidence must not be owned by the lifecycle of one User
-- row. Identities become nullable tombstones; private M6/M12 data keeps its
-- existing CASCADE lifecycle.

ALTER TABLE "SupervisionProcess"
  ADD COLUMN "supervisorErasedAt" TIMESTAMP(3),
  ALTER COLUMN "supervisorId" DROP NOT NULL;

ALTER TABLE "SupervisionParticipation"
  ADD COLUMN "userErasedAt" TIMESTAMP(3),
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "SupervisionSharedTopic"
  ADD COLUMN "authorSupervisorUserId" TEXT,
  ADD COLUMN "authorErasedAt" TIMESTAMP(3),
  ALTER COLUMN "authorParticipationId" DROP NOT NULL;

ALTER TABLE "SupervisionProcess"
  DROP CONSTRAINT "SupervisionProcess_supervisorId_fkey",
  ADD CONSTRAINT "SupervisionProcess_supervisorId_fkey"
    FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupervisionParticipation"
  DROP CONSTRAINT "SupervisionParticipation_userId_fkey",
  ADD CONSTRAINT "SupervisionParticipation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupervisionSharedTopic"
  DROP CONSTRAINT "SupervisionSharedTopic_authorParticipationId_fkey",
  ADD CONSTRAINT "SupervisionSharedTopic_authorParticipationId_fkey"
    FOREIGN KEY ("authorParticipationId") REFERENCES "SupervisionParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SupervisionSharedTopic_authorSupervisorUserId_fkey"
    FOREIGN KEY ("authorSupervisorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SupervisionSharedTopic"
  ADD CONSTRAINT "SupervisionSharedTopic_author_identity_check"
  CHECK (
    ("authorParticipationId" IS NOT NULL AND "authorSupervisorUserId" IS NULL)
    OR ("authorParticipationId" IS NULL AND "authorSupervisorUserId" IS NOT NULL)
    OR (
      "authorParticipationId" IS NULL
      AND "authorSupervisorUserId" IS NULL
      AND "authorErasedAt" IS NOT NULL
    )
  );

CREATE INDEX "SupervisionSharedTopic_authorSupervisorUserId_idx"
  ON "SupervisionSharedTopic"("authorSupervisorUserId");
