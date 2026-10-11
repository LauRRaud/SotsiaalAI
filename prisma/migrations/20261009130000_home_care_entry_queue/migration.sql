-- KODUTEENUS K1-e — võrguta kirje: kui kaua kirje ootas seadme järjekorras.
--
-- Aditiivne: üks nullitav veerg ilma vaikeväärtuseta (ainult kataloogimuudatus).
-- Eelmine rakenduse versioon valib veerud nimeliselt ja seda veergu ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareClientEntry" ADD COLUMN "deviceQueuedSec" INTEGER;

ALTER TABLE "CareClientEntry"
  ADD CONSTRAINT "CareClientEntry_device_queued_not_negative"
  CHECK ("deviceQueuedSec" IS NULL OR "deviceQueuedSec" >= 0) NOT VALID;

ALTER TABLE "CareClientEntry" VALIDATE CONSTRAINT "CareClientEntry_device_queued_not_negative";

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "CareClientEntry" DROP COLUMN IF EXISTS "deviceQueuedSec";
