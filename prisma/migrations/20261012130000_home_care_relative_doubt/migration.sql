-- KODUTEENUS K5-u — „klient ei mäleta, et lubas" (kava II.6.8).
--
-- Jagamiskokkulepe on kliendi oma. Kui klient ütleb hooldajale, et ta ei mäleta, et oleks
-- lubanud lähedasele midagi rääkida, märgib hooldaja selle lähedase rea juurde kahtluse. Kuni
-- hooldusjuht ei ole kokkulepet kliendiga üle küsinud (uus rida), räägitakse sellele
-- lähedasele ainult seda, kas käidi.
--
-- Aditiivne: kolm tühja lubavat veergu ja nende kooskõla tingimus; eelmine rakenduse
-- versioon neid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareClientRelative"
  ADD COLUMN "doubtAt" TIMESTAMP(3),
  ADD COLUMN "doubtByMembershipId" TEXT,
  ADD COLUMN "doubtByName" TEXT;

ALTER TABLE "CareClientRelative"
  ADD CONSTRAINT "CareClientRelative_doubt_check"
  CHECK (
    ("doubtAt" IS NULL AND "doubtByMembershipId" IS NULL AND "doubtByName" IS NULL)
    OR ("doubtAt" IS NOT NULL AND "doubtByName" IS NOT NULL)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "CareClientRelative" DROP CONSTRAINT IF EXISTS "CareClientRelative_doubt_check";
--   ALTER TABLE "CareClientRelative" DROP COLUMN IF EXISTS "doubtAt", DROP COLUMN IF EXISTS "doubtByMembershipId", DROP COLUMN IF EXISTS "doubtByName";
