-- KODUTEENUS K6-a — sõidupäevik (kava II.6.15, ehituse esimene samm).
--
-- Töötaja paneb iga töösõidu kirja läbisõidumõõdiku alg- ja lõppnäiduga; kilomeetrid on
-- näitude vahe. Päevik on isikliku auto hüvitise alus ja läheb raamatupidamisse, seepärast ei
-- ole eesmärgi real kliendi nime. Hüvitist siin ei arvutata.
--
-- Ridu ei muudeta ega kustutata: ekslik rida tühistatakse põhjusega.
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareTripEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "plate" TEXT,
    "startOdometer" INTEGER NOT NULL,
    "endOdometer" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retractedAt" TIMESTAMP(3),
    "retractedByMembershipId" TEXT,
    "retractReason" TEXT,

    CONSTRAINT "CareTripEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareTripEntry_organizationId_day_idx" ON "CareTripEntry"("organizationId", "day");
CREATE INDEX "CareTripEntry_organizationId_membershipId_day_idx" ON "CareTripEntry"("organizationId", "membershipId", "day");

ALTER TABLE "CareTripEntry"
  ADD CONSTRAINT "CareTripEntry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareTripEntry"
  ADD CONSTRAINT "CareTripEntry_vehicle_check" CHECK ("vehicle" IN ('OWN', 'ORG'));
ALTER TABLE "CareTripEntry"
  ADD CONSTRAINT "CareTripEntry_odometer_check"
  CHECK ("startOdometer" BETWEEN 0 AND 9999999 AND "endOdometer" BETWEEN 0 AND 9999999 AND "endOdometer" >= "startOdometer" AND "endOdometer" - "startOdometer" <= 2000);
ALTER TABLE "CareTripEntry"
  ADD CONSTRAINT "CareTripEntry_text_check"
  CHECK (
    "day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND char_length(btrim("purpose")) BETWEEN 1 AND 200
    AND ("plate" IS NULL OR char_length(btrim("plate")) BETWEEN 1 AND 12)
  );
-- Tühistuse väljad käivad koos.
ALTER TABLE "CareTripEntry"
  ADD CONSTRAINT "CareTripEntry_retract_check"
  CHECK (
    ("retractedAt" IS NULL AND "retractReason" IS NULL AND "retractedByMembershipId" IS NULL)
    OR ("retractedAt" IS NOT NULL AND "retractReason" IS NOT NULL AND char_length(btrim("retractReason")) BETWEEN 1 AND 200)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareTripEntry";
