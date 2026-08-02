-- TEENUSPÄEVIK — lähtekülastuse viide (Välitöö sild, leping 8.4).
--
-- Eeltäide tekitas `sourceFieldVisitId` juba varem, aga teda ei saadetud ega
-- salvestatud: ühest külastusest sai teha piiramatu arvu teenuskirjeid ja
-- miski ei näidanud, kust kirje tuli.
--
-- ADDITIIVNE. Olemasolevad read jäävad NULL-iks; PostgreSQL loeb NULL-e
-- unikaalindeksis üksteisest erinevaks, seega vana kood ja külastuseta kirjed
-- töötavad edasi piiranguta.
--
-- VÕÕRVÕTIT EI OLE TAHTLIKULT: külastus on eri säilitusega kui arve
-- alusdokument ja tema kustumine ei tohi teenuskirjet kaasa viia ega takistada.
ALTER TABLE "ServiceEntry" ADD COLUMN "sourceFieldVisitId" TEXT;

CREATE UNIQUE INDEX "ServiceEntry_providerProfileId_sourceFieldVisitId_key"
  ON "ServiceEntry" ("providerProfileId", "sourceFieldVisitId");
