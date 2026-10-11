-- KODUTEENUS K5-p — kuu lukustamine (kava II.6.10, kuu sulgemise kolmas samm).
--
-- Kui hooldusjuht on kuu üle vaadanud, lukustab ta selle. Lukk on kuu arvude hetktõmmis
-- (kliendi kaupa käigud ja aeg, töötajate aeg, ära jäänud käigud): pärast seda näitab kuu
-- kokkuvõte lukustatud arve, mitte jooksvat seisu, ja linnale lähevad samad numbrid, mida
-- hooldusjuht lukustades nägi. Päevikut lukk kinni ei pane; hilisemad kirjed ja parandused
-- loetakse rakenduses eraldi kokku.
--
-- Hetktõmmises on kliendi ID, mitte nimi. Ridu ei kustutata: uuesti avatud lukk saab
-- avamise aja, avaja ja põhjuse; uus lukustamine on uus rida.
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareMonthLock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "openItemCount" INTEGER NOT NULL DEFAULT 0,
    "lockedByMembershipId" TEXT,
    "lockedByName" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopenedAt" TIMESTAMP(3),
    "reopenedByMembershipId" TEXT,
    "reopenedByName" TEXT,
    "reopenReason" TEXT,

    CONSTRAINT "CareMonthLock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareMonthLock_organizationId_month_lockedAt_idx" ON "CareMonthLock"("organizationId", "month", "lockedAt");

-- Ühel kuul on korraga üks kehtiv lukk.
CREATE UNIQUE INDEX "CareMonthLock_active_key" ON "CareMonthLock"("organizationId", "month") WHERE "reopenedAt" IS NULL;

ALTER TABLE "CareMonthLock"
  ADD CONSTRAINT "CareMonthLock_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareMonthLock"
  ADD CONSTRAINT "CareMonthLock_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "CareMonthLock"
  ADD CONSTRAINT "CareMonthLock_open_count_check" CHECK ("openItemCount" >= 0);
-- Uuesti avamise väljad käivad koos: kas kõik tühjad või aeg, avaja nimi ja põhjus olemas.
ALTER TABLE "CareMonthLock"
  ADD CONSTRAINT "CareMonthLock_reopen_check"
  CHECK (
    ("reopenedAt" IS NULL AND "reopenedByMembershipId" IS NULL AND "reopenedByName" IS NULL AND "reopenReason" IS NULL)
    OR (
      "reopenedAt" IS NOT NULL
      AND "reopenedAt" >= "lockedAt"
      AND "reopenedByName" IS NOT NULL
      AND "reopenReason" IS NOT NULL
      AND char_length(btrim("reopenReason")) BETWEEN 1 AND 300
    )
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareMonthLock";
