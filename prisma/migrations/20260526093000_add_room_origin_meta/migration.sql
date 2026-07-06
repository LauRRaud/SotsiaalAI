-- Add descriptive room origin metadata. These fields are informational only;
-- room access remains controlled by RoomMember and existing billing/access logic.
ALTER TABLE "Room"
  ADD COLUMN IF NOT EXISTS "originType" TEXT,
  ADD COLUMN IF NOT EXISTS "originId" TEXT,
  ADD COLUMN IF NOT EXISTS "originLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "originMeta" JSONB;

CREATE INDEX IF NOT EXISTS "Room_originType_idx" ON "Room"("originType");
CREATE INDEX IF NOT EXISTS "Room_originId_idx" ON "Room"("originId");
