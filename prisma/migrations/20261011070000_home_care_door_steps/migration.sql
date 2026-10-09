-- KODUTEENUS K4-f — sammud „kui uks ei avane" (kava II.6.5).
--
-- Kliendiga lepitakse ette kokku, mida hooldaja teeb, kui uks ei avane: koputa
-- magamistoa aknale, helista naabrile, kellel on võti, helista pojale. Sammud on
-- kliendi juures kirjas tema enda sõnadega ja kindlas järjekorras. Ukse taga vajutab
-- hooldaja „Ei saa sisse", puudutab tehtud samme ja neist saab kellaaegadega
-- erijuhtumi kirje: sel hetkel ei pea ta midagi kirjutama.
--
-- Samme ei muudeta ega kustutata: uus loend lõpetab eelmise read (`endedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareDoorStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareDoorStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareDoorStep_clientId_endedAt_position_idx" ON "CareDoorStep"("clientId", "endedAt", "position");
CREATE INDEX "CareDoorStep_organizationId_idx" ON "CareDoorStep"("organizationId");

-- Kehtivas loendis on igal kohal üks samm.
CREATE UNIQUE INDEX "CareDoorStep_active_key" ON "CareDoorStep"("clientId", "position") WHERE "endedAt" IS NULL;

ALTER TABLE "CareDoorStep"
  ADD CONSTRAINT "CareDoorStep_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareDoorStep"
  ADD CONSTRAINT "CareDoorStep_position_check" CHECK ("position" BETWEEN 1 AND 8);
ALTER TABLE "CareDoorStep"
  ADD CONSTRAINT "CareDoorStep_text_check" CHECK (char_length(btrim("text")) BETWEEN 1 AND 200);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareDoorStep";
