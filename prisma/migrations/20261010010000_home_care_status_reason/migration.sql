-- KODUTEENUS K1-j — peatamise ja lõpetamise alus ning seisu ajalugu.
--
-- SKA koduteenuse juhend (18.06.2024, ptk 5) nimetab alused, mille korral teenus
-- peatatakse või lõpetatakse, ja ütleb, et takistuse kadumisel on inimesel taas
-- õigus teenusele. Seni oli kliendil ainult seis ja vaba märkus: alust ei saanud
-- valida ega lugeda ning uuesti avamine kirjutas eelmise lõpetamise üle.
--
-- Aditiivne: üks nullitav veerg ja üks uus tabel. Eelmine rakenduse versioon
-- veergu ei kirjuta ega loe; seepärast lubab veeru CHECK tühja väärtust iga seisu
-- juures ja seisu ning aluse sobivust kontrollib ainult uus tabel, kuhu kirjutab
-- ainult uus kood.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareClient" ADD COLUMN "statusReason" TEXT;

ALTER TABLE "CareClient"
  ADD CONSTRAINT "CareClient_statusReason_check" CHECK (
    "statusReason" IS NULL OR "statusReason" IN (
      'HOSPITAL', 'WITH_FAMILY', 'SAFETY',
      'NO_LONGER_NEEDED', 'MORE_CARE', 'DIED', 'MOVED', 'OWN_WISH', 'COOPERATION',
      'OTHER'
    )
  );

CREATE TABLE "CareClientStatusChange" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "actorMembershipId" TEXT,
    "actorName" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareClientStatusChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareClientStatusChange_clientId_changedAt_idx" ON "CareClientStatusChange"("clientId", "changedAt");
CREATE INDEX "CareClientStatusChange_organizationId_changedAt_idx" ON "CareClientStatusChange"("organizationId", "changedAt");

ALTER TABLE "CareClientStatusChange"
  ADD CONSTRAINT "CareClientStatusChange_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareClientStatusChange"
  ADD CONSTRAINT "CareClientStatusChange_status_check" CHECK (
    "fromStatus" IN ('ACTIVE', 'AWAY', 'ENDED') AND "toStatus" IN ('ACTIVE', 'AWAY', 'ENDED')
  );

-- Alus kuulub seisu juurde: aktiivsel ei ole, ära oleval ja lõppenul on alati.
-- `IS NOT NULL` on eraldi kirjas: ilma selleta annaks puuduv alus võrdluses NULL-i
-- ja CHECK laseks rea läbi.
ALTER TABLE "CareClientStatusChange"
  ADD CONSTRAINT "CareClientStatusChange_reason_check" CHECK (
    ("toStatus" = 'ACTIVE' AND "reason" IS NULL)
    OR ("toStatus" = 'AWAY' AND "reason" IS NOT NULL
      AND "reason" IN ('HOSPITAL', 'WITH_FAMILY', 'SAFETY', 'OTHER'))
    OR ("toStatus" = 'ENDED' AND "reason" IS NOT NULL
      AND "reason" IN ('NO_LONGER_NEEDED', 'MORE_CARE', 'DIED', 'MOVED', 'OWN_WISH', 'COOPERATION', 'OTHER'))
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareClientStatusChange";
--   ALTER TABLE "CareClient" DROP CONSTRAINT IF EXISTS "CareClient_statusReason_check";
--   ALTER TABLE "CareClient" DROP COLUMN IF EXISTS "statusReason";
