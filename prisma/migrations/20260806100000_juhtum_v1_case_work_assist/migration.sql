-- JUHTUM-V1 (CASEWORK-P7) — juhtumi objekt `CaseWorkAssist`.
--
-- Leping: docs/platvormi arendus/juhtum-v1-arendusleping.md (v6).
--
-- TÄIESTI ADDITIIVNE: neli uut enum'i, viis uut tabelit. Ühtegi olemasolevat
-- veergu ega rida ei puudutata. Ilma `CASEWORK_V1_ENABLED` liputa ei ole nendes
-- tabelites ühtki rida — funktsioon on deploy'tav enne aktiveerimisotsust.
--
-- VIIS ASJA, MIDA HILJEM LÕDVENDADA EI TOHI:
--
--   1. `CaseWorkItem` on TYPED-FK, mitte polümorfne `targetType + targetId`.
--      Sama põhjendus, mille `PreInquiry` skeemikommentaar juba kirja paneb:
--      „iga adressaadi-liik kannab oma võtit ja oma FK-d, muidu kaob
--      referentsiaalne terviklikkus." Polümorfse võtme puhul oleks lubadus
--      „ei jää rippuvat viidet" ainult nii tugev kui rakenduse kustutusteede
--      kaetus; `ON DELETE CASCADE` teeb temast ANDMEBAASI garantii, mis kehtib
--      ka otse-SQL kustutuse korral.
--
--   2. `CaseWorkMissingInfo.provenance` on TEKST, mitte enum. Päritolusõnastik
--      elab `lib/workspaces/provenance.js`-is (CASEWORK-P0) ja peab jääma ÜHEKS
--      tõeks — DB-enum tekitaks teise ja nõuaks sõnastiku muutmisel migratsiooni.
--      Sama põhjendus mis A4 `serviceKey`-l.
--
--   3. Kaks auditit on OMA tabelid, mitte `DataAuditLog`. `DataAuditLog` on
--      admini loetav (`app/api/admin/usage/*`), ja retention-põhjus ON juhtumi
--      sisu, mida admin lepingu järgi näha ei tohi. Mõlemad on APPEND-ONLY:
--      update- ja delete-rada ei ehitata.
--
--   4. Selles skeemis EI OLE ühtki ülekande- ega ülevaatuse seisu välja. Mustandi
--      ülekandeahel (8 elementi × 7 seisu) on CASEWORK-P2 ja on kolme otsuse taga
--      (O-CW-2/4/10). P7 on konteiner, mitte olekumasin.
--
--   5. `CaseWorkAssist`-il ei ole isikuvälju. Klient on kahe raja mustris, sama
--      mis `ServiceReferral`-il ja `NetworkShare`-il (omaniku otsus 04.08).
--
-- NELI CHECK-i `CaseWorkAssist`-il ja üks `CaseWorkItem`-il jõustavad
-- invariandid ANDMEBAASIS. Teenusekiht kontrollib neid ka ise, aga ainult selleks,
-- et kasutaja saaks arusaadava vea — terviklikkust kaitseb CHECK.

CREATE TYPE "CaseWorkRetentionState" AS ENUM ('ACTIVE', 'READ_ONLY', 'ARCHIVED');

CREATE TYPE "CaseWorkMissingInfoStatus" AS ENUM ('OPEN', 'RESOLVED', 'NOT_APPLICABLE');

CREATE TYPE "CaseWorkErasureActorKind" AS ENUM ('USER', 'SYSTEM');

CREATE TYPE "CaseWorkExternalSystem" AS ENUM ('STAR2');

CREATE TABLE "CaseWorkAssist" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "preInquiryId" TEXT,
    "urgentRequestId" TEXT,
    "clientUserId" TEXT,
    "clientDisplayName" TEXT,
    "clientExternalRef" TEXT,
    "clientErasedAt" TIMESTAMP(3),
    "externalSystem" "CaseWorkExternalSystem",
    "externalReference" TEXT,
    "nextContactAt" TIMESTAMP(3),
    "retentionState" "CaseWorkRetentionState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkAssist_pkey" PRIMARY KEY ("id"),

    -- Päritolu: maksimaalselt üks. Null on lubatud — juhtumi loob inimene ja tal
    -- ei pruugi olla ühtki pöördumist taga.
    CONSTRAINT "CaseWorkAssist_origin_chk" CHECK (
      num_nonnulls("preInquiryId", "urgentRequestId") <= 1
    ),

    -- Klient kahel rajal: kontoga klient VÕI miinimumkuju, mitte mõlemad.
    -- Mõlema puudumine on lubatud.
    CONSTRAINT "CaseWorkAssist_client_track_chk" CHECK (
      NOT ("clientUserId" IS NOT NULL
           AND ("clientDisplayName" IS NOT NULL OR "clientExternalRef" IS NOT NULL))
    ),

    -- STAR-i viide: mõlemad või kumbki. Poolik viide ei ütle midagi.
    CONSTRAINT "CaseWorkAssist_external_ref_chk" CHECK (
      ("externalSystem" IS NULL) = ("externalReference" IS NULL)
    ),

    -- Kustutatud kliendiviide: kõik kolm välja peavad olema tühjad. Peitmisest
    -- ei piisa, väärtused nullitakse päriselt.
    CONSTRAINT "CaseWorkAssist_client_erased_chk" CHECK (
      "clientErasedAt" IS NULL
      OR ("clientUserId" IS NULL AND "clientDisplayName" IS NULL AND "clientExternalRef" IS NULL)
    )
);

CREATE TABLE "CaseWorkItem" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "userDocumentId" TEXT,
    "agentArtifactId" TEXT,
    "fieldVisitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseWorkItem_pkey" PRIMARY KEY ("id"),

    -- Täpselt üks siht. Tühi seos ja mitmele objektile korraga viitav seos on
    -- mõlemad andmeviga, mitte kasutusjuht.
    CONSTRAINT "CaseWorkItem_exactly_one_target_chk" CHECK (
      num_nonnulls("userDocumentId", "agentArtifactId", "fieldVisitId") = 1
    )
);

CREATE TABLE "CaseWorkMissingInfo" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "status" "CaseWorkMissingInfoStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseWorkMissingInfo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseWorkRetentionAudit" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "fromState" "CaseWorkRetentionState" NOT NULL,
    "toState" "CaseWorkRetentionState" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseWorkRetentionAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseWorkClientErasureAudit" (
    "id" TEXT NOT NULL,
    "caseWorkAssistId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorKind" "CaseWorkErasureActorKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseWorkClientErasureAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseWorkAssist_ownerUserId_updatedAt_idx" ON "CaseWorkAssist"("ownerUserId", "updatedAt");

CREATE INDEX "CaseWorkAssist_ownerUserId_retentionState_updatedAt_idx" ON "CaseWorkAssist"("ownerUserId", "retentionState", "updatedAt");

CREATE INDEX "CaseWorkAssist_ownerUserId_nextContactAt_idx" ON "CaseWorkAssist"("ownerUserId", "nextContactAt");

CREATE INDEX "CaseWorkAssist_preInquiryId_idx" ON "CaseWorkAssist"("preInquiryId");

CREATE INDEX "CaseWorkAssist_urgentRequestId_idx" ON "CaseWorkAssist"("urgentRequestId");

CREATE INDEX "CaseWorkAssist_clientUserId_idx" ON "CaseWorkAssist"("clientUserId");

CREATE INDEX "CaseWorkItem_caseWorkAssistId_createdAt_idx" ON "CaseWorkItem"("caseWorkAssistId", "createdAt");

-- NULL-e ei loeta Postgresis võrdseks, seega need unikaalindeksid piiravad ainult
-- päris seoseid: sama dokumenti ei saa juhtumiga kaks korda siduda, aga mitu
-- artefaktiseost (kus `userDocumentId` on NULL) elavad kõrvuti.
CREATE UNIQUE INDEX "CaseWorkItem_caseWorkAssistId_userDocumentId_key" ON "CaseWorkItem"("caseWorkAssistId", "userDocumentId");

CREATE UNIQUE INDEX "CaseWorkItem_caseWorkAssistId_agentArtifactId_key" ON "CaseWorkItem"("caseWorkAssistId", "agentArtifactId");

CREATE UNIQUE INDEX "CaseWorkItem_caseWorkAssistId_fieldVisitId_key" ON "CaseWorkItem"("caseWorkAssistId", "fieldVisitId");

CREATE INDEX "CaseWorkMissingInfo_caseWorkAssistId_status_idx" ON "CaseWorkMissingInfo"("caseWorkAssistId", "status");

CREATE INDEX "CaseWorkMissingInfo_caseWorkAssistId_createdAt_idx" ON "CaseWorkMissingInfo"("caseWorkAssistId", "createdAt");

CREATE INDEX "CaseWorkRetentionAudit_caseWorkAssistId_createdAt_idx" ON "CaseWorkRetentionAudit"("caseWorkAssistId", "createdAt");

CREATE INDEX "CaseWorkRetentionAudit_ownerUserId_createdAt_idx" ON "CaseWorkRetentionAudit"("ownerUserId", "createdAt");

CREATE INDEX "CaseWorkClientErasureAudit_caseWorkAssistId_createdAt_idx" ON "CaseWorkClientErasureAudit"("caseWorkAssistId", "createdAt");

CREATE INDEX "CaseWorkClientErasureAudit_ownerUserId_createdAt_idx" ON "CaseWorkClientErasureAudit"("ownerUserId", "createdAt");

-- Omanik: CASCADE. Töötaja konto kustutus viib tema juhtumid kaasa.
ALTER TABLE "CaseWorkAssist" ADD CONSTRAINT "CaseWorkAssist_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Klient: SET NULL. Kliendi konto kustutus EI TOHI töötaja juhtumit hävitada.
-- NB see üksi ei määra `clientErasedAt`-i — seda teeb `eraseCaseClientReference()`,
-- mille konto kustutamise orkestreerija kutsub (leping L17).
ALTER TABLE "CaseWorkAssist" ADD CONSTRAINT "CaseWorkAssist_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Päritolu: SET NULL. Pöördumise kustutus ei hävita juhtumit, mis tema pealt algas.
ALTER TABLE "CaseWorkAssist" ADD CONSTRAINT "CaseWorkAssist_preInquiryId_fkey" FOREIGN KEY ("preInquiryId") REFERENCES "PreInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseWorkAssist" ADD CONSTRAINT "CaseWorkAssist_urgentRequestId_fkey" FOREIGN KEY ("urgentRequestId") REFERENCES "UrgentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseWorkItem" ADD CONSTRAINT "CaseWorkItem_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kolm sihti: CASCADE. Siin sünnib garantii „sihtobjekti kustutamine ei jäta
-- rippuvat viidet" — andmebaasis, mitte rakenduse kustutusteel.
ALTER TABLE "CaseWorkItem" ADD CONSTRAINT "CaseWorkItem_userDocumentId_fkey" FOREIGN KEY ("userDocumentId") REFERENCES "UserDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseWorkItem" ADD CONSTRAINT "CaseWorkItem_agentArtifactId_fkey" FOREIGN KEY ("agentArtifactId") REFERENCES "AgentArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseWorkItem" ADD CONSTRAINT "CaseWorkItem_fieldVisitId_fkey" FOREIGN KEY ("fieldVisitId") REFERENCES "FieldVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseWorkMissingInfo" ADD CONSTRAINT "CaseWorkMissingInfo_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseWorkRetentionAudit" ADD CONSTRAINT "CaseWorkRetentionAudit_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseWorkClientErasureAudit" ADD CONSTRAINT "CaseWorkClientErasureAudit_caseWorkAssistId_fkey" FOREIGN KEY ("caseWorkAssistId") REFERENCES "CaseWorkAssist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
