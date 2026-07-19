-- T21 P3 Meetodipeegel V1 (O-CW-3, analüüsidoc ptk 3). Puhtalt additiivne:
-- üks uus tabel, olemasolevaid ei muudeta.
--
-- PRIVATE on invariant, mitte veerg: tabelil EI OLE visibility-/jagamisvälju.
-- Jagatav ei ole kunagi kirje ise, vaid ainult deidentifitseeritud + kasutaja
-- kinnitatud tuletis (ptk 3.5) — see rada on eraldi töö ja tuleb oma tabeliga.
--
-- sourceKind/sourceId on viide ILMA välisvõtmeta: allika (artefakt,
-- eelpöördumine, kõne) kustumisel refleksioonikirje JÄÄB (ptk 3.3 „Seos").
-- Kustutus käib ainult omaniku konto kaskaadiga (ownerUserId FK).

CREATE TABLE "PracticeReflection" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "sourceKind" TEXT,
    "sourceId" TEXT,
    "approach" TEXT,
    "method" TEXT,
    "action" TEXT,
    "supportTechnique" TEXT,
    "choiceReason" TEXT,
    "methodCatalogRef" TEXT,
    "clientGoal" TEXT,
    "clientReaction" TEXT,
    "workerObservation" TEXT,
    "interpretation" TEXT,
    "whatWorked" TEXT,
    "whatDidNot" TEXT,
    "nextStep" TEXT,
    "supportNeed" TEXT,
    "interimOutcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeReflection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PracticeReflection_ownerUserId_createdAt_idx"
    ON "PracticeReflection"("ownerUserId", "createdAt");

CREATE INDEX "PracticeReflection_ownerUserId_sourceKind_sourceId_idx"
    ON "PracticeReflection"("ownerUserId", "sourceKind", "sourceId");

ALTER TABLE "PracticeReflection"
    ADD CONSTRAINT "PracticeReflection_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
