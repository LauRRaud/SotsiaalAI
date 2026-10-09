-- KODUTEENUS kiht 3, K3-c — töötaja puudumine ja käigu tähtsus.
--
-- Kui hooldaja haigestub, peab hooldusjuht nägema ühest kohast, mis käigud jäid katmata
-- ja millised neist peavad kindlasti täna toimuma. Selleks on kaks asja:
--
--   1. PUUDUMINE: töötaja, päevast päevani, liik. Liik ütleb ainult, kas puudumine oli
--      plaaniline või ootamatu; haigust ega muud põhjust siin ei küsita ega hoita.
--   2. KÄIGU TÄHTSUS käigumustri real (kava II.6.10): A peab toimuma täna, B võib samal
--      päeval nihkuda, C võib nädala sees nihkuda. Vaikimisi B.
--
-- Aditiivne: üks vaikeväärtusega veerg ja üks uus tabel. Eelmine rakenduse versioon
-- veergu ei kirjuta (jääb B) ega tabelit loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareVisitSlot" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'B';
ALTER TABLE "CareVisitSlot"
  ADD CONSTRAINT "CareVisitSlot_priority_check" CHECK ("priority" IN ('A', 'B', 'C'));

CREATE TABLE "CareAbsence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "fromDay" TEXT NOT NULL,
    "toDay" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareAbsence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareAbsence_organizationId_toDay_idx" ON "CareAbsence"("organizationId", "toDay");
CREATE INDEX "CareAbsence_membershipId_fromDay_idx" ON "CareAbsence"("membershipId", "fromDay");

-- Liikmesuse kadumisel kaob ka puudumine: ilma töötajata ei ole sellel tähendust.
ALTER TABLE "CareAbsence"
  ADD CONSTRAINT "CareAbsence_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareAbsence"
  ADD CONSTRAINT "CareAbsence_kind_check" CHECK ("kind" IN ('PLANNED', 'SUDDEN'));
-- Päevad kujul AAAA-KK-PP; lõpp ei ole enne algust.
ALTER TABLE "CareAbsence"
  ADD CONSTRAINT "CareAbsence_days_check" CHECK (
    "fromDay" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND "toDay" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND "toDay" >= "fromDay"
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareAbsence";
--   ALTER TABLE "CareVisitSlot" DROP CONSTRAINT IF EXISTS "CareVisitSlot_priority_check";
--   ALTER TABLE "CareVisitSlot" DROP COLUMN IF EXISTS "priority";
