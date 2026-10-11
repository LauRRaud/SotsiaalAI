-- KODUTEENUS K5-c — „Kuhu suunata" (kava II.3.7 punkt 5).
--
-- Klient küsib hooldajalt asju, mis ei ole hooldaja töö: kellele helistada, kui on mure,
-- kust saab abi. Sotsiaalkindlustusameti juhend ootab, et hooldaja oskaks inimese õigesse
-- kohta suunata. Loendit peab asutus ise: numbrid ja lahtiolekuajad muutuvad, seepärast
-- ei ole need koodis, vaid asutuse hooldusjuhi hallatavas loendis, mis on hooldajal
-- telefonis käepärast.
--
-- Ridu ei muudeta ega kustutata: uus loend lõpetab eelmise read (`endedAt`).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareReferralContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,

    CONSTRAINT "CareReferralContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareReferralContact_organizationId_endedAt_position_idx" ON "CareReferralContact"("organizationId", "endedAt", "position");

-- Kehtivas loendis on igal kohal üks rida.
CREATE UNIQUE INDEX "CareReferralContact_active_key" ON "CareReferralContact"("organizationId", "position") WHERE "endedAt" IS NULL;

ALTER TABLE "CareReferralContact"
  ADD CONSTRAINT "CareReferralContact_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareReferralContact"
  ADD CONSTRAINT "CareReferralContact_position_check" CHECK ("position" BETWEEN 1 AND 20);
ALTER TABLE "CareReferralContact"
  ADD CONSTRAINT "CareReferralContact_text_check"
  CHECK (
    char_length(btrim("name")) BETWEEN 1 AND 120
    AND ("phone" IS NULL OR char_length(btrim("phone")) BETWEEN 3 AND 40)
    AND ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 300)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareReferralContact";
