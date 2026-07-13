-- A2: composite index to support (originType, originId) room de-duplication lookups.
-- Non-unique on purpose. A partial UNIQUE index on non-null originId is deferred
-- until existing duplicate origin rooms have been audited (separate later step).

-- CreateIndex
CREATE INDEX "Room_originType_originId_idx" ON "Room"("originType", "originId");
