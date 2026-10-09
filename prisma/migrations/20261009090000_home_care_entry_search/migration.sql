-- KODUTEENUS K1-c — päeviku otsing sõnavormidega.
--
-- Aditiivne: kaks nullitavat veergu tabelis `CareClientEntry` (vaikeväärtuseta,
-- seega ainult kataloogimuudatus). Indeksit ei ole: otsing käib ühe kliendi
-- kirjete seas, mille leiab olemasolev indeks (clientId, occurredAt).
-- Eelmine rakenduse versioon valib veerud nimeliselt ja neid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareClientEntry" ADD COLUMN "searchText" TEXT,
ADD COLUMN "searchVersion" TEXT;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--
--   ALTER TABLE "CareClientEntry" DROP COLUMN IF EXISTS "searchText",
--     DROP COLUMN IF EXISTS "searchVersion";
