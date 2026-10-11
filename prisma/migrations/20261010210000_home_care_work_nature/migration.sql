-- KODUTEENUS kiht 3, K3-g — töö iseloom kliendi juures (kava II.6.3).
--
-- Märge kirjeldab TÖÖD selle kliendi juures, mitte inimest: füüsiliselt raske (tõstmine,
-- pesemine abivahendita), vaimselt kurnav, raske kodukeskkond (ahiküte, vee kandmine),
-- ainult kahekesi. Märke paneb hooldusjuht koos põhjuse ja ülevaatuse päevaga. Selle
-- põhjal loetakse raske töö märgiga klientide käike töötaja kaupa, et koormus jaguneks.
--
-- Rida ei kustutata ega muudeta: uus märge lõpetab eelmise (`endedAt`), nii on näha, mis
-- kehtis varem. Kliendil on korraga üks kehtiv märge (osaline unikaalindeks).
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareWorkNature" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kinds" TEXT[],
    "reason" TEXT NOT NULL,
    "reviewOn" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,
    "endedByName" TEXT,

    CONSTRAINT "CareWorkNature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareWorkNature_organizationId_endedAt_idx" ON "CareWorkNature"("organizationId", "endedAt");
CREATE INDEX "CareWorkNature_clientId_createdAt_idx" ON "CareWorkNature"("clientId", "createdAt");

-- Kliendil on korraga üks kehtiv märge.
CREATE UNIQUE INDEX "CareWorkNature_current_key" ON "CareWorkNature"("clientId") WHERE "endedAt" IS NULL;

ALTER TABLE "CareWorkNature"
  ADD CONSTRAINT "CareWorkNature_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vähemalt üks liik, ainult lubatud liigid. `IS NOT NULL` on kirjas, sest CHECK laseb NULL-i läbi.
ALTER TABLE "CareWorkNature"
  ADD CONSTRAINT "CareWorkNature_kinds_check" CHECK (
    "kinds" IS NOT NULL
    AND cardinality("kinds") BETWEEN 1 AND 4
    AND "kinds" <@ ARRAY['PHYSICAL', 'MENTAL', 'ENVIRONMENT', 'PAIR_ONLY']::TEXT[]
  );
ALTER TABLE "CareWorkNature"
  ADD CONSTRAINT "CareWorkNature_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 1 AND 500);
-- Ülevaatuse päev kujul AAAA-KK-PP või puudub.
ALTER TABLE "CareWorkNature"
  ADD CONSTRAINT "CareWorkNature_reviewOn_check" CHECK ("reviewOn" IS NULL OR "reviewOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareWorkNature";
