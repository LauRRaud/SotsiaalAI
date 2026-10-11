-- TEEKOND K1-f — paus ja lõpetamine: miks Teekond kõrvale pandi ja millal uuesti avati.
--
-- Aditiivne: üks uus tabel. Olemasolevaid tabeleid ei muudeta; eelmine rakenduse
-- versioon seda tabelit ei loe. Teekonna enda seis jääb samaks (ARCHIVED): rida
-- siin ütleb ainult, kas see on paus või lõpetamine. Read kaovad koos Teekonnaga.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "JourneyClosure" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "outcome" TEXT,
    "note" TEXT,
    "resumeOn" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopenedAt" TIMESTAMP(3),

    CONSTRAINT "JourneyClosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JourneyClosure_journeyId_closedAt_idx" ON "JourneyClosure"("journeyId", "closedAt");
CREATE INDEX "JourneyClosure_ownerUserId_closedAt_idx" ON "JourneyClosure"("ownerUserId", "closedAt");

ALTER TABLE "JourneyClosure"
  ADD CONSTRAINT "JourneyClosure_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Liik ja tulemus on rakenduse sõnastik; andmebaas hoiab vigase väärtuse eemal.
ALTER TABLE "JourneyClosure"
  ADD CONSTRAINT "JourneyClosure_kind_check" CHECK ("kind" IN ('PAUSED', 'FINISHED'));
-- Tulemus on lõpetamisel alati ja pausil mitte kunagi. `IS NOT NULL` on eraldi:
-- ilma selleta annaks puuduv tulemus võrdluses NULL-i ja CHECK laseks rea läbi.
ALTER TABLE "JourneyClosure"
  ADD CONSTRAINT "JourneyClosure_outcome_check" CHECK (
    ("kind" = 'FINISHED' AND "outcome" IS NOT NULL
      AND "outcome" IN ('RESOLVED', 'HELP_CONTINUES', 'OWN_WAY', 'CHANGED', 'UNRESOLVED'))
    OR ("kind" = 'PAUSED' AND "outcome" IS NULL)
  );
-- Jätkamise päev on ainult pausil, kalendripäevana.
ALTER TABLE "JourneyClosure"
  ADD CONSTRAINT "JourneyClosure_resumeOn_check" CHECK (
    "resumeOn" IS NULL OR ("kind" = 'PAUSED' AND "resumeOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  );
ALTER TABLE "JourneyClosure"
  ADD CONSTRAINT "JourneyClosure_reopenedAt_check" CHECK ("reopenedAt" IS NULL OR "reopenedAt" >= "closedAt");

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "JourneyClosure";
