-- conversation_run.sql
-- Loob/uuendab ConversationRun tabeli ning staatused (sh DELETED) ja isCrisis välja

-- Ohutu: loo enum, kui seda pole
DO $$
BEGIN
  CREATE TYPE "public"."RunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'ERROR', 'DELETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Ohutu: lisa väärtus DELETED, kui puudub
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'RunStatus' AND e.enumlabel = 'DELETED'
  ) THEN
    ALTER TYPE "public"."RunStatus" ADD VALUE 'DELETED';
  END IF;
END $$;

-- (Valikuline) mõni host loob selle indeksi vaikimisi; kui ei ole, pole hullu
DROP INDEX IF EXISTS "public"."VerificationToken_token_key";

-- Loo tabel, kui puudub (koos isCrisis veeruga)
CREATE TABLE IF NOT EXISTS "public"."ConversationRun" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      "public"."Role" NOT NULL,
  "text"      TEXT NOT NULL DEFAULT '',
  "sources"   JSONB,
  "status"    "public"."RunStatus" NOT NULL DEFAULT 'RUNNING',
  "isCrisis"  BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationRun_pkey" PRIMARY KEY ("id")
);

-- Kui tabel oli juba olemas, lisa isCrisis veerg (ohutult)
ALTER TABLE "public"."ConversationRun"
  ADD COLUMN IF NOT EXISTS "isCrisis" BOOLEAN NOT NULL DEFAULT FALSE;

-- Indeksid
CREATE INDEX IF NOT EXISTS "ConversationRun_userId_updatedAt_idx"
  ON "public"."ConversationRun" ("userId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ConversationRun_status_idx"
  ON "public"."ConversationRun" ("status");

CREATE INDEX IF NOT EXISTS "ConversationRun_userId_status_updatedAt_idx"
  ON "public"."ConversationRun" ("userId", "status", "updatedAt");

CREATE INDEX IF NOT EXISTS "ConversationRun_isCrisis_updatedAt_idx"
  ON "public"."ConversationRun" ("isCrisis", "updatedAt");

-- Välisvõti (ohutult)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ConversationRun_userId_fkey'
      AND table_schema = 'public'
      AND table_name = 'ConversationRun'
  ) THEN
    ALTER TABLE "public"."ConversationRun"
      ADD CONSTRAINT "ConversationRun_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
