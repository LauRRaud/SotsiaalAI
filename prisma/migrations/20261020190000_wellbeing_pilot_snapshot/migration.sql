-- TÖÖHEAOLU PILOODI KVARTALI HETKTÕMMIS (tööheaolu arendusettepanek ptk 8.22–8.23).
--
-- Piloodi vaataja näeb ainult lõppenud kvartaleid ja iga kvartal arvutatakse üks kord, esimesel
-- vaatamisel pärast kvartali lõppu. Kuu, kvartal ja aasta olid sisestikku ning sama periood muutus
-- päevast päeva; kahe päringu vahe andis väikese rühma (ka ühe inimese) vastused tagasi, kuigi kumbki
-- päring eraldi oli k-lävest üle. Külmutatud aruandel sellist vahet ei ole.
--
-- Ainult anonüümne koond (k-lävi ja lahtrisummutus on enne salvestust rakendatud): tabel ei viita
-- ühelegi kasutajale ega kirjele. `scopeKey` on piloodi id või `legacy` (pärandvaataja ilma skoobita);
-- piloodi kustutamine kustutab tema hetktõmmised.
--
-- Aditiivne: uus tabel, olemasolevaid tabeleid ega ridu ei muudeta ja eelmine rakenduse versioon seda
-- tabelit ei loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "WellbeingPilotSnapshot" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "pilotScopeId" TEXT,
    "roleGroup" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodQuarter" INTEGER NOT NULL,
    "dataset" JSONB NOT NULL,
    "offeredMeasures" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellbeingPilotSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WellbeingPilotSnapshot_scopeKey_roleGroup_periodYear_periodQuarter_key" ON "WellbeingPilotSnapshot"("scopeKey", "roleGroup", "periodYear", "periodQuarter");

CREATE INDEX "WellbeingPilotSnapshot_pilotScopeId_idx" ON "WellbeingPilotSnapshot"("pilotScopeId");

ALTER TABLE "WellbeingPilotSnapshot" ADD CONSTRAINT "WellbeingPilotSnapshot_pilotScopeId_fkey" FOREIGN KEY ("pilotScopeId") REFERENCES "WellbeingPilotScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE "WellbeingPilotSnapshot";
