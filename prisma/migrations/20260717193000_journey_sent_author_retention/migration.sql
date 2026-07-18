ALTER TABLE "PreInquiry"
  DROP CONSTRAINT "PreInquiry_authorId_fkey";

ALTER TABLE "PreInquiry"
  ALTER COLUMN "authorId" DROP NOT NULL,
  ADD COLUMN "authorErasedAt" TIMESTAMP(3);

ALTER TABLE "PreInquiry"
  ADD CONSTRAINT "PreInquiry_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
