-- T14 WELLBEING-V2 teine viil (WB-V2-P2), otsus TO-1: „paranda uue kirjena".
-- Puhtalt additiivne. Ühtegi olemasolevat rida ei kirjutata ümber, ühtegi veergu ei kustutata.
-- Kõigil olemasolevatel kirjetel jääb veerg NULL-iks ja nende käitumine ei muutu.

-- Parandus on UUS kirje, mis viitab parandatavale. Kirje vastuseid ei muudeta kunagi kohapeal
-- (UPDATE standardizedFields peal on tootepiir, mitte tehniline) — nii ei kirjutata mustri-
-- statistikat tagantjärele ümber.
ALTER TABLE "WellbeingRecord" ADD COLUMN "supersedesRecordId" TEXT;

-- UNIQUE, mitte tavaindeks: see teeb sidemest 1:1 ja tõkestab DB tasandil topeltparanduse.
-- Kaks parandust sama kirje peale jätaks koondisse kaks „kehtivat" versiooni (parandatav
-- märgitakse aggregationEligible=false, aga mõlemad parandused jääksid true) ja mustri-
-- statistika topeltloendaks — täpselt see, mille vastu TO-1 (c) valiti.
-- Postgres hoiab NULL-id unikaalindeksis eristuvana, seega piiramatu arv parandamata kirjeid
-- on lubatud; ahel A <- B <- C samuti (B parandab A, C parandab B).
CREATE UNIQUE INDEX "WellbeingRecord_supersedesRecordId_key" ON "WellbeingRecord"("supersedesRecordId");

-- SET NULL, mitte CASCADE: parandatava päris kustutamine (§19.8 lubadus) ei tohi kustutada
-- parandust ega jätta rippuvat viidet — parandus jääb alles ja loetavaks, side lihtsalt tühjeneb.
ALTER TABLE "WellbeingRecord" ADD CONSTRAINT "WellbeingRecord_supersedesRecordId_fkey"
  FOREIGN KEY ("supersedesRecordId") REFERENCES "WellbeingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
