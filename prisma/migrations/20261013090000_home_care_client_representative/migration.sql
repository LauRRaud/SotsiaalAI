-- KODUTEENUS K6-i — esindusõiguse kirje (kava II.6.9).
--
-- Lähedasel ei ole seadusest tulenevat õigust täisealise eest otsustada ega alla kirjutada:
-- selleks on vaja volitust või eestkostet. Seni oli kliendi juures lähedaste ring ja
-- jagamisaste, aga mitte seda, kes tohib kliendi eest lepingut sõlmida. Siin on see eraldi
-- kirje: kes, mis alusel (volikiri, eestkoste, muu), mis ulatuses, mis ajast mis ajani, kus on
-- dokumendi koopia ja mis päeval hooldusjuht dokumenti nägi.
--
-- Platvorm dokumenti ei hoia ega kontrolli selle ehtsust: kirje ütleb, mida hooldusjuht nägi.
-- Rida ei kustutata ega muudeta: muutunud või lõppenud õigus lõpetatakse ja vajadusel tehakse
-- uus rida. Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareClientRepresentative" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "basis" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "validFrom" TEXT,
    "validUntil" TEXT,
    "copyKept" TEXT,
    "checkedOn" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,
    "endedByName" TEXT,

    CONSTRAINT "CareClientRepresentative_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareClientRepresentative_organizationId_endedAt_idx" ON "CareClientRepresentative"("organizationId", "endedAt");
CREATE INDEX "CareClientRepresentative_clientId_endedAt_idx" ON "CareClientRepresentative"("clientId", "endedAt");

ALTER TABLE "CareClientRepresentative"
  ADD CONSTRAINT "CareClientRepresentative_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareClientRepresentative"
  ADD CONSTRAINT "CareClientRepresentative_basis_check" CHECK ("basis" IN ('POWER_OF_ATTORNEY', 'GUARDIANSHIP', 'OTHER'));
ALTER TABLE "CareClientRepresentative"
  ADD CONSTRAINT "CareClientRepresentative_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 120);
ALTER TABLE "CareClientRepresentative"
  ADD CONSTRAINT "CareClientRepresentative_scope_check" CHECK (char_length(btrim("scope")) BETWEEN 1 AND 300);
-- Päevad kujul AAAA-KK-PP; kehtivuse lõpp ei ole enne algust.
ALTER TABLE "CareClientRepresentative"
  ADD CONSTRAINT "CareClientRepresentative_days_check" CHECK (
    "checkedOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND ("validFrom" IS NULL OR "validFrom" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    AND ("validUntil" IS NULL OR "validUntil" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    AND ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" >= "validFrom")
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareClientRepresentative";
