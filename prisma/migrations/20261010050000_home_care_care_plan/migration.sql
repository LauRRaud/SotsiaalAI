-- KODUTEENUS kiht 2, K2-b — hoolduskava kliendi juures.
--
-- SHS § 18 lg 2 järgi määratakse koos inimese ja osutajaga kindlaks toimingud, mis
-- tagavad iseseisva toimetuleku kodus; SKA juhendi (18.06.2024, ptk 4.2) järgi ka
-- nende sagedus. Kava on versioonidena: hooldusjuht muudab mustandit ja kehtestab
-- selle; kehtestamine asendab eelmise kehtiva kava, mis jääb alles võrdluseks.
-- Kava read tulevad asutuse toimingute kataloogist (K2-a) ja kannavad toimingu nime
-- koopiat, et kava jääks loetavaks ka pärast toimingu ümbernimetamist.
--
-- Aditiivne: kaks uut tabelit. Eelmine rakenduse versioon neid ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CarePlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "goals" TEXT,
    "reviewOn" TEXT,
    "note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedByMembershipId" TEXT,
    "activatedByName" TEXT,
    "replacedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarePlan_clientId_number_key" ON "CarePlan"("clientId", "number");
CREATE INDEX "CarePlan_organizationId_status_reviewOn_idx" ON "CarePlan"("organizationId", "status", "reviewOn");
-- Kliendil on korraga kõige rohkem üks mustand ja üks kehtiv kava.
CREATE UNIQUE INDEX "CarePlan_clientId_draft_key" ON "CarePlan"("clientId") WHERE "status" = 'DRAFT';
CREATE UNIQUE INDEX "CarePlan_clientId_active_key" ON "CarePlan"("clientId") WHERE "status" = 'ACTIVE';

ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_status_check" CHECK ("status" IN ('DRAFT', 'ACTIVE', 'REPLACED'));
ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_number_check" CHECK ("number" >= 1);
ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_reviewOn_check" CHECK ("reviewOn" IS NULL OR "reviewOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
-- Seis ja ajatemplid käivad koos: mustand ei ole kehtestatud; kehtiv on kehtestatud ja
-- asendamata; asendatud on mõlemad.
ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_state_check" CHECK (
    ("status" = 'DRAFT' AND "activatedAt" IS NULL AND "replacedAt" IS NULL)
    OR ("status" = 'ACTIVE' AND "activatedAt" IS NOT NULL AND "replacedAt" IS NULL)
    OR ("status" = 'REPLACED' AND "activatedAt" IS NOT NULL AND "replacedAt" IS NOT NULL)
  );

CREATE TABLE "CarePlanLine" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "activityId" TEXT,
    "activityName" TEXT NOT NULL,
    "activityGroup" TEXT NOT NULL,
    "frequencyKind" TEXT NOT NULL,
    "frequencyCount" INTEGER,
    "frequencyNote" TEXT,
    "mode" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CarePlanLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CarePlanLine_planId_position_idx" ON "CarePlanLine"("planId", "position");
CREATE INDEX "CarePlanLine_clientId_idx" ON "CarePlanLine"("clientId");
CREATE INDEX "CarePlanLine_activityId_idx" ON "CarePlanLine"("activityId");
-- Üks rida toimingu kohta kavas.
CREATE UNIQUE INDEX "CarePlanLine_planId_activityId_key" ON "CarePlanLine"("planId", "activityId") WHERE "activityId" IS NOT NULL;

ALTER TABLE "CarePlanLine"
  ADD CONSTRAINT "CarePlanLine_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "CarePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Toimingut rakendus ei kustuta (arhiveerib). Asutuse kustutamisel kaovad nii kataloog
-- kui kavad; viide tühjeneb, et kustutuse järjekord ei takistaks, ja nime koopia jääb.
ALTER TABLE "CarePlanLine"
  ADD CONSTRAINT "CarePlanLine_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "CareActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CarePlanLine"
  ADD CONSTRAINT "CarePlanLine_activityGroup_check" CHECK ("activityGroup" IN (
    'SHOPPING', 'SERVICES_AND_ERRANDS', 'HEATING', 'HOME_SAFETY', 'HOUSEKEEPING', 'OTHER_HOME_HELP',
    'HYGIENE', 'NUTRITION', 'DRESSING', 'LAUNDRY', 'MEDICATION', 'ABILITY_MONITORING',
    'NETWORK', 'MENTAL_SUPPORT', 'ASSISTIVE_TECH', 'OTHER_PERSONAL_HELP'
  ));
ALTER TABLE "CarePlanLine"
  ADD CONSTRAINT "CarePlanLine_mode_check" CHECK ("mode" IN ('GUIDE', 'TOGETHER', 'ASSIST', 'FOR'));
-- Sagedus: „vajadusel" on ilma arvuta; päevas, nädalas ja kuus on kordade arv kohustuslik.
ALTER TABLE "CarePlanLine"
  ADD CONSTRAINT "CarePlanLine_frequency_check" CHECK (
    ("frequencyKind" = 'AS_NEEDED' AND "frequencyCount" IS NULL)
    OR ("frequencyKind" IN ('DAILY', 'WEEKLY', 'MONTHLY') AND "frequencyCount" IS NOT NULL
      AND "frequencyCount" BETWEEN 1 AND 60)
  );
ALTER TABLE "CarePlanLine"
  ADD CONSTRAINT "CarePlanLine_activityName_check" CHECK (char_length(btrim("activityName")) > 0);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CarePlanLine";
--   DROP TABLE IF EXISTS "CarePlan";
