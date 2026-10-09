-- TEEKOND K1-b — järgmised sammud: mida tehakse, kes teeb, mis ajaks ja kas tehtud.
--
-- Aditiivne: üks uus tabel. Olemasolevaid tabeleid ei muudeta; eelmine rakenduse
-- versioon seda tabelit ei loe. Read kaovad koos Teekonnaga (kaskaad), Teekond
-- omakorda koos kontoga.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "JourneyStep" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "doer" TEXT,
    "dueOn" TEXT,
    "state" TEXT NOT NULL DEFAULT 'TODO',
    "note" TEXT,
    "doneAt" TIMESTAMP(3),
    "clientActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JourneyStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JourneyStep_journeyId_state_idx" ON "JourneyStep"("journeyId", "state");
CREATE INDEX "JourneyStep_ownerUserId_state_dueOn_idx" ON "JourneyStep"("ownerUserId", "state", "dueOn");
CREATE UNIQUE INDEX "JourneyStep_ownerUserId_clientActionId_key" ON "JourneyStep"("ownerUserId", "clientActionId");

ALTER TABLE "JourneyStep"
  ADD CONSTRAINT "JourneyStep_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seis ja tähtaja kuju on rakenduse sõnastik; andmebaas hoiab vigase väärtuse eemal.
ALTER TABLE "JourneyStep"
  ADD CONSTRAINT "JourneyStep_state_check" CHECK ("state" IN ('TODO', 'DONE', 'DROPPED'));
ALTER TABLE "JourneyStep"
  ADD CONSTRAINT "JourneyStep_dueOn_check" CHECK ("dueOn" IS NULL OR "dueOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
-- Lõpetamise aeg on täpselt siis, kui samm ei ole enam tegemata.
ALTER TABLE "JourneyStep"
  ADD CONSTRAINT "JourneyStep_doneAt_check" CHECK (("state" = 'TODO') = ("doneAt" IS NULL));

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "JourneyStep";
