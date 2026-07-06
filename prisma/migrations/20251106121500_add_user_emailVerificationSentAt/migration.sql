-- Add missing optional column to align DB with prisma/schema.prisma
-- Safe and idempotent for Postgres

ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "emailVerificationSentAt" TIMESTAMP(3);

