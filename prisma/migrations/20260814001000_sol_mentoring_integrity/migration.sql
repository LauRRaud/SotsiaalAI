-- SOL-MENT-01: avalik kataloog loeb ainult admini kinnitatud snapshot'i.
ALTER TABLE "MentorProfile"
  ADD COLUMN "approvedSnapshot" JSONB,
  ADD COLUMN "approvedSnapshotAt" TIMESTAMP(3),
  ADD COLUMN "approvedSnapshotVisible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "consentEvidenceType" TEXT,
  ADD COLUMN "consentEvidenceRef" TEXT,
  ADD COLUMN "consentCapturedAt" TIMESTAMP(3);

UPDATE "MentorProfile"
SET "approvedSnapshot" = jsonb_build_object(
      'displayName', "displayName",
      'title', "title",
      'organization', "organization",
      'fields', to_jsonb("fields"),
      'topics', to_jsonb("topics"),
      'languages', to_jsonb("languages"),
      'formats', to_jsonb("formats"),
      'bioShort', "bioShort",
      'bioFull', "bioFull",
      'experienceSummary', "experienceSummary"
    ),
    "approvedSnapshotAt" = COALESCE("reviewedAt", "updatedAt"),
    "approvedSnapshotVisible" = ("status" = 'ACTIVE')
WHERE "userId" IS NOT NULL
  AND "status" IN ('ACTIVE', 'PAUSED');

-- SOL-MENT-04: paranduse mustand viitab algsele kandjale enne, kui algne
-- märgitakse asendatuks. Olemasolevad lõpetatud ahelad tagasitäidetakse.
ALTER TABLE "MentoringSummary" ADD COLUMN "correctionOfId" TEXT;

UPDATE "MentoringSummary" replacement
SET "correctionOfId" = original."id"
FROM "MentoringSummary" original
WHERE original."supersededById" = replacement."id";

ALTER TABLE "MentoringSummary"
  ADD CONSTRAINT "MentoringSummary_correctionOfId_fkey"
  FOREIGN KEY ("correctionOfId") REFERENCES "MentoringSummary"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MentoringSummary_correctionOfId_status_idx"
  ON "MentoringSummary"("correctionOfId", "status");
