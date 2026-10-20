-- ASUTUSE TUGIMEETMED (Tööheaolu „Minu tugivõimalused" teine osa, TO-6).
--
-- Asutus kirjeldab, milliseid tugimeetmeid ta töötajatele pakub (kataloog:
-- `lib/wellbeing/supportMeasureCatalog.js`) ja lühidalt, kuidas neid kasutada. Töötaja
-- „Minu tugivõimalused" on siis eeltäidetud. See on asutuse, mitte töötaja andmestik: tabel ei
-- viita ühelegi kasutajale ega liikmele; kes muutis, on organisatsiooni auditis.
--
-- Aditiivne: uus tabel, olemasolevaid tabeleid ega ridu ei muudeta ja eelmine rakenduse
-- versioon seda tabelit ei loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "OrganizationSupportMeasure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "measureKey" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSupportMeasure_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationSupportMeasure_organizationId_measureKey_key" ON "OrganizationSupportMeasure"("organizationId", "measureKey");

ALTER TABLE "OrganizationSupportMeasure" ADD CONSTRAINT "OrganizationSupportMeasure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE "OrganizationSupportMeasure";
