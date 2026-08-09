-- SOL-RAGADMIN-03 — ingest'i lukk muutub tingimuslikuks claim'iks koos lease'iga.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-RAGADMIN-03.
--
-- MIKS SEE MIGRATSIOON OLEMAS ON. Ingest kontrollis LOETUD objektilt, kas seis on
-- `INGESTING`, ja seadis seisu hiljem TINGIMUSETA `update`-iga. Kaks paralleelset
-- päringut läbisid mõlemad eelkontrolli ja käivitasid sama `doc_id` ingest'i.
-- Veel halvem oli katkestus: protsessi surm pärast seisu muutmist jättis rea
-- `INGESTING`-usse, staatuse sünkroniseerija SÄILITAS selle seisu alati ja iga
-- järgmine ingest blokeeriti — lukk ilma omanikuta ja ilma tähtajata.
--
-- MIDA VEERUD TEEVAD.
--   · `*ClaimId`   — ÜHE katse töö-ID. DB lõppseis kirjutatakse ainult siis, kui
--     rida kannab endiselt SEDA id-d; nii ei kirjuta hiline zombi üle tulemust,
--     mille vahepeal võttis keegi teine.
--   · `*ClaimedAt` — lease'i algus. Aegunud claim on VARASTATAV, seega lukk ei
--     saa enam igaveseks jääda.
--
-- MIKS `claimedAt IS NULL` LOETAKSE AEGUNUKS JA MIKS BACKFILL'I EI OLE. Enne seda
-- migratsiooni `INGESTING`-usse jäänud rida ei kanna lease'i ega saagi kanda —
-- väljamõeldud algusaeg oleks halvem kui puuduv, sest ta lükkaks taastumist
-- edasi. `NULL` = „omanikku ei ole teada" = kohe varastatav, seega vanad
-- ummikud lahenevad esimese uue ingest-katsega ilma andmeid puutumata.
--
-- MIKS CHECK ON AINULT PAARI PEALE. `claimId` ja `claimedAt` peavad käima koos:
-- pool-lease (id ilma ajata) oleks lukk, mille tähtaega ei saa arvutada. Küll ei
-- ole CHECK-i „claim tohib olla ainult INGESTING seisus": UUID-i ei kasutata
-- kunagi teist korda ja claim-värav laseb iga mitte-INGESTING rea läbi, seega
-- terminaalsele reale jäänud claim on müra, mitte viga. CHECK selle peale
-- muudaks iga sõltumatu seisu-kirjutaja (kaks CLI-skripti, reset,
-- sünkroniseerija) potentsiaalseks 500-ks — kaitse, mis lõhub rohkem kui hoiab.

-- AlterTable
ALTER TABLE "MunicipalityKovAdmin"
  ADD COLUMN "ingestClaimId"     TEXT,
  ADD COLUMN "ingestClaimedAt"   TIMESTAMP(3),
  ADD COLUMN "rtIngestClaimId"   TEXT,
  ADD COLUMN "rtIngestClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationAdmin"
  ADD COLUMN "ingestClaimId"   TEXT,
  ADD COLUMN "ingestClaimedAt" TIMESTAMP(3);

-- CHECK — lease käib paarina, kolm rada, sama reegel.
ALTER TABLE "MunicipalityKovAdmin"
  ADD CONSTRAINT "MunicipalityKovAdmin_ingest_claim_pair"
  CHECK (("ingestClaimId" IS NULL) = ("ingestClaimedAt" IS NULL));

ALTER TABLE "MunicipalityKovAdmin"
  ADD CONSTRAINT "MunicipalityKovAdmin_rt_ingest_claim_pair"
  CHECK (("rtIngestClaimId" IS NULL) = ("rtIngestClaimedAt" IS NULL));

ALTER TABLE "OrganizationAdmin"
  ADD CONSTRAINT "OrganizationAdmin_ingest_claim_pair"
  CHECK (("ingestClaimId" IS NULL) = ("ingestClaimedAt" IS NULL));
