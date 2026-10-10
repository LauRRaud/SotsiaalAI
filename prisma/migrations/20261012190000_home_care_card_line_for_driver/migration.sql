-- KODUTEENUS K5-y — püsikaardi rida „nähtav autojuhile" (kava II.6.14, variant A).
--
-- Autojuht ei ole platvormi kasutaja. Transpordikaardile lähevad ainult need püsikaardi
-- read, mille juurde hooldusjuht või meeskond on selle märke pannud (liikumisabi, kes avab
-- ukse, kellele helistada); ohud ja kokkulepped autojuhini ei jõua.
--
-- Aditiivne: üks vaikeväärtusega veerg; eelmine rakenduse versioon seda ei loe ja selle
-- kirjutatud read on märketa.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareClientCardLine" ADD COLUMN "forDriver" BOOLEAN NOT NULL DEFAULT false;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "CareClientCardLine" DROP COLUMN IF EXISTS "forDriver";
