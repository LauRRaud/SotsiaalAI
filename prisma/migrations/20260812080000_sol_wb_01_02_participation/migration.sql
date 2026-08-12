-- SOL-WB-01 (P1) ja SOL-WB-02 (P1) — üks juur: piloodikoond ei teadnud, KELLE
-- valimisse kirje kuulub, ja uskus selles küsimuses klienti.
--
-- MIS OLI. `WellbeingPilotScope` salvestab `scopeType`, `municipalityId` ja
-- `organizationId`, aga `buildWellbeingAggregateDataset()` ei näinud neist
-- ühtegi: WHERE koosnes `roleGroup`-ist, töövoost ja ajavahemikust. Ühe KOV-i
-- piloodi vaataja nägi seega sama rollirühma koondit KOGU platvormilt — ja
-- vastus kandis tema piloodi metaandmeid, mistõttu laiem valim näis kohaliku
-- asutuse tulemusena.
--
-- Ja `roleGroup` ise tuli `payload`-ist muutmata kujul. Liides saadab täna
-- fikseeritud `SOCIAL_WORKER`, aga otsekutse saab saata mida iganes. Iga
-- tööheaolu õigusega konto sai seega paigutada oma kirjed VÕÕRA piloodi
-- rollirühma, kasvatada selle signaale ja aidata valimil privaatsuskünnist
-- ületada. „Tõendatud organisatsiooniline mõõdik" oli enesedeklaratsioon.
--
-- MIKS ERALDI TABEL, MITTE VEERG KIRJE PEAL. §D8 on kõva piir: `WellbeingRecord`
-- ei saa organisatsiooni omandivõtit ega juhi nähtavust, ja seda hoiavad
-- lepingutestid. Auditi vastuvõtukriteerium lubab teise haru — „koond kasutab
-- eraldi osalusprojektsiooni". See tabel on tema. Lähtekirje ei muutu
-- organisatsiooni varaks: ta ei kanna ühtki organisatsiooni välja, tema omanik,
-- nähtavus ja kustutusrada ei muutu, ning juht ei saa ühtki uut lugemisteed.
-- Uus on ainult see, mille omandileping juba ette näeb: ANONÜÜMNE künnisega
-- kaitstud koond.
--
-- LINGITAVUST SEE EI LISA. Seos „kirje → tööandja" oli ka enne tuletatav
-- (`ownerUserId` → `OrganizationMembership` → `Organization`); siin ta
-- KÜLMUTATAKSE, et hilisem töökohavahetus ei kirjutaks mullust koondit ümber.
--
-- RIDA ON OLEMAS AINULT SIIS, KUI OSALUS ON TÕENDATUD (üks üheselt määratud
-- aktiivne liikmesus, `lib/wellbeing/recordScope.js`). `organizationId` ja
-- `roleGroup` on NOT NULL — poolikut osalust ei ole. Rea PUUDUMINE tähendab
-- „ei kuulu ühessegi piloodi valimisse" ja see on aus vaikeväärtus, mitte kadu:
-- vastupidine („kuulub kõigile") oleks täpselt see vale omistamine, mida
-- parandame.
--
-- BACKFILL'I EI OLE ja seda ei ole vaja: 12.08.2026 seisuga on tootmises
-- 0 `WellbeingRecord` rida, 0 pilooti ja 0 vaatajat (mõõdetud psql-iga enne
-- migratsiooni kirjutamist).
CREATE TABLE IF NOT EXISTS "WellbeingParticipation" (
  "recordId"       TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "municipalityId" TEXT,
  "roleGroup"      TEXT NOT NULL,
  "frozenAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WellbeingParticipation_pkey" PRIMARY KEY ("recordId")
);

-- Võõrvõti AINULT kirje külge ja kaskaadiga: projektsioon on kirje tuletis ega
-- tohi elada kirjest kauem (konto kustutus kaskaadib `WellbeingRecord` kaudu
-- edasi). Organisatsiooni külge võõrvõtit EI OLE — väärtus on snapshot ja
-- kustutatud organisatsioon ei tohi tõendit kaasa võtta ega kustutusel
-- blokeeruda. Sama muster mis `ServiceVisit.assignedOrganizationId`
-- (20260810160000) ja `WellbeingSupportShare.sourceRecordId`.
DO $$
BEGIN
  ALTER TABLE "WellbeingParticipation"
    ADD CONSTRAINT "WellbeingParticipation_recordId_fkey"
    FOREIGN KEY ("recordId") REFERENCES "WellbeingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "WellbeingParticipation_organizationId_roleGroup_idx"
  ON "WellbeingParticipation" ("organizationId", "roleGroup");

CREATE INDEX IF NOT EXISTS "WellbeingParticipation_municipalityId_roleGroup_idx"
  ON "WellbeingParticipation" ("municipalityId", "roleGroup");

-- MUUTUMATUS ON INVARIANT, MITTE LUBADUS (sama põhjendus mis SOL-ORG-01,
-- 20260810200000). Need väärtused ei ole tavalised andmeväljad: nad otsustavad,
-- KELLE juhtimisraportisse inimese signaal loetakse. Üks `update()` vales kohas
-- koliks kirje teise majja, ilma et ükski ühiktest seda näeks.
--
-- Keelatud on VÄÄRTUSE MUUTMINE pärast rea sündi, igas suunas. Rea LISAMINE ja
-- KUSTUTAMINE jäävad lubatuks: esimene on kirje sünd, teine kaskaad kirje
-- kustutamisel. Osalust ei saa MUUTA — ta saab kaduda ainult koos kirjega.
--
-- Parandusrada (TO-1 „paranda uue kirjena") ei puutu sellesse: ta loob UUE kirje
-- ja PÄRIB originaali osaluse, sest parandus kirjeldab sama hetke. Uus rida
-- sünnib kohe õige väärtusega, seega trigger teda ei näe.
CREATE OR REPLACE FUNCTION "wellbeing_participation_frozen"() RETURNS trigger AS $$
BEGIN
  IF NEW."organizationId" IS DISTINCT FROM OLD."organizationId"
     OR NEW."municipalityId" IS DISTINCT FROM OLD."municipalityId"
     OR NEW."roleGroup" IS DISTINCT FROM OLD."roleGroup"
     OR NEW."recordId" IS DISTINCT FROM OLD."recordId" THEN
    RAISE EXCEPTION
      'WellbeingParticipation is frozen at creation (record %, was %/%/%, tried %/%/%)',
      OLD."recordId",
      OLD."organizationId",
      coalesce(OLD."municipalityId", 'NULL'),
      OLD."roleGroup",
      NEW."organizationId",
      coalesce(NEW."municipalityId", 'NULL'),
      NEW."roleGroup";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "WellbeingParticipation_frozen" ON "WellbeingParticipation";

CREATE TRIGGER "WellbeingParticipation_frozen"
  BEFORE UPDATE ON "WellbeingParticipation"
  FOR EACH ROW EXECUTE FUNCTION "wellbeing_participation_frozen"();
