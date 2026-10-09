-- TEEKOND K1-d — inimese enda hinnang muutusele: algseis ja hilisemad märked.
--
-- Aditiivne: üks uus tabel. Olemasolevaid tabeleid ei muudeta; eelmine rakenduse
-- versioon seda tabelit ei loe. Read kaovad koos Teekonnaga (kaskaad).

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "JourneyAssessment" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "note" TEXT,
    "clientActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyAssessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JourneyAssessment_journeyId_createdAt_idx" ON "JourneyAssessment"("journeyId", "createdAt");
CREATE INDEX "JourneyAssessment_ownerUserId_createdAt_idx" ON "JourneyAssessment"("ownerUserId", "createdAt");
CREATE UNIQUE INDEX "JourneyAssessment_ownerUserId_clientActionId_key" ON "JourneyAssessment"("ownerUserId", "clientActionId");

ALTER TABLE "JourneyAssessment"
  ADD CONSTRAINT "JourneyAssessment_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aste on viieastmelise sõnalise skaala järjekorranumber.
ALTER TABLE "JourneyAssessment"
  ADD CONSTRAINT "JourneyAssessment_level_check" CHECK ("level" BETWEEN 1 AND 5);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "JourneyAssessment";
