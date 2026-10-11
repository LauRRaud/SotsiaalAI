-- KODUTEENUS K4-e — varud kliendi kodus (kava II.6.11).
--
-- Maal elava kliendi juures on küsimus sageli lihtne: kas küttepuid, joogivett ja toitu
-- jätkub järgmise käiguni. Hooldusjuht lülitab kliendi juures sisse varud, mida jälgitakse,
-- ja kirjutab, kes varu täiendamise eest vastutab. Igaüks, kes kliendi juures käib, märgib
-- varu seisu ühe puudutusega: piisav, hakkab lõppema või otsas. Lõppev ja otsas varu on
-- hooldusjuhi tähtaegade lehel koos vastutajaga.
--
-- Ravimivaru siin EI OLE: ravimitega seotud märked ootavad omaniku otsust.
--
-- Jälgitava varu rida ei kustutata (jälgimine lõpetatakse, `endedAt`); iga seisu märkimine
-- jätab muutmatu rea tabelisse `CareSupplyCheck`.
-- Aditiivne: kaks uut tabelit, eelmine rakenduse versioon neid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareClientSupply" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "state" TEXT,
    "stateNote" TEXT,
    "checkedAt" TIMESTAMP(3),
    "checkedByMembershipId" TEXT,
    "checkedByName" TEXT,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endedByMembershipId" TEXT,
    "endedByName" TEXT,

    CONSTRAINT "CareClientSupply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareClientSupply_organizationId_endedAt_state_idx" ON "CareClientSupply"("organizationId", "endedAt", "state");
CREATE INDEX "CareClientSupply_clientId_endedAt_idx" ON "CareClientSupply"("clientId", "endedAt");

-- Kliendi juures jälgitakse iga varu korraga ühe reaga.
CREATE UNIQUE INDEX "CareClientSupply_active_key" ON "CareClientSupply"("clientId", "kind") WHERE "endedAt" IS NULL;

ALTER TABLE "CareClientSupply"
  ADD CONSTRAINT "CareClientSupply_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareClientSupply"
  ADD CONSTRAINT "CareClientSupply_kind_check" CHECK ("kind" IN ('FIREWOOD', 'WATER', 'FOOD', 'HYGIENE'));
ALTER TABLE "CareClientSupply"
  ADD CONSTRAINT "CareClientSupply_responsible_check" CHECK (char_length(btrim("responsible")) BETWEEN 1 AND 200);
-- Seis puudub, kuni keegi ei ole seda märkinud; märgitud seisul on ka aeg.
ALTER TABLE "CareClientSupply"
  ADD CONSTRAINT "CareClientSupply_state_check" CHECK (
    ("state" IS NULL AND "checkedAt" IS NULL)
    OR ("state" IS NOT NULL AND "state" IN ('ENOUGH', 'LOW', 'OUT') AND "checkedAt" IS NOT NULL)
  );
ALTER TABLE "CareClientSupply"
  ADD CONSTRAINT "CareClientSupply_stateNote_check" CHECK ("stateNote" IS NULL OR char_length(btrim("stateNote")) BETWEEN 1 AND 200);

CREATE TABLE "CareSupplyCheck" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "note" TEXT,
    "checkedByMembershipId" TEXT,
    "checkedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareSupplyCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareSupplyCheck_supplyId_createdAt_idx" ON "CareSupplyCheck"("supplyId", "createdAt");
CREATE INDEX "CareSupplyCheck_organizationId_idx" ON "CareSupplyCheck"("organizationId");

ALTER TABLE "CareSupplyCheck"
  ADD CONSTRAINT "CareSupplyCheck_supplyId_fkey"
  FOREIGN KEY ("supplyId") REFERENCES "CareClientSupply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareSupplyCheck"
  ADD CONSTRAINT "CareSupplyCheck_state_check" CHECK ("state" IN ('ENOUGH', 'LOW', 'OUT'));
ALTER TABLE "CareSupplyCheck"
  ADD CONSTRAINT "CareSupplyCheck_note_check" CHECK ("note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 200);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareSupplyCheck";
--   DROP TABLE IF EXISTS "CareClientSupply";
