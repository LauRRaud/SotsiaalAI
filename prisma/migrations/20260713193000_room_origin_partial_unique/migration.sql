-- A2 hardening: enforce one room per confirmed singleton origin at the DB level.
--
-- Partial UNIQUE index. Prisma's schema DSL cannot express a partial unique
-- index, so this lives as a raw-SQL migration; the Prisma model keeps the
-- non-unique composite index "Room_originType_originId_idx". `migrate deploy`
-- and `migrate status` (used by db:migrate:check) do not diff against
-- schema.prisma, so this does not break production migrations. Local
-- `prisma migrate dev` may report drift — do NOT let it drop this index.
--
-- Scope: only non-null originId of the singleton origin types that are actually
-- created today. MANUAL_INVITE / UNKNOWN carry a null originId and are exempt
-- (NULLs are distinct in a unique index). JOURNEY is intentionally excluded
-- until a de-duplicating JOURNEY room-creation path exists.
--
-- Verified before creation (2026-07-13, read-only production audit): 0 existing
-- rooms carry a non-null originId, so this index covers 0 current rows and
-- cannot fail on existing duplicates. Re-run the read-only audit immediately
-- before deploying to production.

-- CreateIndex
CREATE UNIQUE INDEX "Room_origin_singleton_unique"
  ON "Room" ("originType", "originId")
  WHERE "originId" IS NOT NULL
    AND "originType" IN ('PRE_INQUIRY', 'SERVICE_PROVIDER_INQUIRY', 'HELP_MATCH');
